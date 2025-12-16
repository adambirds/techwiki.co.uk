"""Import directly from live MediaWiki site into TechWiki."""

import time
from argparse import ArgumentParser
from typing import Any

import requests
from django.core.management.base import BaseCommand, CommandError

from apps.wiki.importer import import_mediawiki_page
from apps.wiki.models import Category, Redirect
from authentication.models import User

# Category mapping based on title keywords
CATEGORY_KEYWORDS = {
    "linux": [
        "linux",
        "ubuntu",
        "centos",
        "debian",
        "nginx",
        "apache",
        "bash",
        "ssh",
        "disk",
        "kernel",
        "iptables",
    ],
    "windows": [
        "windows",
        "microsoft",
        "outlook",
        "office",
        "dpm",
        "active directory",
        "group policy",
        "admx",
    ],
    "networking": ["network", "dhcp", "dns", "ip6", "ipv6", "iptables", "firewall", "vpn"],
    "backup": ["bacula", "backup", "dpm", "restore", "reclaim"],
    "virtualization": ["citrix", "vmware", "openstack", "docker", "container"],
    "databases": ["mysql", "postgresql", "mariadb", "mongodb", "sql"],
    "web-servers": ["nginx", "apache", "php-fpm", "vhost", "ssl"],
    "cms": ["wordpress", "joomla", "magento", "moodle", "mediawiki", "opencart", "prestashop"],
    "cloud": ["amazon", "aws", "s3", "azure", "rclone", "cloud"],
}

# Icons for categories
CATEGORY_ICONS = {
    "linux": "🐧",
    "windows": "🪟",
    "networking": "🌐",
    "backup": "💾",
    "virtualization": "📦",
    "databases": "🗄️",
    "web-servers": "🌍",
    "cms": "📝",
    "cloud": "☁️",
    "general": "📚",
}


def infer_categories(title: str) -> list[str]:
    """Infer categories from article title (can return multiple)."""
    title_lower = title.lower()
    matched_categories = []

    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in title_lower:
                matched_categories.append(category)
                break  # Don't add the same category multiple times

    # Return unique categories, or 'general' if none matched
    return matched_categories if matched_categories else ["general"]


def infer_category(title: str) -> str:
    """Infer primary category from article title."""
    categories = infer_categories(title)
    return categories[0] if categories else "general"


class Command(BaseCommand):
    """Import from live MediaWiki site into TechWiki."""

    help = "Import articles from live MediaWiki site (techwiki.co.uk)"

    def add_arguments(self, parser: ArgumentParser) -> None:
        """Add command arguments."""
        parser.add_argument(
            "--url",
            type=str,
            default="https://techwiki.co.uk",
            help="Base URL of the MediaWiki site",
        )
        parser.add_argument(
            "--author",
            type=str,
            help="Email of the user to set as author for imported articles",
        )
        parser.add_argument(
            "--category",
            type=str,
            help="Default category slug for imported articles",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be imported without actually importing",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=500,
            help="Maximum number of pages to import",
        )
        parser.add_argument(
            "--skip-main",
            action="store_true",
            help="Skip the Main Page",
        )
        parser.add_argument(
            "--delay",
            type=float,
            default=0.5,
            help="Delay between API requests in seconds",
        )

    def handle(self, *args: str, **options: str | float | bool | None) -> None:
        """Execute the import command."""
        base_url = str(options["url"]).rstrip("/")
        api_url = f"{base_url}/api.php"
        dry_run = bool(options["dry_run"])
        limit = int(options["limit"])  # type: ignore[arg-type]
        skip_main = bool(options["skip_main"])
        delay = float(options["delay"])  # type: ignore[arg-type]

        # Get author
        author = None
        if options["author"]:
            try:
                author = User.objects.get(email=options["author"])
                self.stdout.write(f"Using author: {author.email}")
            except User.DoesNotExist:
                raise CommandError(f"User not found: {options['author']}")

        # Get default category
        default_category: str | None = (
            str(options.get("category")) if options.get("category") else None
        )
        if default_category:
            try:
                Category.objects.get(slug=default_category)
                self.stdout.write(f"Using default category: {default_category}")
            except Category.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f"Category '{default_category}' will be created")
                )

        self.stdout.write(f"Fetching page list from {base_url}...")

        # Step 1: Get all page titles
        pages: list[dict[str, Any]] = []
        apcontinue: str | None = None

        while len(pages) < limit:
            params: dict[str, str | int] = {
                "action": "query",
                "list": "allpages",
                "aplimit": min(50, limit - len(pages)),
                "format": "json",
            }
            if apcontinue:
                params["apcontinue"] = apcontinue

            try:
                response = requests.get(api_url, params=params, timeout=30)
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                raise CommandError(f"API request failed: {e}")

            for page in data.get("query", {}).get("allpages", []):
                title = page.get("title", "")
                if skip_main and title == "Main Page":
                    continue
                pages.append(
                    {
                        "pageid": page.get("pageid"),
                        "title": title,
                    }
                )

            # Check for more pages
            if "continue" in data:
                apcontinue = data["continue"].get("apcontinue")
            else:
                break

            time.sleep(delay)

        self.stdout.write(f"Found {len(pages)} pages to import")

        if not pages:
            self.stdout.write(self.style.WARNING("No pages found"))
            return

        # Step 2: Import each page
        pages_imported = 0
        pages_skipped = 0
        pages_failed = 0
        redirects_created = 0

        for i, page in enumerate(pages, 1):
            title = page["title"]
            pageid = page["pageid"]

            self.stdout.write(f"[{i}/{len(pages)}] Processing: {title}")

            # Get page content
            try:
                content_params: dict[str, str | int] = {
                    "action": "query",
                    "prop": "revisions",
                    "rvprop": "content",
                    "rvslots": "main",
                    "pageids": pageid,
                    "format": "json",
                }
                response = requests.get(api_url, params=content_params, timeout=30)
                response.raise_for_status()
                data = response.json()

                page_data = data.get("query", {}).get("pages", {}).get(str(pageid), {})
                revisions = page_data.get("revisions", [])

                if not revisions:
                    self.stdout.write(self.style.WARNING("  No content found"))
                    pages_skipped += 1
                    continue

                # Get the wiki text content
                revision = revisions[0]
                if "slots" in revision:
                    wiki_text = revision["slots"]["main"].get("*", "")
                else:
                    wiki_text = revision.get("*", "")

                if not wiki_text:
                    self.stdout.write(self.style.WARNING("  Empty content"))
                    pages_skipped += 1
                    continue

                # Check if it's a redirect
                if wiki_text.strip().upper().startswith("#REDIRECT"):
                    self.stdout.write("  Skipping redirect page")
                    pages_skipped += 1
                    continue

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  Failed to fetch: {e}"))
                pages_failed += 1
                continue

            if dry_run:
                inferred_cat = default_category if default_category else infer_category(title)
                self.stdout.write(
                    self.style.SUCCESS(f"  Would import: {title} -> [{inferred_cat}]")
                )
                pages_imported += 1
                time.sleep(delay)
                continue

            # Import the page
            try:
                # Get all matched categories or use default
                all_categories: list[str]
                primary_category: str
                if default_category:
                    primary_category = default_category
                    all_categories = [default_category]
                else:
                    all_categories = infer_categories(title)
                    primary_category = all_categories[0] if all_categories else "general"

                    # Ensure all categories exist
                    for cat_slug in all_categories:
                        cat_name = cat_slug.replace("-", " ").title()
                        cat_icon = CATEGORY_ICONS.get(cat_slug, "📚")
                        Category.objects.get_or_create(
                            slug=cat_slug,
                            defaults={
                                "name": cat_name,
                                "icon": cat_icon,
                                "description": f"Articles about {cat_name.lower()}",
                            },
                        )

                result = import_mediawiki_page(
                    wiki_text=wiki_text,
                    title=title,
                    author=author,
                    category_slug=primary_category,
                )

                # Assign all categories
                article = result["article"]
                category_objects = Category.objects.filter(slug__in=all_categories)
                article.categories.set(category_objects)

                # Create a redirect for non-categorized URL (/slug -> /category/slug)
                Redirect.objects.get_or_create(
                    old_path=f"/{article.slug}", defaults={"new_path": article.full_url}
                )

                categories_str = ", ".join(all_categories)
                action = "Created" if result["created"] else "Updated"
                self.stdout.write(
                    self.style.SUCCESS(f"  {action}: {result['article'].title} [{categories_str}]")
                )
                pages_imported += 1
                redirects_created += len(result["redirects"]) + 1  # +1 for slug redirect

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  Failed to import: {e}"))
                pages_failed += 1

            time.sleep(delay)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Import complete!"))
        self.stdout.write(f"  Pages imported: {pages_imported}")
        self.stdout.write(f"  Pages skipped: {pages_skipped}")
        self.stdout.write(f"  Pages failed: {pages_failed}")
        self.stdout.write(f"  Redirects created: {redirects_created}")

        if dry_run:
            self.stdout.write(self.style.WARNING("\nThis was a dry run. No changes were made."))
