import fs from "fs";
import type { MetadataRoute } from "next";
import path from "path";

const BASE_URL = "https://weddingofrebeccanadpeter.co.uk";

// Helper function to generate full path and get last modified date
const getLastModified = (relativePath: string) => {
    const filePath = path.join(
        process.cwd(),
        "src",
        "app",
        "(main)",
        relativePath,
        "page.tsx",
    );
    try {
        return fs.statSync(filePath).mtime;
    } catch (error) {
        console.error(`Error reading file: ${filePath}`, error);
        return new Date(); // Fallback to current date
    }
};

// Define pages and metadata
const pages = [{ path: "", priority: 1.0 }];

export default function sitemap(): MetadataRoute.Sitemap {
    return pages.map(({ path, priority }) => ({
        url: `${BASE_URL}/${path}`,
        lastModified: getLastModified(path || ""), // Handle root page correctly
        priority,
    }));
}
