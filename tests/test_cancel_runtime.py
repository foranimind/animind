import subprocess
import sys
import threading
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.orchestrator.src.adapters.base import (
    AdapterCanceled,
    CancelToken,
    run_subprocess,
)


class TestRunSubprocess(unittest.TestCase):
    def _sleep_cmd(self, duration: float) -> list[str]:
        return [sys.executable, "-c", f"import time; time.sleep({duration})"]

    def test_run_subprocess_success(self) -> None:
        result = run_subprocess([sys.executable, "-c", "print('ok')"])
        self.assertEqual(result.returncode, 0)

    def test_run_subprocess_timeout(self) -> None:
        with self.assertRaises(subprocess.TimeoutExpired):
            run_subprocess(self._sleep_cmd(2.0), timeout_s=0.1)

    def test_run_subprocess_cancel(self) -> None:
        token = CancelToken()

        def _cancel_later() -> None:
            time.sleep(0.2)
            token.cancel()

        thread = threading.Thread(target=_cancel_later)
        thread.start()
        with self.assertRaises(AdapterCanceled):
            run_subprocess(self._sleep_cmd(5.0), cancel_token=token, poll_interval_s=0.05)
        thread.join(timeout=1.0)


if __name__ == "__main__":
    unittest.main()
