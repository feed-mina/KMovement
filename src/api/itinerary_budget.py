"""Persistent conservative budget reservations; failed calls retain their reserve."""
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

def _test_limits():
    """Server-only, explicit account exceptions; callers cannot request a tier."""
    users={x.strip() for x in os.environ.get('ITINERARY_TEST_LIMIT_USERS','').split(',') if x.strip()}
    allowed={x.strip() for x in os.environ.get('KRIDE_AI_TEST_USERS','').split(',') if x.strip()}
    if not users:
        return users,10
    if not users <= allowed or any(not x.isascii() or not x.isdigit() for x in users):
        raise RuntimeError('test_budget_unconfigured')
    try:
        limit=int(os.environ.get('ITINERARY_TEST_CALL_LIMIT','10'))
    except ValueError:
        raise RuntimeError('test_budget_unconfigured') from None
    if not 1 <= limit <= 100:
        raise RuntimeError('test_budget_unconfigured')
    return users,limit

def reserve_budget(identity, input_bytes, max_output):
    values=[float(os.environ.get(k,'0')) for k in ('ITINERARY_INPUT_USD_PER_M','ITINERARY_OUTPUT_USD_PER_M','ITINERARY_DAILY_USD')]
    if not all(0 < v < 1000 for v in values):raise RuntimeError('budget_unconfigured')
    input_price,output_price,daily=values
    test_users,test_limit=_test_limits()
    standard_daily=float(os.environ.get('ITINERARY_STANDARD_DAILY_USD',str(min(daily,1) if test_users else daily)))
    if not 0 < standard_daily <= daily:raise RuntimeError('budget_unconfigured')
    if test_users and (daily>5 or standard_daily>1):raise RuntimeError('test_budget_unconfigured')
    call_limit=test_limit if identity in test_users else 10
    # UTF-8 byte count is a conservative token upper bound for this tokenizer family.
    reserve=(input_bytes*input_price+max_output*output_price)/1_000_000
    path=os.environ.get('ITINERARY_BUDGET_DB','')
    if not path:raise RuntimeError('budget_storage_unconfigured')
    Path(path).parent.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(path,timeout=5)
    try:
        db.execute('CREATE TABLE IF NOT EXISTS reservations(id INTEGER PRIMARY KEY, day TEXT, owner TEXT, reserved REAL, actual REAL, input_tokens INTEGER, output_tokens INTEGER)')
        db.execute('BEGIN IMMEDIATE')
        day=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
        spent=db.execute('SELECT coalesce(sum(reserved),0) FROM reservations WHERE day=?',(day,)).fetchone()[0]
        count=db.execute('SELECT count(*) FROM reservations WHERE day=? AND owner=?',(day,identity)).fetchone()[0]
        if spent+reserve>daily or count>=call_limit:raise RuntimeError('budget_exhausted')
        if identity not in test_users:
            if test_users:
                marks=','.join('?' for _ in test_users)
                standard_spent=db.execute('SELECT coalesce(sum(reserved),0) FROM reservations WHERE day=? AND owner NOT IN ('+marks+')',(day,*sorted(test_users))).fetchone()[0]
            else:
                standard_spent=spent
            if standard_spent+reserve>standard_daily:raise RuntimeError('budget_exhausted')
        row=db.execute('INSERT INTO reservations(day,owner,reserved) VALUES(?,?,?)',(day,identity,reserve)).lastrowid
        db.commit();return path,row,reserve,input_price,output_price
    finally:db.close()

def record_usage(reservation, usage):
    path,row,reserve,input_price,output_price=reservation
    inputs=int(usage.prompt_tokens);outputs=int(usage.completion_tokens)
    cost=(inputs*input_price+outputs*output_price)/1_000_000
    with sqlite3.connect(path) as db:
        db.execute('UPDATE reservations SET actual=?,input_tokens=?,output_tokens=? WHERE id=?',(cost,inputs,outputs,row))
    return dict(inputTokens=inputs,outputTokens=outputs,estimatedCostUsd=cost,reservedUsd=reserve)
