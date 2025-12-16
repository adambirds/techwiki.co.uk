"""Analytics models for tracking user behavior and site statistics."""

import uuid
from django.db import models
from django.utils import timezone


class PageView(models.Model):
    """Track page views across the site."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    path = models.CharField(max_length=500, db_index=True)
    full_url = models.URLField(max_length=1000, blank=True)
    referrer = models.URLField(max_length=1000, blank=True, null=True)
    
    # User info (optional for logged-in users)
    user = models.ForeignKey(
        "authentication.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="page_views",
    )
    session_id = models.CharField(max_length=64, db_index=True, blank=True)
    
    # Client info
    user_agent = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    country = models.CharField(max_length=2, blank=True)  # ISO country code
    city = models.CharField(max_length=100, blank=True)
    
    # Device info
    device_type = models.CharField(
        max_length=20,
        choices=[
            ("desktop", "Desktop"),
            ("mobile", "Mobile"),
            ("tablet", "Tablet"),
            ("bot", "Bot"),
            ("unknown", "Unknown"),
        ],
        default="unknown",
    )
    browser = models.CharField(max_length=50, blank=True)
    os = models.CharField(max_length=50, blank=True)
    
    # Timing
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    time_on_page = models.PositiveIntegerField(null=True, blank=True)  # seconds
    
    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["path", "created_at"]),
            models.Index(fields=["session_id", "created_at"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"PageView: {self.path} at {self.created_at}"


class ArticleView(models.Model):
    """Track views for specific articles."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    article = models.ForeignKey(
        "wiki.Article",
        on_delete=models.CASCADE,
        related_name="views",
    )
    
    # Reuse page view for detailed info
    page_view = models.OneToOneField(
        PageView,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="article_view",
    )
    
    # Denormalized fields for quick queries
    user = models.ForeignKey(
        "authentication.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="article_views",
    )
    session_id = models.CharField(max_length=64, db_index=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    
    # Reading metrics
    time_on_article = models.PositiveIntegerField(null=True, blank=True)  # seconds
    scroll_depth = models.PositiveSmallIntegerField(null=True, blank=True)  # percentage
    
    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["article", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"ArticleView: {self.article.title} at {self.created_at}"


class SearchQuery(models.Model):
    """Track search queries and their results."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    query = models.CharField(max_length=500, db_index=True)
    results_count = models.PositiveIntegerField(default=0)
    
    # User info
    user = models.ForeignKey(
        "authentication.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="search_queries",
    )
    session_id = models.CharField(max_length=64, db_index=True, blank=True)
    
    # Filters used
    category_filter = models.CharField(max_length=100, blank=True)
    type_filter = models.CharField(max_length=50, blank=True)
    
    # Behavior
    clicked_result = models.ForeignKey(
        "wiki.Article",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="search_clicks",
    )
    clicked_position = models.PositiveSmallIntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Search queries"

    def __str__(self) -> str:
        return f"Search: '{self.query}' ({self.results_count} results)"


class Event(models.Model):
    """Track custom events and user interactions."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Event identification
    event_type = models.CharField(max_length=50, db_index=True)  # e.g., 'button_click', 'link_click'
    event_action = models.CharField(max_length=100)  # specific action
    event_category = models.CharField(max_length=100, blank=True)  # grouping
    event_label = models.CharField(max_length=255, blank=True)  # additional info
    event_value = models.FloatField(null=True, blank=True)  # numeric value
    
    # Context
    page_path = models.CharField(max_length=500, blank=True)
    article = models.ForeignKey(
        "wiki.Article",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    
    # User info
    user = models.ForeignKey(
        "authentication.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    session_id = models.CharField(max_length=64, db_index=True, blank=True)
    
    # Additional data as JSON
    metadata = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["event_category", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"Event: {self.event_type}/{self.event_action}"


class DailyStats(models.Model):
    """Aggregated daily statistics for quick dashboard access."""

    date = models.DateField(unique=True, db_index=True)
    
    # Page views
    total_page_views = models.PositiveIntegerField(default=0)
    unique_visitors = models.PositiveIntegerField(default=0)
    
    # Articles
    total_article_views = models.PositiveIntegerField(default=0)
    unique_articles_viewed = models.PositiveIntegerField(default=0)
    avg_time_on_article = models.FloatField(null=True, blank=True)  # seconds
    
    # Search
    total_searches = models.PositiveIntegerField(default=0)
    searches_with_results = models.PositiveIntegerField(default=0)
    searches_with_clicks = models.PositiveIntegerField(default=0)
    
    # Users
    new_users = models.PositiveIntegerField(default=0)
    returning_users = models.PositiveIntegerField(default=0)
    logged_in_users = models.PositiveIntegerField(default=0)
    
    # Devices
    desktop_views = models.PositiveIntegerField(default=0)
    mobile_views = models.PositiveIntegerField(default=0)
    tablet_views = models.PositiveIntegerField(default=0)
    
    # Content
    articles_created = models.PositiveIntegerField(default=0)
    articles_published = models.PositiveIntegerField(default=0)
    articles_updated = models.PositiveIntegerField(default=0)
    
    # Engagement
    total_events = models.PositiveIntegerField(default=0)
    copy_link_clicks = models.PositiveIntegerField(default=0)
    edit_button_clicks = models.PositiveIntegerField(default=0)
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]
        verbose_name_plural = "Daily stats"

    def __str__(self) -> str:
        return f"Stats for {self.date}: {self.total_page_views} views"


class TopArticle(models.Model):
    """Track top articles for a given period."""

    date = models.DateField(db_index=True)
    period = models.CharField(
        max_length=10,
        choices=[
            ("day", "Day"),
            ("week", "Week"),
            ("month", "Month"),
        ],
        default="day",
    )
    article = models.ForeignKey(
        "wiki.Article",
        on_delete=models.CASCADE,
        related_name="top_rankings",
    )
    rank = models.PositiveSmallIntegerField()
    view_count = models.PositiveIntegerField()
    unique_visitors = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["date", "period", "rank"]
        unique_together = ["date", "period", "rank"]

    def __str__(self) -> str:
        return f"#{self.rank} {self.article.title} ({self.period}: {self.date})"


class TopSearchQuery(models.Model):
    """Track top search queries for a given period."""

    date = models.DateField(db_index=True)
    period = models.CharField(
        max_length=10,
        choices=[
            ("day", "Day"),
            ("week", "Week"),
            ("month", "Month"),
        ],
        default="day",
    )
    query = models.CharField(max_length=500)
    rank = models.PositiveSmallIntegerField()
    search_count = models.PositiveIntegerField()
    click_through_rate = models.FloatField(null=True, blank=True)  # percentage

    class Meta:
        ordering = ["date", "period", "rank"]
        unique_together = ["date", "period", "rank"]
        verbose_name_plural = "Top search queries"

    def __str__(self) -> str:
        return f"#{self.rank} '{self.query}' ({self.period}: {self.date})"
