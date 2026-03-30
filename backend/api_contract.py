from typing import Any

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def success_response(data: Any = None, message: str = "", status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "data": data,
            "message": message,
        },
    )


def error_response(error: str, details: list[dict[str, Any]] | None = None, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": error,
            "details": details or [],
        },
    )


def _normalize_validation_errors(errors: list[dict[str, Any]]) -> list[dict[str, str]]:
    details: list[dict[str, str]] = []
    for err in errors:
        loc = err.get("loc", ())
        field_parts = [str(part) for part in loc if part != "body"]
        details.append(
            {
                "field": ".".join(field_parts) if field_parts else "body",
                "message": err.get("msg", "Invalid value"),
            }
        )
    return details


async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return error_response(
        error="Validation failed",
        details=_normalize_validation_errors(exc.errors()),
        status_code=422,
    )


async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        return error_response(
            error=exc.detail.get("error", "Request failed"),
            details=exc.detail.get("details", []),
            status_code=exc.status_code,
        )

    if isinstance(exc.detail, list):
        return error_response(
            error="Request failed",
            details=_normalize_validation_errors(exc.detail),
            status_code=exc.status_code,
        )

    return error_response(
        error=str(exc.detail),
        details=[],
        status_code=exc.status_code,
    )
