/**
 * API client utilities for making requests to the Django backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiOptions extends RequestInit {
    data?: Record<string, any>;
    formData?: FormData;
}

/**
 * Get CSRF token from cookies
 */
function getCsrfToken(): string | null {
    if (typeof document === "undefined") return null;

    const name = "csrftoken";
    const cookies = document.cookie.split(";");

    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name + "=")) {
            return decodeURIComponent(cookie.substring(name.length + 1));
        }
    }
    return null;
}

/**
 * Make an API request
 */
async function apiRequest<T>(
    endpoint: string,
    options: ApiOptions = {},
): Promise<T> {
    const { data, formData, headers = {}, ...fetchOptions } = options;

    const url = `${API_BASE_URL}${endpoint}`;

    const requestHeaders: Record<string, string> = {
        ...(headers as Record<string, string>),
    };

    // Add CSRF token for non-GET requests
    if (fetchOptions.method && fetchOptions.method !== "GET") {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            requestHeaders["X-CSRFToken"] = csrfToken;
        }
    }

    let body: any;

    if (formData) {
        body = formData;
        // Don't set Content-Type for FormData - browser will set it with boundary
    } else if (data) {
        requestHeaders["Content-Type"] = "application/json";
        body = JSON.stringify(data);
    }

    const response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
        credentials: "include", // Include cookies in requests
        body,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.detail || `API request failed: ${response.statusText}`,
        );
    }

    return response.json();
}

/**
 * Photo API types
 */
export interface Photo {
    id: number;
    image_url: string;
    uploaded_by: string;
    uploaded_at: string;
}

/**
 * Video API types
 */
export interface Video {
    id: number;
    upload_id: string;
    filename: string;
    file_size: number;
    duration_seconds: number | null;
    thumbnail_url: string | null;
    embed_url: string | null;
    web_url: string | null;
    status: "pending" | "uploading" | "processing" | "completed" | "failed";
    uploaded_by: string;
    uploaded_at: string;
    is_playable: boolean;
}

export interface VideoUploadInitResponse {
    upload_id: string;
    upload_url: string;
    chunk_size: number;
    message: string;
}

export interface VideoUploadChunkResponse {
    upload_id: string;
    bytes_uploaded: number;
    total_size: number;
    progress: number;
    is_complete: boolean;
    message: string;
}

export interface VideoUploadStatusResponse {
    upload_id: string;
    status: string;
    filename: string;
    file_size: number;
    bytes_uploaded: number;
    progress: number;
    error_message: string | null;
}

/**
 * Guestbook API types
 */
export interface GuestbookMessage {
    id: number;
    name: string;
    message: string;
    created_at: string;
    edit_token: string;
    can_edit: boolean;
}

/**
 * Check if a password is valid
 */
export async function checkPassword(password: string): Promise<boolean> {
    const response = await apiRequest<{ valid: boolean }>(
        "/api/photos/check-password",
        {
            method: "POST",
            data: { password },
        },
    );
    return response.valid;
}

/**
 * Upload a photo
 */
export async function uploadPhoto(
    file: File,
    uploadedBy: string,
): Promise<Photo> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uploaded_by", uploadedBy);

    return apiRequest<Photo>("/api/photos/upload", {
        method: "POST",
        formData,
    });
}

/**
 * Get paginated photos
 */
export async function getPhotos(
    page: number = 1,
    pageSize: number = 50,
): Promise<Photo[]> {
    return apiRequest<Photo[]>(
        `/api/photos/list?page=${page}&page_size=${pageSize}`,
        {
            method: "GET",
        },
    );
}

/**
 * Get total photo count
 */
export async function getPhotoCount(): Promise<number> {
    const response = await apiRequest<{ total: number }>("/api/photos/count", {
        method: "GET",
    });
    return response.total;
}

/**
 * Get CSRF token by making a request to the API
 * This is needed before making any POST requests
 *
 * Note: We use a dedicated /csrf endpoint that doesn't require CSRF validation
 * for the initial request, which will set the CSRF cookie.
 */
export async function initializeCsrf(): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/api/csrf`, {
            credentials: "include",
        });
        // Do NOT overwrite the cookie. Safari requires the original Django Set-Cookie header.
    } catch (error) {
        console.error("Failed to initialize CSRF token:", error);
    }
}
/**
 * Create a guestbook message
 */
export async function createGuestbookMessage(
    name: string,
    message: string,
): Promise<GuestbookMessage> {
    return apiRequest<GuestbookMessage>("/api/guestbook/create", {
        method: "POST",
        data: { name, message },
    });
}

/**
 * Get paginated guestbook messages
 */
export async function getGuestbookMessages(
    page: number = 1,
    pageSize: number = 50,
): Promise<GuestbookMessage[]> {
    return apiRequest<GuestbookMessage[]>(
        `/api/guestbook/list?page=${page}&page_size=${pageSize}`,
        {
            method: "GET",
        },
    );
}

/**
 * Get total guestbook message count
 */
export async function getGuestbookCount(): Promise<number> {
    const response = await apiRequest<{ total: number }>(
        "/api/guestbook/count",
        {
            method: "GET",
        },
    );
    return response.total;
}

/**
 * Update a guestbook message
 */
export async function updateGuestbookMessage(
    messageId: number,
    message: string,
    editToken: string,
): Promise<GuestbookMessage> {
    return apiRequest<GuestbookMessage>(`/api/guestbook/${messageId}/update`, {
        method: "PUT",
        data: { message, edit_token: editToken },
    });
}

// ============================================
// Video Upload API
// ============================================

/**
 * Initialize a video upload session
 * This creates an upload session with the backend/OneDrive
 */
export async function initVideoUpload(
    filename: string,
    fileSize: number,
    contentType: string,
    uploadedBy: string,
): Promise<VideoUploadInitResponse> {
    return apiRequest<VideoUploadInitResponse>("/api/videos/init-upload", {
        method: "POST",
        data: {
            filename,
            file_size: fileSize,
            content_type: contentType,
            uploaded_by: uploadedBy,
        },
    });
}

/**
 * Upload a chunk of a video file
 */
export async function uploadVideoChunk(
    uploadId: string,
    chunk: Blob,
    startByte: number,
    endByte: number,
): Promise<VideoUploadChunkResponse> {
    const formData = new FormData();
    formData.append("file", chunk);
    formData.append("start_byte", startByte.toString());
    formData.append("end_byte", endByte.toString());

    return apiRequest<VideoUploadChunkResponse>(
        `/api/videos/${uploadId}/chunk`,
        {
            method: "POST",
            formData,
        },
    );
}

/**
 * Get the status of a video upload
 */
export async function getVideoUploadStatus(
    uploadId: string,
): Promise<VideoUploadStatusResponse> {
    return apiRequest<VideoUploadStatusResponse>(
        `/api/videos/${uploadId}/status`,
        {
            method: "GET",
        },
    );
}

/**
 * Cancel a video upload
 */
export async function cancelVideoUpload(uploadId: string): Promise<void> {
    await apiRequest<{ message: string }>(`/api/videos/${uploadId}/cancel`, {
        method: "DELETE",
    });
}

/**
 * Get paginated videos
 */
export async function getVideos(
    page: number = 1,
    pageSize: number = 50,
): Promise<Video[]> {
    return apiRequest<Video[]>(
        `/api/videos/list?page=${page}&page_size=${pageSize}`,
        {
            method: "GET",
        },
    );
}

/**
 * Get total video count
 */
export async function getVideoCount(): Promise<number> {
    const response = await apiRequest<{ total: number }>("/api/videos/count", {
        method: "GET",
    });
    return response.total;
}

/**
 * Get a single video by ID
 */
export async function getVideo(videoId: number): Promise<Video> {
    return apiRequest<Video>(`/api/videos/${videoId}`, {
        method: "GET",
    });
}

/**
 * Upload a video file in chunks with progress tracking
 * This is a high-level function that handles the entire chunked upload process
 */
export async function uploadVideoWithProgress(
    file: File,
    uploadedBy: string,
    onProgress?: (progress: number, bytesUploaded: number) => void,
    onComplete?: (video: VideoUploadChunkResponse) => void,
    onError?: (error: Error) => void,
): Promise<VideoUploadChunkResponse> {
    try {
        // Initialize the upload session
        const initResponse = await initVideoUpload(
            file.name,
            file.size,
            file.type || "video/mp4",
            uploadedBy,
        );

        const { upload_id, chunk_size } = initResponse;
        let bytesUploaded = 0;

        // Upload chunks
        while (bytesUploaded < file.size) {
            const startByte = bytesUploaded;
            const endByte = Math.min(startByte + chunk_size, file.size);
            const chunk = file.slice(startByte, endByte);

            const chunkResponse = await uploadVideoChunk(
                upload_id,
                chunk,
                startByte,
                endByte,
            );

            bytesUploaded = chunkResponse.bytes_uploaded;

            // Report progress
            if (onProgress) {
                onProgress(chunkResponse.progress, bytesUploaded);
            }

            // Check if complete
            if (chunkResponse.is_complete) {
                if (onComplete) {
                    onComplete(chunkResponse);
                }
                return chunkResponse;
            }
        }

        // Should not reach here, but return last status
        const status = await getVideoUploadStatus(upload_id);
        return {
            upload_id: status.upload_id,
            bytes_uploaded: status.bytes_uploaded,
            total_size: status.file_size,
            progress: status.progress,
            is_complete: status.status === "completed",
            message: "Upload completed",
        };
    } catch (error) {
        if (onError) {
            onError(error instanceof Error ? error : new Error(String(error)));
        }
        throw error;
    }
}
