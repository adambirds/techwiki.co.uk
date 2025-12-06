"use client";

import { type Video } from "@/lib/api";
import { PlayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { useState } from "react";

interface VideoGalleryProps {
    videos: Video[];
    onLoadMore?: () => void;
    hasMore?: boolean;
    isLoading?: boolean;
}

interface VideoPlayerModalProps {
    video: Video;
    onClose: () => void;
}

function formatDuration(seconds: number | null): string {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function VideoPlayerModal({ video, onClose }: VideoPlayerModalProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-7xl overflow-hidden rounded-lg bg-[#1c324a]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                >
                    <XMarkIcon className="size-6" />
                </button>

                {/* Video player */}
                {video.embed_url ? (
                    <iframe
                        src={video.embed_url}
                        className="w-full"
                        style={{ height: "80vh" }}
                        allow="autoplay; fullscreen"
                        allowFullScreen
                    />
                ) : video.web_url ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <p className="mb-4 text-white">
                            Video is still processing. Click below to view on
                            OneDrive.
                        </p>
                        <a
                            href={video.web_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                        >
                            Open in OneDrive
                        </a>
                    </div>
                ) : (
                    <div className="flex items-center justify-center p-8">
                        <p className="text-gray-400">
                            Video is not available for playback yet.
                        </p>
                    </div>
                )}

                {/* Video info */}
                <div className="border-t border-gray-700 p-4">
                    <h3 className="truncate text-lg font-medium text-white">
                        {video.filename}
                    </h3>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-400">
                        <span>Uploaded by {video.uploaded_by}</span>
                        <span>{formatFileSize(video.file_size)}</span>
                        {video.duration_seconds && (
                            <span>
                                {formatDuration(video.duration_seconds)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function VideoGallery({
    videos,
    onLoadMore,
    hasMore,
    isLoading,
}: VideoGalleryProps) {
    const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

    if (videos.length === 0) {
        return (
            <div className="rounded-lg border-2 border-dashed border-gray-600 p-8 text-center">
                <p className="text-gray-400">No videos have been shared yet.</p>
            </div>
        );
    }

    return (
        <>
            {/* Video player modal */}
            {selectedVideo && (
                <VideoPlayerModal
                    video={selectedVideo}
                    onClose={() => setSelectedVideo(null)}
                />
            )}

            {/* Video grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((video) => (
                    <div
                        key={video.id}
                        className="group relative cursor-pointer overflow-hidden rounded-lg bg-[#253a52]"
                        onClick={() => setSelectedVideo(video)}
                    >
                        {/* Thumbnail or placeholder */}
                        <div className="relative aspect-video bg-gray-800">
                            {video.thumbnail_url ? (
                                <Image
                                    src={video.thumbnail_url}
                                    alt={video.filename}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <PlayIcon className="size-32 text-gray-600" />
                                </div>
                            )}

                            {/* Play overlay */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                <div className="rounded-full bg-white/20 p-4">
                                    <PlayIcon className="size-16 text-white" />
                                </div>
                            </div>

                            {/* Duration badge */}
                            {video.duration_seconds && (
                                <div className="absolute right-2 bottom-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                                    {formatDuration(video.duration_seconds)}
                                </div>
                            )}

                            {/* Processing indicator */}
                            {!video.is_playable && (
                                <div className="absolute top-2 left-2 rounded bg-yellow-600/80 px-2 py-1 text-xs text-white">
                                    Processing...
                                </div>
                            )}
                        </div>

                        {/* Video info */}
                        <div className="p-3">
                            <p className="truncate text-sm font-medium text-white">
                                {video.filename}
                            </p>
                            <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                                <span>{video.uploaded_by}</span>
                                <span>{formatFileSize(video.file_size)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Load more button */}
            {hasMore && (
                <div className="mt-6 flex justify-center">
                    <button
                        onClick={onLoadMore}
                        disabled={isLoading}
                        className="rounded-md bg-[#2d4a66] px-6 py-2 text-sm font-medium text-white hover:bg-[#355270] disabled:opacity-50"
                    >
                        {isLoading ? "Loading..." : "Load More Videos"}
                    </button>
                </div>
            )}
        </>
    );
}
