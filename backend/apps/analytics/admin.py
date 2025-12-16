from django.contrib import admin
from .models import (
    PageView,
    ArticleView,
    SearchQuery,
    Event,
    DailyStats,
    TopArticle,
    TopSearchQuery,
)


@admin.register(PageView)
class PageViewAdmin(admin.ModelAdmin):
    list_display = ["path", "user", "device_type", "browser", "created_at"]
    list_filter = ["device_type", "browser", "created_at"]
    search_fields = ["path", "user__email", "session_id"]
    readonly_fields = ["id", "created_at"]
    date_hierarchy = "created_at"


@admin.register(ArticleView)
class ArticleViewAdmin(admin.ModelAdmin):
    list_display = ["article", "user", "time_on_article", "scroll_depth", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["article__title", "user__email"]
    readonly_fields = ["id", "created_at"]
    date_hierarchy = "created_at"


@admin.register(SearchQuery)
class SearchQueryAdmin(admin.ModelAdmin):
    list_display = ["query", "results_count", "clicked_result", "user", "created_at"]
    list_filter = ["created_at", "category_filter", "type_filter"]
    search_fields = ["query", "user__email"]
    readonly_fields = ["id", "created_at"]
    date_hierarchy = "created_at"


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = [
        "event_type",
        "event_action",
        "event_category",
        "page_path",
        "user",
        "created_at",
    ]
    list_filter = ["event_type", "event_category", "created_at"]
    search_fields = ["event_action", "event_label", "page_path", "user__email"]
    readonly_fields = ["id", "created_at"]
    date_hierarchy = "created_at"


@admin.register(DailyStats)
class DailyStatsAdmin(admin.ModelAdmin):
    list_display = [
        "date",
        "total_page_views",
        "unique_visitors",
        "total_article_views",
        "total_searches",
        "articles_created",
    ]
    list_filter = ["date"]
    readonly_fields = ["updated_at"]
    date_hierarchy = "date"


@admin.register(TopArticle)
class TopArticleAdmin(admin.ModelAdmin):
    list_display = ["date", "period", "rank", "article", "view_count", "unique_visitors"]
    list_filter = ["period", "date"]
    search_fields = ["article__title"]
    date_hierarchy = "date"


@admin.register(TopSearchQuery)
class TopSearchQueryAdmin(admin.ModelAdmin):
    list_display = ["date", "period", "rank", "query", "search_count", "click_through_rate"]
    list_filter = ["period", "date"]
    search_fields = ["query"]
    date_hierarchy = "date"
