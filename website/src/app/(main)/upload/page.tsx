"use client";

import NameInputModal from "@/components/NameInputModal";
import PhotoGallery from "@/components/PhotoGallery";
import PhotoUpload from "@/components/PhotoUpload";
import {
    checkPassword,
    getPhotoCount,
    getPhotos,
    initializeCsrf,
    type Photo,
} from "@/lib/api";
import { COOKIE_NAMES, getCookie, setCookie } from "@/lib/cookies";
import { Cormorant_Garamond } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const cormorantGaramond = Cormorant_Garamond({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

function UploadPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [showNameModal, setShowNameModal] = useState(false);
    const [guestName, setGuestName] = useState<string>("");
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [error, setError] = useState<string>("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPhotos, setTotalPhotos] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const PAGE_SIZE = 50;

    useEffect(() => {
        async function initialize() {
            try {
                // Initialize CSRF token
                await initializeCsrf();

                // Check password from URL
                const password = searchParams.get("password");
                if (!password) {
                    router.push("/");
                    return;
                }

                // Validate password with backend
                const isValid = await checkPassword(password);
                if (!isValid) {
                    setError("Invalid password. Please check your QR code.");
                    setIsLoading(false);
                    return;
                }

                setIsAuthorized(true);

                // Check if guest name is stored
                const storedName = getCookie(COOKIE_NAMES.GUEST_NAME);
                if (storedName) {
                    setGuestName(storedName);
                } else {
                    setShowNameModal(true);
                }

                // Load existing photos
                const [existingPhotos, photoCount] = await Promise.all([
                    getPhotos(1, PAGE_SIZE),
                    getPhotoCount(),
                ]);
                setPhotos(existingPhotos);
                setTotalPhotos(photoCount);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "Failed to initialize",
                );
            } finally {
                setIsLoading(false);
            }
        }

        initialize();
    }, [searchParams, router]);

    const handleNameSubmit = (name: string) => {
        setGuestName(name);
        setCookie(COOKIE_NAMES.GUEST_NAME, name);
        setShowNameModal(false);
    };

    const handlePhotoUploaded = (photo: Photo) => {
        setPhotos((prev) => [photo, ...prev]);
        setTotalPhotos((prev) => prev + 1);
    };

    const handleLoadMore = async () => {
        setIsLoadingMore(true);
        try {
            const nextPage = currentPage + 1;
            const morePhotos = await getPhotos(nextPage, PAGE_SIZE);
            setPhotos((prev) => [...prev, ...morePhotos]);
            setCurrentPage(nextPage);
        } catch (err) {
            console.error("Failed to load more photos:", err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const hasMorePhotos = photos.length < totalPhotos;

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#1c324a]">
                <div className="size-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            </div>
        );
    }

    if (error || !isAuthorized) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#1c324a] px-4">
                <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                    <p className="text-red-800">{error || "Access denied"}</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <NameInputModal
                isOpen={showNameModal}
                onSubmit={handleNameSubmit}
            />

            <div className="min-h-screen bg-[#1c324a]">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <div className="mx-auto flex flex-col items-center">
                            {/* "the WEDDING of" image - responsive */}
                            <div className="relative w-full max-w-md overflow-hidden">
                                <Image
                                    src="/images/the-wedding-of-desktop.png"
                                    alt="the WEDDING of"
                                    width={1200}
                                    height={240}
                                    className="hidden w-full scale-125 sm:block"
                                    priority
                                />
                                <Image
                                    src="/images/the-wedding-of-mobile.png"
                                    alt="the WEDDING of"
                                    width={800}
                                    height={160}
                                    className="w-full scale-125 sm:hidden"
                                    priority
                                />
                            </div>
                            {/* Names in Cormorant Garamond */}
                            <h1
                                className={`${cormorantGaramond.className} text-4xl font-semibold tracking-wide text-[#dab94d] sm:text-5xl`}
                            >
                                REBECCA & PETER
                            </h1>
                        </div>
                        <p className="mt-2 text-2xl text-gray-200">
                            Share Your Special Moments
                        </p>
                        {guestName && (
                            <p className="mt-1 text-lg text-gray-300">
                                Welcome, {guestName}!
                            </p>
                        )}

                        {/* Link to Guestbook */}
                        <div className="mt-4">
                            <Link
                                href={`/guestbook?password=${searchParams.get("password")}`}
                                className="inline-flex items-center gap-2 rounded-md bg-[#2d4a66] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#355270]"
                            >
                                Leave a Message in Our Guestbook
                            </Link>
                        </div>
                    </div>

                    {/* Upload Section */}
                    {guestName && (
                        <div className="mb-12">
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold text-white">
                                    Upload Your Photos
                                </h2>
                                <p className="text-sm text-gray-300">
                                    Share the moments you captured from our
                                    special day
                                </p>
                            </div>
                            <PhotoUpload
                                guestName={guestName}
                                onPhotoUploaded={handlePhotoUploaded}
                            />
                        </div>
                    )}

                    {/* Gallery Section */}
                    <div>
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-white">
                                Photo Gallery
                            </h2>
                            <p className="text-sm text-gray-300">
                                {totalPhotos}{" "}
                                {totalPhotos === 1 ? "photo" : "photos"} shared
                                by our guests
                            </p>
                        </div>
                        <PhotoGallery
                            photos={photos}
                            onLoadMore={handleLoadMore}
                            hasMore={hasMorePhotos}
                            isLoading={isLoadingMore}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

export default function UploadPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#1c324a]">
                    <div className="size-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                </div>
            }
        >
            <UploadPageContent />
        </Suspense>
    );
}
