from __future__ import annotations

from fastapi import FastAPI

from .api.tasks import router as tasks_router


def create_app() -> FastAPI:
    app = FastAPI()
    app.include_router(tasks_router, prefix="/v1")
    return app


app = create_app()
