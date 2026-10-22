"""Admission policy tests without HTTP transport or an event-loop socket."""
from unittest.mock import Mock
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from src.api import public_itinerary as module

BODY = {'duration': '당일치기', 'regions': ['서울'], 'artists': ['BTS'], 'budget': {'min': 30000, 'max': 200000}, 'responseLocale': 'ja'}


@pytest.mark.parametrize('consent', [False, None])
def test_consent_policy_runs_before_any_await(monkeypatch, consent):
    monkeypatch.setattr(module.ai_runtime, 'authenticate', Mock())
    request = module.PublicItineraryRequest(**BODY, **({'acknowledgeUnverifiedConditions': consent} if consent is not None else {}))
    call = module.itinerary(request, 'fixture', '7')
    with pytest.raises(HTTPException) as error:
        call.send(None)
    assert error.value.status_code == 422
    assert error.value.detail['code'] == 'consent_required'


@pytest.mark.parametrize('change', [{'regions': ['부산']}, {'duration': '1박2일'}, {'regions': []}, {'regions': ['서울', '제주']}])
def test_unsupported_policy_precedes_generation(monkeypatch, change):
    monkeypatch.setattr(module.ai_runtime, 'authenticate', Mock())
    request = module.PublicItineraryRequest(**{**BODY, **change, 'acknowledgeUnverifiedConditions': True})
    with pytest.raises(HTTPException) as error:
        module.itinerary(request, 'fixture', '7').send(None)
    assert error.value.status_code == 422
    assert error.value.detail['code'] == 'unsupported_conditions'


@pytest.mark.parametrize('consent', ['true', 1, 'false'])
def test_consent_is_a_strict_boolean(consent):
    with pytest.raises(ValidationError):
        module.PublicItineraryRequest(**BODY, acknowledgeUnverifiedConditions=consent)


def test_explicit_consent_reaches_admission_with_conditions_intact(monkeypatch):
    class Admitted(Exception):
        pass
    async def admission():
        raise Admitted()
    monkeypatch.setattr(module.ai_runtime, 'authenticate', Mock())
    monkeypatch.setattr(module.ai_runtime, 'acquire_slot', admission)
    body = {**BODY, 'acknowledgeUnverifiedConditions': True}
    request = module.PublicItineraryRequest(**body)
    with pytest.raises(Admitted):
        module.itinerary(request, 'fixture', '7').send(None)
    assert request.model_dump() == {**body, 'purposes': []}
