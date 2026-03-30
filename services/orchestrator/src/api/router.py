from fastapi import APIRouter

from .jobs import router as jobs_router
from .relay import router as relay_router

router = APIRouter()

router.include_router(relay_router, prefix="/jobs", tags=["relay"])
router.include_router(jobs_router, prefix="/jobs", tags=["jobs"])
