"""Keep legacy artist claims out of general-place recommendation evidence."""
import math
from urllib.parse import urlparse


def legacy_general_place(row, fetched_at):
    if not isinstance(row, dict):
        return None
    identity, name, address = row.get("contentId"), row.get("title"), row.get("addr")
    source = row.get("sourceUrl")
    if (isinstance(identity, bool) or not isinstance(identity, (str, int)) or
            not str(identity).strip() or
            not all(isinstance(v, str) and v.strip() for v in (name, address, source))):
        return None
    try:
        url = urlparse(source)
        if url.scheme not in ("http", "https") or not url.hostname or url.username or url.password:
            return None
        if isinstance(row.get("mapY"), bool) or isinstance(row.get("mapX"), bool):
            return None
        lat, lon = float(row["mapY"]), float(row["mapX"])
        if not (math.isfinite(lat) and math.isfinite(lon) and 33 <= lat <= 39 and 124 <= lon <= 132):
            return None
    except (ValueError, TypeError, KeyError):
        return None
    identity = "tour:" + str(identity)
    # A location URL and legacy APPROVED flag do not prove an artist relation.
    # Never use API fetch time as the factual review time.
    return dict(id=identity, poi_id=identity, name=name, address=address,
                lat=lat, lon=lon, sourceUrl=source, fetchedAt=fetched_at,
                artist="", artistRelationStatus="unverified",
                personalizedEligible=False, hoursStatus="unknown",
                visibility="PUBLIC", evidenceGrade="PUBLIC_CATALOG_LOCATION_ONLY")
