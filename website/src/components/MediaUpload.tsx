"use client";

import {
    cancelVideoUpload,
    uploadPhoto,
    uploadVideoWithProgress,
    type Photo,
    type VideoUploadChunkResponse,
} from "@/lib/api";
import {
    CheckCircleIcon,
    ExclamationCircleIcon,
    PhotoIcon,
    VideoCameraIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { DragEvent, useRef, useState } from "react";
import ImageCropper from "./ImageCropperSimple";

interface MediaUploadProps {
    guestName: string;
    onPhotoUploaded: (photo: Photo) => void;
    onVideoUploaded: (response: VideoUploadChunkResponse) => void;
}

interface PreviewFile {
    id: string;
    file: File;
    preview: string;
    type: "photo" | "video";
    croppedBlob?: Blob;
}

interface UploadingFile {
    id: string;
    file: File;
    type: "photo" | "video";
    progress: number;
    bytesUploaded: number;
    status: "pending" | "uploading" | "completed" | "failed";
    error?: string;
    uploadId?: string;
}

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
];

const ALLOWED_VIDEO_TYPES = [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "video/x-matroska",
    "video/mpeg",
    "video/3gpp",
    "video/x-m4v",
];

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function MediaUpload({
    guestName,
    onPhotoUploaded,
    onVideoUploaded,
}: MediaUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [error, setError] = useState<string>("");
    const [cropperImage, setCropperImage] = useState<string | null>(null);
    const [cropperFileId, setCropperFileId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            handleFiles(files);
        }
    };

    const handleFiles = (files: File[]) => {
        setError("");

        const validFiles: PreviewFile[] = [];
        const errors: string[] = [];

        for (const file of files) {
            const isImage = file.type.startsWith("image/");
            const isVideo = file.type.startsWith("video/");

            if (!isImage && !isVideo) {
                errors.push(`${file.name} is not an image or video file`);
                continue;
            }

            if (isImage && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
                errors.push(`${file.name} has an unsupported image format`);
                continue;
            }

            if (isVideo && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
                errors.push(`${file.name} has an unsupported video format`);
                continue;
            }

            validFiles.push({
                id: `${file.name}-${Date.now()}-${Math.random()}`,
                file,
                preview: URL.createObjectURL(file),
                type: isImage ? "photo" : "video",
            });
        }

        if (errors.length > 0) {
            setError(errors.join(". "));
        }

        setPreviewFiles((prev) => [...prev, ...validFiles]);
    };

    const removePreview = (id: string) => {
        setPreviewFiles((prev) => {
            const file = prev.find((f) => f.id === id);
            if (file) {
                URL.revokeObjectURL(file.preview);
            }
            return prev.filter((f) => f.id !== id);
        });
    };

    const uploadFile = async (previewFile: PreviewFile) => {
        const { file, type, croppedBlob, id } = previewFile;

        // Create uploading file entry
        const uploadingFile: UploadingFile = {
            id,
            file,
            type,
            progress: 0,
            bytesUploaded: 0,
            status: "uploading",
        };

        setUploadingFiles((prev) => [...prev, uploadingFile]);

        try {
            if (type === "photo") {
                // Upload photo
                const fileToUpload = croppedBlob
                    ? new File([croppedBlob], file.name, { type: "image/jpeg" })
                    : file;

                // Set progress to 50% while uploading
                setUploadingFiles((prev) =>
                    prev.map((f) =>
                        f.id === id
                            ? {
                                  ...f,
                                  progress: 50,
                                  bytesUploaded: file.size / 2,
                              }
                            : f,
                    ),
                );

                const photo = await uploadPhoto(fileToUpload, guestName);
                onPhotoUploaded(photo);

                setUploadingFiles((prev) =>
                    prev.map((f) =>
                        f.id === id
                            ? {
                                  ...f,
                                  status: "completed",
                                  progress: 100,
                                  bytesUploaded: file.size,
                              }
                            : f,
                    ),
                );
            } else {
                // Upload video with chunked upload
                await uploadVideoWithProgress(
                    file,
                    guestName,
                    // Progress callback
                    (progress, bytesUploaded) => {
                        setUploadingFiles((prev) =>
                            prev.map((f) =>
                                f.id === id
                                    ? { ...f, progress, bytesUploaded }
                                    : f,
                            ),
                        );
                    },
                    // Complete callback
                    (response) => {
                        setUploadingFiles((prev) =>
                            prev.map((f) =>
                                f.id === id
                                    ? {
                                          ...f,
                                          status: "completed",
                                          progress: 100,
                                          uploadId: response.upload_id,
                                      }
                                    : f,
                            ),
                        );
                        onVideoUploaded(response);
                    },
                    // Error callback
                    (error) => {
                        setUploadingFiles((prev) =>
                            prev.map((f) =>
                                f.id === id
                                    ? {
                                          ...f,
                                          status: "failed",
                                          error: error.message,
                                      }
                                    : f,
                            ),
                        );
                    },
                );
            }

            // Remove from preview
            removePreview(id);
        } catch (err) {
            setUploadingFiles((prev) =>
                prev.map((f) =>
                    f.id === id
                        ? {
                              ...f,
                              status: "failed",
                              error:
                                  err instanceof Error
                                      ? err.message
                                      : "Upload failed",
                          }
                        : f,
                ),
            );
        }
    };

    const uploadAll = async () => {
        setError("");

        // Upload all files
        for (const previewFile of previewFiles) {
            await uploadFile(previewFile);
        }
    };

    const openCropper = (fileId: string) => {
        const file = previewFiles.find((f) => f.id === fileId);
        if (file && file.type === "photo") {
            setCropperImage(file.preview);
            setCropperFileId(fileId);
        }
    };

    const handleCropComplete = (croppedBlob: Blob) => {
        if (!cropperFileId) return;

        const croppedPreviewUrl = URL.createObjectURL(croppedBlob);

        setPreviewFiles((prev) =>
            prev.map((pf) => {
                if (pf.id === cropperFileId) {
                    URL.revokeObjectURL(pf.preview);
                    return {
                        ...pf,
                        preview: croppedPreviewUrl,
                        croppedBlob,
                    };
                }
                return pf;
            }),
        );

        setCropperImage(null);
        setCropperFileId(null);
    };

    const handleCropCancel = () => {
        setCropperImage(null);
        setCropperFileId(null);
    };

    const cancelUpload = async (uploadingFile: UploadingFile) => {
        if (
            uploadingFile.uploadId &&
            uploadingFile.status === "uploading" &&
            uploadingFile.type === "video"
        ) {
            try {
                await cancelVideoUpload(uploadingFile.uploadId);
            } catch (err) {
                console.error("Failed to cancel upload:", err);
            }
        }

        setUploadingFiles((prev) =>
            prev.filter((f) => f.id !== uploadingFile.id),
        );
    };

    const removeFromUploadList = (id: string) => {
        setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const photoCount = previewFiles.filter((f) => f.type === "photo").length;
    const videoCount = previewFiles.filter((f) => f.type === "video").length;

    return (
        <div className="space-y-4">
            {/* Image Cropper Modal */}
            {cropperImage && (
                <ImageCropper
                    image={cropperImage}
                    isOpen={!!cropperImage}
                    onComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                />
            )}

            {/* Drop zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                    isDragging
                        ? "border-blue-400 bg-[#253a52]"
                        : "border-gray-600 bg-[#253a52] hover:border-blue-500 hover:bg-[#2d4a66]"
                }`}
            >
                <div className="mb-4 flex items-center justify-center gap-3">
                    <PhotoIcon className="size-12 text-gray-400" />
                    <VideoCameraIcon className="size-12 text-gray-400" />
                </div>
                <div className="mt-4">
                    <p className="text-sm font-medium text-white">
                        Click to upload or drag and drop
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                        Photos: JPG, PNG, GIF, WebP
                    </p>
                    <p className="text-xs text-gray-400">
                        Videos: MP4, MOV, WebM, AVI (any size)
                    </p>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {/* Error message */}
            {error && (
                <div className="rounded-md bg-red-900/50 p-3">
                    <p className="text-sm text-red-200">{error}</p>
                </div>
            )}

            {/* Preview grid */}
            {previewFiles.length > 0 && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {previewFiles.map((file) => (
                            <div
                                key={file.id}
                                className="group relative aspect-square overflow-hidden rounded-lg bg-gray-800"
                            >
                                {file.type === "photo" ? (
                                    <Image
                                        src={file.preview}
                                        alt={file.file.name}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                                    />
                                ) : (
                                    <div className="flex size-full items-center justify-center">
                                        <VideoCameraIcon className="size-12 text-gray-600" />
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                                    {file.type === "photo" && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openCropper(file.id);
                                            }}
                                            className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
                                            title="Crop"
                                        >
                                            <svg
                                                className="size-5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
                                                />
                                            </svg>
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removePreview(file.id);
                                        }}
                                        className="rounded-full bg-red-600/80 p-2 text-white hover:bg-red-600"
                                        title="Remove"
                                    >
                                        <XMarkIcon className="size-5" />
                                    </button>
                                </div>

                                {/* File type badge */}
                                <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
                                    {file.type === "photo" ? "Photo" : "Video"}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Upload button */}
                    <button
                        onClick={uploadAll}
                        disabled={previewFiles.length === 0}
                        className="w-full rounded-md bg-[#2d4a66] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#355270] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Upload {photoCount + videoCount}{" "}
                        {photoCount + videoCount === 1 ? "file" : "files"}
                    </button>
                </div>
            )}

            {/* Upload progress list */}
            {uploadingFiles.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-white">
                        Uploading
                    </h3>
                    {uploadingFiles.map((file) => (
                        <div
                            key={file.id}
                            className="rounded-lg bg-[#253a52] p-4"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    {file.status === "completed" ? (
                                        <CheckCircleIcon className="size-5 text-green-400" />
                                    ) : file.status === "failed" ? (
                                        <ExclamationCircleIcon className="size-5 text-red-400" />
                                    ) : file.type === "photo" ? (
                                        <PhotoIcon className="size-5 text-blue-400" />
                                    ) : (
                                        <VideoCameraIcon className="size-5 text-purple-400" />
                                    )}
                                    <div>
                                        <p className="max-w-xs truncate text-sm font-medium text-white">
                                            {file.file.name}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {file.type === "video" && (
                                                <>
                                                    {formatFileSize(
                                                        file.bytesUploaded,
                                                    )}{" "}
                                                    /{" "}
                                                    {formatFileSize(
                                                        file.file.size,
                                                    )}
                                                </>
                                            )}
                                            {file.type === "photo" &&
                                                formatFileSize(file.file.size)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (
                                            file.status === "completed" ||
                                            file.status === "failed"
                                        ) {
                                            removeFromUploadList(file.id);
                                        } else {
                                            cancelUpload(file);
                                        }
                                    }}
                                    className="rounded-full p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
                                    title={
                                        file.status === "uploading"
                                            ? "Cancel upload"
                                            : "Remove"
                                    }
                                >
                                    <XMarkIcon className="size-4" />
                                </button>
                            </div>

                            {/* Progress bar for videos and uploading photos */}
                            {(file.status === "uploading" ||
                                file.status === "pending") && (
                                <div className="mt-3">
                                    <div className="mb-1 flex justify-between text-xs text-gray-400">
                                        <span>
                                            {file.status === "pending"
                                                ? "Waiting..."
                                                : "Uploading..."}
                                        </span>
                                        <span>
                                            {Math.round(file.progress)}%
                                        </span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                                        <div
                                            className={`h-full rounded-full ${
                                                file.type === "photo"
                                                    ? "bg-[#dab94d]"
                                                    : "bg-[#dab94d]"
                                            }`}
                                            style={{
                                                width: `${Math.max(1, file.progress)}%`,
                                                transition:
                                                    "width 0.3s ease-out",
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Status messages */}
                            {file.status === "completed" && (
                                <p className="mt-2 text-xs text-green-400">
                                    {file.type === "photo"
                                        ? "Photo uploaded!"
                                        : "Video uploaded! Processing..."}
                                </p>
                            )}
                            {file.status === "failed" && file.error && (
                                <p className="mt-2 text-xs text-red-400">
                                    {file.error}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
