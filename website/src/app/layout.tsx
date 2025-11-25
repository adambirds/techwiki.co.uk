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
                <meta
                    httpEquiv="Permissions-Policy"
                    content="picture-in-picture '*'"
                />
            </head>
            <body className="h-full bg-[#1c324a]">{children}</body>
        </html>
    );
}
