"""Reproducible, read-only candidate audit. Never import old loaders or connect to DB."""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "dataset/source/kculture_media/kcisa_media_locations_2023.csv"
POLICY = "dataset/policies/artist-place-scope.json"


def normalize(value):
    # Identity suggestions only: no punctuation stripping, fuzzy match or group inheritance.
    return re.sub(r"\s+", " ", str(value or "").strip()).casefold()


def read_master(payload):
    """Public API export; do not pretend it includes unapproved DB rows."""
    data = payload.get("data", payload)
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise ValueError("master_requires_data_items")
    items = data["items"]
    if data.get("totalCount") != len(items):
        raise ValueError("master_incomplete_pagination")
    seen_ids, seen_slugs = set(), set()
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("master_invalid_item")
        identity = item.get("id", item.get("artistId", item.get("artist_id")))
        slug = item.get("slug")
        if not isinstance(identity, int) or isinstance(identity, bool) or identity <= 0:
            raise ValueError("master_invalid_artist_id")
        if not isinstance(slug, str) or not slug.strip():
            raise ValueError("master_missing_slug")
        if identity in seen_ids or normalize(slug) in seen_slugs:
            raise ValueError("master_duplicate_identity")
        seen_ids.add(identity)
        seen_slugs.add(normalize(slug))
    return items


def build_audit(rows, scope, source_sha, master=None):
    policy_items = scope["items"]
    slugs = [normalize(p["slug"]) for p in policy_items]
    if len(set(slugs)) != len(slugs):
        raise ValueError("duplicate_policy_slug")
    by_slug = {normalize(p["slug"]): p for p in policy_items}
    if master is None:
        targets = [dict(p, artistId="") for p in policy_items]
        basis = "source_seed_expected_not_live_db"
    else:
        targets = []
        for entry in master:
            slug = entry["slug"]
            known = by_slug.get(normalize(slug), {})
            targets.append(dict(
                known, slug=slug,
                artistId=entry.get("id", entry.get("artistId", entry.get("artist_id"))),
                displayName=entry.get("nameKo") or entry.get("name_ko") or slug,
                entityType=known.get("entityType", "unclassified"),
                candidateAliases=known.get("candidateAliases", []),
            ))
        basis = "approved_master_export_not_all_database_rows"
    alias_map = {}
    for target in targets:
        for alias in target["candidateAliases"]:
            key = normalize(alias)
            if key in alias_map and alias_map[key] != target["slug"]:
                raise ValueError("ambiguous_alias")
            alias_map[key] = target["slug"]
    candidates, extra, exact, counts = [], Counter(), {}, Counter()
    for number, row in enumerate(rows, 2):
        label = row["아티스트"].strip()
        slug = alias_map.get(normalize(label))
        if slug is None:
            extra[label] += 1
            continue
        counts[slug] += 1
        # Missing address is never merged, and same-name branches stay separate.
        name, address = row["장소명"].strip(), row["주소"].strip()
        key = (slug, normalize(name), normalize(address))
        if not address:
            key += (number,)
        if key in exact:
            exact[key]["sourceRows"].append(number)
            continue
        identity = hashlib.sha256(
            json.dumps([source_sha, *key], ensure_ascii=False).encode()
        ).hexdigest()[:24]
        candidate = dict(candidateId=identity, artistSlug=slug, artistId=next(
            p["artistId"] for p in targets if p["slug"] == slug),
            rawArtist=label, placeName=name, address=address, sourceRows=[number],
            mappingStatus="suggested_not_verified", relationStatus="U",
            relationType="UNKNOWN", sourceUrl="", hoursStatus="unknown",
            visitStatus="unknown", personalizedEligible=False)
        exact[key] = candidate
        candidates.append(candidate)
    overview = []
    for target in targets:
        selected = [c for c in candidates if c["artistSlug"] == target["slug"]]
        overview.append(dict(
            artist_id=target["artistId"], slug=target["slug"],
            canonical_name=target["displayName"], entity_type=target["entityType"],
            type_status="provisional_catalog_classification",
            candidate_rows=counts[target["slug"]], unique_candidates=len(selected),
            V=0, I=0, U=len(selected), relation_accuracy="",
            hours_verified_count=0, personalized_eligible_count=0,
            next_action="verify_identity_branch_relation_and_hours" if selected
            else "collect_from_official_artist_and_place_sources"))
    summary = dict(
        scopeBasis=basis, sourceSha256=source_sha, sourceRows=len(rows),
        rawArtistLabels=len({r["아티스트"].strip() for r in rows}),
        targetArtists=len(targets), artistsWithAliasCandidates=sum(
            p["candidate_rows"] > 0 for p in overview),
        matchedRawRows=sum(counts.values()), uniqueCandidateRelations=len(candidates),
        duplicateExtraRows=sum(counts.values())-len(candidates),
        outsideScopeRawRows=sum(extra.values()), outsideScopeLabels=len(extra),
        entityTypes=dict(Counter(p["entity_type"] for p in overview)),
        V=0, I=0, U=len(candidates),
        factAccuracy=None, verifiedCoverage=None,
        metricStatus="identity_mapping_and_factual_review_pending",
        rebuildDecision="not_determined_by_unreviewed_data",
        operationalDatabaseQueried=False,
    )
    return summary, overview, candidates, extra


def write_csv(path, records):
    if not records:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(records[0]), lineterminator="\n")
        writer.writeheader()
        for row in records:
            writer.writerow({k: json.dumps(v, ensure_ascii=False) if isinstance(v, list) else v
                             for k, v in row.items()})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--master-json", type=Path)
    args = parser.parse_args()
    raw = (ROOT / SOURCE).read_bytes()
    # Normalize platform checkout line endings to preserve Git-source reproducibility.
    canonical = raw.replace(b"\r\n", b"\n")
    sha = hashlib.sha256(canonical).hexdigest()
    rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
    scope = json.loads((ROOT / POLICY).read_text(encoding="utf-8"))
    master = read_master(json.loads(args.master_json.read_text(encoding="utf-8"))) if args.master_json else None
    summary, overview, candidates, extra = build_audit(rows, scope, sha, master)
    summary["sourceRevision"] = scope["sourceRevision"]
    summary["sourcePath"] = SOURCE
    summary["sourceHashMode"] = "sha256_utf8_lf"
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    write_csv(args.output / "artist-progress.csv", overview)
    write_csv(args.output / "relation-candidates.csv", candidates)
    write_csv(args.output / "outside-scope.csv",
              [dict(raw_artist=k, candidate_rows=v, status="expansion_candidate_only")
               for k, v in sorted(extra.items())])
    print(json.dumps(summary, ensure_ascii=True))


if __name__ == "__main__":
    main()
