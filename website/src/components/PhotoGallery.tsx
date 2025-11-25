"use client";

import { type Photo } from "@/lib/api";
import { XMarkIcon } from "@heroicons/react/24/solid";
import Image from "next/image";
import { useState } from "react";

interface PhotoGalleryProps {
    photos: Photo[];
    onLoadMore?: () => void;
    hasMore?: boolean;
    isLoading?: boolean;
}

export default function PhotoGallery({
    photos,
    onLoadMore,
    hasMore = false,
    isLoading = false,
}: PhotoGalleryProps) {
    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

    if (photos.length === 0) {
        return (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                <p className="text-gray-500">
                    No photos yet. Be the first to share a memory!
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {photos.map((photo) => (
                    <div
                        key={photo.id}
                        className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-gray-100 transition-transform hover:scale-105"
                        onClick={() => setSelectedPhoto(photo)}
                    >
                        <Image
                            src={photo.image_url}
                            alt={`Photo by ${photo.uploaded_by}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <p className="truncate text-xs text-white">
                                {photo.uploaded_by}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Load More Button */}
            {hasMore && onLoadMore && (
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={onLoadMore}
                        disabled={isLoading}
                        className="rounded-md bg-[#2d4a66] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#355270] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Loading...
                            </span>
                        ) : (
                            "Load More Photos"
                        )}
                    </button>
                </div>
            )}

            {/* Lightbox Modal */}
            {selectedPhoto && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setSelectedPhoto(null)}
                >
                    <button
                        onClick={() => setSelectedPhoto(null)}
                        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                    >
                        <XMarkIcon className="size-6" />
                    </button>

                    <div className="relative max-h-[90vh] max-w-[90vw]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={selectedPhoto.image_url}
                            alt={`Photo by ${selectedPhoto.uploaded_by}`}
                            className="max-h-[90vh] max-w-full rounded-lg object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="mt-4 text-center">
                            <p className="text-sm text-white">
                                Uploaded by{" "}
                                <span className="font-medium">
                                    {selectedPhoto.uploaded_by}
                                </span>
                            </p>
                            <p className="text-xs text-gray-400">
                                {new Date(
                                    selectedPhoto.uploaded_at,
                                ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
