"""Admin-only API endpoints for dashboard user management."""

from datetime import timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.http import HttpRequest
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.analytics.models import PageView
from apps.wiki.models import Article, ArticleStatus, UserRole, WikiUserProfile

router = Router(tags=["Admin"])
User = get_user_model()

MANAGEABLE_ROLES = {
    UserRole.READER,
    UserRole.CONTRIBUTOR,
    UserRole.TRUSTED_CONTRIBUTOR,
    UserRole.MODERATOR,
    UserRole.ADMIN,
}


class AdminUserUpdateRequest(Schema):
    role: str | None = None
    is_active: bool | None = None


def require_admin(request: HttpRequest) -> Any:
    """Return the authenticated admin or reject the request."""
    if not request.user.is_authenticated:
        raise HttpError(401, "Authentication required")
    if not (request.user.is_staff or request.user.is_superuser):
        raise HttpError(403, "Admin access required")
    return request.user


def serialize_user(user: Any) -> dict[str, Any]:
    profile = getattr(user, "wiki_profile", None)
    role = (
        UserRole.ADMIN
        if user.is_staff or user.is_superuser
        else profile.role if profile else UserRole.READER
    )
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": role,
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "email_verified": user.email_verified,
        "date_joined": user.date_joined.isoformat(),
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "articles_count": user.articles.count(),
    }


def get_manageable_user(request: HttpRequest, user_id: str) -> Any:
    require_admin(request)
    try:
        return User.objects.select_related("wiki_profile").get(id=user_id)
    except (User.DoesNotExist, ValueError):
        raise HttpError(404, "User not found")


def lock_active_admins() -> list[Any]:
    """Lock active admins so concurrent requests cannot remove the final one."""
    return list(
        User.objects.select_for_update()
        .filter(is_active=True)
        .filter(Q(is_staff=True) | Q(is_superuser=True))
    )


def ensure_another_active_admin(target: Any, active_admins: list[Any]) -> None:
    """Reject an action that would remove the final active dashboard admin."""
    if not target.is_active or not (target.is_staff or target.is_superuser):
        return
    if not any(admin.id != target.id for admin in active_admins):
        raise HttpError(409, "At least one active admin must remain")


@router.get("/overview")
def admin_overview(request: HttpRequest) -> dict[str, Any]:
    """Return headline user, content, and traffic metrics."""
    require_admin(request)
    thirty_days_ago = timezone.now() - timedelta(days=30)
    today = timezone.now().date()

    return {
        "users": {
            "total": User.objects.count(),
            "active": User.objects.filter(is_active=True).count(),
            "banned": User.objects.filter(is_active=False).count(),
            "moderators": WikiUserProfile.objects.filter(role=UserRole.MODERATOR).count(),
            "admins": User.objects.filter(is_active=True)
            .filter(Q(is_staff=True) | Q(is_superuser=True))
            .count(),
            "new_last_30_days": User.objects.filter(date_joined__gte=thirty_days_ago).count(),
        },
        "content": {
            "total_articles": Article.objects.count(),
            "published_articles": Article.objects.filter(status=ArticleStatus.PUBLISHED).count(),
            "pending_articles": Article.objects.filter(status=ArticleStatus.PENDING_REVIEW).count(),
        },
        "traffic": {
            "page_views_today": PageView.objects.filter(created_at__date=today).count(),
            "page_views_last_30_days": PageView.objects.filter(
                created_at__gte=thirty_days_ago
            ).count(),
        },
    }


@router.get("/users")
def list_admin_users(
    request: HttpRequest,
    search: str = "",
    status: str = "all",
    role: str = "all",
    page: int = 1,
    per_page: int = 20,
) -> dict[str, Any]:
    """List users for administration with search and filters."""
    require_admin(request)
    page = max(page, 1)
    per_page = min(max(per_page, 1), 100)

    users = User.objects.select_related("wiki_profile").all().order_by("-date_joined")
    if search.strip():
        term = search.strip()
        users = users.filter(
            Q(email__icontains=term) | Q(first_name__icontains=term) | Q(last_name__icontains=term)
        )
    if status == "active":
        users = users.filter(is_active=True)
    elif status == "banned":
        users = users.filter(is_active=False)
    elif status != "all":
        raise HttpError(400, "Invalid status filter")

    if role != "all":
        valid_roles = {choice for choice, _ in UserRole.choices}
        if role not in valid_roles:
            raise HttpError(400, "Invalid role filter")
        if role == UserRole.ADMIN:
            users = users.filter(Q(is_staff=True) | Q(is_superuser=True))
        elif role == UserRole.READER:
            users = users.filter(is_staff=False, is_superuser=False).filter(
                Q(wiki_profile__role=UserRole.READER) | Q(wiki_profile__isnull=True)
            )
        else:
            users = users.filter(
                is_staff=False,
                is_superuser=False,
                wiki_profile__role=role,
            )

    total = users.count()
    total_pages = max((total + per_page - 1) // per_page, 1)
    offset = (page - 1) * per_page

    return {
        "users": [serialize_user(user) for user in users[offset : offset + per_page]],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


@router.patch("/users/{user_id}")
@csrf_protect
def update_admin_user(
    request: HttpRequest,
    user_id: str,
    data: AdminUserUpdateRequest,
) -> dict[str, Any]:
    """Update a user's wiki role, admin access, or active state."""
    require_admin(request)
    if data.role is None and data.is_active is None:
        raise HttpError(400, "No changes supplied")
    if data.role is not None and data.role not in MANAGEABLE_ROLES:
        raise HttpError(400, "Invalid role")

    with transaction.atomic():
        active_admins = lock_active_admins()
        try:
            target = User.objects.select_for_update().get(id=user_id)
        except (User.DoesNotExist, ValueError):
            raise HttpError(404, "User not found")

        removes_admin_access = data.role is not None and data.role != UserRole.ADMIN
        deactivates_user = data.is_active is False
        if removes_admin_access or deactivates_user:
            ensure_another_active_admin(target, active_admins)

        if data.role is not None:
            profile, _ = WikiUserProfile.objects.get_or_create(user=target)
            profile.role = data.role
            profile.is_trusted = data.role in {
                UserRole.TRUSTED_CONTRIBUTOR,
                UserRole.MODERATOR,
                UserRole.ADMIN,
            }
            profile.save(update_fields=["role", "is_trusted", "updated_at"])

            if data.role == UserRole.ADMIN:
                target.is_staff = True
            else:
                target.is_staff = False
                target.is_superuser = False

        if data.is_active is not None:
            target.is_active = data.is_active

        target.save(update_fields=["is_active", "is_staff", "is_superuser"])

    target = User.objects.select_related("wiki_profile").get(id=target.id)
    return {"success": True, "user": serialize_user(target)}


@router.delete("/users/{user_id}")
@csrf_protect
def delete_admin_user(request: HttpRequest, user_id: str) -> dict[str, Any]:
    """Permanently remove an account while preserving an active admin."""
    require_admin(request)
    with transaction.atomic():
        active_admins = lock_active_admins()
        try:
            target = User.objects.select_for_update().get(id=user_id)
        except (User.DoesNotExist, ValueError):
            raise HttpError(404, "User not found")

        ensure_another_active_admin(target, active_admins)
        email = target.email
        target.delete()

    return {"success": True, "message": f"{email} was permanently removed"}
