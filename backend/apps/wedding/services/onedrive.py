"""OneDrive/SharePoint integration service for video uploads.

This service uses Microsoft Graph API to upload large files to OneDrive/SharePoint
using the resumable upload session approach (chunked upload).

Reference: https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession
"""

import logging
from typing import Any, TypedDict
from urllib.parse import quote

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class UploadSessionInfo(TypedDict):
    """Information about an upload session."""

    upload_url: str
    expiration_datetime: str


class UploadedFileInfo(TypedDict):
    """Information about an uploaded file."""

    item_id: str
    web_url: str
    download_url: str | None
    embed_url: str | None
    name: str
    size: int


class OneDriveService:
    """Service for interacting with OneDrive/SharePoint via Microsoft Graph API.

    Supports large file uploads using resumable upload sessions (chunked upload).
    Files larger than 4MB should use this approach.

    Configuration required:
    - ONEDRIVE_CLIENT_ID: Azure AD application client ID
    - ONEDRIVE_CLIENT_SECRET: Azure AD application client secret
    - ONEDRIVE_TENANT_ID: Azure AD tenant ID
    - ONEDRIVE_DRIVE_ID: OneDrive/SharePoint drive ID (or 'me' for personal OneDrive)
    - ONEDRIVE_FOLDER_PATH: Path in OneDrive where files will be uploaded
    """

    # Microsoft Graph API endpoints
    GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
    TOKEN_ENDPOINT = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"

    # Chunk size for uploads (must be a multiple of 320 KiB)
    # Using 75MB chunks for testing performance with large phone videos (1-2GB)
    # This gives ~13-27 chunks for typical videos, providing good progress tracking
    CHUNK_SIZE = 75 * 1024 * 1024  # 75 MB

    def __init__(self) -> None:
        """Initialize the OneDrive service."""
        self.client_id = getattr(settings, "ONEDRIVE_CLIENT_ID", None)
        self.client_secret = getattr(settings, "ONEDRIVE_CLIENT_SECRET", None)
        self.tenant_id = getattr(settings, "ONEDRIVE_TENANT_ID", None)
        self.drive_id = getattr(settings, "ONEDRIVE_DRIVE_ID", None)
        self.folder_path = getattr(settings, "ONEDRIVE_FOLDER_PATH", "WeddingVideos")

        self._access_token: str | None = None
        self._token_expires_at: float = 0

    @property
    def is_configured(self) -> bool:
        """Check if the service is properly configured."""
        return all([self.client_id, self.client_secret, self.tenant_id, self.drive_id])

    def _get_access_token(self) -> str:
        """Get an access token for Microsoft Graph API.

        Uses client credentials flow (application permissions).
        Tokens are cached until they expire.
        """
        import time

        # Return cached token if still valid (with 5 min buffer)
        if self._access_token and self._token_expires_at > time.time() + 300:
            return self._access_token

        if not self.is_configured:
            raise ValueError("OneDrive service is not properly configured")

        token_url = self.TOKEN_ENDPOINT.format(tenant_id=self.tenant_id)

        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "https://graph.microsoft.com/.default",
        }

        response = requests.post(token_url, data=data, timeout=30)
        response.raise_for_status()

        token_data = response.json()
        self._access_token = token_data["access_token"]
        self._token_expires_at = time.time() + token_data.get("expires_in", 3600)

        return self._access_token

    def _get_headers(self) -> dict[str, str]:
        """Get headers for Microsoft Graph API requests."""
        return {
            "Authorization": f"Bearer {self._get_access_token()}",
            "Content-Type": "application/json",
        }

    def create_upload_session(self, filename: str, file_size: int) -> UploadSessionInfo:
        """Create a resumable upload session for a large file.

        Args:
            filename: The name of the file to upload
            file_size: The size of the file in bytes

        Returns:
            UploadSessionInfo with the upload URL and expiration time
        """
        # Sanitize filename for URL
        safe_filename = quote(filename)

        # Build the path - use drive ID if specified, otherwise use 'me'
        if self.drive_id and self.drive_id != "me":
            # SharePoint or specific OneDrive
            path = f"/drives/{self.drive_id}/root:/{self.folder_path}/{safe_filename}:/createUploadSession"
        else:
            # Personal OneDrive
            path = f"/me/drive/root:/{self.folder_path}/{safe_filename}:/createUploadSession"

        url = f"{self.GRAPH_API_BASE}{path}"

        # Request body for upload session
        body = {
            "item": {
                "@microsoft.graph.conflictBehavior": "rename",  # Rename if exists
                "name": filename,
            }
        }

        response = requests.post(
            url,
            headers=self._get_headers(),
            json=body,
            timeout=30,
        )

        if response.status_code != 200:
            logger.error("Failed to create upload session: %s", response.text)
            response.raise_for_status()

        data = response.json()

        return UploadSessionInfo(
            upload_url=data["uploadUrl"],
            expiration_datetime=data["expirationDateTime"],
        )

    def upload_chunk(
        self,
        upload_url: str,
        chunk_data: bytes,
        start_byte: int,
        end_byte: int,
        total_size: int,
    ) -> dict[str, Any] | None:
        """Upload a chunk of a file to an existing upload session.

        Args:
            upload_url: The upload URL from create_upload_session
            chunk_data: The bytes to upload
            start_byte: The starting byte position (0-indexed)
            end_byte: The ending byte position (exclusive)
            total_size: The total file size

        Returns:
            For the final chunk, returns the completed file info.
            For intermediate chunks, returns None.
        """
        # Content-Range header format: bytes start-end/total
        # Note: end byte in header is inclusive
        content_range = f"bytes {start_byte}-{end_byte - 1}/{total_size}"

        headers = {
            "Content-Length": str(len(chunk_data)),
            "Content-Range": content_range,
        }

        response = requests.put(
            upload_url,
            headers=headers,
            data=chunk_data,
            timeout=120,  # Longer timeout for chunk upload
        )

        # 202 Accepted = chunk uploaded, more to go
        # 200 or 201 = upload complete
        if response.status_code == 202:
            return None

        if response.status_code in (200, 201):
            return response.json()

        logger.error("Chunk upload failed: %s", response.text)
        response.raise_for_status()
        return None

    def cancel_upload_session(self, upload_url: str) -> None:
        """Cancel an upload session.

        Args:
            upload_url: The upload URL from create_upload_session
        """
        try:
            requests.delete(upload_url, timeout=30)
        except requests.RequestException as e:
            logger.warning("Failed to cancel upload session: %s", e)

    def get_upload_session_status(self, upload_url: str) -> dict[str, Any]:
        """Get the status of an upload session.

        Args:
            upload_url: The upload URL from create_upload_session

        Returns:
            Upload session status including next expected ranges
        """
        response = requests.get(upload_url, timeout=30)
        response.raise_for_status()
        return response.json()

    def get_file_info(self, item_id: str) -> UploadedFileInfo:
        """Get information about an uploaded file.

        Args:
            item_id: The OneDrive item ID

        Returns:
            File information including URLs
        """
        if self.drive_id and self.drive_id != "me":
            url = f"{self.GRAPH_API_BASE}/drives/{self.drive_id}/items/{item_id}"
        else:
            url = f"{self.GRAPH_API_BASE}/me/drive/items/{item_id}"

        response = requests.get(
            url,
            headers=self._get_headers(),
            timeout=30,
        )
        response.raise_for_status()

        data = response.json()

        return UploadedFileInfo(
            item_id=data["id"],
            web_url=data.get("webUrl", ""),
            download_url=data.get("@microsoft.graph.downloadUrl"),
            embed_url=None,  # We'll generate this separately
            name=data.get("name", ""),
            size=data.get("size", 0),
        )

    def create_sharing_link(self, item_id: str) -> str | None:
        """Create a sharing link for a file.

        Args:
            item_id: The OneDrive item ID

        Returns:
            The sharing link URL, or None if failed
        """
        if self.drive_id and self.drive_id != "me":
            url = f"{self.GRAPH_API_BASE}/drives/{self.drive_id}/items/{item_id}/createLink"
        else:
            url = f"{self.GRAPH_API_BASE}/me/drive/items/{item_id}/createLink"

        body = {
            "type": "view",
            "scope": "anonymous",
        }

        try:
            response = requests.post(
                url,
                headers=self._get_headers(),
                json=body,
                timeout=30,
            )
            response.raise_for_status()

            data = response.json()
            return data.get("link", {}).get("webUrl")
        except requests.RequestException as e:
            logger.warning("Failed to create sharing link: %s", e)
            return None

    def create_embed_url(self, item_id: str) -> str | None:
        """Create an embed URL for video playback.

        Args:
            item_id: The OneDrive item ID

        Returns:
            The embed URL for video playback, or None if failed
        """
        if self.drive_id and self.drive_id != "me":
            url = f"{self.GRAPH_API_BASE}/drives/{self.drive_id}/items/{item_id}/preview"
        else:
            url = f"{self.GRAPH_API_BASE}/me/drive/items/{item_id}/preview"

        try:
            response = requests.post(
                url,
                headers=self._get_headers(),
                json={},  # Empty body required
                timeout=30,
            )
            response.raise_for_status()

            data = response.json()
            return data.get("getUrl")
        except requests.RequestException as e:
            logger.warning("Failed to create embed URL: %s", e)
            return None

    def delete_file(self, item_id: str) -> bool:
        """Delete a file from OneDrive.

        Args:
            item_id: The OneDrive item ID

        Returns:
            True if deleted successfully, False otherwise
        """
        if self.drive_id and self.drive_id != "me":
            url = f"{self.GRAPH_API_BASE}/drives/{self.drive_id}/items/{item_id}"
        else:
            url = f"{self.GRAPH_API_BASE}/me/drive/items/{item_id}"

        try:
            response = requests.delete(
                url,
                headers=self._get_headers(),
                timeout=30,
            )
            return response.status_code == 204
        except requests.RequestException as e:
            logger.warning("Failed to delete file: %s", e)
            return False
