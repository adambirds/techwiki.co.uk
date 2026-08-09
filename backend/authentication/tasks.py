import logging
from uuid import UUID

from apps.ebay.clients.discord import DiscordWebhook
from celery import shared_task
from django.conf import settings

from authentication.email_service import send_graph_email

logger = logging.getLogger(__name__)


@shared_task(queue="email")
def send_verification_email(email: str, first_name: str, verification_token: UUID) -> None:
    """Send a verification email from an asynchronous account workflow."""
    logger.info("Sending verification email to %s", email)
    auth_frontend_url = str(settings.AUTH_FRONTEND_URL).rstrip("/")
    send_graph_email(
        to_email=email,
        subject="Verify your email address for TechWiki",
        html_template="email/verification.html",
        context={
            "first_name": first_name,
            "verification_url": f"{auth_frontend_url}/verify-email/{verification_token}",
        },
    )


@shared_task(queue="email")
def send_missing_initial_verification_email(
    email: str,
    first_name: str,
    verification_token: UUID,
) -> None:
    """Resend verification for a legacy unverified account."""
    send_verification_email(email, first_name, verification_token)


@shared_task(queue="email")
def send_reset_password_email(email: str, first_name: str, reset_password_link: str) -> None:
    """Send a password reset email from an asynchronous account workflow."""
    logger.info("Sending password reset email to %s", email)
    send_graph_email(
        to_email=email,
        subject="Reset your password for TechWiki",
        html_template="email/password_reset.html",
        context={
            "first_name": first_name,
            "reset_url": reset_password_link,
        },
    )


@shared_task(queue="email")
def send_email_verification_successful_email(email: str, first_name: str) -> None:
    """Notify a user that email verification completed."""
    send_graph_email(
        to_email=email,
        subject="Email verification successful",
        html_template="email/notification.html",
        context={
            "first_name": first_name,
            "heading": "Email verification successful",
            "message": "Your TechWiki email address has been verified.",
        },
    )


@shared_task(queue="email")
def send_password_reset_successful_email(email: str, first_name: str) -> None:
    """Notify a user that their password was reset."""
    send_graph_email(
        to_email=email,
        subject="Password reset successful",
        html_template="email/notification.html",
        context={
            "first_name": first_name,
            "heading": "Password reset successful",
            "message": (
                "Your TechWiki password was reset. If this was not you, contact an "
                "administrator immediately."
            ),
        },
    )


@shared_task(queue="general")
def notify_new_user_signup(user_email: str) -> None:
    webhook_url = getattr(settings, "DISCORD_WEBHOOK_SIGNUP_URL", "")
    webhook = DiscordWebhook(webhook_url)
    webhook.set_content(f"New user signup: {user_email}")
    webhook.execute()


@shared_task(queue="general")
def notify_user_email_verified(user_email: str) -> None:
    webhook_url = getattr(settings, "DISCORD_WEBHOOK_SIGNUP_URL", "")
    webhook = DiscordWebhook(webhook_url)
    webhook.set_content(f"User email verified: {user_email}")
    webhook.execute()
