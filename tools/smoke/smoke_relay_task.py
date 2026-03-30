from __future__ import annotations

import argparse
import json
import time
from urllib import request


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--token", required=True)
    args = parser.parse_args()

    payload = json.dumps(
        {
            "job_id": "smoke_job",
            "kind": "music",
            "input": {"prompt": "ambient"},
            "options": {"duration_s": 4},
        }
    ).encode("utf-8")
    req = request.Request(
        f"{args.base_url.rstrip('/')}/v1/tasks",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Relay-Token": args.token,
        },
        method="POST",
    )
    with request.urlopen(req, timeout=15) as response:
        created = json.loads(response.read().decode("utf-8"))
    task_id = created["task_id"]
    print(f"created task_id={task_id}")

    for _ in range(10):
        req = request.Request(
            f"{args.base_url.rstrip('/')}/v1/tasks/{task_id}",
            headers={"X-Relay-Token": args.token},
        )
        with request.urlopen(req, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
        print(payload.get("status"))
        if payload.get("status") in {"succeeded", "failed"}:
            break
        time.sleep(1.0)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
