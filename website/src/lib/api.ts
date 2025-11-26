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
        // Make a GET request to the CSRF endpoint to initialize the CSRF cookie
        await fetch(`${API_BASE_URL}/api/csrf`, {
            credentials: "include",
        });
    } catch (error) {
        console.error("Failed to initialize CSRF token:", error);
    }
} /**
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
