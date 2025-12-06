# OneDrive/SharePoint Video Upload Integration

This document provides comprehensive instructions for setting up the OneDrive/SharePoint integration for video uploads on the Wedding of Rebecca and Peter website.

## Overview

The wedding website allows guests to upload videos which are stored in OneDrive/SharePoint rather than on the server. This approach:

- **Saves server storage**: Videos can be large (up to 100MB each), so storing them in cloud storage keeps server costs down
- **Enables chunked uploads**: Large files are uploaded in 5MB chunks, allowing for progress tracking and resumable uploads
- **Provides video playback**: OneDrive provides embedded video player functionality

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Frontend      │────▶│   Django API    │────▶│   OneDrive/     │
│   (Next.js)     │     │   (Backend)     │     │   SharePoint    │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │   1. Init upload      │   2. Create session   │
        │──────────────────────▶│──────────────────────▶│
        │                       │                       │
        │   3. Upload URL       │   4. Session URL      │
        │◀──────────────────────│◀──────────────────────│
        │                       │                       │
        │   5. Upload chunks    │   6. Forward chunks   │
        │──────────────────────▶│──────────────────────▶│
        │                       │                       │
        │   7. Progress updates │                       │
        │◀──────────────────────│                       │
        │                       │                       │
        │   8. Complete         │   9. File info        │
        │◀──────────────────────│◀──────────────────────│
```

## Prerequisites

- Microsoft 365 account (personal, business, or enterprise)
- Access to Azure Portal (https://portal.azure.com)
- Admin consent capability (for application permissions)

## Step 1: Register an Azure AD Application

### 1.1 Access Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in with your Microsoft account

### 1.2 Create App Registration

1. Navigate to **Azure Active Directory** → **App registrations**
2. Click **+ New registration**
3. Fill in the details:
    - **Name**: `Wedding Video Upload` (or any descriptive name)
    - **Supported account types**: Choose based on your needs:
        - "Accounts in this organizational directory only" for SharePoint/OneDrive for Business
        - "Accounts in any organizational directory and personal Microsoft accounts" for personal OneDrive
    - **Redirect URI**: Leave blank (not needed for client credentials flow)
4. Click **Register**

### 1.3 Note the Application Details

After registration, you'll see the **Overview** page. Note down:

- **Application (client) ID** → This is your `ONEDRIVE_CLIENT_ID`
- **Directory (tenant) ID** → This is your `ONEDRIVE_TENANT_ID`

## Step 2: Create a Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Under **Client secrets**, click **+ New client secret**
3. Add a description (e.g., "Wedding Video Upload Secret")
4. Choose an expiration period (recommend: 24 months)
5. Click **Add**
6. **IMPORTANT**: Copy the **Value** immediately → This is your `ONEDRIVE_CLIENT_SECRET`
    - You won't be able to see this value again after leaving the page!

## Step 3: Configure API Permissions

### 3.1 Add Microsoft Graph Permissions

1. Go to **API permissions** in your app registration
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Choose **Application permissions** (not Delegated)
5. Search for and select:
    - `Files.ReadWrite.All` - Required for uploading and managing files
    - `Sites.ReadWrite.All` - Required if using SharePoint (optional)
6. Click **Add permissions**

### 3.2 Grant Admin Consent

1. Still on the **API permissions** page
2. Click **Grant admin consent for [Your Organization]**
3. Click **Yes** to confirm
4. You should see green checkmarks next to the permissions

> **Note**: If you don't have admin rights, you'll need to request consent from an Azure AD administrator.

## Step 4: Find Your Drive ID

### Option A: Personal OneDrive

If you're using a personal OneDrive, you can use `me` as the drive ID:

```
ONEDRIVE_DRIVE_ID=me
```

However, this typically requires **delegated permissions** (user sign-in), which our implementation doesn't support. For personal OneDrive with application permissions, you'll need to find the actual drive ID.

### Option B: OneDrive for Business / SharePoint

To find the drive ID for OneDrive for Business or a SharePoint document library:

#### Using Graph Explorer

1. Go to [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with your Microsoft account
3. Run this query to list your drives:
    ```
    GET https://graph.microsoft.com/v1.0/me/drives
    ```
4. Or for a specific SharePoint site:
    ```
    GET https://graph.microsoft.com/v1.0/sites/{site-id}/drives
    ```

The response will include drive IDs like:

```json
{
  "value": [
    {
      "id": "b!xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "name": "Documents",
      "driveType": "documentLibrary"
    }
  ]
}
```

The `id` field is your `ONEDRIVE_DRIVE_ID`.

#### Using PowerShell (SharePoint)

```powershell
# Install Microsoft Graph PowerShell module
Install-Module Microsoft.Graph -Scope CurrentUser

# Connect to Microsoft Graph
Connect-MgGraph -Scopes "Sites.Read.All"

# Get all sites
Get-MgSite -All

# Get drives for a specific site
Get-MgSiteDrive -SiteId "your-site-id"
```

### Option C: Create a Shared Folder

For the best results, we recommend:

1. Create a folder in your OneDrive or SharePoint specifically for wedding videos
2. Use that folder path in `ONEDRIVE_FOLDER_PATH`

## Step 5: Configure Environment Variables

Add the following environment variables to your deployment:

```bash
# Azure AD Application Registration
ONEDRIVE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ONEDRIVE_CLIENT_SECRET=your-secret-value-here
ONEDRIVE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# OneDrive/SharePoint Drive
ONEDRIVE_DRIVE_ID=b!xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Folder where videos will be stored (created automatically if it doesn't exist)
ONEDRIVE_FOLDER_PATH=WeddingVideos
```

### For Local Development

Create or update your `.env` file:

```bash
# .env
ONEDRIVE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ONEDRIVE_CLIENT_SECRET=your-secret-value-here
ONEDRIVE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ONEDRIVE_DRIVE_ID=b!xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ONEDRIVE_FOLDER_PATH=WeddingVideos
```

### For Production (Docker/Kubernetes)

Add to your container environment configuration.

## Step 6: Test the Integration

### 6.1 Verify Configuration

You can test that the OneDrive service is properly configured by running this in a Django shell:

```python
from apps.wedding.services import OneDriveService

service = OneDriveService()
print(f"Is configured: {service.is_configured}")

# Test getting an access token
if service.is_configured:
    try:
        token = service._get_access_token()
        print(f"Successfully obtained access token: {token[:20]}...")
    except Exception as e:
        print(f"Failed to get token: {e}")
```

### 6.2 Test Upload Session Creation

```python
from apps.wedding.services import OneDriveService

service = OneDriveService()
session = service.create_upload_session("test-video.mp4", 1024 * 1024)
print(f"Upload URL: {session['upload_url'][:50]}...")
print(f"Expires: {session['expiration_datetime']}")

# Clean up - cancel the session
service.cancel_upload_session(session['upload_url'])
```

## Troubleshooting

### Error: "AADSTS7000215: Invalid client secret provided"

- The client secret may have expired or been entered incorrectly
- Generate a new client secret and update `ONEDRIVE_CLIENT_SECRET`

### Error: "AADSTS700016: Application with identifier 'xxx' was not found"

- The client ID is incorrect
- Verify the Application (client) ID from Azure Portal

### Error: "Insufficient privileges to complete the operation"

- Admin consent has not been granted
- Go to Azure Portal → App registrations → API permissions → Grant admin consent

### Error: "The resource could not be found" (404)

- The drive ID is incorrect
- The folder path doesn't exist (it should be created automatically, but verify the drive ID is correct)

### Error: "Access denied" (403)

- The application doesn't have the required permissions
- Verify `Files.ReadWrite.All` permission is granted with admin consent

### Videos not playing in embed

- OneDrive may take a few minutes to process the video for streaming
- Very large videos may take longer to process
- Some video formats may not be supported for streaming

## Security Considerations

### Client Secret Management

- **Never commit** the client secret to version control
- Use environment variables or a secrets manager
- Rotate the client secret periodically (every 6-12 months)
- Set up alerts for secret expiration

### Principle of Least Privilege

- Only grant the permissions you actually need
- `Files.ReadWrite.All` is broad; consider if you can scope to a specific folder
- For SharePoint, consider using site-specific permissions

### Monitoring

- Enable Azure AD sign-in logs to monitor API access
- Set up alerts for unusual activity
- Review application access periodically

## Folder Structure in OneDrive

Videos are stored with the following structure:

```
OneDrive/
└── WeddingVideos/           # ONEDRIVE_FOLDER_PATH
    ├── video1.mp4
    ├── video2.mov
    └── ...
```

If a file with the same name exists, OneDrive will automatically rename the new file (e.g., `video1 (1).mp4`).

## Video Playback

Videos are played using OneDrive's embed URL feature. The workflow:

1. After upload completes, we get the OneDrive item ID
2. We call the `/preview` endpoint to get an embed URL
3. The frontend uses an iframe to display the video player

The embed URL provides:

- Adaptive streaming (adjusts quality based on connection)
- Built-in video controls
- Mobile-friendly playback

## API Endpoints Reference

| Endpoint                         | Method | Description               |
| -------------------------------- | ------ | ------------------------- |
| `/api/videos/init-upload`        | POST   | Initialize upload session |
| `/api/videos/{upload_id}/chunk`  | POST   | Upload a chunk            |
| `/api/videos/{upload_id}/status` | GET    | Get upload status         |
| `/api/videos/{upload_id}/cancel` | DELETE | Cancel upload             |
| `/api/videos/list`               | GET    | List all completed videos |
| `/api/videos/count`              | GET    | Get video count           |
| `/api/videos/{video_id}`         | GET    | Get single video          |

## Additional Resources

- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/overview)
- [Resumable File Upload](https://docs.microsoft.com/en-us/graph/api/driveitem-createuploadsession)
- [Azure AD App Registration](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [Microsoft Graph Permissions Reference](https://docs.microsoft.com/en-us/graph/permissions-reference)
