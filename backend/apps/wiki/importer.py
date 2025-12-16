"""MediaWiki to Markdown importer for TechWiki."""

import re
import logging
from typing import Optional
from django.utils.text import slugify

logger = logging.getLogger(__name__)


class MediaWikiConverter:
    """Convert MediaWiki syntax to Markdown."""

    def __init__(self):
        self.inferred_categories = []
        self.generated_redirects = []

    def convert(self, wiki_text: str, title: str = "") -> dict:
        """
        Convert MediaWiki text to Markdown.
        
        Returns:
            dict with keys: markdown, categories, redirects, title
        """
        self.inferred_categories = []
        self.generated_redirects = []
        
        markdown = wiki_text
        
        # Extract and remove categories
        markdown = self._extract_categories(markdown)
        
        # Extract redirects
        markdown = self._extract_redirects(markdown, title)
        
        # Convert formatting
        markdown = self._convert_headings(markdown)
        markdown = self._convert_bold_italic(markdown)
        markdown = self._convert_links(markdown)
        markdown = self._convert_lists(markdown)
        markdown = self._convert_code_blocks(markdown)
        markdown = self._convert_templates(markdown)
        markdown = self._convert_tables(markdown)
        markdown = self._convert_images(markdown)
        markdown = self._convert_nowiki(markdown)
        
        # Clean up
        markdown = self._cleanup(markdown)
        
        return {
            "markdown": markdown.strip(),
            "categories": self.inferred_categories,
            "redirects": self.generated_redirects,
            "title": title,
        }

    def _extract_categories(self, text: str) -> str:
        """Extract [[Category:...]] tags."""
        pattern = r'\[\[Category:([^\]]+)\]\]'
        matches = re.findall(pattern, text, re.IGNORECASE)
        
        for match in matches:
            category = match.strip()
            if category:
                self.inferred_categories.append(slugify(category))
        
        return re.sub(pattern, '', text, flags=re.IGNORECASE)

    def _extract_redirects(self, text: str, title: str) -> str:
        """Extract #REDIRECT directives."""
        pattern = r'^#REDIRECT\s*\[\[([^\]]+)\]\]'
        match = re.match(pattern, text, re.IGNORECASE | re.MULTILINE)
        
        if match:
            target = match.group(1).strip()
            if title:
                self.generated_redirects.append({
                    "from": f"/wiki/{title.replace(' ', '_')}",
                    "to": f"/{slugify(target)}",
                })
            return ""
        
        return text

    def _convert_headings(self, text: str) -> str:
        """Convert == Heading == to # Heading."""
        # Must process from deepest to shallowest
        for i in range(6, 0, -1):
            pattern = r'^={' + str(i) + r'}\s*(.+?)\s*={' + str(i) + r'}\s*$'
            replacement = '#' * i + r' \1'
            text = re.sub(pattern, replacement, text, flags=re.MULTILINE)
        return text

    def _convert_bold_italic(self, text: str) -> str:
        """Convert '''bold''' and ''italic''."""
        # Bold+italic (''''') 
        text = re.sub(r"'''''(.+?)'''''", r'***\1***', text)
        # Bold (''')
        text = re.sub(r"'''(.+?)'''", r'**\1**', text)
        # Italic ('')
        text = re.sub(r"''(.+?)''", r'*\1*', text)
        return text

    def _convert_links(self, text: str) -> str:
        """Convert [[links]] and [external links]."""
        # Internal links with display text [[Page|text]]
        text = re.sub(
            r'\[\[([^\]|]+)\|([^\]]+)\]\]',
            lambda m: f'[{m.group(2)}](/{slugify(m.group(1))})',
            text
        )
        
        # Internal links [[Page]]
        text = re.sub(
            r'\[\[([^\]]+)\]\]',
            lambda m: f'[{m.group(1)}](/{slugify(m.group(1))})',
            text
        )
        
        # External links with text [http://... text] or [https://... text]
        # Only match URLs starting with http:// or https://
        text = re.sub(
            r'\[(https?://\S+)\s+([^\]]+)\]',
            r'[\2](\1)',
            text
        )
        
        # External links without text [http://...]
        text = re.sub(
            r'\[(https?://[^\s\]]+)\]',
            r'<\1>',
            text
        )
        
        return text

    def _convert_lists(self, text: str) -> str:
        """Convert MediaWiki * and # lists to Markdown.
        
        Note: This runs AFTER bold/italic conversion, so ** is markdown bold, not a list.
        MediaWiki lists have * followed by space, not ** for bold.
        """
        lines = text.split('\n')
        result = []
        
        for line in lines:
            # Skip lines that are already markdown headings (start with # followed by space)
            if re.match(r'^#+\s+', line):
                result.append(line)
                continue
            
            # Skip lines that start with ** (markdown bold), not MediaWiki lists
            # MediaWiki lists are * followed by space, not **
            if line.startswith('**') or line.startswith('*_'):
                result.append(line)
                continue
            
            # Unordered lists (MediaWiki uses * followed by space)
            match = re.match(r'^(\*+)\s+(.*)$', line)
            if match:
                level = len(match.group(1))
                content = match.group(2)
                indent = '  ' * (level - 1)
                result.append(f'{indent}- {content}')
                continue
            
            # Ordered lists (MediaWiki uses # for ordered lists, but not followed by space like markdown headings)
            match = re.match(r'^(#+)(.*)$', line)
            if match and not match.group(2).startswith(' '):
                level = len(match.group(1))
                content = match.group(2).lstrip()
                indent = '  ' * (level - 1)
                result.append(f'{indent}1. {content}')
                continue
            
            # Definition lists
            match = re.match(r'^;\s*(.+?)\s*:\s*(.*)$', line)
            if match:
                result.append(f'**{match.group(1)}**: {match.group(2)}')
                continue
            
            result.append(line)
        
        return '\n'.join(result)

    def _convert_code_blocks(self, text: str) -> str:
        """Convert <source> and <syntaxhighlight> to fenced code blocks."""
        # <source lang="...">...</source>
        text = re.sub(
            r'<source\s+lang=["\']?(\w+)["\']?\s*>(.*?)</source>',
            r'```\1\n\2\n```',
            text,
            flags=re.DOTALL | re.IGNORECASE
        )
        
        # <syntaxhighlight lang="...">...</syntaxhighlight>
        text = re.sub(
            r'<syntaxhighlight\s+lang=["\']?(\w+)["\']?\s*>(.*?)</syntaxhighlight>',
            r'```\1\n\2\n```',
            text,
            flags=re.DOTALL | re.IGNORECASE
        )
        
        # <code>...</code>
        text = re.sub(r'<code>(.*?)</code>', r'`\1`', text)
        
        # <pre>...</pre>
        text = re.sub(
            r'<pre>(.*?)</pre>',
            r'```\n\1\n```',
            text,
            flags=re.DOTALL
        )
        
        return text

    def _convert_templates(self, text: str) -> str:
        """Convert common templates to Markdown equivalents."""
        # {{note|...}} -> > **Note:** ...
        text = re.sub(
            r'\{\{[Nn]ote\|([^}]+)\}\}',
            r'> **Note:** \1',
            text
        )
        
        # {{warning|...}} -> > ⚠️ **Warning:** ...
        text = re.sub(
            r'\{\{[Ww]arning\|([^}]+)\}\}',
            r'> ⚠️ **Warning:** \1',
            text
        )
        
        # {{tip|...}} -> > 💡 **Tip:** ...
        text = re.sub(
            r'\{\{[Tt]ip\|([^}]+)\}\}',
            r'> 💡 **Tip:** \1',
            text
        )
        
        # Remove other templates (could be customized)
        text = re.sub(r'\{\{[^}]+\}\}', '', text)
        
        return text

    def _convert_tables(self, text: str) -> str:
        """Convert MediaWiki tables to Markdown tables."""
        # This is a simplified conversion
        lines = text.split('\n')
        result = []
        in_table = False
        headers_done = False
        
        for line in lines:
            line = line.strip()
            
            if line.startswith('{|'):
                in_table = True
                headers_done = False
                continue
            
            if line.startswith('|}'):
                in_table = False
                result.append('')
                continue
            
            if not in_table:
                result.append(line)
                continue
            
            # Skip table attributes
            if line.startswith('|+') or line.startswith('|-'):
                continue
            
            # Header cells
            if line.startswith('!'):
                cells = re.split(r'\s*!!\s*', line[1:])
                result.append('| ' + ' | '.join(c.strip() for c in cells) + ' |')
                if not headers_done:
                    result.append('| ' + ' | '.join('---' for _ in cells) + ' |')
                    headers_done = True
                continue
            
            # Regular cells
            if line.startswith('|'):
                cells = re.split(r'\s*\|\|\s*', line[1:])
                result.append('| ' + ' | '.join(c.strip() for c in cells) + ' |')
                continue
        
        return '\n'.join(result)

    def _convert_images(self, text: str) -> str:
        """Convert [[File:...]] and [[Image:...]] to Markdown."""
        pattern = r'\[\[(?:File|Image):([^\]|]+)(?:\|[^\]]+)?\]\]'
        
        def replace_image(match):
            filename = match.group(1).strip()
            return f'![{filename}](/api/wiki/images/{slugify(filename)})'
        
        return re.sub(pattern, replace_image, text, flags=re.IGNORECASE)

    def _convert_nowiki(self, text: str) -> str:
        """Handle <nowiki> tags."""
        # Simple removal - content is preserved as-is
        text = re.sub(r'<nowiki>(.*?)</nowiki>', r'\1', text, flags=re.DOTALL)
        return text

    def _cleanup(self, text: str) -> str:
        """Clean up extra whitespace and formatting."""
        # Remove excessive blank lines
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Remove HTML comments
        text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
        
        # Remove __TOC__, __NOTOC__, etc.
        text = re.sub(r'__[A-Z]+__', '', text)
        
        return text


def import_mediawiki_page(
    wiki_text: str,
    title: str,
    author=None,
    category_slug: Optional[str] = None,
) -> dict:
    """
    Import a MediaWiki page into TechWiki.
    
    Args:
        wiki_text: The MediaWiki source text
        title: The page title
        author: User object for the author
        category_slug: Optional category slug to assign
    
    Returns:
        dict with created article and any redirects
    """
    from apps.wiki.models import Article, Category, Redirect, ArticleStatus
    from apps.wiki.views import render_markdown
    
    converter = MediaWikiConverter()
    result = converter.convert(wiki_text, title)
    
    # Find or create category
    category = None
    if category_slug:
        category, _ = Category.objects.get_or_create(
            slug=category_slug,
            defaults={"name": category_slug.replace("-", " ").title()}
        )
    elif result["categories"]:
        cat_slug = result["categories"][0]
        category, _ = Category.objects.get_or_create(
            slug=cat_slug,
            defaults={"name": cat_slug.replace("-", " ").title()}
        )
    
    # Create article
    slug = slugify(title)
    article, created = Article.objects.get_or_create(
        slug=slug,
        category=category,
        defaults={
            "title": title,
            "content": result["markdown"],
            "rendered_html": render_markdown(result["markdown"]),
            "author": author,
            "status": ArticleStatus.PUBLISHED,
        }
    )
    
    if not created:
        article.content = result["markdown"]
        article.rendered_html = render_markdown(result["markdown"])
        article.save()
    
    # Create redirects
    created_redirects = []
    for redirect_data in result["redirects"]:
        redirect, _ = Redirect.objects.get_or_create(
            old_path=redirect_data["from"],
            defaults={"new_path": redirect_data["to"]}
        )
        created_redirects.append(redirect)
    
    # Add standard wiki redirect (/wiki/Page_Title)
    wiki_redirect, _ = Redirect.objects.get_or_create(
        old_path=f"/wiki/{title.replace(' ', '_')}",
        defaults={"new_path": article.full_url}
    )
    created_redirects.append(wiki_redirect)
    
    # Add index.php style redirect (/index.php/Page_Title)
    index_redirect, _ = Redirect.objects.get_or_create(
        old_path=f"/index.php/{title.replace(' ', '_')}",
        defaults={"new_path": article.full_url}
    )
    created_redirects.append(index_redirect)
    
    # Add index.php?title= style redirect
    query_redirect, _ = Redirect.objects.get_or_create(
        old_path=f"/index.php?title={title.replace(' ', '_')}",
        defaults={"new_path": article.full_url}
    )
    created_redirects.append(query_redirect)
    
    return {
        "article": article,
        "created": created,
        "redirects": created_redirects,
        "categories_inferred": result["categories"],
    }
