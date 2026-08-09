import { BannerAd, InArticleAd, SidebarAd } from "./AdSense";

const BANNER_SLOT = process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT;
const SIDEBAR_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT;
const IN_ARTICLE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_IN_ARTICLE_SLOT;

export function SiteBannerAd({ className = "" }: { className?: string }) {
    if (!BANNER_SLOT) return null;
    return <BannerAd slot={BANNER_SLOT} className={className} />;
}

export function SiteSidebarAd({ className = "" }: { className?: string }) {
    if (!SIDEBAR_SLOT) return null;
    return <SidebarAd slot={SIDEBAR_SLOT} className={className} />;
}

export function ArticleAd({ className = "" }: { className?: string }) {
    if (!IN_ARTICLE_SLOT) return null;
    return <InArticleAd slot={IN_ARTICLE_SLOT} className={className} />;
}
