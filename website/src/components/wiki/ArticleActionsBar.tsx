"use client";

import { analytics } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { useState } from "react";

interface ArticleActionsBarProps {
    articleId: string;
    articleSlug: string;
    categorySlug: string;
}

export function ArticleActionsBar({
    articleId,
    articleSlug,
    categorySlug,
}: ArticleActionsBarProps) {
    const { isAuthenticated, getLoginUrl } = useAuth();
    const [copied, setCopied] = useState(false);

    const handleSuggestEdit = () => {
        analytics.trackArticleAction("suggest_edit", articleId);

        if (!isAuthenticated) {
            // Redirect to login with return URL
            window.location.href = getLoginUrl(window.location.href);
            return;
        }
        // Go to edit page
        window.location.href = `/edit/${articleId}`;
    };

    const handleCopyLink = async () => {
        analytics.trackArticleAction("copy_link", articleId);

        try {
            const url = `${window.location.origin}/${categorySlug}/${articleSlug}`;
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement("textarea");
            textArea.value = window.location.href;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="flex items-center gap-4">
            <button
                onClick={handleSuggestEdit}
                className="flex items-center gap-1 transition-colors hover:text-white"
            >
                <span>📝</span> Suggest edit
            </button>
            <button
                onClick={handleCopyLink}
                className="flex items-center gap-1 transition-colors hover:text-white"
            >
                <span>{copied ? "✓" : "🔗"}</span>{" "}
                {copied ? "Copied!" : "Copy link"}
            </button>
        </div>
    );
}
