# Production Deployment Fixes Needed

## Issues
1. **CORS headers not being sent** - API requests from weddingofrebeccaandpeter.co.uk to api.weddingofrebeccaandpeter.co.uk are being blocked
2. **413 Content Too Large** - Photo uploads are being rejected due to body size limits (currently hitting at ~10MB photos)
3. **404 on media files** - Uploaded photos returning 404 (e.g., `/media/wedding_photos/2025/11/26/forge-playground.png`)

## Root Cause
Since Django runs in Docker and the reverse proxy runs on the host:
1. The reverse proxy needs to allow larger request body sizes (currently defaults to ~1-2MB)
2. The reverse proxy needs to pass through CORS headers from Django backend
3. **The media directory must be mounted as a Docker volume** so the host reverse proxy can serve files

## Required Fix: Mount Media Directory as Docker Volume

### 1. Update Docker Deployment

In your Ansible deployment, ensure the backend container mounts the media directory:

```yaml
# In your docker-compose or docker run command
volumes:
  - /var/www/weddingofrebeccaandpeter/media:/opt/weddingofrebeccaandpeter/backend/media
```

This makes the media files accessible to both:
- Django inside the container (for writing uploads)
- Reverse proxy on the host (for serving files)

### 2. Configure Reverse Proxy

#### For Caddy

```caddy
api.weddingofrebeccaandpeter.co.uk {
    # Increase max body size to 50MB for photo uploads
    request_body {
        max_size 50MB
    }
    
    # Serve media files directly from host volume
    handle /media/* {
        root * /var/www/weddingofrebeccaandpeter
        file_server
    }
    
    # Reverse proxy API requests to Django backend
    handle {
        reverse_proxy localhost:8000 {
            # Pass through headers including CORS
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
}
```

#### For nginx

```nginx
server {
    server_name api.weddingofrebeccaandpeter.co.uk;
    
    # Increase max body size to 50MB for photo uploads
    client_max_body_size 50M;
    
    # Serve media files directly from host volume
    location /media/ {
        alias /var/www/weddingofrebeccaandpeter/media/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Proxy API requests to Django
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Important: Don't filter response headers - let Django's CORS middleware handle it
        proxy_pass_request_headers on;
    }
}
```

### 3. Ensure Proper Permissions

```bash
# On the host machine
sudo mkdir -p /var/www/weddingofrebeccaandpeter/media
sudo chown -R <docker-user>:<docker-user> /var/www/weddingofrebeccaandpeter/media
sudo chmod 755 /var/www/weddingofrebeccaandpeter/media
```

Replace `<docker-user>` with the user that the Django container runs as (often the same user running Docker).

## Django Settings Already Updated

The following settings have been added to `backend/weddingofrebeccaandpeter/settings.py`:

```python
# File Upload Settings
# Allow uploads up to 50MB (photos can be large after cropping)
DATA_UPLOAD_MAX_MEMORY_SIZE = 52428800  # 50MB in bytes
FILE_UPLOAD_MAX_MEMORY_SIZE = 52428800  # 50MB in bytes
```

CORS is already properly configured in Django:
```python
CORS_ALLOWED_ORIGINS = [
    "https://" + SITE_DOMAIN,  # https://weddingofrebeccaandpeter.co.uk
    "https://api." + SITE_DOMAIN,  # https://api.weddingofrebeccaandpeter.co.uk
]
CORS_ALLOW_CREDENTIALS = True
```

Media files configuration:
```python
MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media/")
```

## Important Notes

### Media Files Path
The Django backend stores uploaded files in `/opt/weddingofrebeccaandpeter/backend/media/` (assuming that's your deployment path). Make sure:
1. This directory exists and is writable by the Django process user
2. The reverse proxy can read from this directory
3. Adjust the path in the reverse proxy config if your deployment uses a different location

### Why Not Serve Media Through Django in Production?
Django's `static()` URL handler is disabled in production (`DEBUG=False`) because:
- It's inefficient for serving static files
- Web servers (nginx/Caddy) are optimized for static file serving
- This is Django's recommended approach

## Testing After Deployment

1. Try uploading a photo from https://weddingofrebeccaandpeter.co.uk/upload
2. Check browser console for:
   - No CORS errors
   - No 413 errors
   - Successful upload response
3. Verify the returned `image_url` loads correctly (e.g., `https://api.weddingofrebeccaandpeter.co.uk/media/wedding_photos/2025/11/26/photo.jpg`)
4. Check that existing photos on the homepage load correctly

## Ansible Deployment Steps

1. Update the Ansible playbook in the `adb-deploy` repository to include:
   - Reverse proxy configuration changes (media files + body size limit)
   - Ensure media directory exists and has correct permissions
2. Re-run the deployment:
   ```bash
   ansible-playbook site.yml -i inventories/production/hosts.ini \
     --extra-vars "site=weddingofrebeccaandpeter-website"
   ```
3. Restart the reverse proxy service on the production server:
   ```bash
   # For Caddy
   sudo systemctl restart caddy
   
   # For nginx
   sudo systemctl restart nginx
   ```
