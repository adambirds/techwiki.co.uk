import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
    title: "Wedding of Rebecca and Peter",
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
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link rel="shortcut icon" href="/favicon.ico" />
                <link
                    rel="apple-touch-icon"
                    sizes="180x180"
                    href="/apple-touch-icon.png"
                />
                <meta
                    name="apple-mobile-web-app-title"
                    content="Wedding of Rebecca & Peter"
                />
                <link rel="manifest" href="/site.webmanifest" />
                <meta
                    httpEquiv="Permissions-Policy"
                    content="picture-in-picture '*'"
                />
            </head>
            <body className="h-full bg-[#1c324a]">{children}</body>
        </html>
    );
}
