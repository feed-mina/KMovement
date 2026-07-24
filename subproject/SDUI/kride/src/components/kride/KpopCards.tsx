'use client';
import { useId, useState } from "react";

type CardProps = {
  data?: Record<string, any>;
  meta?: Record<string, any>;
  onAction?: (meta: Record<string, any>, data?: Record<string, any>) => void;
};

const displayName = (data?: Record<string, any>) =>
  data?.nameKo || data?.name_ko || data?.nameEn || data?.name || "K-POP";

async function postJson(url: string, method = "POST") {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(String(res.status));
  }
  return res.json();
}

export function ArtistCard({ data, meta, onAction }: CardProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [status, setStatus] = useState("");
  const [followed, setFollowed] = useState(Boolean(data?.followed));
  const [busy, setBusy] = useState(false);
  const name = displayName(data);
  const imageUrl = data?.imageUrl || data?.image_url;

  const follow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await postJson(`/api/v1/kpop/artists/${data?.id}/follow`, followed ? "DELETE" : "POST");
      setFollowed((current) => !current);
      setStatus(followed ? "팔로우를 취소했습니다." : "팔로우했습니다.");
    } catch {
      setStatus("로그인 후 팔로우할 수 있습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="kpop-card" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <div className="kpop-card-image">
        {imageUrl ? (
          <img src={imageUrl} alt={`${name} 아티스트 프로필 이미지`} />
        ) : (
          <span role="img" aria-label={`${name} 프로필 이미지 없음`}>{name.slice(0, 1)}</span>
        )}
      </div>
      <div className="kpop-card-body">
        <p className="kpop-eyebrow">아티스트</p>
        <h3 id={titleId}>{name}</h3>
        <p id={descriptionId}>{data?.profile || "이벤트, 팬 동선, 근거가 확인된 상품 후보를 모아보세요."}</p>
        <button
          type="button"
          aria-label={`${name} 상세 보기`}
          onClick={() => onAction?.({ ...meta, actionType: "ROUTE", actionUrl: `/kpop/artists?artistId=${data?.id}` }, data)}
        >
          상세 보기
        </button>
        <button type="button" aria-pressed={followed} aria-busy={busy} disabled={busy} onClick={follow}>
          {busy ? "처리 중…" : followed ? "팔로우 취소" : "팔로우"}
        </button>
        {status ? <small role="status" aria-live="polite" aria-atomic="true">{status}</small> : null}
      </div>
    </article>
  );
}

export function EventCard({ data, meta, onAction }: CardProps) {
  const titleId = useId();
  const detailId = useId();
  const evidenceId = useId();
  const [status, setStatus] = useState("");
  const [bookmarked, setBookmarked] = useState(Boolean(data?.bookmarked));
  const [busy, setBusy] = useState(false);
  const title = data?.titleKo || data?.title_ko || data?.titleEn || data?.title || "K-POP event";

  const bookmark = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // 팔로우와 동일한 토글: 저장된 상태에서 다시 누르면 DELETE로 해제한다.
      await postJson(`/api/v1/kpop/events/${data?.id}/bookmark`, bookmarked ? "DELETE" : "POST");
      setBookmarked((current) => !current);
      setStatus(bookmarked ? "일정 저장을 취소했습니다." : "일정을 저장했습니다.");
    } catch {
      setStatus("로그인 후 일정을 저장할 수 있습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="kpop-card kpop-event-card" aria-labelledby={titleId} aria-describedby={`${detailId} ${evidenceId}`}>
      <div className="kpop-card-body">
        <p className="kpop-eyebrow">{data?.artistNameKo || data?.artistName || "Event"}</p>
        <h3 id={titleId}>{title}</h3>
        <p id={detailId}>{[data?.region, data?.venue, data?.date].filter(Boolean).join(" · ") || "장소와 일정 확인 중"}</p>
        <p className="kpop-evidence kpop-evidence-note" id={evidenceId} role="note">
          <strong>출처 안내:</strong> 공식 또는 운영 검수 완료 링크만 신뢰할 수 있는 정보로 확인해 주세요.
        </p>
        <button
          type="button"
          aria-label={`${title} 상세 보기`}
          onClick={() => onAction?.({ ...meta, actionType: "ROUTE", actionUrl: `/kpop/event?eventId=${data?.id}` }, data)}
        >
          상세 보기
        </button>
        <button type="button" aria-pressed={bookmarked} aria-busy={busy} disabled={busy} onClick={bookmark}>
          {busy ? "저장 중…" : bookmarked ? "일정 저장 취소" : "일정 저장"}
        </button>
        {status ? <small role="status" aria-live="polite" aria-atomic="true">{status}</small> : null}
      </div>
    </article>
  );
}
