"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Generate or retrieve session ID
function getSessionId(): string {
    if (typeof window === "undefined") return "";

    let sessionId = sessionStorage.getItem("tw_session_id");
    if (!sessionId) {
        sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        sessionStorage.setItem("tw_session_id", sessionId);
    }
    return sessionId;
}

// Track an event to our internal analytics
async function trackEvent(
    endpoint: string,
    data: Record<string, unknown>,
): Promise<void> {
    try {
        await fetch(`${API_BASE}/api/analytics/track/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                ...data,
                session_id: getSessionId(),
            }),
        });
    } catch (err) {
        // Silently fail - analytics should never break the app
        console.debug("Analytics tracking failed:", err);
    }
}

/**
 * Hook to track page views automatically
 */
export function usePageTracking() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const lastPathRef = useRef<string>("");
    const startTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        const fullPath =
            pathname +
            (searchParams.toString() ? `?${searchParams.toString()}` : "");

        // Don't track same page twice
        if (fullPath === lastPathRef.current) return;

        // Track time on previous page
        if (lastPathRef.current) {
            const timeOnPage = Math.round(
                (Date.now() - startTimeRef.current) / 1000,
            );
            if (timeOnPage > 0 && timeOnPage < 3600) {
                // Update previous page view with time
                // This would require storing the previous page view ID
            }
        }

        // Track new page view
        trackEvent("pageview", {
            path: pathname,
            full_url: typeof window !== "undefined" ? window.location.href : "",
            referrer:
                typeof document !== "undefined" ? document.referrer : null,
        });

        lastPathRef.current = fullPath;
        startTimeRef.current = Date.now();
    }, [pathname, searchParams]);
}

/**
 * Hook to track article views
 */
export function useArticleTracking(articleId: string | null) {
    const startTimeRef = useRef<number>(Date.now());
    const maxScrollRef = useRef<number>(0);
    const trackedRef = useRef<boolean>(false);

    useEffect(() => {
        if (!articleId || trackedRef.current) return;

        // Track article view
        trackEvent("article", {
            article_id: articleId,
        });
        trackedRef.current = true;

        // Track scroll depth
        const handleScroll = () => {
            const scrollHeight =
                document.documentElement.scrollHeight - window.innerHeight;
            const currentScroll = window.scrollY;
            const scrollPercent = Math.round(
                (currentScroll / scrollHeight) * 100,
            );
            maxScrollRef.current = Math.max(
                maxScrollRef.current,
                scrollPercent,
            );
        };

        window.addEventListener("scroll", handleScroll);

        // Track time and scroll on unmount
        return () => {
            window.removeEventListener("scroll", handleScroll);

            const timeOnArticle = Math.round(
                (Date.now() - startTimeRef.current) / 1000,
            );
            // Could send an update with time and scroll depth here
        };
    }, [articleId]);
}

/**
 * Track search events
 */
export function trackSearch(query: string, resultsCount: number) {
    return trackEvent("search", {
        query,
        results_count: resultsCount,
    });
}

/**
 * Track custom events
 */
export function trackCustomEvent(
    eventType: string,
    eventAction: string,
    options?: {
        category?: string;
        label?: string;
        value?: number;
        pagePath?: string;
        articleId?: string;
        metadata?: Record<string, unknown>;
    },
) {
    return trackEvent("event", {
        event_type: eventType,
        event_action: eventAction,
        event_category: options?.category,
        event_label: options?.label,
        event_value: options?.value,
        page_path:
            options?.pagePath ||
            (typeof window !== "undefined" ? window.location.pathname : ""),
        article_id: options?.articleId,
        metadata: options?.metadata,
    });
}

/**
 * Pre-built event trackers for common actions
 */
export const internalAnalytics = {
    // Article interactions
    articleCopyLink: (articleId: string) =>
        trackCustomEvent("article_action", "copy_link", { articleId }),

    articleSuggestEdit: (articleId: string) =>
        trackCustomEvent("article_action", "suggest_edit", { articleId }),

    articleEdit: (articleId: string) =>
        trackCustomEvent("article_action", "edit", { articleId }),

    articleShare: (articleId: string, platform: string) =>
        trackCustomEvent("article_action", "share", {
            articleId,
            metadata: { platform },
        }),

    // Navigation
    categoryClick: (categorySlug: string) =>
        trackCustomEvent("navigation", "category_click", {
            metadata: { category: categorySlug },
        }),

    tagClick: (tagSlug: string) =>
        trackCustomEvent("navigation", "tag_click", {
            metadata: { tag: tagSlug },
        }),

    // Search
    searchClick: (query: string, articleId: string, position: number) =>
        trackCustomEvent("search", "result_click", {
            articleId,
            metadata: { query, position },
        }),

    // Auth
    loginClick: () => trackCustomEvent("auth", "login_click"),
    signupClick: () => trackCustomEvent("auth", "signup_click"),
    logoutClick: () => trackCustomEvent("auth", "logout_click"),

    // Content creation
    newArticleStart: () => trackCustomEvent("content", "new_article_start"),
    articleSave: (articleId: string, isDraft: boolean) =>
        trackCustomEvent("content", isDraft ? "save_draft" : "save_publish", {
            articleId,
        }),

    // External links
    externalLinkClick: (url: string) =>
        trackCustomEvent("link", "external_click", {
            metadata: { url },
        }),

    // Errors
    error: (errorType: string, errorMessage: string) =>
        trackCustomEvent("error", errorType, {
            label: errorMessage,
        }),
};

export default internalAnalytics;
