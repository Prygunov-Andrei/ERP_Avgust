"""Middleware: request_id propagation + access log."""

import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

from .logging_setup import request_id_ctx

logger = logging.getLogger("recognition.access")


async def request_id_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    token = request_id_ctx.set(rid)
    start = time.monotonic()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers["X-Request-ID"] = rid
        return response
    finally:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "elapsed_ms": elapsed_ms,
            },
        )
        request_id_ctx.reset(token)
