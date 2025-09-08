"""Authentication views for Django Ninja API with proper HTTP status codes and response mapping."""

import logging
from typing import Any

from django.contrib.auth import authenticate, login, logout
from django.http import HttpRequest
from django.middleware.csrf import get_token
from ninja import Router

from authentication.models import User
from authentication.ninja.schemas import (
    AuthResponse,
    LoginRequest,
    ProblemDetail,
    StatusResponse,
    UserResponse,
)

logger = logging.getLogger(__name__)

auth_router = Router(tags=["auth"])


def transform_user_to_response(user: User) -> UserResponse:
    author = None
    if hasattr(user, "author") and user.author:
        author = {
            "avatar": getattr(user.author, "avatar", None),
            "bio": getattr(user.author, "bio", None),
        }

    return UserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_staff=user.is_staff,
        author=author,
    )


@auth_router.get(
    "/csrf",
    response={200: StatusResponse, 500: ProblemDetail},
)
def get_csrf_token(request: HttpRequest) -> tuple[int, dict[str, Any]]:
    try:
        get_token(request)
        return 200, {"message": "CSRF token set", "success": True}
    except Exception as e:
        logger.error("CSRF error: %s", str(e))
        return 500, {"message": "An error has occurred.", "success": False, "code": "server_error"}


@auth_router.post(
    "/login",
    response={
        200: AuthResponse,
        401: ProblemDetail,
        403: ProblemDetail,
        500: ProblemDetail,
    },
)
def login_user(request: HttpRequest, login_data: LoginRequest) -> tuple[int, dict[str, Any]]:
    """
    200: success
    401: invalid credentials
    403: authenticated but not staff/superuser
    500: server error
    """
    try:
        user = authenticate(request, username=login_data.email, password=login_data.password)
        if user is None:
            return 401, {
                "message": "The username and password entered are incorrect.",
                "success": False,
                "code": "invalid_credentials",
            }

        if not (user.is_staff or user.is_superuser):
            return 403, {
                "message": "You do not have permission to access this resource.",
                "success": False,
                "code": "forbidden",
            }

        login(request, user)
        get_token(request)  # rotate/ensure CSRF with new session
        return 200, {
            "user": transform_user_to_response(user),
            "message": "Login successful",
            "success": True,
        }

    except Exception as e:
        logger.error("Login error: %s", str(e))
        return 500, {"message": "An error has occurred.", "success": False, "code": "server_error"}


@auth_router.post(
    "/logout",
    response={200: StatusResponse, 401: ProblemDetail, 500: ProblemDetail},
)
def logout_user(request: HttpRequest) -> tuple[int, dict[str, Any]]:
    try:
        if not request.user.is_authenticated:
            return 401, {
                "message": "User not authenticated",
                "success": False,
                "code": "unauthenticated",
            }

        logout(request)
        return 200, {"message": "Logout successful", "success": True}

    except Exception as e:
        logger.error("Logout error: %s", str(e))
        return 500, {"message": "An error has occurred.", "success": False, "code": "server_error"}


@auth_router.get(
    "/me",
    response={200: AuthResponse, 401: ProblemDetail, 403: ProblemDetail, 500: ProblemDetail},
)
def get_current_user(request: HttpRequest) -> tuple[int, dict[str, Any]]:
    try:
        if not request.user.is_authenticated:
            return 401, {
                "message": "User not authenticated",
                "success": False,
                "code": "unauthenticated",
            }

        if not (request.user.is_staff or request.user.is_superuser):
            return 403, {
                "message": "You do not have permission to access this resource.",
                "success": False,
                "code": "forbidden",
            }

        return 200, {
            "user": transform_user_to_response(request.user),
            "message": "User authenticated",
            "success": True,
        }

    except Exception as e:
        logger.error("Get current user error: %s", str(e))
        return 500, {"message": "An error has occurred.", "success": False, "code": "server_error"}
