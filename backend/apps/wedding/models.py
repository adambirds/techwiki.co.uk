import uuid

from django.db import models
from django.utils import timezone


class Photo(models.Model):
    """Model to store wedding photos uploaded by guests."""

    image = models.ImageField(upload_to="wedding_photos/%Y/%m/%d/")
    uploaded_by = models.CharField(
        max_length=255, help_text="Name of the guest who uploaded the photo"
    )
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-uploaded_at"]
        verbose_name = "Wedding Photo"
        verbose_name_plural = "Wedding Photos"

    def __str__(self) -> str:
        return f"Photo by {self.uploaded_by} at {self.uploaded_at.strftime('%Y-%m-%d %H:%M')}"


class GuestbookMessage(models.Model):
    """Model to store guestbook messages from wedding guests."""

    name = models.CharField(max_length=255, help_text="Name of the guest")
    message = models.TextField(help_text="Guestbook message")
    created_at = models.DateTimeField(default=timezone.now)
    edit_token = models.UUIDField(
        default=uuid.uuid4, editable=False, help_text="Token for editing the message"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Guestbook Message"
        verbose_name_plural = "Guestbook Messages"

    def __str__(self) -> str:
        return f"Message by {self.name} at {self.created_at.strftime('%Y-%m-%d %H:%M')}"

    def can_edit(self) -> bool:
        """Check if message can still be edited (within 30 minutes)."""
        from datetime import timedelta

        time_limit = timedelta(minutes=30)
        return timezone.now() - self.created_at < time_limit
