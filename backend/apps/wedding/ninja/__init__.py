"""Wedding app ninja router initialization."""

from apps.wedding.ninja.views import guestbook_router, photos_router

__all__ = ["guestbook_router", "photos_router"]
