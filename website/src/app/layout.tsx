import type { Metadata } from "next";

import { GoogleAdSenseScript } from "@/lib/analytics/AdSense";
import { GoogleAnalytics } from "@/lib/analytics/GoogleAnalytics";
import "./globals.css";

export const metadata: Metadata = {
    title: "Tech Wiki",
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="h-full" suppressHydrationWarning>
            <head>
                <link
                    rel="icon"
                    type="image/png"
                    href="/favicon-96x96.png"
                    sizes="96x96"
                />
                <link rel="shortcut icon" href="/favicon.ico" />
                <link
                    rel="apple-touch-icon"
                    sizes="180x180"
                    href="/apple-touch-icon.png"
                />
                <meta name="apple-mobile-web-app-title" content="Tech Wiki" />
                <link rel="manifest" href="/site.webmanifest" />
                <meta
                    httpEquiv="Permissions-Policy"
                    content="picture-in-picture '*'"
                />
            </head>
            <body className="h-full bg-[#1c324a] text-gray-200">
                <GoogleAnalytics />
                <GoogleAdSenseScript />
                {children}
            </body>
        </html>
    );
}
