import logging

from django.http import HttpRequest, HttpResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from ninja import NinjaAPI
from ninja.errors import HttpError
from pydantic import ValidationError

from apps.wedding.ninja import guestbook_router, photos_router
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
api.add_router("/photos", photos_router)
api.add_router("/guestbook", guestbook_router)


@api.get("/csrf", auth=None)
@ensure_csrf_cookie
def get_csrf_token(request: HttpRequest) -> dict[str, str]:
    """Get CSRF token - this endpoint doesn't require CSRF validation.

    The @ensure_csrf_cookie decorator ensures the CSRF cookie is set in the response.
    """
    # This will set the CSRF cookie and return the token value
    token = get_token(request)
    return {"csrf_token": token}


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
