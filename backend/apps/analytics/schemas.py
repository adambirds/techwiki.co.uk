"""Pydantic schemas for Analytics API."""

from datetime import date

from pydantic import BaseModel


# Request schemas
class PageViewRequest(BaseModel):
    path: str
    full_url: str | None = None
    referrer: str | None = None
    session_id: str
    time_on_page: int | None = None


class ArticleViewRequest(BaseModel):
    article_id: str
    session_id: str
    time_on_article: int | None = None
    scroll_depth: int | None = None


class SearchQueryRequest(BaseModel):
    query: str
    results_count: int
    session_id: str
    category_filter: str | None = None
    type_filter: str | None = None


class SearchClickRequest(BaseModel):
    search_id: str
    article_id: str
    position: int


class EventRequest(BaseModel):
    event_type: str
    event_action: str
    event_category: str | None = None
    event_label: str | None = None
    event_value: float | None = None
    page_path: str | None = None
    article_id: str | None = None
    session_id: str
    metadata: dict[str, str | int | float | bool | None] | None = None


# Response schemas
class DailyStatsResponse(BaseModel):
    date: date
    total_page_views: int
    unique_visitors: int
    total_article_views: int
    unique_articles_viewed: int
    avg_time_on_article: float | None
    total_searches: int
    searches_with_results: int
    searches_with_clicks: int
    new_users: int
    returning_users: int
    logged_in_users: int
    desktop_views: int
    mobile_views: int
    tablet_views: int
    articles_created: int
    articles_published: int
    articles_updated: int
    total_events: int
    copy_link_clicks: int
    edit_button_clicks: int


class TopArticleResponse(BaseModel):
    rank: int
    article_id: str
    article_title: str
    article_slug: str
    category_name: str | None
    view_count: int
    unique_visitors: int


class TopSearchQueryResponse(BaseModel):
    rank: int
    query: str
    search_count: int
    click_through_rate: float | None


class AnalyticsSummaryResponse(BaseModel):
    """Summary analytics for the dashboard."""

    period: str  # "today", "week", "month"
    total_page_views: int
    unique_visitors: int
    total_article_views: int
    total_searches: int
    avg_time_on_article: float | None
    bounce_rate: float | None

    # Comparison with previous period
    page_views_change: float | None  # percentage
    visitors_change: float | None
    article_views_change: float | None
    searches_change: float | None


class TrafficSourceResponse(BaseModel):
    source: str
    count: int
    percentage: float


class DeviceBreakdownResponse(BaseModel):
    desktop: int
    mobile: int
    tablet: int
    desktop_percentage: float
    mobile_percentage: float
    tablet_percentage: float


class AnalyticsDashboardResponse(BaseModel):
    summary: AnalyticsSummaryResponse
    daily_stats: list[DailyStatsResponse]
    top_articles: list[TopArticleResponse]
    top_searches: list[TopSearchQueryResponse]
    traffic_sources: list[TrafficSourceResponse]
    device_breakdown: DeviceBreakdownResponse
