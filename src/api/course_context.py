"""Short-lived, user-bound course references; never trust browser-supplied POIs.

The signed payload identifies an immutable course revision. Current catalog data
is re-read on every use, so revoked or changed evidence invalidates the reference.
No original Chroma data, credentials, or user messages are stored in the token.
"""
import base64
import hashlib
import hmac
import json
import os
import time
import uuid


def catalog_revision(catalog):
    fields = ('id', 'name', 'address', 'lat', 'lon', 'artist', 'names', 'sourceUrl',
              'coordinateSourceUrl', 'sourceSha256', 'reviewBy', 'evidenceGrade')
    stable = json.dumps({i: {k: p.get(k) for k in fields} for i, p in catalog.items()},
                        ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(stable.encode()).hexdigest()


def _key():
    key = os.environ.get('KRIDE_COURSE_SIGNING_KEY') or os.environ.get('KRIDE_INTERNAL_TOKEN', '')
    if len(key) < 32:
        raise RuntimeError('course_signing_unconfigured')
    return key.encode()


def _encode(data):
    return base64.urlsafe_b64encode(data).decode().rstrip('=')


def validate_signing_configuration():
    _key()


def issue_context(user, poi_ids, catalog, now=None):
    now = int(time.time() if now is None else now)
    if not poi_ids or len(poi_ids) > 24 or len(set(poi_ids)) != len(poi_ids):
        raise ValueError('invalid_course_ids')
    if any(i not in catalog for i in poi_ids):
        raise ValueError('invalid_course_ids')
    key = _key()
    record = {'v': 1, 'itineraryId': uuid.uuid4().hex, 'exp': now + 3600,
              'owner': hmac.new(key, ('course-owner:' + str(user)).encode(), hashlib.sha256).hexdigest(),
              'poiIds': poi_ids, 'catalogRevision': catalog_revision(catalog)}
    payload = _encode(json.dumps(record, sort_keys=True, separators=(',', ':')).encode())
    signature = _encode(hmac.new(key, ('course-v1:' + payload).encode(), hashlib.sha256).digest())
    return {'courseContext': payload + '.' + signature, 'itineraryId': record['itineraryId'],
            'catalogRevision': record['catalogRevision'], 'contextExpiresAt': record['exp']}


def resolve_context(token, user, catalog, now=None):
    now = int(time.time() if now is None else now)
    try:
        if not isinstance(token, str) or len(token) > 8000:
            raise ValueError()
        payload, signature = token.split('.')
        key = _key()
        expected = _encode(hmac.new(key, ('course-v1:' + payload).encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError()
        record = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        owner = hmac.new(key, ('course-owner:' + str(user)).encode(), hashlib.sha256).hexdigest()
        if (record.get('v') != 1 or record.get('owner') != owner or
                not isinstance(record.get('exp'), int) or not now < record['exp'] <= now + 3600 or
                record.get('catalogRevision') != catalog_revision(catalog)):
            raise ValueError()
        ids = record['poiIds']
        if not isinstance(ids, list) or not 1 <= len(ids) <= 24 or len(set(ids)) != len(ids):
            raise ValueError()
        return record, [catalog[i] for i in ids]
    except (ValueError, KeyError, TypeError, UnicodeError):
        raise ValueError('course_context_expired_or_changed') from None


def localized_place(place, locale):
    names = place.get('names', {})
    name = names.get(locale)
    # A display translation is not a new place; ID and coordinates stay fixed.
    if isinstance(name, dict):
        name = name.get('value') if name.get('status') == 'verified' else None
    elif locale != 'ko':
        name = None
    return {**place, 'name': name or place['name'], 'canonicalName': place['name'], 'displayName': name or place['name'],
            'displayLocale': locale, 'translationVerified': bool(name) or locale == 'ko'}


def scope_notice(locale):
    return {
        'en': 'General places in Seoul for a day trip. Artist connections, prices, opening hours and reservation availability are unverified. Check the official sources before visiting.',
        'ja': 'ソウルの日帰り向け一般スポットです。アーティストとの関係、料金、営業時間、予約の可否は未確認です。訪問前に公式情報をご確認ください。',
        'ko': '서울 당일치기 일반 장소입니다. 아티스트 연관·영업시간·가격·예약 가능 여부는 미확인입니다. 방문 전 공식 출처를 확인하세요.',
    }[locale]
