"""Persistent conservative budget reservations; failed calls retain their reserve."""
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

def reserve_budget(identity, input_bytes, max_output):
    values=[float(os.environ.get(k,'0')) for k in ('ITINERARY_INPUT_USD_PER_M','ITINERARY_OUTPUT_USD_PER_M','ITINERARY_DAILY_USD')]
    if not all(0 < v < 1000 for v in values):raise RuntimeError('budget_unconfigured')
    input_price,output_price,daily=values
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
        if spent+reserve>daily or count>=10:raise RuntimeError('budget_exhausted')
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
