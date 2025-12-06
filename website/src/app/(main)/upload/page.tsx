"use client";

import MediaUpload from "@/components/MediaUpload";
import NameInputModal from "@/components/NameInputModal";
import PhotoGallery from "@/components/PhotoGallery";
import VideoGallery from "@/components/VideoGallery";
import {
    checkPassword,
    getPhotoCount,
    getPhotos,
    getVideoCount,
    getVideos,
    initializeCsrf,
    type Photo,
    type Video,
    type VideoUploadChunkResponse,
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
    const [videos, setVideos] = useState<Video[]>([]);
    const [error, setError] = useState<string>("");
    const [currentPhotoPage, setCurrentPhotoPage] = useState(1);
    const [currentVideoPage, setCurrentVideoPage] = useState(1);
    const [totalPhotos, setTotalPhotos] = useState(0);
    const [totalVideos, setTotalVideos] = useState(0);
    const [isLoadingMorePhotos, setIsLoadingMorePhotos] = useState(false);
    const [isLoadingMoreVideos, setIsLoadingMoreVideos] = useState(false);
    const [activeTab, setActiveTab] = useState<"photos" | "videos">("photos");
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

                // Load existing photos and videos
                const [existingPhotos, photoCount, existingVideos, videoCount] =
                    await Promise.all([
                        getPhotos(1, PAGE_SIZE),
                        getPhotoCount(),
                        getVideos(1, PAGE_SIZE),
                        getVideoCount(),
                    ]);
                setPhotos(existingPhotos);
                setTotalPhotos(photoCount);
                setVideos(existingVideos);
                setTotalVideos(videoCount);
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

    const handleVideoUploaded = (response: VideoUploadChunkResponse) => {
        // Video is uploaded but may still be processing
        // Refresh the videos list after a short delay
        setTimeout(async () => {
            try {
                const [updatedVideos, videoCount] = await Promise.all([
                    getVideos(1, PAGE_SIZE),
                    getVideoCount(),
                ]);
                setVideos(updatedVideos);
                setTotalVideos(videoCount);
            } catch (err) {
                console.error("Failed to refresh videos:", err);
            }
        }, 2000);
    };

    const handleLoadMorePhotos = async () => {
        setIsLoadingMorePhotos(true);
        try {
            const nextPage = currentPhotoPage + 1;
            const morePhotos = await getPhotos(nextPage, PAGE_SIZE);
            setPhotos((prev) => [...prev, ...morePhotos]);
            setCurrentPhotoPage(nextPage);
        } catch (err) {
            console.error("Failed to load more photos:", err);
        } finally {
            setIsLoadingMorePhotos(false);
        }
    };

    const handleLoadMoreVideos = async () => {
        setIsLoadingMoreVideos(true);
        try {
            const nextPage = currentVideoPage + 1;
            const moreVideos = await getVideos(nextPage, PAGE_SIZE);
            setVideos((prev) => [...prev, ...moreVideos]);
            setCurrentVideoPage(nextPage);
        } catch (err) {
            console.error("Failed to load more videos:", err);
        } finally {
            setIsLoadingMoreVideos(false);
        }
    };

    const hasMorePhotos = photos.length < totalPhotos;
    const hasMoreVideos = videos.length < totalVideos;

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
                                    Share Your Memories
                                </h2>
                                <p className="text-sm text-gray-300">
                                    Upload photos and videos from our special
                                    day
                                </p>
                            </div>
                            <MediaUpload
                                guestName={guestName}
                                onPhotoUploaded={handlePhotoUploaded}
                                onVideoUploaded={handleVideoUploaded}
                            />
                        </div>
                    )}

                    {/* Gallery Section with Tabs */}
                    <div>
                        {/* Tab Navigation */}
                        <div className="mb-6 border-b border-gray-700">
                            <nav className="-mb-px flex space-x-8">
                                <button
                                    onClick={() => setActiveTab("photos")}
                                    className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                                        activeTab === "photos"
                                            ? "border-[#dab94d] text-[#dab94d]"
                                            : "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-300"
                                    }`}
                                >
                                    Photos ({totalPhotos})
                                </button>
                                <button
                                    onClick={() => setActiveTab("videos")}
                                    className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                                        activeTab === "videos"
                                            ? "border-[#dab94d] text-[#dab94d]"
                                            : "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-300"
                                    }`}
                                >
                                    Videos ({totalVideos})
                                </button>
                            </nav>
                        </div>

                        {/* Photo Gallery */}
                        {activeTab === "photos" && (
                            <div>
                                <div className="mb-4">
                                    <p className="text-sm text-gray-300">
                                        {totalPhotos}{" "}
                                        {totalPhotos === 1 ? "photo" : "photos"}{" "}
                                        shared by our guests
                                    </p>
                                </div>
                                <PhotoGallery
                                    photos={photos}
                                    onLoadMore={handleLoadMorePhotos}
                                    hasMore={hasMorePhotos}
                                    isLoading={isLoadingMorePhotos}
                                />
                            </div>
                        )}

                        {/* Video Gallery */}
                        {activeTab === "videos" && (
                            <div>
                                <div className="mb-4">
                                    <p className="text-sm text-gray-300">
                                        {totalVideos}{" "}
                                        {totalVideos === 1 ? "video" : "videos"}{" "}
                                        shared by our guests
                                    </p>
                                </div>
                                <VideoGallery
                                    videos={videos}
                                    onLoadMore={handleLoadMoreVideos}
                                    hasMore={hasMoreVideos}
                                    isLoading={isLoadingMoreVideos}
                                />
                            </div>
                        )}
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
