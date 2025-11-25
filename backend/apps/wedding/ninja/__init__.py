"""Wedding app ninja router initialization."""

from apps.wedding.ninja.views import guestbook_router, photos_router

__all__ = ['photos_router', 'guestbook_router']
