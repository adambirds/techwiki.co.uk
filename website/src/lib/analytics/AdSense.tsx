"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

// Extend Window type for adsbygoogle
declare global {
    interface Window {
        adsbygoogle: unknown[];
    }
}

/**
 * Google AdSense initialization script
 * Include this once in your layout
 */
export function GoogleAdSenseScript() {
    if (!ADSENSE_CLIENT_ID) {
        return null;
    }

    return (
        <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
        />
    );
}

interface AdUnitProps {
    slot: string;
    format?: "auto" | "fluid" | "rectangle" | "vertical" | "horizontal";
    responsive?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Google AdSense Ad Unit
 */
export function AdUnit({
    slot,
    format = "auto",
    responsive = true,
    className = "",
    style,
}: AdUnitProps) {
    const adRef = useRef<HTMLModElement>(null);
    const isLoaded = useRef(false);

    useEffect(() => {
        if (!ADSENSE_CLIENT_ID || !slot || isLoaded.current) return;

        try {
            // Push ad to adsbygoogle
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            isLoaded.current = true;
        } catch (error) {
            console.error("AdSense error:", error);
        }
    }, [slot]);

    if (!ADSENSE_CLIENT_ID || !slot) {
        return null;
    }

    return (
        <ins
            ref={adRef}
            className={`adsbygoogle ${className}`}
            style={{
                display: "block",
                ...style,
            }}
            data-ad-client={ADSENSE_CLIENT_ID}
            data-ad-slot={slot}
            data-ad-format={format}
            data-full-width-responsive={responsive ? "true" : "false"}
            aria-label="Advertisement"
        />
    );
}

/**
 * In-article ad unit - best for within content
 */
export function InArticleAd({
    slot,
    className = "",
}: {
    slot: string;
    className?: string;
}) {
    return (
        <div className={`my-8 ${className}`}>
            <AdUnit slot={slot} format="fluid" />
        </div>
    );
}

/**
 * Sidebar ad unit - best for sidebars
 */
export function SidebarAd({
    slot,
    className = "",
}: {
    slot: string;
    className?: string;
}) {
    return (
        <div className={`mb-6 ${className}`}>
            <AdUnit slot={slot} format="rectangle" />
        </div>
    );
}

/**
 * Banner ad unit - best for header/footer
 */
export function BannerAd({
    slot,
    className = "",
}: {
    slot: string;
    className?: string;
}) {
    return (
        <div className={`w-full ${className}`}>
            <AdUnit slot={slot} format="horizontal" responsive />
        </div>
    );
}

export default AdUnit;
