"""Tests for Microsoft Graph transactional email delivery."""

import base64
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from authentication.email_service import EmailDeliveryError, send_graph_email


class GraphEmailServiceTestCase(SimpleTestCase):
    def setUp(self) -> None:
        self.temp_dir = TemporaryDirectory()
        credential_dir = Path(self.temp_dir.name)
        self.certificate_path = credential_dir / "certificate.crt"
        self.private_key_path = credential_dir / "private.key"
        self.certificate_path.write_text(
            "-----BEGIN CERTIFICATE-----\nPUBLIC\n-----END CERTIFICATE-----",
            encoding="utf-8",
        )
        self.private_key_path.write_text(
            "-----BEGIN PRIVATE KEY-----\nPRIVATE\n-----END PRIVATE KEY-----",
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def settings(self) -> object:
        return override_settings(
            MICROSOFT_GRAPH_TENANT_ID="tenant-id",
            MICROSOFT_GRAPH_CLIENT_ID="client-id",
            MICROSOFT_GRAPH_SENDER_EMAIL="noreply@techwiki.co.uk",
            MICROSOFT_GRAPH_CERTIFICATE_BASE64="",
            MICROSOFT_GRAPH_PRIVATE_KEY_BASE64="",
            MICROSOFT_GRAPH_CERTIFICATE_PATH=str(self.certificate_path),
            MICROSOFT_GRAPH_PRIVATE_KEY_PATH=str(self.private_key_path),
            MICROSOFT_GRAPH_PRIVATE_KEY_PASSPHRASE="",
            MICROSOFT_GRAPH_TIMEOUT_SECONDS=15,
        )

    @patch("authentication.email_service.requests.post")
    @patch("authentication.email_service.msal.ConfidentialClientApplication")
    def test_sends_rendered_email(
        self,
        mock_client_class: MagicMock,
        mock_post: MagicMock,
    ) -> None:
        client = mock_client_class.return_value
        client.acquire_token_for_client.return_value = {"access_token": "token"}
        mock_post.return_value.status_code = 202

        with self.settings():
            send_graph_email(
                to_email="person@example.com",
                subject="Test subject",
                html_template="email/verification.html",
                context={
                    "first_name": "Test",
                    "verification_url": "https://auth.techwiki.co.uk/verify-email/token",
                },
            )

        credential = mock_client_class.call_args.kwargs["client_credential"]
        self.assertIn("BEGIN PRIVATE KEY", credential["private_key"])
        self.assertIn("BEGIN CERTIFICATE", credential["public_certificate"])
        request = mock_post.call_args
        self.assertEqual(
            request.args[0],
            "https://graph.microsoft.com/v1.0/users/noreply@techwiki.co.uk/sendMail",
        )
        self.assertEqual(request.kwargs["headers"]["Authorization"], "Bearer token")
        self.assertEqual(
            request.kwargs["json"]["message"]["toRecipients"][0]["emailAddress"]["address"],
            "person@example.com",
        )
        self.assertIn("Verify email address", request.kwargs["json"]["message"]["body"]["content"])

    @patch("authentication.email_service.requests.post")
    @patch("authentication.email_service.msal.ConfidentialClientApplication")
    def test_base64_environment_credentials_take_precedence(
        self,
        mock_client_class: MagicMock,
        mock_post: MagicMock,
    ) -> None:
        private_key = "-----BEGIN PRIVATE KEY-----\nENV KEY\n-----END PRIVATE KEY-----"
        certificate = "-----BEGIN CERTIFICATE-----\nENV CERT\n-----END CERTIFICATE-----"
        mock_client_class.return_value.acquire_token_for_client.return_value = {
            "access_token": "token"
        }
        mock_post.return_value.status_code = 202

        with (
            self.settings(),
            override_settings(
                MICROSOFT_GRAPH_PRIVATE_KEY_BASE64=base64.b64encode(private_key.encode()).decode(),
                MICROSOFT_GRAPH_CERTIFICATE_BASE64=base64.b64encode(certificate.encode()).decode(),
                MICROSOFT_GRAPH_PRIVATE_KEY_PATH="/missing/private.key",
                MICROSOFT_GRAPH_CERTIFICATE_PATH="/missing/certificate.crt",
            ),
        ):
            send_graph_email(
                to_email="person@example.com",
                subject="Test",
                html_template="email/verification.html",
                context={"first_name": "Test", "verification_url": "https://example.com"},
            )

        credential = mock_client_class.call_args.kwargs["client_credential"]
        self.assertEqual(credential["private_key"], private_key)
        self.assertEqual(credential["public_certificate"], certificate)

    @patch("authentication.email_service.msal.ConfidentialClientApplication")
    def test_token_failure_raises_delivery_error(self, mock_client_class: MagicMock) -> None:
        mock_client_class.return_value.acquire_token_for_client.return_value = {
            "error": "invalid_client",
            "error_description": "Certificate rejected",
        }

        with self.settings(), self.assertRaisesRegex(EmailDeliveryError, "Certificate rejected"):
            send_graph_email(
                to_email="person@example.com",
                subject="Test",
                html_template="email/verification.html",
                context={"first_name": "Test", "verification_url": "https://example.com"},
            )

    @patch("authentication.email_service.requests.post")
    @patch("authentication.email_service.msal.ConfidentialClientApplication")
    def test_graph_rejection_raises_delivery_error(
        self,
        mock_client_class: MagicMock,
        mock_post: MagicMock,
    ) -> None:
        mock_client_class.return_value.acquire_token_for_client.return_value = {
            "access_token": "token"
        }
        mock_post.return_value.status_code = 403
        mock_post.return_value.headers = {"request-id": "graph-request-id"}

        with self.settings(), self.assertRaisesRegex(EmailDeliveryError, "status 403"):
            send_graph_email(
                to_email="person@example.com",
                subject="Test",
                html_template="email/verification.html",
                context={"first_name": "Test", "verification_url": "https://example.com"},
            )
