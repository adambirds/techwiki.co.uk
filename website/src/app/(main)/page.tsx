import WeddingCountdown from "@/components/WeddingCountdown";
import { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

const cormorantGaramond = Cormorant_Garamond({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "Wedding of Rebecca and Peter",
};

export default async function Home() {
    return (
        <div className="min-h-screen bg-[#1c324a]">
            {/* Hero Section */}
            <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
                {/* Wedding Title - Large */}
                <div className="mx-auto mb-8 flex flex-col items-center">
                    <div className="relative w-full max-w-3xl overflow-hidden">
                        <Image
                            src="/images/the-wedding-of-desktop.png"
                            alt="the WEDDING of"
                            width={800}
                            height={160}
                            className="hidden w-full scale-125 sm:block"
                            priority
                        />
                        <Image
                            src="/images/the-wedding-of-mobile.png"
                            alt="the WEDDING of"
                            width={600}
                            height={120}
                            className="w-full scale-125 sm:hidden"
                            priority
                        />
                    </div>
                    <h1
                        className={`${cormorantGaramond.className} mt-6 text-center text-6xl font-semibold tracking-wide text-[#d4af37] sm:text-7xl md:text-8xl`}
                    >
                        REBECCA & PETER
                    </h1>
                </div>

                {/* Wedding Date, Location, and Countdown */}
                <WeddingCountdown />

                {/* Photo Gallery Grid */}
                <div className="mb-12 grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg shadow-xl">
                        <Image
                            src="/images/becca-pete-hero-image.jpg"
                            alt="Rebecca and Peter"
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                        />
                    </div>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg shadow-xl">
                        <Image
                            src="/images/becca-pete-home-image.jpg"
                            alt="Rebecca and Peter"
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                        />
                    </div>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg shadow-xl">
                        <Image
                            src="/images/becca-pete-share-memories-1.jpg"
                            alt="Rebecca and Peter"
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                        />
                    </div>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg shadow-xl">
                        <Image
                            src="/images/becca-pete-share-memories-2.jpg"
                            alt="Rebecca and Peter"
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                        />
                    </div>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg shadow-xl">
                        <Image
                            src="/images/becca-pete-share-memories-3.jpg"
                            alt="Rebecca and Peter"
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                        />
                    </div>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg shadow-xl">
                        <Image
                            src="/images/becca-pete-hero-image.jpg"
                            alt="Rebecca and Peter"
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                        />
                    </div>
                </div>

                {/* Call to Action Button */}
                <div className="flex flex-col items-center gap-4">
                    <Link
                        href="https://www.theknot.com/us/rebecca-birds-and-peter-boyle-dec-2025"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-[#2d4a66] px-8 py-4 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-[#355270]"
                    >
                        View Our Wedding on The Knot
                    </Link>
                </div>
            </div>
        </div>
    );
}
