"""
build_ensemble_ranker.py — LightGBM vs XGBoost Ranker 학습 + MLflow/DagsHub
============================================================================
실행:
    python src/ml/build_ensemble_ranker.py

결과:
    - DagsHub 대시보드에서 비교 확인
    - models/ensemble_ranker.pkl 우승 모델 저장
    - .ai/memo/ensemble_comparison.md 비교 문서 생성
"""
from __future__ import annotations

import json
import os
import pickle
import sys
import time

import numpy as np
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# ── 프로젝트 루트 ────────────────────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, PROJECT_ROOT)

from src.ml.feature_engineering import compute_features, FEATURE_NAMES


# ══════════════════════════════════════════════════════════════════════════════
# 1. 학습 데이터 생성 (synthetic — AI-Hub 여행로그 기반)
# ══════════════════════════════════════════════════════════════════════════════
def generate_synthetic_data(n_queries: int = 200, n_candidates_per_query: int = 30) -> tuple:
    """
    Neo4j + ChromaDB에서 실제 POI를 가져와 synthetic 학습 데이터 생성.
    positive: Neo4j 아티스트 촬영지 (label=1)
    negative: 랜덤 POI (label=0, ratio ~1:3)
    """
    from src.api.rag_client import get_chroma, get_embedder, COLLECTION_MAP

    chroma = get_chroma()
    embedder = get_embedder()

    # 모든 POI 컬렉션에서 샘플 수집
    all_pois: list[dict] = []
    for col_name in set(COLLECTION_MAP.values()):
        try:
            col = chroma.get_collection(col_name)
            result = col.get(limit=500, include=["metadatas"])
            for meta in result["metadatas"]:
                meta["_collection"] = col_name
                all_pois.append(meta)
        except Exception:
            continue

    if not all_pois:
        print("[ensemble] ChromaDB에서 POI 로드 실패. 더미 데이터로 대체합니다.")
        return _generate_dummy_data(n_queries)

    print(f"[ensemble] {len(all_pois)} POIs from ChromaDB")

    # 쿼리 시나리오 생성
    sample_artists = ["BTS", "BLACKPINK", "SEVENTEEN", "EXO", "TWICE"]
    sample_regions = ["서울", "부산", "제주", "경주", "강원"]
    sample_purposes = ["kculture", "food", "nature", "history"]

    rng = np.random.default_rng(42)
    X_all, y_all, groups = [], [], []

    for qid in range(n_queries):
        artists = list(rng.choice(sample_artists, size=rng.integers(1, 3), replace=False))
        regions = list(rng.choice(sample_regions, size=1, replace=False))
        purposes = list(rng.choice(sample_purposes, size=rng.integers(1, 3), replace=False))
        budget = {"min": 30000, "max": 500000}

        # 후보 POI 샘플
        cand_indices = rng.choice(len(all_pois), size=min(n_candidates_per_query, len(all_pois)), replace=False)
        candidates = [all_pois[i] for i in cand_indices]

        neo4j_ids = set()
        artist_counts = {}
        chroma_sims = {}

        for poi in candidates:
            poi_name = poi.get("name", "")
            # synthetic relevance signal
            sim = rng.uniform(0.2, 0.95)
            chroma_sims[poi_name] = sim

            # positive if region matches AND high similarity
            is_pos = any(r in poi.get("address", "") for r in regions) and sim > 0.6
            if is_pos:
                neo4j_ids.add(poi_name)
                artist_counts[poi_name] = int(rng.integers(1, 5))

        for poi in candidates:
            feats = compute_features(
                poi=poi,
                neo4j_poi_ids=neo4j_ids,
                neo4j_artist_counts=artist_counts,
                chroma_similarities=chroma_sims,
                user_artists=artists,
                user_regions=regions,
                user_purposes=purposes,
                user_budget=budget,
            )
            poi_name = poi.get("name", "")
            label = 1 if poi_name in neo4j_ids else 0
            X_all.append(feats)
            y_all.append(label)
            groups.append(qid)

    return np.array(X_all), np.array(y_all), np.array(groups)


def _generate_dummy_data(n_queries: int) -> tuple:
    """ChromaDB 없을 때 더미 데이터"""
    rng = np.random.default_rng(42)
    X, y, groups = [], [], []
    for qid in range(n_queries):
        n_cand = rng.integers(10, 30)
        for _ in range(n_cand):
            feats = rng.uniform(0, 1, size=8).astype(np.float32)
            feats[6] = rng.uniform(0, 100)  # distance_km
            label = int(feats[0] > 0.5 and feats[2] > 0.5)
            X.append(feats)
            y.append(label)
            groups.append(qid)
    return np.array(X), np.array(y), np.array(groups)


# ══════════════════════════════════════════════════════════════════════════════
# 2. 평가 메트릭
# ══════════════════════════════════════════════════════════════════════════════
def ndcg_at_k(y_true: np.ndarray, y_pred: np.ndarray, groups: np.ndarray, k: int) -> float:
    """그룹별 NDCG@k 평균"""
    from sklearn.metrics import ndcg_score
    unique_groups = np.unique(groups)
    scores = []
    for g in unique_groups:
        mask = groups == g
        yt = y_true[mask]
        yp = y_pred[mask]
        if len(yt) < 2 or yt.sum() == 0:
            continue
        s = ndcg_score([yt], [yp], k=k)
        scores.append(s)
    return float(np.mean(scores)) if scores else 0.0


def recall_at_k(y_true: np.ndarray, y_pred: np.ndarray, groups: np.ndarray, k: int) -> float:
    """그룹별 Recall@k 평균"""
    unique_groups = np.unique(groups)
    scores = []
    for g in unique_groups:
        mask = groups == g
        yt = y_true[mask]
        yp = y_pred[mask]
        if yt.sum() == 0:
            continue
        top_k_idx = np.argsort(-yp)[:k]
        recall = yt[top_k_idx].sum() / yt.sum()
        scores.append(recall)
    return float(np.mean(scores)) if scores else 0.0


def map_at_k(y_true: np.ndarray, y_pred: np.ndarray, groups: np.ndarray, k: int) -> float:
    """그룹별 MAP@k 평균"""
    unique_groups = np.unique(groups)
    aps = []
    for g in unique_groups:
        mask = groups == g
        yt = y_true[mask]
        yp = y_pred[mask]
        if yt.sum() == 0:
            continue
        top_k_idx = np.argsort(-yp)[:k]
        hits = 0
        ap_sum = 0.0
        for rank, idx in enumerate(top_k_idx, 1):
            if yt[idx] == 1:
                hits += 1
                ap_sum += hits / rank
        aps.append(ap_sum / min(k, int(yt.sum())))
    return float(np.mean(aps)) if aps else 0.0


# ══════════════════════════════════════════════════════════════════════════════
# 3. 메인: 학습 + 비교
# ══════════════════════════════════════════════════════════════════════════════
def main():
    print("=" * 60)
    print(" K-Ride 앙상블 랭커: LightGBM vs XGBoost")
    print("=" * 60)

    # 데이터 생성
    print("\n[1/5] 학습 데이터 생성...")
    X, y, groups = generate_synthetic_data(n_queries=200)
    print(f"  총 샘플: {len(X)}, 양성: {y.sum()}, 음성: {(1-y).sum()}")

    # Train/Val/Test 분할 (쿼리 단위)
    unique_groups = np.unique(groups)
    rng = np.random.default_rng(42)
    rng.shuffle(unique_groups)

    n_train = int(len(unique_groups) * 0.7)
    n_val = int(len(unique_groups) * 0.2)

    train_groups = set(unique_groups[:n_train])
    val_groups = set(unique_groups[n_train:n_train + n_val])
    test_groups = set(unique_groups[n_train + n_val:])

    train_mask = np.isin(groups, list(train_groups))
    val_mask = np.isin(groups, list(val_groups))
    test_mask = np.isin(groups, list(test_groups))

    X_train, y_train, g_train = X[train_mask], y[train_mask], groups[train_mask]
    X_val, y_val, g_val = X[val_mask], y[val_mask], groups[val_mask]
    X_test, y_test, g_test = X[test_mask], y[test_mask], groups[test_mask]

    print(f"  Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")

    # group sizes (LightGBM/XGBoost 랭킹용)
    def get_group_sizes(g: np.ndarray) -> list[int]:
        _, counts = np.unique(g, return_counts=True)
        return counts.tolist()

    train_group_sizes = get_group_sizes(g_train)
    val_group_sizes = get_group_sizes(g_val)
    test_group_sizes = get_group_sizes(g_test)

    # DagsHub + MLflow 설정
    print("\n[2/5] MLflow/DagsHub 설정...")
    use_mlflow = False
    try:
        import dagshub
        import mlflow

        repo_owner = os.environ.get("DAGSHUB_REPO_OWNER", "")
        repo_name = os.environ.get("DAGSHUB_REPO_NAME", "kride-project")
        if repo_owner:
            dagshub.init(repo_owner=repo_owner, repo_name=repo_name, mlflow=True)
            mlflow.set_experiment("kride_ensemble_ranker")
            use_mlflow = True
            print(f"  MLflow 원격 추적 활성화: {repo_owner}/{repo_name}")
        else:
            print("  DAGSHUB_REPO_OWNER 미설정 → MLflow 로컬 모드")
            mlflow.set_experiment("kride_ensemble_ranker")
            use_mlflow = True
    except ImportError:
        print("  dagshub/mlflow 미설치 → 추적 생략")

    # ── LightGBM ──────────────────────────────────────────────────────────────
    print("\n[3/5] LightGBM LGBMRanker 학습...")
    lgbm_metrics = {}
    lgbm_model = None
    try:
        import lightgbm as lgb

        lgbm_ranker = lgb.LGBMRanker(
            objective="lambdarank",
            metric="ndcg",
            n_estimators=200,
            learning_rate=0.05,
            num_leaves=31,
            min_child_samples=5,
            random_state=42,
        )
        lgbm_ranker.fit(
            X_train, y_train,
            group=train_group_sizes,
            eval_set=[(X_val, y_val)],
            eval_group=[val_group_sizes],
            eval_metric="ndcg",
            eval_at=[5, 10],
            callbacks=[lgb.early_stopping(20), lgb.log_evaluation(50)],
        )

        # 테스트 평가
        lgbm_pred = lgbm_ranker.predict(X_test)
        lgbm_metrics = {
            "ndcg_5": ndcg_at_k(y_test, lgbm_pred, g_test, 5),
            "ndcg_10": ndcg_at_k(y_test, lgbm_pred, g_test, 10),
            "map_5": map_at_k(y_test, lgbm_pred, g_test, 5),
            "recall_5": recall_at_k(y_test, lgbm_pred, g_test, 5),
            "recall_10": recall_at_k(y_test, lgbm_pred, g_test, 10),
        }
        lgbm_model = lgbm_ranker
        print(f"  LightGBM: {lgbm_metrics}")

        if use_mlflow:
            with mlflow.start_run(run_name="lgbm_ranker"):
                mlflow.log_params({"model": "LGBMRanker", "n_estimators": 200, "lr": 0.05})
                mlflow.log_metrics(lgbm_metrics)
                mlflow.sklearn.log_model(lgbm_ranker, "model")

    except ImportError:
        print("  lightgbm 미설치 → 건너뜀")
    except Exception as e:
        print(f"  LightGBM 학습 실패: {e}")

    # ── XGBoost ───────────────────────────────────────────────────────────────
    print("\n[4/5] XGBoost XGBRanker 학습...")
    xgb_metrics = {}
    xgb_model = None
    try:
        import xgboost as xgb

        xgb_ranker = xgb.XGBRanker(
            objective="rank:ndcg",
            n_estimators=200,
            learning_rate=0.05,
            max_depth=6,
            random_state=42,
            tree_method="hist",
        )
        xgb_ranker.fit(
            X_train, y_train,
            group=train_group_sizes,
            eval_set=[(X_val, y_val)],
            eval_group=[val_group_sizes],
            verbose=50,
        )

        # 테스트 평가
        xgb_pred = xgb_ranker.predict(X_test)
        xgb_metrics = {
            "ndcg_5": ndcg_at_k(y_test, xgb_pred, g_test, 5),
            "ndcg_10": ndcg_at_k(y_test, xgb_pred, g_test, 10),
            "map_5": map_at_k(y_test, xgb_pred, g_test, 5),
            "recall_5": recall_at_k(y_test, xgb_pred, g_test, 5),
            "recall_10": recall_at_k(y_test, xgb_pred, g_test, 10),
        }
        xgb_model = xgb_ranker
        print(f"  XGBoost: {xgb_metrics}")

        if use_mlflow:
            with mlflow.start_run(run_name="xgb_ranker"):
                mlflow.log_params({"model": "XGBRanker", "n_estimators": 200, "lr": 0.05})
                mlflow.log_metrics(xgb_metrics)
                mlflow.sklearn.log_model(xgb_ranker, "model")

    except ImportError:
        print("  xgboost 미설치 → 건너뜀")
    except Exception as e:
        print(f"  XGBoost 학습 실패: {e}")

    # ── 비교 + 우승 모델 저장 ─────────────────────────────────────────────────
    print("\n[5/5] 비교 + 모델 저장...")

    winner_name = "none"
    winner_model = None

    if lgbm_metrics and xgb_metrics:
        if lgbm_metrics["ndcg_5"] >= xgb_metrics["ndcg_5"]:
            winner_name, winner_model = "lightgbm", lgbm_model
        else:
            winner_name, winner_model = "xgboost", xgb_model
    elif lgbm_metrics:
        winner_name, winner_model = "lightgbm", lgbm_model
    elif xgb_metrics:
        winner_name, winner_model = "xgboost", xgb_model

    if winner_model:
        models_dir = os.path.join(PROJECT_ROOT, "models")
        os.makedirs(models_dir, exist_ok=True)
        pkl_path = os.path.join(models_dir, "ensemble_ranker.pkl")
        with open(pkl_path, "wb") as f:
            pickle.dump({"model": winner_model, "type": winner_name, "features": FEATURE_NAMES}, f)
        print(f"  우승 모델: {winner_name} → {pkl_path}")

    # 비교 문서 생성
    memo_dir = os.path.join(PROJECT_ROOT, ".ai", "memo")
    os.makedirs(memo_dir, exist_ok=True)
    report = [
        "# 앙상블 랭커 비교: LightGBM vs XGBoost",
        "",
        f"데이터: {len(X)} 샘플, {len(np.unique(groups))} 쿼리",
        f"Split: Train {len(X_train)} / Val {len(X_val)} / Test {len(X_test)}",
        "",
        "## 테스트셋 결과",
        "",
        "| 메트릭 | LightGBM | XGBoost |",
        "|--------|----------|---------|",
    ]
    for metric in ["ndcg_5", "ndcg_10", "map_5", "recall_5", "recall_10"]:
        lg = lgbm_metrics.get(metric, "N/A")
        xg = xgb_metrics.get(metric, "N/A")
        lg_str = f"{lg:.4f}" if isinstance(lg, float) else lg
        xg_str = f"{xg:.4f}" if isinstance(xg, float) else xg
        report.append(f"| {metric} | {lg_str} | {xg_str} |")

    report.extend([
        "",
        f"**우승 모델**: {winner_name}",
        f"생성 시각: {time.strftime('%Y-%m-%d %H:%M:%S')}",
    ])

    doc_path = os.path.join(memo_dir, "ensemble_comparison.md")
    with open(doc_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report))
    print(f"  비교 문서: {doc_path}")
    print("\n완료!")


if __name__ == "__main__":
    main()
