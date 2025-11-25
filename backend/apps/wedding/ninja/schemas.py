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
