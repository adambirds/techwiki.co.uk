"use client";

import {
    Dialog,
    DialogBackdrop,
    DialogPanel,
    DialogTitle,
} from "@headlessui/react";
import {
    ArrowsRightLeftIcon,
    ArrowsUpDownIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";
import Cropper, { Area } from "react-easy-crop";

interface ImageCropperProps {
    image: string;
    isOpen: boolean;
    onComplete: (croppedImage: Blob) => void;
    onCancel: () => void;
}

export default function ImageCropper({
    image,
    isOpen,
    onComplete,
    onCancel,
}: ImageCropperProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [flipHorizontal, setFlipHorizontal] = useState(false);
    const [flipVertical, setFlipVertical] = useState(false);
    const [aspect, setAspect] = useState(4 / 3);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
        null,
    );
    const [isProcessing, setIsProcessing] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setRotation(0);
            setFlipHorizontal(false);
            setFlipVertical(false);
            setAspect(4 / 3);
            setCroppedAreaPixels(null);
            setIsProcessing(false);
        }
    }, [isOpen]);

    const onCropComplete = useCallback(
        (croppedArea: Area, croppedAreaPixels: Area) => {
            setCroppedAreaPixels(croppedAreaPixels);
        },
        [],
    );

    const createCroppedImage = async () => {
        if (!croppedAreaPixels) return;

        setIsProcessing(true);
        try {
            console.log("Cropping with params:", {
                rotation,
                flipHorizontal,
                flipVertical,
                croppedAreaPixels,
            });
            const croppedImage = await getCroppedImg(
                image,
                croppedAreaPixels,
                rotation,
                flipHorizontal,
                flipVertical,
            );
            console.log("Cropped image created:", croppedImage.size, "bytes");
            onComplete(croppedImage);
        } catch (e) {
            console.error("Error cropping image:", e);
            alert("Error cropping image. Check console for details.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onCancel} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/80" />

            <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
                <DialogPanel className="relative w-full max-w-4xl overflow-hidden rounded-lg bg-[#1c324a] shadow-xl">
                    <div className="bg-[#1c324a] px-4 pt-5 pb-4 sm:p-6">
                        <DialogTitle
                            as="h3"
                            className="mb-4 text-lg font-semibold text-white"
                        >
                            Crop Your Image
                        </DialogTitle>

                        <div className="relative h-[300px] w-full bg-gray-900 sm:h-[400px]">
                            <Cropper
                                image={image}
                                crop={crop}
                                zoom={zoom}
                                rotation={rotation}
                                aspect={aspect}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                                onRotationChange={setRotation}
                                showGrid={true}
                                zoomWithScroll={true}
                            />
                        </div>

                        <div className="mt-4 max-h-[40vh] space-y-4 overflow-y-auto sm:mt-6 sm:max-h-none sm:space-y-6 sm:overflow-y-visible">
                            {/* Aspect Ratio and Flip Buttons */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Aspect Ratio */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-200">
                                        Aspect Ratio
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setAspect(16 / 9)}
                                            className={`flex h-10 flex-1 items-center justify-center rounded-md transition-colors ${
                                                aspect === 16 / 9
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-[#253a52] text-gray-300 hover:bg-[#2d4a66]"
                                            }`}
                                            title="Landscape (16:9)"
                                        >
                                            <div className="h-4 w-7 rounded border-2 border-current" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAspect(1)}
                                            className={`flex h-10 flex-1 items-center justify-center rounded-md transition-colors ${
                                                aspect === 1
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-[#253a52] text-gray-300 hover:bg-[#2d4a66]"
                                            }`}
                                            title="Square (1:1)"
                                        >
                                            <div className="size-5 rounded border-2 border-current" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAspect(9 / 16)}
                                            className={`flex h-10 flex-1 items-center justify-center rounded-md transition-colors ${
                                                aspect === 9 / 16
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-[#253a52] text-gray-300 hover:bg-[#2d4a66]"
                                            }`}
                                            title="Portrait (9:16)"
                                        >
                                            <div className="h-7 w-4 rounded border-2 border-current" />
                                        </button>
                                    </div>
                                </div>

                                {/* Flip */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-200">
                                        Flip
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFlipHorizontal(
                                                    !flipHorizontal,
                                                )
                                            }
                                            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-md transition-colors ${
                                                flipHorizontal
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-[#253a52] text-gray-300 hover:bg-[#2d4a66]"
                                            }`}
                                            title="Flip Horizontal"
                                        >
                                            <ArrowsRightLeftIcon className="size-5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFlipVertical(!flipVertical)
                                            }
                                            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-md transition-colors ${
                                                flipVertical
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-[#253a52] text-gray-300 hover:bg-[#2d4a66]"
                                            }`}
                                            title="Flip Vertical"
                                        >
                                            <ArrowsUpDownIcon className="size-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Zoom and Rotation Sliders - Same Line */}
                            <div className="flex items-center gap-2 text-xs">
                                <label htmlFor="zoom" className="text-gray-200">
                                    Zoom
                                </label>
                                <input
                                    id="zoom"
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.01}
                                    value={zoom}
                                    onChange={(e) =>
                                        setZoom(parseFloat(e.target.value))
                                    }
                                    className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500"
                                />
                                <span className="w-10 text-gray-400">
                                    {zoom.toFixed(1)}x
                                </span>

                                <label
                                    htmlFor="rotation"
                                    className="text-gray-200"
                                >
                                    Rotate
                                </label>
                                <input
                                    id="rotation"
                                    type="range"
                                    min={0}
                                    max={360}
                                    step={1}
                                    value={rotation}
                                    onChange={(e) =>
                                        setRotation(parseInt(e.target.value))
                                    }
                                    className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500"
                                />
                                <span className="w-8 text-gray-400">
                                    {rotation}°
                                </span>
                            </div>

                            <p className="text-xs text-gray-400">
                                💡 Drag the image to reposition • Scroll or use
                                sliders to adjust • Drag corners to resize
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#253a52] px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                        <button
                            type="button"
                            onClick={createCroppedImage}
                            disabled={isProcessing}
                            className="inline-flex w-full justify-center rounded-md bg-[#2d4a66] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#355270] disabled:cursor-not-allowed disabled:opacity-50 sm:ml-3 sm:w-auto"
                        >
                            {isProcessing ? "Processing..." : "Apply Crop"}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isProcessing}
                            className="mt-3 inline-flex w-full justify-center rounded-md bg-[#253a52] px-3 py-2 text-sm font-semibold text-gray-200 shadow-sm ring-1 ring-gray-600 ring-inset hover:bg-[#2d4a66] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0 sm:w-auto"
                        >
                            Cancel
                        </button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}

// Helper function to create cropped image
async function getCroppedImg(
    imageSrc: string,
    pixelCrop: Area,
    rotation: number = 0,
    flipHorizontal: boolean = false,
    flipVertical: boolean = false,
): Promise<Blob> {
    console.log("getCroppedImg called with:", {
        imageSrc: imageSrc.substring(0, 50),
        pixelCrop,
        rotation,
        flipHorizontal,
        flipVertical,
    });

    const image = await createImage(imageSrc);
    console.log("Image loaded:", image.width, "x", image.height);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error("No 2d context");
    }

    // If no rotation or flips, just do a simple crop
    if (rotation === 0 && !flipHorizontal && !flipVertical) {
        console.log("Using simple crop path");
        canvas.width = Math.round(pixelCrop.width);
        canvas.height = Math.round(pixelCrop.height);

        console.log("Canvas size:", canvas.width, "x", canvas.height);
        console.log(
            "Drawing from:",
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
        );

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height,
        );

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        console.log(
                            "Blob created successfully:",
                            blob.size,
                            "bytes",
                        );
                        resolve(blob);
                    } else {
                        console.error("Canvas is empty!");
                        reject(new Error("Canvas is empty"));
                    }
                },
                "image/jpeg",
                0.95,
            );
        });
    }

    // For rotations and flips, we need to transform the image first
    const rotRad = (rotation * Math.PI) / 180;

    // Calculate bounding box of the rotated image
    const bBoxWidth =
        Math.abs(Math.cos(rotRad) * image.width) +
        Math.abs(Math.sin(rotRad) * image.height);
    const bBoxHeight =
        Math.abs(Math.sin(rotRad) * image.width) +
        Math.abs(Math.cos(rotRad) * image.height);

    // Set canvas size to match the bounding box (rounded to integers)
    canvas.width = Math.round(bBoxWidth);
    canvas.height = Math.round(bBoxHeight);

    // Translate canvas context to center point
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rotRad);
    ctx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
    ctx.translate(-image.width / 2, -image.height / 2);

    // Draw rotated/flipped image
    ctx.drawImage(image, 0, 0);

    // Create a second canvas for the final cropped image
    const croppedCanvas = document.createElement("canvas");
    const croppedCtx = croppedCanvas.getContext("2d");

    if (!croppedCtx) {
        throw new Error("No 2d context for cropped canvas");
    }

    // Set final crop size
    croppedCanvas.width = Math.round(pixelCrop.width);
    croppedCanvas.height = Math.round(pixelCrop.height);

    // Draw the cropped portion from the rotated canvas
    croppedCtx.drawImage(
        canvas,
        Math.round(pixelCrop.x),
        Math.round(pixelCrop.y),
        Math.round(pixelCrop.width),
        Math.round(pixelCrop.height),
        0,
        0,
        Math.round(pixelCrop.width),
        Math.round(pixelCrop.height),
    );

    return new Promise((resolve, reject) => {
        croppedCanvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Canvas is empty"));
                }
            },
            "image/jpeg",
            0.95,
        );
    });
}

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", (error) => reject(error));
        image.setAttribute("crossOrigin", "anonymous");
        image.src = url;
    });
}
