# <APP_NAME>

> Replace all placeholders in this document before shipping.

## Replace These Placeholders First

- **Tenant ID:** `<TENANT_ID>`
- **Azure AD Client ID:** `<CLIENT_ID>`
- **Primary Domain / Tunnel:** `<DOMAIN>`
- **Base URL:** `<BASE_URL>`
- **Microsoft Graph Scopes:** `<GRAPH_SCOPES>` (default `User.Read TeamsActivity.Send` – add more only when required)
- **App ID URI (if exposing APIs):** `<APP_ID_URI>`
- **App Distribution Options:** `<APP_DISTRIBUTION>` (e.g., `personal tab`, `team tab`)
- **Optional External API Base URL:** `<OPTIONAL_EXTERNAL_API_BASE_URL>`

---

This scaffold bootstraps a production-ready Microsoft Teams access request workflow using **Node.js 18+**, **TypeScript**, **Express**, and the **Microsoft Graph SDK**. The architecture adapts the OfficeDev [tab-request-approval (Node.js)] sample for:

- Teams tab SSO using the Auth Code + PKCE flow.
- Activity Feed notifications with deep links that launch task modules.
- Task module UX for approving or rejecting requests.
- Hardened security posture (CSRF, Helmet, strict CORS, rate limiting, Zod/Joi validation).

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Azure AD App Registration](#azure-ad-app-registration)
4. [Configure Teams SSO](#configure-teams-sso)
5. [Local Development](#local-development)
6. [Packaging & Deployment](#packaging--deployment)
7. [Environment Variables](#environment-variables)
8. [Testing & Diagnostics](#testing--diagnostics)
9. [Security & Hardening](#security--hardening)
10. [Reference Material](#reference-material)

## Architecture Overview

- **Express API (`src/server.ts`)** provides REST endpoints with CSRF protection, per-user rate limiting, and logging (Pino + request IDs).
- **Graph client (`src/services/graphClient.ts`)** wraps Microsoft Graph delegated calls with token caching per user.
- **Approvals service (`src/services/approvals.ts`)** handles persistence (in-memory demo) and workflow logic.
- **Routes** expose `requests` and `approvals` APIs for the tab and task modules.
- **Task modules (`src/taskModules`)** render approval dialogs launched via deep links in Teams Activity Feed notifications.
- **Tab web app (`src/web`)** renders the Teams tab UI and wires Teams JS SDK v2+ for SSO and optional external OAuth provider integration.
- **Notifications (`src/notifications/activityFeed.ts`)** delivers Teams Activity Feed deep links to approvers.
- **Manifest (`appManifest/manifest.json`)** includes personal/team tab definitions and valid domains.

## Prerequisites

- Node.js 18 or later and npm 9+.
- An Azure AD tenant with permission to create app registrations.
- Microsoft Teams desktop or web client with sideloading enabled.
- (Optional) External approval system endpoint if integrating a second identity provider.

## Azure AD App Registration

1. Create a new app registration named `<APP_NAME>`.
2. Set **Supported account types** to *Single tenant* (recommended for production) or as required.
3. Under **Authentication**:
   - Add a Web platform redirect URI: `<BASE_URL>/auth/callback`.
   - Enable **Allow public client flows** for mobile/desktop clients if using Teams mobile.
   - Enable the **Implicit grant** checkboxes **off** – this project uses Auth Code + PKCE only.
4. Under **Expose an API**:
   - If required, set the Application ID URI to `<APP_ID_URI>`.
5. Under **API permissions** add delegated scopes:
   - `User.Read`
   - `TeamsActivity.Send`
   - Add additional scopes only when the business scenario requires them (see [Least-Privilege Justification](#least-privilege-graph-scopes)).
6. Grant admin consent.
7. Create a client secret for server-to-server token acquisition if necessary (store it in the `CLIENT_SECRET` environment variable).

## Configure Teams SSO

Follow the OfficeDev [tab-request-approval (Node.js)] sample guidance and adapt to Auth Code + PKCE:

1. Enable **Teams SSO** by configuring the tab `websiteUrl` and `contentUrl` to use `<BASE_URL>`.
2. Update the **AAD app manifest** to include the Teams application ID if re-using an existing registration.
3. Configure the Teams tab for both `<APP_DISTRIBUTION>` if required.
4. Ensure the Teams desktop/web client is on the latest build to support v2+ of the Teams JS SDK.

## Local Development

1. Copy `.env.example` to `.env` and fill in the placeholders.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start a local tunnel (e.g., `dev tunnels`, `ngrok`) exposing port 3978 and update `<DOMAIN>`/`<BASE_URL>`.
4. Run the development server with hot reload:

   ```bash
   npm run dev
   ```

5. Sideload the Teams app manifest (see [Packaging & Deployment](#packaging--deployment)).

### Data Storage

The scaffold uses an in-memory data store for approvals. Swap in a persistent store (SQL, Cosmos DB, etc.) by replacing the repository implementation in `src/services/approvals.ts`.

## Packaging & Deployment

1. Update `appManifest/manifest.json` with real IDs, URLs, and app details.
2. Run the manifest packaging script:

   ```bash
   npm run build
   npm run package:manifest
   ```

   (Add `"package:manifest": "ts-node scripts/packageManifest.ts"` to `package.json` if not present.)

3. Upload the generated ZIP in `dist/manifest` to Teams for both the requester and approver.
4. For production, deploy the Express app to Azure App Service, Container Apps, or another managed host. Configure environment variables according to the [Environment Variables](#environment-variables) section.

## Environment Variables

See [.env.example](./.env.example) for all required values. Set `AUTHORITY_HOST` to the Azure AD login host (default `https://login.microsoftonline.com`). No secrets should be committed to source control. Use Key Vault or equivalent secret managers in production.

## Testing & Diagnostics

- Run unit/integration tests:

  ```bash
  npm test
  ```

- Import the provided Postman collection (see `./postman/requests.postman_collection.json`) for API examples.
- Use structured logging (`pino`) for request correlation. Each request includes a `requestId` header (default `X-Request-ID`).

## Security & Hardening

- Uses Auth Code + PKCE for all OAuth flows; no implicit grant.
- CSRF protection via `csurf` for state-changing routes.
- Strict CORS configuration allowing only `<BASE_URL>` origins.
- Helmet middleware enforces secure headers.
- Joi input validation on all API payloads.
- Rate limiting per route and per user (user extracted from SSO token).
- Idempotency keys required on create request endpoint to prevent duplicate submissions.
- Environment-driven configuration (12-factor friendly).

## Least-Privilege Graph Scopes

| Scope | Justification |
|-------|---------------|
| `User.Read` | Required to identify the signed-in user and display profile info in the tab and approvals. |
| `TeamsActivity.Send` | Required to send Activity Feed notifications with deep links to approvers. |
| _Add more only as necessary_ | For example, `MailboxSettings.Read` if you need timezone/locale, etc. |

## Reference Material

- OfficeDev sample: [tab-request-approval (Node.js)](https://github.com/OfficeDev/Microsoft-Teams-Samples/tree/main/samples/tab-request-approval/nodejs) – follow for tab SSO, Activity Feed, and task module patterns. Modernize with Auth Code + PKCE and the security hardening in this scaffold.
- [Teams Toolkit Documentation](https://learn.microsoft.com/microsoftteams/platform/toolkit/).
- [Microsoft Graph SDK for JavaScript](https://learn.microsoft.com/graph/sdks/sdks-overview).

