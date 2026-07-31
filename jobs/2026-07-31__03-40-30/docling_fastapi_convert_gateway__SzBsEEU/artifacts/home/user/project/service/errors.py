"""Fixed error-code taxonomy for the gateway."""
from __future__ import annotations

ERROR_STATUS = {
    "VALIDATION_ERROR": 400,
    "INVALID_FORMAT": 400,
    "PATH_NOT_ALLOWED": 403,
    "SOURCE_NOT_FOUND": 404,
    "JOB_NOT_FOUND": 404,
    "IDEMPOTENCY_KEY_CONFLICT": 409,
    "JOB_NOT_FINISHED": 409,
    "RESULT_UNAVAILABLE": 409,
    "JOB_ALREADY_TERMINAL": 409,
    "QUEUE_FULL": 429,
}


class ApiError(Exception):
    def __init__(self, code: str, message: str, retry_after: int | None = None):
        if code not in ERROR_STATUS:
            raise ValueError(f"unknown error code: {code}")
        self.code = code
        self.message = message
        self.status_code = ERROR_STATUS[code]
        self.retry_after = retry_after
        super().__init__(message)

    def body(self) -> dict:
        return {"error": {"code": self.code, "message": self.message}}


def err(code: str, message: str, retry_after: int | None = None) -> ApiError:
    return ApiError(code, message, retry_after=retry_after)
