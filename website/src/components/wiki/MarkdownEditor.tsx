"use client";

import { uploadImage } from "@/lib/wiki/api";
import { useCallback, useRef, useState } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    articleId?: string;
    placeholder?: string;
    className?: string;
    previewHtml?: string;
}

const TOOLBAR_ITEMS = [
    { icon: "B", action: "bold", wrap: ["**", "**"], label: "Bold" },
    { icon: "I", action: "italic", wrap: ["*", "*"], label: "Italic" },
    {
        icon: "~",
        action: "strikethrough",
        wrap: ["~~", "~~"],
        label: "Strikethrough",
    },
    { icon: "H1", action: "h1", prefix: "# ", label: "Heading 1" },
    { icon: "H2", action: "h2", prefix: "## ", label: "Heading 2" },
    { icon: "H3", action: "h3", prefix: "### ", label: "Heading 3" },
    { icon: "•", action: "ul", prefix: "- ", label: "Bullet list" },
    { icon: "1.", action: "ol", prefix: "1. ", label: "Numbered list" },
    { icon: "[]", action: "checkbox", prefix: "- [ ] ", label: "Checkbox" },
    { icon: "<>", action: "code", wrap: ["`", "`"], label: "Inline code" },
    {
        icon: "```",
        action: "codeblock",
        wrap: ["```\n", "\n```"],
        label: "Code block",
    },
    { icon: "🔗", action: "link", template: "[link text](url)", label: "Link" },
    { icon: "🖼️", action: "image", label: "Image" },
    {
        icon: "📊",
        action: "mermaid",
        wrap: ["```mermaid\n", "\n```"],
        label: "Mermaid diagram",
    },
    { icon: "∑", action: "math", wrap: ["$", "$"], label: "Inline math" },
    {
        icon: "📐",
        action: "mathblock",
        wrap: ["$$\n", "\n$$"],
        label: "Math block",
    },
];

export function MarkdownEditor({
    value,
    onChange,
    articleId,
    placeholder = "Write your content in Markdown...",
    className = "",
    previewHtml,
}: MarkdownEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isPreview, setIsPreview] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const insertText = useCallback(
        (item: (typeof TOOLBAR_ITEMS)[number]) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selected = value.substring(start, end);

            let newText = "";
            let cursorOffset = 0;

            if (item.wrap) {
                newText =
                    value.substring(0, start) +
                    item.wrap[0] +
                    (selected || "text") +
                    item.wrap[1] +
                    value.substring(end);
                cursorOffset = start + item.wrap[0].length;
            } else if (item.prefix) {
                const lineStart = value.lastIndexOf("\n", start - 1) + 1;
                newText =
                    value.substring(0, lineStart) +
                    item.prefix +
                    value.substring(lineStart);
                cursorOffset = start + item.prefix.length;
            } else if (item.template) {
                newText =
                    value.substring(0, start) +
                    item.template +
                    value.substring(end);
                cursorOffset = start + item.template.length;
            }

            onChange(newText);

            // Restore cursor position
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(cursorOffset, cursorOffset);
            }, 0);
        },
        [value, onChange],
    );

    const handleToolbarClick = useCallback(
        (item: (typeof TOOLBAR_ITEMS)[number]) => {
            if (item.action === "image") {
                fileInputRef.current?.click();
            } else {
                insertText(item);
            }
        },
        [insertText],
    );

    const handleFileUpload = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith("image/")) {
                alert("Please select an image file");
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert("Image must be less than 5MB");
                return;
            }

            setIsUploading(true);

            try {
                const result = await uploadImage(file, articleId);

                if (result.success && result.url) {
                    const textarea = textareaRef.current;
                    if (!textarea) return;

                    const start = textarea.selectionStart;
                    const imageMarkdown = `![${result.alt_text || file.name}](${result.url})`;
                    const newValue =
                        value.substring(0, start) +
                        imageMarkdown +
                        value.substring(start);
                    onChange(newValue);
                } else {
                    alert(result.message || "Failed to upload image");
                }
            } catch (error) {
                console.error("Image upload error:", error);
                alert("Failed to upload image");
            } finally {
                setIsUploading(false);
                event.target.value = "";
            }
        },
        [articleId, value, onChange],
    );

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // Handle Tab for indentation
            if (event.key === "Tab") {
                event.preventDefault();
                const textarea = event.currentTarget;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;

                const newValue =
                    value.substring(0, start) + "    " + value.substring(end);
                onChange(newValue);

                setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = start + 4;
                }, 0);
            }

            // Keyboard shortcuts
            if (event.metaKey || event.ctrlKey) {
                if (event.key === "b") {
                    event.preventDefault();
                    insertText(TOOLBAR_ITEMS.find((i) => i.action === "bold")!);
                } else if (event.key === "i") {
                    event.preventDefault();
                    insertText(
                        TOOLBAR_ITEMS.find((i) => i.action === "italic")!,
                    );
                } else if (event.key === "k") {
                    event.preventDefault();
                    insertText(TOOLBAR_ITEMS.find((i) => i.action === "link")!);
                }
            }
        },
        [value, onChange, insertText],
    );

    const handlePaste = useCallback(
        async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
            const items = Array.from(event.clipboardData.items);

            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    event.preventDefault();
                    const file = item.getAsFile();
                    if (!file) continue;

                    setIsUploading(true);

                    try {
                        const result = await uploadImage(file, articleId);

                        if (result.success && result.url) {
                            const textarea = textareaRef.current;
                            if (!textarea) return;

                            const start = textarea.selectionStart;
                            const imageMarkdown = `![${result.alt_text || "Pasted image"}](${result.url})`;
                            const newValue =
                                value.substring(0, start) +
                                imageMarkdown +
                                value.substring(start);
                            onChange(newValue);
                        }
                    } catch (error) {
                        console.error("Paste upload error:", error);
                    } finally {
                        setIsUploading(false);
                    }

                    break;
                }
            }
        },
        [articleId, value, onChange],
    );

    return (
        <div
            className={`flex flex-col overflow-hidden rounded-lg border border-gray-700 ${className}`}
        >
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 border-b border-gray-700 bg-gray-800 p-2">
                {TOOLBAR_ITEMS.map((item) => (
                    <button
                        key={item.action}
                        type="button"
                        onClick={() => handleToolbarClick(item)}
                        className="rounded px-2 py-1 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                        title={item.label}
                        disabled={isUploading}
                    >
                        {item.icon}
                    </button>
                ))}

                <div className="flex-1" />

                {/* Preview toggle */}
                <button
                    type="button"
                    onClick={() => setIsPreview(!isPreview)}
                    className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                        isPreview
                            ? "bg-blue-600 text-white"
                            : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                >
                    {isPreview ? "Edit" : "Preview"}
                </button>
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
            />

            {/* Editor/Preview area */}
            <div className="relative min-h-[400px]">
                {isUploading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/50">
                        <div className="text-white">Uploading image...</div>
                    </div>
                )}

                {isPreview ? (
                    <div className="min-h-[400px] overflow-auto bg-gray-900 p-4">
                        {previewHtml ? (
                            <MarkdownRenderer html={previewHtml} />
                        ) : (
                            <div className="text-gray-500">
                                Preview requires pre-rendered HTML from the
                                server.
                            </div>
                        )}
                    </div>
                ) : (
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder={placeholder}
                        className="h-[400px] w-full resize-y bg-gray-900 p-4 font-mono text-sm text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                )}
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between border-t border-gray-700 bg-gray-800 px-4 py-2 text-xs text-gray-400">
                <span>{value.length} characters</span>
                <span>{value.split(/\s+/).filter(Boolean).length} words</span>
                <span>
                    ~
                    {Math.max(
                        1,
                        Math.ceil(
                            value.split(/\s+/).filter(Boolean).length / 200,
                        ),
                    )}{" "}
                    min read
                </span>
            </div>
        </div>
    );
}

export default MarkdownEditor;
