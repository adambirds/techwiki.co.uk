from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import GuestbookMessage, Photo


@admin.register(Photo)
class PhotoAdmin(ModelAdmin):
    list_display = ['uploaded_by', 'uploaded_at', 'image']
    list_filter = ['uploaded_at']
    search_fields = ['uploaded_by']
    readonly_fields = ['uploaded_at']
    date_hierarchy = 'uploaded_at'


@admin.register(GuestbookMessage)
class GuestbookMessageAdmin(ModelAdmin):
    list_display = ['name', 'message_preview', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'message']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    
    def message_preview(self, obj):
        """Show first 100 characters of message."""
        return obj.message[:100] + '...' if len(obj.message) > 100 else obj.message
    message_preview.short_description = 'Message'
