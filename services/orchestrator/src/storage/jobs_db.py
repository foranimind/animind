from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Dict


def init_db(db_path: Path) -> None:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            "create table if not exists jobs (job_id text primary key, payload text not null)"
        )
        conn.commit()
    finally:
        conn.close()


def load_jobs(db_path: Path) -> Dict[str, dict]:
    path = Path(db_path)
    init_db(path)
    conn = sqlite3.connect(path)
    try:
        rows = conn.execute("select job_id, payload from jobs").fetchall()
    finally:
        conn.close()
    jobs: Dict[str, dict] = {}
    for job_id, payload in rows:
        try:
            decoded = json.loads(payload)
        except json.JSONDecodeError:
            continue
        if isinstance(decoded, dict):
            jobs[str(job_id)] = decoded
    return jobs


def upsert_job(db_path: Path, job_id: str, payload: dict) -> None:
    path = Path(db_path)
    init_db(path)
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            """
            insert into jobs(job_id, payload)
            values (?, ?)
            on conflict(job_id) do update set payload=excluded.payload
            """,
            (job_id, json.dumps(payload, ensure_ascii=True, sort_keys=True)),
        )
        conn.commit()
    finally:
        conn.close()
