from django.apps import AppConfig
from django.conf import settings


class WeddingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.wedding"


if not hasattr(settings, "WEDDING_PHOTO_UPLOAD_PASSWORD"):
    raise RuntimeError("WEDDING_PHOTO_UPLOAD_PASSWORD setting is required for the wedding app.")
