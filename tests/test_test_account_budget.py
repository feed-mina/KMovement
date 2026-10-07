from concurrent.futures import ThreadPoolExecutor
import pytest
from src.api.itinerary_budget import reserve_budget

@pytest.fixture(autouse=True)
def budget(monkeypatch,tmp_path):
    for k,v in {'ITINERARY_BUDGET_DB':str(tmp_path/'budget.sqlite'),'ITINERARY_INPUT_USD_PER_M':'1','ITINERARY_OUTPUT_USD_PER_M':'1','ITINERARY_DAILY_USD':'5','ITINERARY_STANDARD_DAILY_USD':'1','KRIDE_AI_TEST_USERS':'7,8','ITINERARY_TEST_LIMIT_USERS':'7','ITINERARY_TEST_CALL_LIMIT':'100'}.items():
        monkeypatch.setenv(k,v)

def test_exception_is_account_specific_and_exact_boundary():
    for _ in range(100):reserve_budget('7',1,1)
    with pytest.raises(RuntimeError,match='exhausted'):reserve_budget('7',1,1)
    for _ in range(10):reserve_budget('8',1,1)
    with pytest.raises(RuntimeError,match='exhausted'):reserve_budget('8',1,1)

def test_global_money_limit_shared_with_test_accounts():
    reserve_budget('7',4_000_000,0)
    reserve_budget('8',1_000_000,0)
    with pytest.raises(RuntimeError,match='exhausted'):reserve_budget('7',1,0)

def test_standard_money_limit_not_raised_for_other_accounts():
    reserve_budget('8',1_000_000,0)
    with pytest.raises(RuntimeError,match='exhausted'):reserve_budget('8',1,0)
    reserve_budget('7',1_000_000,0)

def test_parallel_reservations_do_not_exceed_count():
    for _ in range(99):reserve_budget('7',1,0)
    def attempt(_):
        try:reserve_budget('7',1,0);return True
        except RuntimeError:return False
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(attempt,range(8)))==1

@pytest.mark.parametrize('setting,value',[('ITINERARY_TEST_LIMIT_USERS','9'),('ITINERARY_TEST_LIMIT_USERS','*'),('ITINERARY_TEST_CALL_LIMIT','0'),('ITINERARY_TEST_CALL_LIMIT','101'),('ITINERARY_TEST_CALL_LIMIT','unlimited'),('ITINERARY_DAILY_USD','6'),('ITINERARY_STANDARD_DAILY_USD','2')])
def test_invalid_exception_fails_closed(monkeypatch,setting,value):
    monkeypatch.setenv(setting,value)
    with pytest.raises(RuntimeError,match='test_budget_unconfigured'):reserve_budget('7',1,0)

def test_default_remains_ten_without_exception(monkeypatch):
    monkeypatch.delenv('ITINERARY_TEST_LIMIT_USERS')
    for _ in range(10):reserve_budget('7',1,0)
    with pytest.raises(RuntimeError,match='exhausted'):reserve_budget('7',1,0)

def test_missing_standard_setting_preserves_one_dollar(monkeypatch):
    monkeypatch.delenv('ITINERARY_STANDARD_DAILY_USD')
    reserve_budget('8',1_000_000,0)
    with pytest.raises(RuntimeError,match='exhausted'):reserve_budget('8',1,0)
