"""Eligibility is checked against current DB facts, never names or generated claims."""
from datetime import date, datetime, timezone
from urllib.parse import urlparse

SLOTS = {"morning": (540, 570), "afternoon": (780, 810), "evening": (1080, 1110)}

def url_ok(value):
    try:
        u = urlparse(value)
        return u.scheme == "https" and bool(u.hostname) and not u.username and not u.password
    except (TypeError, ValueError, AttributeError):
        return False

def current_review(fact, now=None):
    now = now or datetime.now(timezone.utc)
    try:
        start = datetime.fromisoformat(fact["verifiedAt"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(fact["reviewBy"].replace("Z", "+00:00"))
        return fact["status"] == "verified" and bool(start.tzinfo and end.tzinfo) and start <= now < end and url_ok(fact["sourceUrl"])
    except (KeyError, TypeError, ValueError, AttributeError):
        return False

def valid_intervals(intervals):
    return isinstance(intervals, list) and all(
        isinstance(i, list) and len(i) == 2 and all(type(v) is int for v in i)
        and 0 <= i[0] < i[1] <= 1440 for i in intervals)

def open_slots(place, visit_date, now=None):
    """Only holidays and opening hours. No reservation/last-order/additional gate."""
    h = place.get("openingHours", {})
    if not current_review(h, now):
        return []
    try:
        weekday = str(date.fromisoformat(visit_date).weekday())  # Monday=0, KST visit date
        overrides = h.get("dateOverrides", {})
        if not isinstance(overrides, dict):
            return []
        intervals = overrides[visit_date] if visit_date in overrides else h["weekly"][weekday]
        # Explicit [] is a closed day; missing hours are unknown, not 24-hour opening.
        if not valid_intervals(intervals):
            return []
        return [slot for slot, (start, end) in SLOTS.items()
                if any(a <= start and end <= b for a, b in intervals)]
    except (KeyError, TypeError, ValueError):
        return []

def verified_relations(place, artist_ids, now=None):
    result = []
    for e in place.get("artistEvidence", []):
        if not isinstance(e, dict) or not current_review(e, now):
            continue
        if (type(e.get("artistId")) is not int or e["artistId"] not in artist_ids
            or type(e.get("contentId")) is not int or e["contentId"] <= 0
            or e.get("poiId") != place.get("id")
            or e.get("action") not in ("MV", "CONTENT_VISIT", "SNS", "POPUP")
            or not all(isinstance(e.get(k), str) and e[k].strip()
                       for k in ("artistEvidence", "placeEvidence", "actionEvidence", "locator"))):
            continue
        result.append(e)
    return result

def cost_amount(place, now=None):
    c = place.get("cost", {})
    if (not current_review(c, now) or c.get("scope") != "per_person_visit"
        or type(c.get("amountKrw")) is not int or not 0 <= c["amountKrw"] <= 100_000_000
        or not isinstance(c.get("evidence"), str) or not c["evidence"].strip()):
        return None
    return c["amountKrw"]

def candidates(req, catalog, general=False, now=None):
    admitted = {}
    for identity, p in catalog.items():
        if not isinstance(p, dict) or p.get("visibility") != "PUBLIC" or p.get("id") != identity:
            continue
        amount = cost_amount(p, now)
        slots = open_slots(p, req.visitDate, now)
        evidence = verified_relations(p, req.artistIds, now)
        if amount is None or amount > req.budget["max"] or not slots:
            continue
        if req.artistIds and not general and not evidence:
            continue
        admitted[identity] = {**p, "allowedSlots": slots, "artistEvidence": evidence,
                              "visitCostKrw": amount,
                              "artistRelationStatus": "verified" if evidence and not general else "general",
                              "personalizedEligible": bool(evidence) and not general}
    return admitted

def check_budget(plan, budget):
    prices = [p["visitCostKrw"] for d in plan["itinerary"]
              for slot in SLOTS for p in d[slot]["places"]]
    total = sum(prices)
    return bool(prices) and budget["min"] <= total <= budget["max"], total

def select_scope(req, catalog):
    from fastapi import HTTPException
    exact = candidates(req, catalog)
    if exact or not req.artistIds:
        return exact, False
    general_candidates=candidates(req,catalog,general=True)
    if not general_candidates:
        return {}, False
    if not req.acknowledgeUnverifiedConditions:
        raise HTTPException(422, {"code": "consent_required",
            "message": "선택한 아티스트의 검증된 후보가 없습니다. 일반 코스 전환은 직접 동의해 주세요."})
    return general_candidates, True
