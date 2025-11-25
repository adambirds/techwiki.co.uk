"use client";

import NameInputModal from "@/components/NameInputModal";
import {
    checkPassword,
    createGuestbookMessage,
    getGuestbookCount,
    getGuestbookMessages,
    initializeCsrf,
    updateGuestbookMessage,
    type GuestbookMessage,
} from "@/lib/api";
import {
    COOKIE_NAMES,
    getCookie,
    getEditToken,
    setCookie,
    storeEditToken,
} from "@/lib/cookies";
import { PencilIcon } from "@heroicons/react/24/outline";
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

function GuestbookPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [showNameModal, setShowNameModal] = useState(false);
    const [guestName, setGuestName] = useState<string>("");
    const [messages, setMessages] = useState<GuestbookMessage[]>([]);
    const [error, setError] = useState<string>("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalMessages, setTotalMessages] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newMessage, setNewMessage] = useState("");
    const [editingMessageId, setEditingMessageId] = useState<number | null>(
        null,
    );
    const [editingText, setEditingText] = useState("");
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
                    setError("Invalid password. Please check your link.");
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

                // Load existing messages
                const [existingMessages, messageCount] = await Promise.all([
                    getGuestbookMessages(1, PAGE_SIZE),
                    getGuestbookCount(),
                ]);
                setMessages(existingMessages);
                setTotalMessages(messageCount);
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

    const handleSubmitMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !guestName) return;

        setIsSubmitting(true);
        try {
            const message = await createGuestbookMessage(
                guestName,
                newMessage.trim(),
            );
            // Store the edit token in cookie
            storeEditToken(message.id, message.edit_token);
            setMessages((prev) => [message, ...prev]);
            setTotalMessages((prev) => prev + 1);
            setNewMessage("");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to submit message",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditMessage = (message: GuestbookMessage) => {
        setEditingMessageId(message.id);
        setEditingText(message.message);
    };

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setEditingText("");
    };

    const handleSaveEdit = async (messageId: number) => {
        const editToken = getEditToken(messageId);
        if (!editToken) {
            setError("Edit token not found");
            return;
        }

        setIsSubmitting(true);
        try {
            const updatedMessage = await updateGuestbookMessage(
                messageId,
                editingText.trim(),
                editToken,
            );
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === messageId ? updatedMessage : msg,
                ),
            );
            setEditingMessageId(null);
            setEditingText("");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to update message",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLoadMore = async () => {
        setIsLoadingMore(true);
        try {
            const nextPage = currentPage + 1;
            const moreMessages = await getGuestbookMessages(
                nextPage,
                PAGE_SIZE,
            );
            setMessages((prev) => [...prev, ...moreMessages]);
            setCurrentPage(nextPage);
        } catch (err) {
            console.error("Failed to load more messages:", err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const hasMoreMessages = messages.length < totalMessages;

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
                <div className="rounded-lg bg-red-900/50 p-6 ring-1 ring-red-500">
                    <p className="text-center text-lg text-red-200">
                        {error || "Unauthorized access"}
                    </p>
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

            <div className="min-h-screen bg-[#1c324a] px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-6 flex flex-col items-center">
                            {/* Wedding images */}
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
                            {/* Names */}
                            <h1
                                className={`${cormorantGaramond.className} mt-4 text-4xl font-semibold tracking-wide text-[#d4af37] sm:text-5xl`}
                            >
                                REBECCA & PETER
                            </h1>
                        </div>

                        <h2 className="mb-2 text-2xl font-bold text-white">
                            Wedding Guestbook
                        </h2>
                        <p className="text-gray-300">
                            Share your wishes, memories, and messages
                        </p>

                        {/* Link to upload page */}
                        <div className="mt-4">
                            <Link
                                href={`/upload?password=${searchParams.get("password")}`}
                                className="inline-flex items-center gap-2 text-sm text-white hover:text-blue-300"
                            >
                                ← Back to Photo Upload
                            </Link>
                        </div>
                    </div>

                    {/* Message Form */}
                    {guestName && (
                        <div className="mb-12 rounded-lg bg-[#253a52] p-6">
                            <h3 className="mb-4 text-lg font-semibold text-white">
                                Leave a Message
                            </h3>
                            <form onSubmit={handleSubmitMessage}>
                                <textarea
                                    value={newMessage}
                                    onChange={(e) =>
                                        setNewMessage(e.target.value)
                                    }
                                    placeholder="Write your message here..."
                                    rows={4}
                                    className="mb-4 block w-full rounded-md border-0 bg-[#1c324a] px-3 py-2 text-white shadow-sm ring-1 ring-gray-600 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:ring-inset sm:text-sm"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={
                                        isSubmitting || !newMessage.trim()
                                    }
                                    className="w-full rounded-md bg-[#2d4a66] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#355270] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                >
                                    {isSubmitting
                                        ? "Submitting..."
                                        : "Submit Message"}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Messages List */}
                    <div>
                        <div className="mb-4">
                            <h3 className="text-xl font-semibold text-white">
                                Messages
                            </h3>
                            <p className="text-sm text-gray-300">
                                {totalMessages}{" "}
                                {totalMessages === 1 ? "message" : "messages"}{" "}
                                from our guests
                            </p>
                        </div>

                        {messages.length === 0 ? (
                            <div className="rounded-lg border-2 border-dashed border-gray-600 bg-[#253a52] p-12 text-center">
                                <p className="text-gray-400">
                                    No messages yet. Be the first to leave a
                                    message!
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map((message) => {
                                    const canEdit =
                                        message.can_edit &&
                                        getEditToken(message.id) !== null;
                                    const isEditing =
                                        editingMessageId === message.id;

                                    return (
                                        <div
                                            key={message.id}
                                            className="rounded-lg bg-[#253a52] p-6 shadow-sm"
                                        >
                                            <div className="mb-3 flex items-start justify-between">
                                                <h4 className="font-semibold text-white">
                                                    {message.name}
                                                </h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(
                                                            message.created_at,
                                                        ).toLocaleDateString(
                                                            "en-US",
                                                            {
                                                                year: "numeric",
                                                                month: "long",
                                                                day: "numeric",
                                                            },
                                                        )}
                                                    </span>
                                                    {canEdit && !isEditing && (
                                                        <button
                                                            onClick={() =>
                                                                handleEditMessage(
                                                                    message,
                                                                )
                                                            }
                                                            className="rounded p-1 text-white transition-colors hover:bg-[#2d4a66]"
                                                            title="Edit message"
                                                        >
                                                            <PencilIcon className="size-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {isEditing ? (
                                                <div className="space-y-3">
                                                    <textarea
                                                        value={editingText}
                                                        onChange={(e) =>
                                                            setEditingText(
                                                                e.target.value,
                                                            )
                                                        }
                                                        rows={4}
                                                        className="block w-full rounded-md border-0 bg-[#1c324a] px-3 py-2 text-white shadow-sm ring-1 ring-gray-600 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:ring-inset sm:text-sm"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() =>
                                                                handleSaveEdit(
                                                                    message.id,
                                                                )
                                                            }
                                                            disabled={
                                                                isSubmitting ||
                                                                !editingText.trim()
                                                            }
                                                            className="rounded-md bg-[#2d4a66] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#355270] disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {isSubmitting
                                                                ? "Saving..."
                                                                : "Save"}
                                                        </button>
                                                        <button
                                                            onClick={
                                                                handleCancelEdit
                                                            }
                                                            disabled={
                                                                isSubmitting
                                                            }
                                                            className="rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="whitespace-pre-wrap text-gray-200">
                                                    {message.message}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Load More Button */}
                                {hasMoreMessages && (
                                    <div className="mt-8 flex justify-center">
                                        <button
                                            onClick={handleLoadMore}
                                            disabled={isLoadingMore}
                                            className="rounded-md bg-[#2d4a66] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#355270] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isLoadingMore ? (
                                                <span className="flex items-center gap-2">
                                                    <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                    Loading...
                                                </span>
                                            ) : (
                                                "Load More Messages"
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default function GuestbookPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#1c324a]">
                    <div className="size-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                </div>
            }
        >
            <GuestbookPageContent />
        </Suspense>
    );
}
