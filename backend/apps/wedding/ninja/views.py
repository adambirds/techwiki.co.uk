"""API views for wedding photo management."""

import logging
from uuid import UUID

from django.conf import settings
from django.http import HttpRequest
from ninja import File, Form, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile

from apps.wedding.models import GuestbookMessage, Photo, Video, VideoUploadStatus
from apps.wedding.ninja.schemas import (
    GuestbookCountResponseSchema,
    GuestbookMessageResponseSchema,
    GuestbookMessageSchema,
    GuestbookUpdateSchema,
    PasswordCheckResponseSchema,
    PasswordCheckSchema,
    PhotoCountResponseSchema,
    PhotoResponseSchema,
    VideoCountResponseSchema,
    VideoResponseSchema,
    VideoUploadChunkResponseSchema,
    VideoUploadInitResponseSchema,
    VideoUploadInitSchema,
    VideoUploadStatusResponseSchema,
)
from apps.wedding.services import OneDriveService

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

    # Validate file size (max 100MB)
    max_size = 100 * 1024 * 1024  # 100MB in bytes
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


# Video Router
videos_router = Router(tags=["Videos"])


def _build_video_response(request: HttpRequest, video: Video) -> VideoResponseSchema:
    """Build a VideoResponseSchema from a Video model instance."""
    thumbnail_url = None
    if video.thumbnail:
        thumbnail_url = request.build_absolute_uri(video.thumbnail.url)

    return VideoResponseSchema(
        id=video.id,
        upload_id=video.upload_id,
        filename=video.filename,
        file_size=video.file_size,
        duration_seconds=video.duration_seconds,
        thumbnail_url=thumbnail_url,
        embed_url=video.onedrive_embed_url,
        web_url=video.onedrive_web_url,
        status=video.status,
        uploaded_by=video.uploaded_by,
        uploaded_at=video.uploaded_at,
        is_playable=video.is_playable,
    )


@videos_router.post("/init-upload", response=VideoUploadInitResponseSchema)
def init_video_upload(
    request: HttpRequest,
    payload: VideoUploadInitSchema,
) -> VideoUploadInitResponseSchema:
    """Initialize a video upload session.

    This creates an upload session with OneDrive and returns the upload URL
    and chunk size for the client to use for uploading the video in chunks.
    """
    # Validate content type
    allowed_types = [
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/webm",
        "video/x-matroska",
        "video/mpeg",
        "video/3gpp",
        "video/x-m4v",
    ]
    if payload.content_type not in allowed_types:
        raise HttpError(
            400,
            f"File type {payload.content_type} not allowed. Allowed types: {', '.join(allowed_types)}",
        )

    # Initialize OneDrive service
    onedrive_service = OneDriveService()

    if not onedrive_service.is_configured:
        raise HttpError(500, "Video upload service is not configured")

    try:
        # Create upload session with OneDrive
        session_info = onedrive_service.create_upload_session(payload.filename, payload.file_size)

        # Create video record in database
        video = Video.objects.create(
            filename=payload.filename,
            file_size=payload.file_size,
            content_type=payload.content_type,
            uploaded_by=payload.uploaded_by,
            status=VideoUploadStatus.UPLOADING,
            upload_session_url=session_info["upload_url"],
        )

        logger.info(
            "Video upload initiated by %s: %s (size: %d bytes)",
            payload.uploaded_by,
            payload.filename,
            payload.file_size,
        )

        return VideoUploadInitResponseSchema(
            upload_id=video.upload_id,
            upload_url=session_info["upload_url"],
            chunk_size=onedrive_service.CHUNK_SIZE,
            message="Upload session created. Send chunks to the upload URL.",
        )

    except Exception as e:
        logger.exception("Failed to create video upload session")
        raise HttpError(500, f"Failed to initialize upload: {e!s}")


@videos_router.post("/{upload_id}/chunk", response=VideoUploadChunkResponseSchema)
def upload_video_chunk(
    request: HttpRequest,
    upload_id: UUID,
    file: UploadedFile = File(...),  # type: ignore[type-arg]  # noqa: B008
    start_byte: int = Form(...),  # type: ignore[type-arg]
    end_byte: int = Form(...),  # type: ignore[type-arg]
) -> VideoUploadChunkResponseSchema:
    """Upload a chunk of a video file.

    This receives a chunk and forwards it to OneDrive using the upload session URL.
    """
    try:
        video = Video.objects.get(upload_id=upload_id)
    except Video.DoesNotExist:
        raise HttpError(404, "Upload not found")

    if video.status not in [VideoUploadStatus.PENDING, VideoUploadStatus.UPLOADING]:
        raise HttpError(400, f"Upload is not in progress. Status: {video.status}")

    if not video.upload_session_url:
        raise HttpError(400, "Upload session not found")

    onedrive_service = OneDriveService()

    try:
        # Read the chunk data
        chunk_data = file.read()

        # Upload chunk to OneDrive
        result = onedrive_service.upload_chunk(
            upload_url=video.upload_session_url,
            chunk_data=chunk_data,
            start_byte=start_byte,
            end_byte=end_byte,
            total_size=video.file_size,
        )

        # Update bytes uploaded
        video.bytes_uploaded = end_byte
        video.status = VideoUploadStatus.UPLOADING

        is_complete = result is not None

        if is_complete and result:
            # Upload complete! Extract file info
            video.onedrive_item_id = result.get("id")
            video.onedrive_web_url = result.get("webUrl")
            video.onedrive_download_url = result.get("@microsoft.graph.downloadUrl")
            video.status = VideoUploadStatus.PROCESSING

            # Try to get embed URL for video playback
            if video.onedrive_item_id:
                embed_url = onedrive_service.create_embed_url(video.onedrive_item_id)
                if embed_url:
                    video.onedrive_embed_url = embed_url
                    video.status = VideoUploadStatus.COMPLETED

            video.upload_session_url = None  # Clear session URL

            logger.info(
                "Video upload completed: %s by %s",
                video.filename,
                video.uploaded_by,
            )

        video.save()

        return VideoUploadChunkResponseSchema(
            upload_id=video.upload_id,
            bytes_uploaded=video.bytes_uploaded,
            total_size=video.file_size,
            progress=video.upload_progress,
            is_complete=is_complete,
            message="Upload complete!" if is_complete else "Chunk uploaded successfully",
        )

    except Exception as e:
        logger.exception("Failed to upload video chunk")
        video.status = VideoUploadStatus.FAILED
        video.error_message = str(e)
        video.save()
        raise HttpError(500, f"Failed to upload chunk: {e!s}")


@videos_router.get("/{upload_id}/status", response=VideoUploadStatusResponseSchema)
def get_video_upload_status(
    request: HttpRequest,
    upload_id: UUID,
) -> VideoUploadStatusResponseSchema:
    """Get the status of a video upload."""
    try:
        video = Video.objects.get(upload_id=upload_id)
    except Video.DoesNotExist:
        raise HttpError(404, "Upload not found")

    return VideoUploadStatusResponseSchema(
        upload_id=video.upload_id,
        status=video.status,
        filename=video.filename,
        file_size=video.file_size,
        bytes_uploaded=video.bytes_uploaded,
        progress=video.upload_progress,
        error_message=video.error_message,
    )


@videos_router.delete("/{upload_id}/cancel")
def cancel_video_upload(
    request: HttpRequest,
    upload_id: UUID,
) -> dict[str, str]:
    """Cancel an in-progress video upload."""
    try:
        video = Video.objects.get(upload_id=upload_id)
    except Video.DoesNotExist:
        raise HttpError(404, "Upload not found")

    if video.status == VideoUploadStatus.COMPLETED:
        raise HttpError(400, "Cannot cancel a completed upload")

    # Cancel the OneDrive upload session if it exists
    if video.upload_session_url:
        onedrive_service = OneDriveService()
        onedrive_service.cancel_upload_session(video.upload_session_url)

    # Delete the video record
    video.delete()

    logger.info("Video upload cancelled: %s by %s", video.filename, video.uploaded_by)

    return {"message": "Upload cancelled successfully"}


@videos_router.get("/list", response=list[VideoResponseSchema])
def list_videos(
    request: HttpRequest,
    page: int = 1,
    page_size: int = 50,
) -> list[VideoResponseSchema]:
    """Get paginated wedding videos.

    Args:
        page: Page number (1-indexed)
        page_size: Number of videos per page (max 100)
    """
    # Limit page_size to prevent abuse
    page_size = min(page_size, 100)

    # Calculate offset
    offset = (page - 1) * page_size

    # Only show completed videos
    videos = Video.objects.filter(status=VideoUploadStatus.COMPLETED)[offset : offset + page_size]

    return [_build_video_response(request, video) for video in videos]


@videos_router.get("/count", response=VideoCountResponseSchema)
def get_video_count(request: HttpRequest) -> VideoCountResponseSchema:
    """Get the total count of completed videos."""
    total = Video.objects.filter(status=VideoUploadStatus.COMPLETED).count()
    return VideoCountResponseSchema(total=total)


@videos_router.get("/{video_id}", response=VideoResponseSchema)
def get_video(
    request: HttpRequest,
    video_id: int,
) -> VideoResponseSchema:
    """Get a single video by ID."""
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        raise HttpError(404, "Video not found")

    return _build_video_response(request, video)
