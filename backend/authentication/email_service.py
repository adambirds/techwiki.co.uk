"""Transactional email delivery through Microsoft Graph."""

import base64
import binascii
import logging
from pathlib import Path
from typing import Any

import msal
import requests
from django.conf import settings
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

GRAPH_SCOPE = ["https://graph.microsoft.com/.default"]


class EmailConfigurationError(RuntimeError):
    """Microsoft Graph email settings are incomplete or invalid."""


class EmailDeliveryError(RuntimeError):
    """Microsoft Graph did not accept a transactional email."""


def _required_setting(name: str) -> str:
    value = str(getattr(settings, name, "")).strip()
    if not value:
        raise EmailConfigurationError(f"{name} is required")
    return value


def _read_credential(
    *,
    base64_setting_name: str,
    path_setting_name: str,
) -> str:
    """Read a PEM credential from base64 environment data or a file fallback."""
    encoded = str(getattr(settings, base64_setting_name, "")).strip()
    if encoded:
        try:
            decoded = base64.b64decode(encoded, validate=True).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError) as exc:
            raise EmailConfigurationError(
                f"{base64_setting_name} is not valid base64-encoded UTF-8"
            ) from exc
        if "-----BEGIN " not in decoded:
            raise EmailConfigurationError(
                f"{base64_setting_name} does not contain a PEM credential"
            )
        return decoded

    path_value = str(getattr(settings, path_setting_name, "")).strip()
    if not path_value:
        raise EmailConfigurationError(f"Set {base64_setting_name} or {path_setting_name}")
    path = Path(path_value)
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise EmailConfigurationError(f"Could not read {path_setting_name}: {path}") from exc


def _get_access_token() -> str:
    tenant_id = _required_setting("MICROSOFT_GRAPH_TENANT_ID")
    client_id = _required_setting("MICROSOFT_GRAPH_CLIENT_ID")
    private_key = _read_credential(
        base64_setting_name="MICROSOFT_GRAPH_PRIVATE_KEY_BASE64",
        path_setting_name="MICROSOFT_GRAPH_PRIVATE_KEY_PATH",
    )
    public_certificate = _read_credential(
        base64_setting_name="MICROSOFT_GRAPH_CERTIFICATE_BASE64",
        path_setting_name="MICROSOFT_GRAPH_CERTIFICATE_PATH",
    )

    credential: dict[str, str] = {
        "private_key": private_key,
        "public_certificate": public_certificate,
    }
    passphrase = str(getattr(settings, "MICROSOFT_GRAPH_PRIVATE_KEY_PASSPHRASE", ""))
    if passphrase:
        credential["passphrase"] = passphrase

    app = msal.ConfidentialClientApplication(
        client_id=client_id,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
        client_credential=credential,
    )
    result: dict[str, Any] = app.acquire_token_for_client(scopes=GRAPH_SCOPE)
    access_token = result.get("access_token")
    if not access_token:
        error = result.get("error", "token_acquisition_failed")
        description = result.get("error_description", "Microsoft identity rejected the request")
        logger.error("Microsoft Graph token acquisition failed: %s", error)
        raise EmailDeliveryError(f"Could not authenticate email service: {description}")
    return str(access_token)


def send_graph_email(
    *,
    to_email: str,
    subject: str,
    html_template: str,
    context: dict[str, Any],
) -> None:
    """Render and send a single-recipient transactional email."""
    sender = _required_setting("MICROSOFT_GRAPH_SENDER_EMAIL")
    html_content = render_to_string(html_template, context)
    access_token = _get_access_token()
    timeout = int(getattr(settings, "MICROSOFT_GRAPH_TIMEOUT_SECONDS", 15))

    response = requests.post(
        f"https://graph.microsoft.com/v1.0/users/{sender}/sendMail",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": html_content,
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": to_email,
                        }
                    }
                ],
            },
            "saveToSentItems": True,
        },
        timeout=timeout,
    )
    if response.status_code != 202:
        request_id = response.headers.get("request-id", "unknown")
        logger.error(
            "Microsoft Graph rejected email: status=%s request_id=%s",
            response.status_code,
            request_id,
        )
        raise EmailDeliveryError(
            f"Microsoft Graph rejected the email (status {response.status_code}, "
            f"request ID {request_id})"
        )


def send_verification_email(user: Any) -> None:
    """Send an account verification link."""
    auth_frontend_url = str(settings.AUTH_FRONTEND_URL).rstrip("/")
    send_graph_email(
        to_email=user.email,
        subject="Verify your TechWiki email",
        html_template="email/verification.html",
        context={
            "first_name": user.first_name,
            "verification_url": f"{auth_frontend_url}/verify-email/{user.verification_token}",
        },
    )


def send_password_reset_email(user: Any, reset_url: str) -> None:
    """Send a password reset link."""
    send_graph_email(
        to_email=user.email,
        subject="Reset your TechWiki password",
        html_template="email/password_reset.html",
        context={
            "first_name": user.first_name,
            "reset_url": reset_url,
        },
    )
