"""Read-only catalog reconciliation. No SQL, DB connection, ID allocation or place propagation."""
from __future__ import annotations
import argparse
import copy
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "dataset/policies/artist-catalog-expansion.json"


def key(value):
    if not isinstance(value, str) or not value.strip():
        return ""
    # No fuzzy matching or punctuation deletion: shared group/agency/channel is not identity.
    return re.sub(r"\s+", " ", value.strip()).casefold()


def names(item):
    aliases = item.get("aliases", [])
    if not isinstance(aliases, list) or not all(isinstance(v, str) and key(v) for v in aliases):
        raise ValueError("invalid_alias_list")
    return {key(v) for v in [item.get("slug"), item.get("displayName"),
            item.get("name"), item.get("nameKo"), item.get("nameEn"),
            item.get("name_ko"), item.get("name_en"), *item.get("aliases", [])] if key(v)}


def validate_live_master(payload):
    if not isinstance(payload, dict) or payload.get("masterScope") != "all_artists":
        raise ValueError("complete_master_including_unapproved_required")
    data = payload.get("data")
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise ValueError("master_items_required")
    items = data["items"]
    if (type(payload.get("allArtistCount")) is not int or
            payload["allArtistCount"] != len(items) or
            type(data.get("totalCount")) is not int or data["totalCount"] != len(items)):
        raise ValueError("incomplete_master")
    seen = set()
    result = []
    for source in items:
        if not isinstance(source, dict):
            raise ValueError("invalid_master_item")
        identity = source.get("id", source.get("artistId", source.get("artist_id")))
        if type(identity) is not int or identity <= 0 or identity in seen:
            raise ValueError("invalid_or_duplicate_artist_id")
        if not key(source.get("slug")):
            raise ValueError("missing_master_slug")
        approved = source.get("approvedYn", source.get("approved_yn"))
        if approved not in ("Y", "N"):
            raise ValueError("approval_state_required")
        seen.add(identity)
        result.append({**copy.deepcopy(source), "artistId": identity,
                       "approvedYn": approved})
    return result


def reconcile(policy, live_master=None, incoming=None):
    if policy.get("placePolicy") != "explicit_artist_only_no_group_or_channel_inheritance":
        raise ValueError("explicit_artist_place_policy_required")
    incoming = copy.deepcopy(policy["incoming"] if incoming is None else incoming)
    source_only = live_master is None
    basis = "source_seed_only_not_live_db" if source_only else "provided_all_artist_master"
    existing = copy.deepcopy(policy["retained"] if source_only else live_master)
    if not source_only:
        for retained in policy["retained"]:
            if not any(names(retained) & names(row) for row in existing):
                raise ValueError("expected_retained_artist_missing_from_live_master")
    records = []
    for entry in existing:
        slug = entry["slug"]
        # Scope aliases may enrich only a single, exact matching slug.
        scoped = [p for p in policy["retained"] if key(p["slug"]) == key(slug)]
        aliases = list(entry.get("aliases", []))
        if len(scoped) == 1:
            aliases += scoped[0]["aliases"]
        display = entry.get("displayName") or entry.get("nameKo") or entry.get("name_ko") or slug
        records.append(dict(
            recordKey="existing:" + str(entry.get("artistId") or slug),
            artistId=entry.get("artistId"), slug=slug, displayName=display,
            entityType=entry.get("entityType", "unclassified"),
            approvedYn=entry.get("approvedYn", ""),
            aliases=list(dict.fromkeys(aliases)), status="retained",
            idState="awaiting_live_id" if source_only else "observed_id_unchanged",
            inheritGroupPlaces=False, placeRelationsAdded=0))
    if len({r["recordKey"] for r in records}) != len(records):
        raise ValueError("duplicate_existing_identity")
    deferred = {key(p["name"]) for p in policy["deferred"]}
    decisions = []
    new_index = []
    for candidate in incoming:
        label = candidate.get("name")
        if not key(label):
            raise ValueError("empty_candidate_name")
        candidate_names = names(candidate)
        decision = dict(inputName=label, classification="", matchedArtistIds=[],
            matchedSlugs=[], proposedKey="", reason="", basis=basis,
            registrationState="not_applied", inheritGroupPlaces=False,
            placeRelationsAdded=0)
        if candidate.get("inheritGroupPlaces") is True:
            raise ValueError("group_place_inheritance_forbidden")
        matches = [r for r in records if names(r) & candidate_names]
        if key(label) in deferred:
            decision.update(classification="hold", reason="user_deferred_do_not_register")
        elif len(matches) > 1:
            decision.update(classification="hold", reason="ambiguous_existing_identities",
                matchedArtistIds=sorted(r["artistId"] for r in matches if r["artistId"] is not None),
                matchedSlugs=[r["slug"] for r in matches])
        elif len(matches) == 1:
            match = matches[0]
            if (candidate.get("entityType") and match["entityType"] != "unclassified"
                    and candidate["entityType"] != match["entityType"]):
                decision.update(classification="hold", reason="entity_type_conflict")
            else:
                decision.update(classification="duplicate",
                    reason="existing_name_match_confirm_identity_no_new_id",
                    matchedArtistIds=[match["artistId"]] if match["artistId"] is not None else [],
                    matchedSlugs=[match["slug"]], proposedKey=match["recordKey"])
        else:
            batch_matches = [r for r in new_index if r["names"] & candidate_names]
            if len(batch_matches) > 1:
                decision.update(classification="hold", reason="ambiguous_new_batch_aliases")
            elif batch_matches:
                decision.update(classification="duplicate", reason="same_new_batch_identity_no_new_id",
                                proposedKey=batch_matches[0]["recordKey"])
            else:
                proposal = "proposal:" + hashlib.sha256(key(label).encode()).hexdigest()[:20]
                decision.update(classification="new", reason="no_name_match_candidate_not_verified_identity",
                                proposedKey=proposal)
                new_index.append(dict(recordKey=proposal, names=candidate_names, candidate=candidate))
        decisions.append(decision)
    for new in new_index:
        candidate = new["candidate"]
        records.append(dict(recordKey=new["recordKey"], artistId=None, slug="",
            displayName=candidate["name"], entityType=candidate.get("entityType", "unclassified"),
            approvedYn="", aliases=candidate.get("aliases", []), status="new_candidate",
            idState="not_allocated", inheritGroupPlaces=False, placeRelationsAdded=0))
    counts = Counter(d["classification"] for d in decisions)
    summary = dict(basis=basis, retainedCount=len(existing), incomingCount=len(incoming),
        duplicateCount=counts["duplicate"], newCount=counts["new"], holdCount=counts["hold"],
        deferredOutsideIncoming=len(policy["deferred"]), combinedPlannedCount=len(records),
        operationalIdsObserved=not source_only, databaseModified=False,
        registrationApplied=False, existingIdsReassigned=0, groupPlaceRelationsInherited=0,
        placeRelationsAdded=0, unresolvedIdentityReview=True)
    return summary, records, decisions


def write_csv(path, records):
    if not records:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(records[0]), lineterminator="\n")
        writer.writeheader()
        for row in records:
            writer.writerow({k: json.dumps(v, ensure_ascii=False) if isinstance(v, list)
                             else "" if v is None else v for k, v in row.items()})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--master-json", type=Path)
    args = parser.parse_args()
    policy = json.loads(POLICY.read_text(encoding="utf-8"))
    master = validate_live_master(json.loads(args.master_json.read_text(encoding="utf-8"))) if args.master_json else None
    summary, records, decisions = reconcile(policy, master)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output/"summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2)+"\n",encoding="utf-8")
    write_csv(args.output/"combined-catalog.csv", records)
    write_csv(args.output/"new-name-decisions.csv", decisions)
    write_csv(args.output/"deferred-names.csv", policy["deferred"])
    print(json.dumps(summary, ensure_ascii=True))


if __name__ == "__main__":
    main()
