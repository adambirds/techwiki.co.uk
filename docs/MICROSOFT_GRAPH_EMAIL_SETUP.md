# Microsoft Graph transactional email setup

TechWiki sends account verification and password-reset messages through a Microsoft 365
mailbox using Microsoft Graph. The backend authenticates as an Entra application with an
X.509 certificate; client secrets and SMTP passwords are not supported.

Use separate Entra app registrations and certificates for development and production. They
may target the same sender mailbox, although separate mailboxes provide clearer auditing.

## 1. Prepare the sender mailbox

Create or choose an Exchange Online mailbox such as:

```text
noreply@techwiki.co.uk
```

The address must be a real Exchange Online mailbox that Microsoft Graph can send as. A shared
mailbox is suitable when its licensing and storage usage comply with your Microsoft 365 plan.

## 2. Register the Entra application

In the [Microsoft Entra admin center](https://entra.microsoft.com/):

1. Open **Identity > Applications > App registrations**.
2. Select **New registration**.
3. Name it `TechWiki Email Production` (and create a separate
   `TechWiki Email Development` registration for development).
4. Select **Accounts in this organizational directory only**.
5. Do not configure a redirect URI.
6. Record the **Application (client) ID** and **Directory (tenant) ID**.

Do not add an organization-wide Microsoft Graph `Mail.Send` permission when using the
mailbox-scoped Exchange Application RBAC configuration below. Entra permissions and Exchange
RBAC permissions are additive; adding unscoped `Mail.Send` would allow the app to send as
every mailbox in the tenant.

## 3. Generate and upload a certificate

Generate a different key pair for each environment:

```bash
openssl genrsa -out techwiki-email-prod.key 3072
openssl req -new -x509 \
  -key techwiki-email-prod.key \
  -out techwiki-email-prod.crt \
  -days 365 \
  -sha256 \
  -subj "/CN=TechWiki Email Production"
chmod 600 techwiki-email-prod.key
```

Upload only the public certificate:

1. Open the app registration.
2. Select **Certificates & secrets > Certificates**.
3. Select **Upload certificate**.
4. Upload `techwiki-email-prod.crt`.

Never upload, commit, or copy the `.key` file into a container image. Mount it as a
read-only deployment secret. Store the public certificate alongside it. Set a certificate
expiry alert and overlap old/new certificates during rotation.

## 4. Scope Graph access to the sender mailbox

Microsoft recommends Exchange Online Role Based Access Control for Applications rather than
the legacy Application Access Policy feature.

These Exchange RBAC settings are not currently exposed as ordinary Entra admin center forms.
An Azure subscription is not required. Install the cross-platform PowerShell 7 command-line
tool on macOS and run the Exchange commands locally.

Microsoft now distributes the supported stable macOS release as a signed `.pkg` installer.
Download the package matching your Mac processor (Apple silicon/Arm64 or Intel/x64) from the
[official macOS installation page](https://learn.microsoft.com/powershell/scripting/install/install-powershell-on-macos),
open it, and complete the installer.

Homebrew remains an alternative, but PowerShell is now a formula rather than a cask. Install
it from Terminal with:

```bash
brew install powershell
```

Do not install `powershell@preview`; the preview release is unnecessary for this setup.
After either installation method, start PowerShell by running `pwsh`, then install the
Exchange Online administration module for your macOS user:

```powershell
Install-Module ExchangeOnlineManagement -Scope CurrentUser -Force
```

Connect to Exchange Online using a Microsoft 365 account with permission to configure
Exchange Application RBAC:

```powershell
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline
```

PowerShell 7 opens the Microsoft sign-in flow in your default browser and supports MFA. The
PowerShell modules are installed only for your local macOS user; this does not create Azure
resources or require an Azure subscription.

Find the service principal in the [Microsoft Entra admin center](https://entra.microsoft.com/):

1. Open **Identity > Applications > Enterprise applications > All applications**.
2. Search for the TechWiki email application by its display name.
3. Open it and copy the **Object ID** from **Overview**.

The value required below is the **Enterprise application/service principal Object ID**, not
the Object ID shown under App registrations. No Microsoft Graph PowerShell connection is
needed.

Create the Exchange pointer and a scope containing only the sender mailbox:

```powershell
New-ServicePrincipal `
  -AppId "<CLIENT_ID>" `
  -ObjectId "<SERVICE_PRINCIPAL_OBJECT_ID>" `
  -DisplayName "TechWiki Email Production"

New-ManagementScope `
  -Name "TechWiki Email Production Sender" `
  -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'noreply@techwiki.co.uk'"

New-ManagementRoleAssignment `
  -Name "TechWiki Email Production Mail.Send" `
  -App "<SERVICE_PRINCIPAL_OBJECT_ID>" `
  -Role "Application Mail.Send" `
  -CustomResourceScope "TechWiki Email Production Sender"
```

Confirm the mailbox is in scope:

```powershell
Test-ServicePrincipalAuthorization `
  -Identity "<SERVICE_PRINCIPAL_OBJECT_ID>" `
  -Resource "noreply@techwiki.co.uk" |
  Format-Table RoleName, GrantedPermissions, InScope
```

Test a second mailbox and confirm `InScope` is false. Exchange permission changes can take
between 30 minutes and two hours to propagate.

## 5. Encode the certificate for environment transport

TechWiki prefers base64 environment values because the deployment system injects Docker
environment variables rather than mounting files. Base64 keeps multiline PEM data safe while
passing through GitHub Secrets, Ansible, YAML, and Docker.

On Linux:

```bash
base64 -w 0 techwiki-email-prod.crt > techwiki-email-prod.crt.base64
base64 -w 0 techwiki-email-prod.key > techwiki-email-prod.key.base64
```

On macOS:

```bash
base64 < techwiki-email-prod.crt | tr -d '\n' > techwiki-email-prod.crt.base64
base64 < techwiki-email-prod.key | tr -d '\n' > techwiki-email-prod.key.base64
```

Store the contents as GitHub Actions secrets, not the files themselves:

- `MICROSOFT_GRAPH_CERTIFICATE_BASE64`
- `MICROSOFT_GRAPH_PRIVATE_KEY_BASE64`

Configure the backend container with:

```dotenv
MICROSOFT_GRAPH_TENANT_ID=<directory-tenant-id>
MICROSOFT_GRAPH_CLIENT_ID=<application-client-id>
MICROSOFT_GRAPH_SENDER_EMAIL=noreply@techwiki.co.uk
MICROSOFT_GRAPH_CERTIFICATE_BASE64=<single-line-base64-public-certificate>
MICROSOFT_GRAPH_PRIVATE_KEY_BASE64=<single-line-base64-private-key>
MICROSOFT_GRAPH_PRIVATE_KEY_PASSPHRASE=
MICROSOFT_GRAPH_TIMEOUT_SECONDS=15
AUTH_FRONTEND_URL=https://auth.techwiki.co.uk
```

The passphrase variable is optional. Local file paths remain supported as a fallback when the
base64 variables are empty:

```dotenv
MICROSOFT_GRAPH_CERTIFICATE_PATH=/absolute/path/to/techwiki-email-dev.crt
MICROSOFT_GRAPH_PRIVATE_KEY_PATH=/absolute/path/to/techwiki-email-dev.key
```

For local development, use a separate development app registration and certificate. You can
either base64-encode them like production or use the path fallback. Never commit certificate
or private-key files.

### adb-deploy configuration

In `adb-deploy/group_vars/all.yml`, add variables for TechWiki and pass them into the
backend container:

```yaml
techwiki_graph_tenant_id: ""
techwiki_graph_client_id: ""
techwiki_graph_sender_email: ""
techwiki_graph_certificate_base64: ""
techwiki_graph_private_key_base64: ""

# Within the TechWiki backend env mapping:
env:
  MICROSOFT_GRAPH_TENANT_ID: "{{ techwiki_graph_tenant_id }}"
  MICROSOFT_GRAPH_CLIENT_ID: "{{ techwiki_graph_client_id }}"
  MICROSOFT_GRAPH_SENDER_EMAIL: "{{ techwiki_graph_sender_email }}"
  MICROSOFT_GRAPH_CERTIFICATE_BASE64: "{{ techwiki_graph_certificate_base64 }}"
  MICROSOFT_GRAPH_PRIVATE_KEY_BASE64: "{{ techwiki_graph_private_key_base64 }}"
```

Add the values to the TechWiki repository's GitHub Actions secrets and pass them to the deploy
playbook using the existing `--extra-vars` convention:

```bash
--extra-vars "techwiki_graph_tenant_id=${{ secrets.MICROSOFT_GRAPH_TENANT_ID }}" \
--extra-vars "techwiki_graph_client_id=${{ secrets.MICROSOFT_GRAPH_CLIENT_ID }}" \
--extra-vars "techwiki_graph_sender_email=${{ secrets.MICROSOFT_GRAPH_SENDER_EMAIL }}" \
--extra-vars "techwiki_graph_certificate_base64=${{ secrets.MICROSOFT_GRAPH_CERTIFICATE_BASE64 }}" \
--extra-vars "techwiki_graph_private_key_base64=${{ secrets.MICROSOFT_GRAPH_PRIVATE_KEY_BASE64 }}"
```

The encoded values contain no line breaks. GitHub masks registered secrets in action output,
and the values are passed directly into the backend container by adb-deploy.

## 6. Verify delivery before deployment

From the Django shell:

```bash
python manage.py shell
```

```python
from authentication.email_service import send_graph_email

send_graph_email(
    to_email="your-address@example.com",
    subject="TechWiki Graph email test",
    html_template="email/verification.html",
    context={
        "first_name": "Test",
        "verification_url": "https://auth.techwiki.co.uk/",
    },
)
```

A successful Graph `sendMail` request returns HTTP 202 and creates a copy in the sender
mailbox's Sent Items. Check Exchange message trace, junk delivery, and the backend logs if the
message is not received.

## 7. DNS and operational checks

Because the message is sent by Exchange Online for the existing Microsoft 365 domain, retain
the Microsoft 365 SPF record and enable DKIM for `techwiki.co.uk`. Configure DMARC once SPF
and DKIM alignment are confirmed.

Monitor:

- certificate expiration;
- Graph authentication and HTTP errors;
- Exchange message trace and outbound spam restrictions;
- the sender mailbox's Sent Items and quota;
- resend-verification rate-limit events.

## Recovery through Django shell

Email verification is enforced for password, passkey, and 2FA authentication. If delivery is
temporarily unavailable, an administrator with shell access can verify a known account:

```python
from authentication.models import User

user = User.objects.get(email="person@example.com")
user.email_verified = True
user.save(update_fields=["email_verified"])
```

Only use this after independently confirming ownership of the email address.

## Microsoft documentation

- [Azure Cloud Shell](https://learn.microsoft.com/azure/cloud-shell/overview)
- [Microsoft Graph sendMail](https://learn.microsoft.com/graph/api/user-sendmail)
- [MSAL Python certificate credentials](https://learn.microsoft.com/entra/msal/python/advanced/client-credentials)
- [Exchange Online RBAC for Applications](https://learn.microsoft.com/exchange/permissions-exo/application-rbac)
- [Exchange Online sending limits](https://learn.microsoft.com/office365/servicedescriptions/exchange-online-service-description/exchange-online-limits)
