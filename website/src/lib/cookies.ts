/**
 * Cookie utilities for managing client-side cookies
 */

/**
 * Set a cookie
 */
export function setCookie(
    name: string,
    value: string,
    days: number = 365,
): void {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
}

/**
 * Get a cookie value
 */
export function getCookie(name: string): string | null {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(";");

    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(nameEQ)) {
            return decodeURIComponent(cookie.substring(nameEQ.length));
        }
    }

    return null;
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string): void {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}

/**
 * Cookie names used in the app
 */
export const COOKIE_NAMES = {
    GUEST_NAME: "wedding_guest_name",
    PASSWORD_VERIFIED: "wedding_password_verified",
    GUESTBOOK_EDIT_TOKENS: "wedding_guestbook_edit_tokens",
} as const;

/**
 * Store a guestbook edit token
 */
export function storeEditToken(messageId: number, token: string): void {
    const tokens = getEditTokens();
    tokens[messageId] = token;
    setCookie(COOKIE_NAMES.GUESTBOOK_EDIT_TOKENS, JSON.stringify(tokens), 1); // 1 day expiry
}

/**
 * Get all stored edit tokens
 */
export function getEditTokens(): Record<number, string> {
    const tokensStr = getCookie(COOKIE_NAMES.GUESTBOOK_EDIT_TOKENS);
    if (!tokensStr) return {};
    try {
        return JSON.parse(tokensStr);
    } catch {
        return {};
    }
}

/**
 * Get edit token for a specific message
 */
export function getEditToken(messageId: number): string | null {
    const tokens = getEditTokens();
    return tokens[messageId] || null;
}

/**
 * Remove an edit token
 */
export function removeEditToken(messageId: number): void {
    const tokens = getEditTokens();
    delete tokens[messageId];
    if (Object.keys(tokens).length === 0) {
        deleteCookie(COOKIE_NAMES.GUESTBOOK_EDIT_TOKENS);
    } else {
        setCookie(
            COOKIE_NAMES.GUESTBOOK_EDIT_TOKENS,
            JSON.stringify(tokens),
            1,
        );
    }
}
