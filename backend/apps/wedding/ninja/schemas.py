"""Schemas for wedding photo API endpoints."""

from datetime import datetime
from uuid import UUID

from ninja import Schema
from pydantic import Field


class PhotoUploadSchema(Schema):
    """Schema for uploading a photo."""

    uploaded_by: str = Field(
        ..., min_length=1, max_length=255, description="Name of the guest uploading the photo"
    )


class PhotoResponseSchema(Schema):
    """Schema for photo response."""

    id: int
    image_url: str
    uploaded_by: str
    uploaded_at: datetime


class PasswordCheckSchema(Schema):
    """Schema for checking the upload password."""

    password: str = Field(..., min_length=1, description="Password to access photo upload")


class PasswordCheckResponseSchema(Schema):
    """Schema for password check response."""

    valid: bool


class PhotoCountResponseSchema(Schema):
    """Schema for total photo count response."""

    total: int


class GuestbookMessageSchema(Schema):
    """Schema for creating a guestbook message."""

    name: str = Field(..., min_length=1, max_length=255, description="Name of the guest")
    message: str = Field(..., min_length=1, max_length=2000, description="Guestbook message")


class GuestbookMessageResponseSchema(Schema):
    """Schema for guestbook message response."""

    id: int
    name: str
    message: str
    created_at: datetime
    edit_token: UUID
    can_edit: bool


class GuestbookUpdateSchema(Schema):
    """Schema for updating a guestbook message."""

    message: str = Field(
        ..., min_length=1, max_length=2000, description="Updated guestbook message"
    )
    edit_token: str = Field(..., description="Edit token for authorization")


class GuestbookCountResponseSchema(Schema):
    """Schema for total guestbook message count response."""

    total: int


# Video Upload Schemas


class VideoUploadInitSchema(Schema):
    """Schema for initiating a video upload."""

    filename: str = Field(
        ..., min_length=1, max_length=255, description="Original filename of the video"
    )
    file_size: int = Field(
        ..., gt=0, description="File size in bytes (no limit for chunked uploads)"
    )
    content_type: str = Field(default="video/mp4", description="MIME type of the video")
    uploaded_by: str = Field(
        ..., min_length=1, max_length=255, description="Name of the guest uploading the video"
    )


class VideoUploadInitResponseSchema(Schema):
    """Schema for video upload initiation response."""

    upload_id: UUID
    upload_url: str
    chunk_size: int
    message: str


class VideoUploadChunkSchema(Schema):
    """Schema for uploading a video chunk."""

    start_byte: int = Field(..., ge=0, description="Starting byte position")
    end_byte: int = Field(..., gt=0, description="Ending byte position (exclusive)")


class VideoUploadChunkResponseSchema(Schema):
    """Schema for video chunk upload response."""

    upload_id: UUID
    bytes_uploaded: int
    total_size: int
    progress: float
    is_complete: bool
    message: str


class VideoUploadStatusSchema(Schema):
    """Schema for checking video upload status."""

    upload_id: UUID


class VideoUploadStatusResponseSchema(Schema):
    """Schema for video upload status response."""

    upload_id: UUID
    status: str
    filename: str
    file_size: int
    bytes_uploaded: int
    progress: float
    error_message: str | None = None


class VideoUploadFinalizeSchema(Schema):
    """Schema for finalizing a video upload."""

    upload_id: UUID


class VideoResponseSchema(Schema):
    """Schema for video response."""

    id: int
    upload_id: UUID
    filename: str
    file_size: int
    duration_seconds: float | None
    thumbnail_url: str | None
    embed_url: str | None
    web_url: str | None
    status: str
    uploaded_by: str
    uploaded_at: datetime
    is_playable: bool


class VideoCountResponseSchema(Schema):
    """Schema for total video count response."""

    total: int
