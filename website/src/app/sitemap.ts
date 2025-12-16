import { getSitemapData } from "@/lib/wiki/api";
import type { MetadataRoute } from "next";

const BASE_URL = "https://techwiki.co.uk";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: BASE_URL,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 1.0,
        },
        {
            url: `${BASE_URL}/search`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.5,
        },
        {
            url: `${BASE_URL}/categories`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
        },
    ];

    // Fetch dynamic wiki content
    try {
        const sitemapData = await getSitemapData();

        if (sitemapData.success) {
            // Add articles
            const articlePages: MetadataRoute.Sitemap =
                sitemapData.articles.map((article) => ({
                    url: `${BASE_URL}${article.url}`,
                    lastModified: new Date(article.lastModified),
                    changeFrequency: article.changeFrequency as
                        | "daily"
                        | "weekly"
                        | "monthly",
                    priority: article.priority,
                }));

            // Add categories
            const categoryPages: MetadataRoute.Sitemap =
                sitemapData.categories.map((category) => ({
                    url: `${BASE_URL}${category.url}`,
                    lastModified: new Date(category.lastModified),
                    changeFrequency: category.changeFrequency as
                        | "daily"
                        | "weekly"
                        | "monthly",
                    priority: category.priority,
                }));

            return [...staticPages, ...categoryPages, ...articlePages];
        }
    } catch (error) {
        console.error("Failed to fetch sitemap data:", error);
    }

    return staticPages;
}
