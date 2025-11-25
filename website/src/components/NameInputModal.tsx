"use client";

import {
    Dialog,
    DialogBackdrop,
    DialogPanel,
    DialogTitle,
} from "@headlessui/react";
import { Cormorant_Garamond } from "next/font/google";
import Image from "next/image";
import { useState } from "react";

const cormorantGaramond = Cormorant_Garamond({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

interface NameInputModalProps {
    isOpen: boolean;
    onSubmit: (name: string) => void;
}

export default function NameInputModal({
    isOpen,
    onSubmit,
}: NameInputModalProps) {
    const [name, setName] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedName = name.trim();
        if (!trimmedName) {
            setError("Please enter your name");
            return;
        }

        if (trimmedName.length < 2) {
            setError("Name must be at least 2 characters");
            return;
        }

        onSubmit(trimmedName);
    };

    return (
        <Dialog open={isOpen} onClose={() => {}} className="relative z-50">
            <DialogBackdrop
                transition
                className="fixed inset-0 bg-black/80 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[enter]:ease-out data-[leave]:duration-200 data-[leave]:ease-in"
            />

            <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <DialogPanel
                        transition
                        className="relative transform overflow-hidden rounded-lg bg-[#1c324a] px-4 pt-5 pb-4 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[enter]:ease-out data-[leave]:duration-200 data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95"
                    >
                        <div>
                            <div className="mx-auto flex flex-col items-center">
                                {/* "the WEDDING of" image - responsive */}
                                <div className="relative w-full max-w-md overflow-hidden">
                                    <Image
                                        src="/images/the-wedding-of-desktop.png"
                                        alt="the WEDDING of"
                                        width={600}
                                        height={120}
                                        className="hidden w-full scale-125 sm:block"
                                        priority
                                    />
                                    <Image
                                        src="/images/the-wedding-of-mobile.png"
                                        alt="the WEDDING of"
                                        width={400}
                                        height={80}
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
                            <div className="mt-3 text-center sm:mt-5">
                                <DialogTitle
                                    as="h3"
                                    className="text-base font-semibold text-white"
                                >
                                    Welcome to Our Wedding Gallery
                                </DialogTitle>
                                <div className="mt-2">
                                    <p className="text-sm text-gray-300">
                                        Please enter your name so we know who
                                        shared these special moments with us.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="mt-5 sm:mt-6">
                            <div>
                                <label
                                    htmlFor="name"
                                    className="block text-sm font-medium text-gray-200"
                                >
                                    Your Name
                                </label>
                                <div className="mt-2">
                                    <input
                                        type="text"
                                        name="name"
                                        id="name"
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            setError("");
                                        }}
                                        className="block w-full rounded-md border-0 bg-[#253a52] px-3 py-2 text-white shadow-sm ring-1 ring-gray-600 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:ring-inset sm:text-sm/6"
                                        placeholder="Enter your name"
                                        autoFocus
                                    />
                                </div>
                                {error && (
                                    <p className="mt-2 text-sm text-red-400">
                                        {error}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="mt-6 inline-flex w-full justify-center rounded-md bg-[#2d4a66] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#355270] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                            >
                                Continue
                            </button>
                        </form>
                    </DialogPanel>
                </div>
            </div>
        </Dialog>
    );
}
