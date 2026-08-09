"""Tests for admin dashboard API endpoints."""

import json

from django.test import Client, TestCase

from apps.wiki.models import UserRole, WikiUserProfile
from authentication.models import User


class AdminApiTestCase(TestCase):
    def setUp(self) -> None:
        self.client = Client()
        self.admin = User.objects.create_superuser(
            email="admin@example.com",
            password="password",
            first_name="Admin",
            last_name="User",
        )
        self.member = User.objects.create_user(
            email="member@example.com",
            password="password",
            first_name="Regular",
            last_name="Member",
            email_verified=True,
        )
        WikiUserProfile.objects.create(user=self.member, role=UserRole.READER)

    def create_second_admin(self) -> User:
        return User.objects.create_superuser(
            email="other@example.com",
            password="password",
            first_name="Other",
            last_name="Admin",
        )

    def test_non_admin_cannot_access_users(self) -> None:
        self.client.force_login(self.member)
        response = self.client.get("/api/admin/users")
        self.assertEqual(response.status_code, 403)

    def test_admin_can_view_overview_and_users(self) -> None:
        self.client.force_login(self.admin)
        overview = self.client.get("/api/admin/overview")
        users = self.client.get("/api/admin/users?search=member")
        self.assertEqual(overview.status_code, 200)
        self.assertEqual(overview.json()["users"]["total"], 2)
        self.assertEqual(overview.json()["users"]["admins"], 1)
        self.assertEqual(users.status_code, 200)
        self.assertEqual(users.json()["total"], 1)
        self.assertEqual(users.json()["users"][0]["email"], self.member.email)

    def test_admin_can_promote_and_ban_user(self) -> None:
        self.client.force_login(self.admin)
        response = self.client.patch(
            f"/api/admin/users/{self.member.id}",
            data=json.dumps({"role": "moderator", "is_active": False}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.member.refresh_from_db()
        self.member.wiki_profile.refresh_from_db()
        self.assertFalse(self.member.is_active)
        self.assertEqual(self.member.wiki_profile.role, UserRole.MODERATOR)

    def test_admin_role_grants_dashboard_access(self) -> None:
        self.client.force_login(self.admin)
        response = self.client.patch(
            f"/api/admin/users/{self.member.id}",
            data=json.dumps({"role": "admin"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.member.refresh_from_db()
        self.member.wiki_profile.refresh_from_db()
        self.assertTrue(self.member.is_staff)
        self.assertEqual(self.member.wiki_profile.role, UserRole.ADMIN)

        self.client.force_login(self.member)
        self.assertEqual(self.client.get("/api/admin/overview").status_code, 200)

    def test_admin_can_edit_own_role_when_another_admin_remains(self) -> None:
        self.create_second_admin()
        self.client.force_login(self.admin)
        response = self.client.patch(
            f"/api/admin/users/{self.admin.id}",
            data=json.dumps({"role": "moderator"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.admin.refresh_from_db()
        self.assertFalse(self.admin.is_staff)
        self.assertFalse(self.admin.is_superuser)
        self.assertEqual(self.admin.wiki_profile.role, UserRole.MODERATOR)

    def test_admin_can_remove_superuser_when_another_admin_remains(self) -> None:
        other_admin = self.create_second_admin()
        self.client.force_login(self.admin)
        response = self.client.delete(f"/api/admin/users/{other_admin.id}")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(id=other_admin.id).exists())

    def test_last_admin_cannot_be_demoted_banned_or_deleted(self) -> None:
        self.client.force_login(self.admin)
        demote = self.client.patch(
            f"/api/admin/users/{self.admin.id}",
            data=json.dumps({"role": "moderator"}),
            content_type="application/json",
        )
        ban = self.client.patch(
            f"/api/admin/users/{self.admin.id}",
            data=json.dumps({"is_active": False}),
            content_type="application/json",
        )
        delete = self.client.delete(f"/api/admin/users/{self.admin.id}")

        self.assertEqual(demote.status_code, 409)
        self.assertEqual(ban.status_code, 409)
        self.assertEqual(delete.status_code, 409)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)
        self.assertTrue(self.admin.is_superuser)

    def test_user_mutations_require_csrf_token(self) -> None:
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.force_login(self.admin)

        rejected = csrf_client.patch(
            f"/api/admin/users/{self.member.id}",
            data=json.dumps({"is_active": False}),
            content_type="application/json",
        )
        self.assertEqual(rejected.status_code, 403)

        csrf_response = csrf_client.get("/api/csrf")
        accepted = csrf_client.patch(
            f"/api/admin/users/{self.member.id}",
            data=json.dumps({"is_active": False}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_response.json()["csrf_token"],
        )
        self.assertEqual(accepted.status_code, 200)

    def test_admin_can_delete_regular_user(self) -> None:
        self.client.force_login(self.admin)
        response = self.client.delete(f"/api/admin/users/{self.member.id}")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(id=self.member.id).exists())
