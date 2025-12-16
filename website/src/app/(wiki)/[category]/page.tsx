import { ArticleCard } from "@/components/wiki/ArticleCard";
import { getArticles, getCategory } from "@/lib/wiki/api";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface CategoryPageProps {
    params: Promise<{ category: string }>;
    searchParams: Promise<{ page?: string; type?: string }>;
}

export async function generateMetadata({
    params,
}: CategoryPageProps): Promise<Metadata> {
    const { category: slug } = await params;
    const response = await getCategory(slug).catch(() => null);

    if (!response?.success || !response.categories?.[0]) {
        return { title: "Category Not Found | TechWiki" };
    }

    const category = response.categories[0];
    return {
        title: `${category.name} | TechWiki`,
        description:
            category.description ||
            `Browse ${category.name} articles on TechWiki`,
    };
}

// Revalidate every 60 seconds
export const revalidate = 60;

export default async function CategoryPage({
    params,
    searchParams,
}: CategoryPageProps) {
    const { category: slug } = await params;
    const { page = "1", type } = await searchParams;
    const currentPage = parseInt(page, 10);

    const [categoryRes, articlesRes] = await Promise.all([
        getCategory(slug).catch(() => null),
        getArticles({
            category: slug,
            article_type: type,
            page: currentPage,
            per_page: 12,
        }).catch(() => null),
    ]);

    // Handle category not found
    if (!categoryRes?.success) {
        notFound();
    }

    const category = (
        categoryRes as {
            success: boolean;
            category?: {
                id: string;
                name: string;
                slug: string;
                description: string;
                icon: string;
            };
        }
    ).category;
    const articles = articlesRes?.success ? articlesRes.articles : [];
    const totalPages = articlesRes?.success ? articlesRes.total_pages : 0;
    const total = articlesRes?.success ? articlesRes.total : 0;

    if (!category) {
        notFound();
    }

    return (
        <div>
            {/* Category header */}
            <div className="mb-8">
                <div className="mb-4 flex items-center gap-3">
                    {category.icon && (
                        <span className="text-4xl">{category.icon}</span>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold text-white">
                            {category.name}
                        </h1>
                        {category.description && (
                            <p className="mt-1 text-gray-400">
                                {category.description}
                            </p>
                        )}
                    </div>
                </div>
                <div className="text-sm text-gray-500">
                    {total} article{total !== 1 ? "s" : ""}
                </div>
            </div>

            {/* Filter bar */}
            <div className="mb-6 flex items-center gap-4">
                <span className="text-gray-400">Filter by type:</span>
                <div className="flex items-center gap-2">
                    {[
                        "",
                        "documentation",
                        "tutorial",
                        "blog",
                        "guide",
                        "reference",
                    ].map((t) => (
                        <Link
                            key={t}
                            href={`/${slug}${t ? `?type=${t}` : ""}`}
                            className={`rounded-lg px-3 py-1 text-sm transition-colors ${
                                (type || "") === t
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                            }`}
                        >
                            {t ? t.charAt(0).toUpperCase() + t.slice(1) : "All"}
                        </Link>
                    ))}
                </div>
            </div>

            {/* Articles grid */}
            {articles.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {articles.map((article) => (
                        <ArticleCard key={article.id} article={article} />
                    ))}
                </div>
            ) : (
                <div className="py-12 text-center">
                    <p className="text-gray-400">
                        No articles in this category yet.
                    </p>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                    <Link
                        href={`/${slug}?page=${currentPage - 1}${type ? `&type=${type}` : ""}`}
                        className={`rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white hover:bg-gray-700 ${
                            currentPage <= 1
                                ? "pointer-events-none opacity-50"
                                : ""
                        }`}
                    >
                        Previous
                    </Link>
                    <span className="text-gray-400">
                        Page {currentPage} of {totalPages}
                    </span>
                    <Link
                        href={`/${slug}?page=${currentPage + 1}${type ? `&type=${type}` : ""}`}
                        className={`rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white hover:bg-gray-700 ${
                            currentPage >= totalPages
                                ? "pointer-events-none opacity-50"
                                : ""
                        }`}
                    >
                        Next
                    </Link>
                </div>
            )}
        </div>
    );
}
