"use client";

import { uploadPhoto, type Photo } from "@/lib/api";
import {
    PhotoIcon,
    ScissorsIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { DragEvent, useRef, useState } from "react";
import ImageCropper from "./ImageCropper";

interface PhotoUploadProps {
    guestName: string;
    onPhotoUploaded: (photo: Photo) => void;
}

interface PreviewFile {
    file: File;
    preview: string;
    croppedBlob?: Blob;
}

export default function PhotoUpload({
    guestName,
    onPhotoUploaded,
}: PhotoUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(
        new Set(),
    );
    const [error, setError] = useState<string>("");
    const [cropperImage, setCropperImage] = useState<string | null>(null);
    const [cropperPreview, setCropperPreview] = useState<string | null>(null);
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

        const imageFiles = files.filter((file) =>
            file.type.startsWith("image/"),
        );

        if (imageFiles.length !== files.length) {
            setError("Only image files are allowed");
        }

        const newPreviewFiles = imageFiles.map((file) => ({
            file,
            preview: URL.createObjectURL(file),
        }));

        setPreviewFiles((prev) => [...prev, ...newPreviewFiles]);
    };

    const removePreview = (preview: string) => {
        setPreviewFiles((prev) => {
            const file = prev.find((f) => f.preview === preview);
            if (file) {
                URL.revokeObjectURL(file.preview);
            }
            return prev.filter((f) => f.preview !== preview);
        });
    };

    const uploadFile = async (previewFile: PreviewFile) => {
        const { file, preview, croppedBlob } = previewFile;

        setUploadingFiles((prev) => new Set(prev).add(preview));

        try {
            // Use cropped blob if available, otherwise use original file
            const fileToUpload = croppedBlob
                ? new File([croppedBlob], file.name, { type: "image/jpeg" })
                : file;

            const photo = await uploadPhoto(fileToUpload, guestName);
            onPhotoUploaded(photo);

            // Remove from preview
            removePreview(preview);
        } catch (err) {
            // Don't set error here, let it fail silently for parallel uploads
            console.error("Upload error:", err);
        } finally {
            setUploadingFiles((prev) => {
                const next = new Set(prev);
                next.delete(preview);
                return next;
            });
        }
    };

    const uploadAll = async () => {
        setError("");

        // Upload all files in parallel
        const uploadPromises = previewFiles.map((previewFile) =>
            uploadFile(previewFile),
        );

        try {
            await Promise.all(uploadPromises);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Some uploads failed",
            );
        }
    };

    const openCropper = (preview: string) => {
        // Use the current preview (which may be cropped) for further editing
        setCropperImage(preview);
        setCropperPreview(preview);
    };

    const handleCropComplete = (croppedBlob: Blob) => {
        if (!cropperPreview) return;

        // Create a new preview URL for the cropped image
        const croppedPreviewUrl = URL.createObjectURL(croppedBlob);

        // Update the preview file with the cropped blob and new preview URL
        setPreviewFiles((prev) =>
            prev.map((pf) => {
                if (pf.preview === cropperPreview) {
                    // Revoke the old preview URL to prevent memory leaks
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
        setCropperPreview(null);
    };

    const handleCropCancel = () => {
        setCropperImage(null);
        setCropperPreview(null);
    };

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
                <PhotoIcon className="mx-auto size-12 text-gray-400" />
                <div className="mt-4">
                    <p className="text-sm font-medium text-white">
                        Click to upload or drag and drop
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                        PNG, JPG, GIF, WEBP up to 10MB
                    </p>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {/* Error message */}
            {error && (
                <div className="rounded-md bg-red-900/50 p-4 ring-1 ring-red-500">
                    <p className="text-sm text-red-200">{error}</p>
                </div>
            )}

            {/* Preview grid */}
            {previewFiles.length > 0 && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                        {previewFiles.map(({ file, preview, croppedBlob }) => {
                            const isUploading = uploadingFiles.has(preview);

                            return (
                                <div
                                    key={preview}
                                    className="group relative aspect-square"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={preview}
                                        alt="Preview"
                                        className={`size-full rounded-lg object-cover ${
                                            isUploading ? "opacity-50" : ""
                                        }`}
                                    />
                                    {croppedBlob && (
                                        <div className="absolute top-2 left-2 rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white">
                                            Cropped
                                        </div>
                                    )}
                                    {!isUploading && (
                                        <>
                                            <button
                                                onClick={() =>
                                                    openCropper(preview)
                                                }
                                                className="absolute bottom-2 left-2 rounded-full bg-[#2d4a66] p-2 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#355270]"
                                                title="Crop image"
                                            >
                                                <ScissorsIcon className="size-4" />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    removePreview(preview)
                                                }
                                                className="absolute top-2 right-2 rounded-full bg-red-600 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-700"
                                            >
                                                <XMarkIcon className="size-4" />
                                            </button>
                                        </>
                                    )}
                                    {isUploading && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="size-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Upload button */}
                    <button
                        onClick={uploadAll}
                        disabled={uploadingFiles.size > 0}
                        className="w-full rounded-md bg-[#2d4a66] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#355270] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {uploadingFiles.size > 0
                            ? `Uploading... (${uploadingFiles.size}/${previewFiles.length})`
                            : `Upload ${previewFiles.length} ${previewFiles.length === 1 ? "Photo" : "Photos"}`}
                    </button>
                </div>
            )}
        </div>
    );
}
