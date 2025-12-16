"""Admin configuration for TechWiki."""

from django.contrib import admin
from django.forms import ModelForm
from django.http import HttpRequest
from django.utils.html import format_html
from django.utils.safestring import SafeString
from unfold.admin import ModelAdmin

from apps.wiki.models import (
    Article,
    ArticleImage,
    ArticleRevision,
    Category,
    ModerationLog,
    Redirect,
    Tag,
    WikiUserProfile,
)


@admin.register(Category)
class CategoryAdmin(ModelAdmin):
    list_display = ["name", "slug", "parent", "article_count", "order", "is_active"]
    list_filter = ["is_active", "parent"]
    search_fields = ["name", "slug", "description"]
    prepopulated_fields = {"slug": ("name",)}
    ordering = ["order", "name"]


@admin.register(Tag)
class TagAdmin(ModelAdmin):
    list_display = ["name", "slug", "article_count"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}

    @admin.display(description="Articles")
    def article_count(self, obj: Tag) -> int:
        return Article.objects.filter(tags=obj).count()


class ArticleRevisionInline(admin.TabularInline[ArticleRevision, Article]):
    model = ArticleRevision
    extra = 0
    readonly_fields = ["version", "title", "author", "change_summary", "created_at"]
    can_delete = False


class ArticleImageInline(admin.TabularInline[ArticleImage, Article]):
    model = ArticleImage
    extra = 1
    readonly_fields = ["image_preview"]

    @admin.display(description="Preview")
    def image_preview(self, obj: ArticleImage) -> SafeString | str:
        if obj.image:
            return format_html('<img src="{}" style="max-height: 100px;" />', obj.image.url)
        return "-"


@admin.register(Article)
class ArticleAdmin(ModelAdmin):
    list_display = [
        "title",
        "category",
        "article_type",
        "status",
        "author",
        "published_at",
        "view_count",
        "is_featured",
    ]
    list_filter = ["status", "article_type", "category", "is_featured", "created_at"]
    search_fields = ["title", "slug", "content", "excerpt"]
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ["view_count", "version", "created_at", "updated_at", "published_at"]
    autocomplete_fields = ["author", "moderator", "category", "tags"]
    inlines = [ArticleImageInline, ArticleRevisionInline]
    date_hierarchy = "created_at"

    fieldsets = (
        (None, {"fields": ("title", "slug", "excerpt", "content")}),
        ("Classification", {"fields": ("article_type", "category", "tags")}),
        ("Authorship", {"fields": ("author",)}),
        (
            "Status & Moderation",
            {"fields": ("status", "moderation_notes", "moderator", "moderated_at")},
        ),
        (
            "SEO",
            {
                "fields": ("meta_title", "meta_description", "featured_image"),
                "classes": ("collapse",),
            },
        ),
        (
            "Settings",
            {
                "fields": ("is_featured", "allow_comments"),
            },
        ),
        (
            "Statistics",
            {
                "fields": ("view_count", "version", "created_at", "updated_at", "published_at"),
                "classes": ("collapse",),
            },
        ),
    )

    def save_model(
        self, request: HttpRequest, obj: Article, form: ModelForm[Article], change: bool
    ) -> None:
        if not obj.author:
            obj.author = request.user  # type: ignore[assignment]
        super().save_model(request, obj, form, change)


@admin.register(ArticleImage)
class ArticleImageAdmin(ModelAdmin):
    list_display = ["id", "article", "alt_text", "uploaded_by", "created_at", "image_preview"]
    list_filter = ["created_at"]
    search_fields = ["alt_text", "caption"]
    readonly_fields = ["image_preview"]

    @admin.display(description="Preview")
    def image_preview(self, obj: ArticleImage) -> SafeString | str:
        if obj.image:
            return format_html('<img src="{}" style="max-height: 100px;" />', obj.image.url)
        return "-"


@admin.register(Redirect)
class RedirectAdmin(ModelAdmin):
    list_display = ["old_path", "new_path", "is_permanent", "hit_count", "last_hit"]
    list_filter = ["is_permanent"]
    search_fields = ["old_path", "new_path", "notes"]
    readonly_fields = ["hit_count", "last_hit"]


@admin.register(WikiUserProfile)
class WikiUserProfileAdmin(ModelAdmin):
    list_display = ["user", "role", "is_trusted", "articles_count", "created_at"]
    list_filter = ["role", "is_trusted"]
    search_fields = ["user__email", "user__first_name", "user__last_name"]
    readonly_fields = ["articles_count", "created_at", "updated_at"]


@admin.register(ModerationLog)
class ModerationLogAdmin(ModelAdmin):
    list_display = ["article", "moderator", "action", "old_status", "new_status", "created_at"]
    list_filter = ["action", "created_at"]
    search_fields = ["article__title", "moderator__email", "notes"]
    readonly_fields = [
        "article",
        "moderator",
        "action",
        "old_status",
        "new_status",
        "notes",
        "created_at",
    ]

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: ModerationLog | None = None) -> bool:
        return False


@admin.register(ArticleRevision)
class ArticleRevisionAdmin(ModelAdmin):
    list_display = ["article", "version", "author", "change_summary", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["article__title", "change_summary"]
    readonly_fields = [
        "article",
        "version",
        "title",
        "content",
        "author",
        "change_summary",
        "created_at",
    ]

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(
        self, request: HttpRequest, obj: ArticleRevision | None = None
    ) -> bool:
        return False
