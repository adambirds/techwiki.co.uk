"""API views for wedding photo management."""

import logging

from django.conf import settings
from django.http import HttpRequest
from ninja import File, Form, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile

from apps.wedding.models import GuestbookMessage, Photo
from apps.wedding.ninja.schemas import (
    GuestbookCountResponseSchema,
    GuestbookMessageResponseSchema,
    GuestbookMessageSchema,
    GuestbookUpdateSchema,
    PasswordCheckResponseSchema,
    PasswordCheckSchema,
    PhotoCountResponseSchema,
    PhotoResponseSchema,
)

logger = logging.getLogger(__name__)

photos_router = Router(tags=["Photos"])

# This should be stored in environment variables in production
WEDDING_PHOTO_UPLOAD_PASSWORD = settings.WEDDING_PHOTO_UPLOAD_PASSWORD


@photos_router.post("/check-password", response=PasswordCheckResponseSchema)
def check_password(
    request: HttpRequest, payload: PasswordCheckSchema
) -> PasswordCheckResponseSchema:
    """Check if the provided password is valid for photo uploads."""
    is_valid = payload.password == WEDDING_PHOTO_UPLOAD_PASSWORD
    return PasswordCheckResponseSchema(valid=is_valid)


@photos_router.post("/upload", response=PhotoResponseSchema)
def upload_photo(
    request: HttpRequest,
    file: UploadedFile = File(...),  # type: ignore[type-arg]  # noqa: B008
    uploaded_by: str = Form(...),  # type: ignore[type-arg]
) -> PhotoResponseSchema:
    """Upload a wedding photo."""

    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HttpError(
            400,
            f"File type {file.content_type} not allowed. Allowed types: {', '.join(allowed_types)}",
        )

    # Validate file size (max 10MB)
    max_size = 10 * 1024 * 1024  # 10MB in bytes
    if file.size and file.size > max_size:
        raise HttpError(400, "File size exceeds maximum allowed size of 10MB")

    # Create the photo record
    photo = Photo.objects.create(
        image=file,
        uploaded_by=uploaded_by,
    )

    # Build the full URL for the image
    image_url = request.build_absolute_uri(photo.image.url)

    logger.info("Photo uploaded by %s: %s", uploaded_by, image_url)

    return PhotoResponseSchema(
        id=photo.id,
        image_url=image_url,
        uploaded_by=photo.uploaded_by,
        uploaded_at=photo.uploaded_at,
    )


@photos_router.get("/list", response=list[PhotoResponseSchema])
def list_photos(
    request: HttpRequest,
    page: int = 1,
    page_size: int = 50,
) -> list[PhotoResponseSchema]:
    """Get paginated wedding photos.

    Args:
        page: Page number (1-indexed)
        page_size: Number of photos per page (max 100)
    """

    # Limit page_size to prevent abuse
    page_size = min(page_size, 100)

    # Calculate offset
    offset = (page - 1) * page_size

    photos = Photo.objects.all()[offset : offset + page_size]

    return [
        PhotoResponseSchema(
            id=photo.id,
            image_url=request.build_absolute_uri(photo.image.url),
            uploaded_by=photo.uploaded_by,
            uploaded_at=photo.uploaded_at,
        )
        for photo in photos
    ]


@photos_router.get("/count", response=PhotoCountResponseSchema)
def get_photo_count(request: HttpRequest) -> PhotoCountResponseSchema:
    """Get the total count of photos."""

    total = Photo.objects.count()

    return PhotoCountResponseSchema(total=total)


# Guestbook Router
guestbook_router = Router(tags=["Guestbook"])


@guestbook_router.post("/create", response=GuestbookMessageResponseSchema)
def create_guestbook_message(
    request: HttpRequest,
    payload: GuestbookMessageSchema,
) -> GuestbookMessageResponseSchema:
    """Create a new guestbook message."""

    message = GuestbookMessage.objects.create(
        name=payload.name,
        message=payload.message,
    )

    logger.info("Guestbook message created by %s", payload.name)

    return GuestbookMessageResponseSchema(
        id=message.id,
        name=message.name,
        message=message.message,
        created_at=message.created_at,
        edit_token=message.edit_token,
        can_edit=message.can_edit(),
    )


@guestbook_router.get("/list", response=list[GuestbookMessageResponseSchema])
def list_guestbook_messages(
    request: HttpRequest,
    page: int = 1,
    page_size: int = 50,
) -> list[GuestbookMessageResponseSchema]:
    """Get paginated guestbook messages.

    Args:
        page: Page number (1-indexed)
        page_size: Number of messages per page (max 100)
    """

    # Limit page_size to prevent abuse
    page_size = min(page_size, 100)

    # Calculate offset
    offset = (page - 1) * page_size

    messages = GuestbookMessage.objects.all()[offset : offset + page_size]

    return [
        GuestbookMessageResponseSchema(
            id=message.id,
            name=message.name,
            message=message.message,
            created_at=message.created_at,
            edit_token=message.edit_token,
            can_edit=message.can_edit(),
        )
        for message in messages
    ]


@guestbook_router.get("/count", response=GuestbookCountResponseSchema)
def get_guestbook_count(request: HttpRequest) -> GuestbookCountResponseSchema:
    """Get the total count of guestbook messages."""

    total = GuestbookMessage.objects.count()

    return GuestbookCountResponseSchema(total=total)


@guestbook_router.put("/{message_id}/update", response=GuestbookMessageResponseSchema)
def update_guestbook_message(
    request: HttpRequest,
    message_id: int,
    payload: GuestbookUpdateSchema,
) -> GuestbookMessageResponseSchema:
    """Update a guestbook message if the edit token is valid and within time limit."""

    try:
        message = GuestbookMessage.objects.get(id=message_id)
    except GuestbookMessage.DoesNotExist:
        raise HttpError(404, "Message not found")

    # Verify edit token
    if str(message.edit_token) != payload.edit_token:
        raise HttpError(403, "Invalid edit token")

    # Check if still within edit time window
    if not message.can_edit():
        raise HttpError(403, "Edit time window has expired (30 minutes)")

    # Update the message
    message.message = payload.message
    message.save()

    logger.info("Guestbook message %s updated by %s", message_id, message.name)

    return GuestbookMessageResponseSchema(
        id=message.id,
        name=message.name,
        message=message.message,
        created_at=message.created_at,
        edit_token=message.edit_token,
        can_edit=message.can_edit(),
    )
