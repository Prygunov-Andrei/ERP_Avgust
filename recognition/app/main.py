"""Recognition Service — FastAPI entrypoint."""

import logging

from fastapi import FastAPI

from .api.health import router as health_router
from .api.parse import router as parse_router
from .config import settings

logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(
    title="ISMeta Recognition Service",
    description="PDF → structured items via LLM Vision",
    version="0.1.0",
)

app.include_router(health_router)
app.include_router(parse_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.port)
