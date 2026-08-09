"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { Suspense, useEffect } from "react";

// Extend Window type for gtag
declare global {
    interface Window {
        gtag: (
            command: string,
            action: string,
            params?: Record<string, unknown>,
        ) => void;
        dataLayer: unknown[];
    }
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

function GoogleAnalyticsInner() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (
            !GA_MEASUREMENT_ID ||
            typeof window === "undefined" ||
            typeof window.gtag !== "function"
        ) {
            return;
        }

        // Track page views
        const url =
            pathname +
            (searchParams.toString() ? `?${searchParams.toString()}` : "");
        window.gtag("config", GA_MEASUREMENT_ID, {
            page_path: url,
        });
    }, [pathname, searchParams]);

    return null;
}

export function GoogleAnalytics() {
    if (!GA_MEASUREMENT_ID) {
        return null;
    }

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${GA_MEASUREMENT_ID}', {
                        page_path: window.location.pathname,
                        send_page_view: false
                    });
                `}
            </Script>
            <Suspense fallback={null}>
                <GoogleAnalyticsInner />
            </Suspense>
        </>
    );
}

// Analytics event tracking utilities
export const analytics = {
    // Track custom events
    event: (action: string, params?: Record<string, unknown>) => {
        if (typeof window !== "undefined" && window.gtag && GA_MEASUREMENT_ID) {
            window.gtag("event", action, params);
        }
    },

    // Track button clicks
    trackButtonClick: (buttonName: string, location?: string) => {
        analytics.event("button_click", {
            button_name: buttonName,
            location: location,
        });
    },

    // Track link clicks
    trackLinkClick: (
        linkUrl: string,
        linkText?: string,
        isExternal?: boolean,
    ) => {
        analytics.event("link_click", {
            link_url: linkUrl,
            link_text: linkText,
            is_external: isExternal,
        });
    },

    // Track search usage
    trackSearch: (query: string, resultsCount?: number) => {
        analytics.event("search", {
            search_term: query,
            results_count: resultsCount,
        });
    },

    // Track article views
    trackArticleView: (
        articleId: string,
        articleTitle: string,
        category?: string,
    ) => {
        analytics.event("article_view", {
            article_id: articleId,
            article_title: articleTitle,
            category: category,
        });
    },

    // Track article actions
    trackArticleAction: (
        action: "edit" | "copy_link" | "share" | "suggest_edit",
        articleId: string,
    ) => {
        analytics.event("article_action", {
            action: action,
            article_id: articleId,
        });
    },

    // Track user authentication
    trackAuth: (action: "login" | "signup" | "logout") => {
        analytics.event("auth", {
            action: action,
        });
    },

    // Track navigation
    trackNavigation: (from: string, to: string) => {
        analytics.event("navigation", {
            from: from,
            to: to,
        });
    },

    // Track category browsing
    trackCategoryView: (categorySlug: string, categoryName: string) => {
        analytics.event("category_view", {
            category_slug: categorySlug,
            category_name: categoryName,
        });
    },

    // Track content creation
    trackContentCreation: (
        action: "start" | "save_draft" | "submit" | "publish",
        articleId?: string,
    ) => {
        analytics.event("content_creation", {
            action: action,
            article_id: articleId,
        });
    },

    // Track errors
    trackError: (
        errorType: string,
        errorMessage: string,
        location?: string,
    ) => {
        analytics.event("error", {
            error_type: errorType,
            error_message: errorMessage,
            location: location,
        });
    },

    // Track page timing
    trackTiming: (category: string, name: string, value: number) => {
        analytics.event("timing_complete", {
            name: name,
            value: value,
            event_category: category,
        });
    },
};

export default GoogleAnalytics;
