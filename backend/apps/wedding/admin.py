from django.contrib import admin
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import GuestbookMessage, Photo, Video


@admin.register(Photo)
class PhotoAdmin(ModelAdmin):
    list_display = ["uploaded_by", "uploaded_at", "image"]
    list_filter = ["uploaded_at"]
    search_fields = ["uploaded_by"]
    readonly_fields = ["uploaded_at"]
    date_hierarchy = "uploaded_at"


@admin.register(GuestbookMessage)
class GuestbookMessageAdmin(ModelAdmin):
    list_display = ["name", "message_preview", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["name", "message"]
    readonly_fields = ["created_at"]
    date_hierarchy = "created_at"

    @display(description="Message")
    def message_preview(self, obj: GuestbookMessage) -> str:
        """Show first 100 characters of message."""
        return obj.message[:100] + "..." if len(obj.message) > 100 else obj.message


@admin.register(Video)
class VideoAdmin(ModelAdmin):
    list_display = ["filename", "uploaded_by", "status", "file_size_display", "uploaded_at"]
    list_filter = ["status", "uploaded_at"]
    search_fields = ["uploaded_by", "filename"]
    readonly_fields = [
        "upload_id",
        "uploaded_at",
        "onedrive_item_id",
        "onedrive_web_url",
        "onedrive_download_url",
        "onedrive_embed_url",
        "bytes_uploaded",
        "upload_session_url",
    ]
    date_hierarchy = "uploaded_at"
    fieldsets = [
        (
            "Basic Information",
            {
                "fields": ["filename", "uploaded_by", "content_type", "file_size", "status"],
            },
        ),
        (
            "Upload Progress",
            {
                "fields": ["upload_id", "bytes_uploaded", "error_message"],
            },
        ),
        (
            "OneDrive Information",
            {
                "fields": [
                    "onedrive_item_id",
                    "onedrive_web_url",
                    "onedrive_download_url",
                    "onedrive_embed_url",
                ],
                "classes": ["collapse"],
            },
        ),
        (
            "Media",
            {
                "fields": ["thumbnail", "duration_seconds"],
            },
        ),
    ]

    @display(description="File Size")
    def file_size_display(self, obj: Video) -> str:
        """Display file size in human-readable format."""
        size = obj.file_size
        for unit in ["B", "KB", "MB", "GB"]:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size = int(size / 1024)
        return f"{size:.1f} TB"
