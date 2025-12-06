#!/usr/bin/env python3
"""
Script to get the Drive ID from SharePoint site.
Run this with your Azure AD credentials to find the drive ID.
"""

import os
import sys

import requests

# Your site ID
SITE_ID = "adbtechltd.sharepoint.com,bd3cf5e4-0e43-4cae-ab1b-b57cbf8f7129,531b2af6-3592-40e1-944a-f938acef1f92"

# Get credentials from environment or prompt
CLIENT_ID = os.getenv("ONEDRIVE_CLIENT_ID") or input("Enter your Client ID: ")
CLIENT_SECRET = os.getenv("ONEDRIVE_CLIENT_SECRET") or input("Enter your Client Secret: ")
TENANT_ID = os.getenv("ONEDRIVE_TENANT_ID") or input("Enter your Tenant ID: ")

print("\n=== Getting Access Token ===")
token_url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
token_data = {
    "grant_type": "client_credentials",
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "scope": "https://graph.microsoft.com/.default",
}

try:
    token_response = requests.post(token_url, data=token_data, timeout=30)
    token_response.raise_for_status()
    access_token = token_response.json()["access_token"]
    print("✓ Access token obtained successfully")
except Exception as e:
    print(f"✗ Failed to get access token: {e}")
    sys.exit(1)

print("\n=== Getting Drives for SharePoint Site ===")
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json",
}

drives_url = f"https://graph.microsoft.com/v1.0/sites/{SITE_ID}/drives"

try:
    drives_response = requests.get(drives_url, headers=headers, timeout=30)
    drives_response.raise_for_status()
    drives = drives_response.json()

    print(f"\nFound {len(drives.get('value', []))} drive(s):\n")

    for drive in drives.get("value", []):
        print(f"Name: {drive.get('name')}")
        print(f"Drive ID: {drive.get('id')}")
        print(f"Drive Type: {drive.get('driveType')}")
        print(f"Web URL: {drive.get('webUrl', 'N/A')}")
        print("-" * 80)

    # Find the "Documents" or "Shared Documents" drive
    for drive in drives.get("value", []):
        if drive.get("name") in ["Documents", "Shared Documents"]:
            print("\n🎯 RECOMMENDED DRIVE FOR YOUR CONFIGURATION:")
            print(f"\nONEDRIVE_DRIVE_ID={drive.get('id')}")
            print(
                "ONEDRIVE_FOLDER_PATH=ADB Software Solutions/Client Folders/Rebecca & Peter Photo Website/VideoUpload"
            )
            break

except Exception as e:
    print(f"✗ Failed to get drives: {e}")
    if hasattr(e, "response") and e.response is not None:
        print(f"Response: {e.response.text}")
    sys.exit(1)
