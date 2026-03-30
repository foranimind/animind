from __future__ import annotations

import argparse
import json
import time
from urllib import request


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    args = parser.parse_args()

    payload = json.dumps({"prompt": "smoke test", "options": {"targets": ["music"]}}).encode("utf-8")
    req = request.Request(
        f"{args.base_url.rstrip('/')}/api/jobs",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with request.urlopen(req, timeout=15) as response:
        data = json.loads(response.read().decode("utf-8"))
    job_id = data["job_id"]
    print(f"created job_id={job_id}")

    for _ in range(10):
        with request.urlopen(
            f"{args.base_url.rstrip('/')}/api/jobs/{job_id}",
            timeout=15,
        ) as response:
            payload = json.loads(response.read().decode("utf-8"))
        print(payload.get("status"))
        if payload.get("status") in {"DONE", "FAILED", "CANCELED"}:
            break
        time.sleep(1.0)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
