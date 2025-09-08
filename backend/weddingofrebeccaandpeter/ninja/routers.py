import logging

from django.http import HttpRequest, HttpResponse
from ninja import NinjaAPI
from ninja.errors import HttpError
from pydantic import ValidationError

from authentication.ninja.views import auth_router

logger = logging.getLogger(__name__)

api = NinjaAPI(
    title="Wedding of Rebecca and Peter API",
    version="1.0",
    description="API for the Wedding of Rebecca and Peter website",
    csrf=True,
)

# Register nested routers
api.add_router("/auth", auth_router)


@api.exception_handler(ValidationError)
def custom_validation_errors(request: HttpRequest, exc: ValidationError) -> HttpResponse:
    logger.info("Validation error on %s %s", request.method, request.path)
    logger.info("Request body: %s", request.body.decode("utf-8"))
    logger.info("Validation errors: %s", exc.errors())

    return api.create_response(
        request,
        {"detail": exc.errors()},
        status=422,
    )


@api.exception_handler(HttpError)
def custom_http_errors(request: HttpRequest, exc: HttpError) -> HttpResponse:
    logger.info("HTTP error on %s %s", request.method, request.path)
    logger.info("Request body: %s", request.body.decode("utf-8"))
    logger.info("HTTP error: %s", exc)

    return api.create_response(
        request,
        {"detail": str(exc)},
        status=exc.status_code,
    )
