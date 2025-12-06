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


class VideoUploadStatus(models.TextChoices):
    """Status choices for video uploads."""

    PENDING = "pending", "Pending"
    UPLOADING = "uploading", "Uploading"
    PROCESSING = "processing", "Processing"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class Video(models.Model):
    """Model to store wedding videos uploaded by guests.

    Videos are stored on OneDrive/SharePoint to save server storage.
    The upload is done in chunks to handle large files (up to 100MB).
    """

    # Unique upload ID for tracking chunked uploads
    upload_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    # OneDrive/SharePoint storage info
    onedrive_item_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="OneDrive/SharePoint item ID",
    )
    onedrive_web_url = models.URLField(
        max_length=1024,
        blank=True,
        null=True,
        help_text="OneDrive/SharePoint web URL for viewing",
    )
    onedrive_download_url = models.URLField(
        max_length=2048,
        blank=True,
        null=True,
        help_text="OneDrive/SharePoint download URL",
    )
    onedrive_embed_url = models.URLField(
        max_length=2048,
        blank=True,
        null=True,
        help_text="OneDrive/SharePoint embed URL for video playback",
    )

    # Video metadata
    filename = models.CharField(max_length=255, help_text="Original filename")
    file_size = models.BigIntegerField(help_text="File size in bytes")
    content_type = models.CharField(max_length=100, default="video/mp4")
    duration_seconds = models.FloatField(null=True, blank=True, help_text="Video duration")

    # Thumbnail stored locally (small file)
    thumbnail = models.ImageField(
        upload_to="wedding_video_thumbnails/%Y/%m/%d/",
        null=True,
        blank=True,
        help_text="Video thumbnail image",
    )

    # Upload tracking
    status = models.CharField(
        max_length=20,
        choices=VideoUploadStatus.choices,
        default=VideoUploadStatus.PENDING,
    )
    bytes_uploaded = models.BigIntegerField(default=0, help_text="Bytes uploaded so far")
    error_message = models.TextField(blank=True, null=True)

    # OneDrive upload session URL (temporary, used during chunked upload)
    upload_session_url = models.URLField(max_length=2048, blank=True, null=True)

    # User info
    uploaded_by = models.CharField(
        max_length=255, help_text="Name of the guest who uploaded the video"
    )
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-uploaded_at"]
        verbose_name = "Wedding Video"
        verbose_name_plural = "Wedding Videos"

    def __str__(self) -> str:
        return f"Video by {self.uploaded_by} at {self.uploaded_at.strftime('%Y-%m-%d %H:%M')}"

    @property
    def upload_progress(self) -> float:
        """Return upload progress as a percentage (0-100)."""
        if self.file_size == 0:
            return 0.0
        return min(100.0, (self.bytes_uploaded / self.file_size) * 100)

    @property
    def is_playable(self) -> bool:
        """Check if the video is ready to be played."""
        return self.status == VideoUploadStatus.COMPLETED and bool(self.onedrive_embed_url)


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
