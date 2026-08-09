"""
Dependency Updater MCP Server

Exposes tools that Claude Code, Copilot CLI, or Codex CLI can call to scan a
monorepo for outdated dependencies (package.json + pip-compile .in files) and
update them — with a hard rule: minor/patch updates are safe to apply
automatically, major version bumps are always flagged for human review, never
silently applied.

Setup:
    pip install fastmcp requests

Register with Claude Code (~/.claude/mcp.json or via `claude mcp add`):
    {
      "mcpServers": {
        "dependency-updater": {
          "command": "python",
          "args": ["/path/to/dep_updater_server.py"]
        }
      }
    }

Then, in Claude Code: "Use dependency-updater to check FlipLytics for
outdated dependencies."
"""

import json
import re
import subprocess
from pathlib import Path
from typing import Any

import requests
from fastmcp import FastMCP

mcp = FastMCP("dependency-updater")


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


@mcp.tool()
def scan_monorepo(root_path: str) -> dict[str, Any]:
    """Find all package.json and pip-compile .in files under a monorepo root.

    Skips node_modules and .git directories. Returns file paths grouped by
    ecosystem, so the caller knows what's available to check.
    """
    root = Path(root_path)
    if not root.exists():
        return {"error": f"Path does not exist: {root_path}"}

    npm_files, python_files = [], []
    for path in root.rglob("*"):
        if any(part in {"node_modules", ".git", "venv", ".venv"} for part in path.parts):
            continue
        if path.name == "package.json":
            npm_files.append(str(path))
        elif path.suffix == ".in":
            python_files.append(str(path))

    return {"npm_files": npm_files, "python_requirements_in_files": python_files}


# ---------------------------------------------------------------------------
# Version checking — the read-only, always-safe half
# ---------------------------------------------------------------------------


def _get_latest_npm_version(package: str) -> str | None:
    resp = requests.get(f"https://registry.npmjs.org/{package}/latest", timeout=10)
    return resp.json().get("version") if resp.ok else None


def _get_latest_pypi_version(package: str) -> str | None:
    resp = requests.get(f"https://pypi.org/pypi/{package}/json", timeout=10)
    return resp.json()["info"]["version"] if resp.ok else None


def _is_major_bump(current: str, latest: str) -> bool:
    """True if the first version component differs (semver-style major bump)."""
    try:
        current_match = re.match(r"\d+", current.lstrip("^~=v"))
        latest_match = re.match(r"\d+", latest.lstrip("^~=v"))
        if current_match is None or latest_match is None:
            return True
        current_major = current_match.group()
        latest_major = latest_match.group()
        return current_major != latest_major
    except (AttributeError, IndexError):
        return True  # if we can't tell, treat it as risky and flag it


@mcp.tool()
def check_npm_outdated(package_json_path: str) -> dict[str, Any]:
    """Check a package.json's dependencies against the latest npm versions.

    Returns two lists: safe_updates (patch/minor, fine to apply automatically)
    and major_updates (breaking-change risk, always requires human review —
    never applied without explicit confirmation).
    """
    data = json.loads(Path(package_json_path).read_text())
    safe: list[dict[str, str]] = []
    major: list[dict[str, str]] = []

    for section in ("dependencies", "devDependencies"):
        for pkg, current in data.get(section, {}).items():
            latest = _get_latest_npm_version(pkg)
            if not latest or latest in current:
                continue
            entry = {"package": pkg, "current": current, "latest": latest}
            (major if _is_major_bump(current, latest) else safe).append(entry)

    return {"safe_updates": safe, "major_updates": major}


@mcp.tool()
def check_python_outdated(requirements_in_path: str) -> dict[str, Any]:
    """Check a pip-compile .in file's pins against the latest PyPI versions.

    Same safe/major split and same rule: major bumps are never silently applied.
    """
    lines = Path(requirements_in_path).read_text().splitlines()
    safe: list[dict[str, str]] = []
    major: list[dict[str, str]] = []

    for line in lines:
        line = line.strip()
        if not line or line.startswith(("#", "-")):
            continue
        match = re.match(r"^([A-Za-z0-9_.\-]+)\s*([=<>~!].*)?$", line)
        if not match:
            continue
        pkg, current = match.group(1), (match.group(2) or "").strip()
        latest = _get_latest_pypi_version(pkg)
        if not latest or latest in current:
            continue
        entry = {"package": pkg, "current": current or "(unpinned)", "latest": latest}
        (major if _is_major_bump(current or "0", latest) else safe).append(entry)

    return {"safe_updates": safe, "major_updates": major}


# ---------------------------------------------------------------------------
# Applying updates — write access, so this is where the caution matters most
# ---------------------------------------------------------------------------


@mcp.tool()
def apply_npm_updates(package_json_path: str, packages: list[str]) -> str:
    """Update specific packages in package.json to their latest version, then
    run npm install to regenerate the lockfile. Only pass packages that have
    already been reviewed — this tool does not re-check major-bump status.

    Reports any package that fails to install (e.g. an ERESOLVE peer
    dependency conflict) rather than assuming success.
    """
    succeeded, failed = [], []

    for pkg in packages:
        latest = _get_latest_npm_version(pkg)
        if not latest:
            failed.append(f"{pkg} (couldn't resolve latest version)")
            continue
        result = subprocess.run(
            ["npm", "install", f"{pkg}@{latest}", "--save-exact"],
            cwd=Path(package_json_path).parent,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            # Surface the real npm error (e.g. ERESOLVE conflict details)
            # rather than a generic failure message.
            failed.append(f"{pkg}: {result.stderr.strip()[:300]}")
        else:
            succeeded.append(f"{pkg}@{latest}")

    summary = f"Succeeded: {', '.join(succeeded) or 'none'}."
    if failed:
        summary += f"\nFailed (review needed): {'; '.join(failed)}"
    return summary


@mcp.tool()
def apply_python_updates(repo_root: str, in_file_relative_path: str, packages: list[str]) -> str:
    """Update specific packages in a .in file to their latest version, then
    recompile using the repo's own tools/update-locked-requirements script —
    not a generic pip-compile call. That script cascades dev.txt into
    prod.txt/mypy.txt as a seed before recompiling each from its own .in
    file, which keeps versions consistent across environments; calling
    pip-compile directly here would skip that and risk drift. Only pass
    packages that have already been reviewed via check_python_outdated.

    repo_root: path to the repo root (where tools/update-locked-requirements lives)
    in_file_relative_path: path to the .in file, relative to repo_root
    """
    root = Path(repo_root)
    in_path = root / in_file_relative_path
    script_path = root / "tools" / "update-locked-requirements"

    if not script_path.exists():
        return f"Couldn't find {script_path} — is repo_root correct?"

    lines = in_path.read_text().splitlines()
    updated_lines = []
    for line in lines:
        stripped = line.strip()
        match = re.match(r"^([A-Za-z0-9_.\-]+)", stripped)
        if match and match.group(1) in packages:
            latest = _get_latest_pypi_version(match.group(1))
            if latest:
                updated_lines.append(f"{match.group(1)}=={latest}")
                continue
        updated_lines.append(line)
    in_path.write_text("\n".join(updated_lines) + "\n")

    result = subprocess.run(
        [str(script_path)],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return (
            f"Updated {in_file_relative_path} but "
            f"tools/update-locked-requirements failed:\n{result.stderr}"
        )
    return (
        f"Updated {len(packages)} package(s) in {in_file_relative_path} and "
        f"recompiled all locked requirements via tools/update-locked-requirements "
        f"(dev.txt, prod.txt, mypy.txt regenerated in cascade)."
    )


if __name__ == "__main__":
    mcp.run()
