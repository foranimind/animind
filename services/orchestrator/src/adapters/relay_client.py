from __future__ import annotations

import httpx

from ..config.relay import get_relay_settings


class RelayClient:
    def __init__(self) -> None:
        self._settings = get_relay_settings()

    def create_task(self, payload: dict) -> dict:
        with httpx.Client(
            timeout=self._settings.timeout_s,
            verify=self._settings.verify_tls,
        ) as client:
            response = client.post(
                f"{self._settings.base_url}/v1/tasks",
                json=payload,
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()

    def get_task(self, task_id: str) -> dict:
        with httpx.Client(
            timeout=self._settings.timeout_s,
            verify=self._settings.verify_tls,
        ) as client:
            response = client.get(
                f"{self._settings.base_url}/v1/tasks/{task_id}",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()

    def _headers(self) -> dict[str, str]:
        return {"X-Relay-Token": self._settings.token}
