# MenyaMuhinzi — Vercel production checklist

## Frontend (Vercel project env)

| Variable | Required | Notes |
|----------|----------|-------|
| `API_BASE_URL` | Yes | Server-only. HTTPS NestJS root including `/api/v1`. |
| `SITE_ORIGIN` | Yes | Exact public site URL (scheme + host, no trailing slash). Used for CSRF and OAuth callback (`/auth/google/callback`). |
| `MENYA_BFF_SHARED_SECRET` | Yes | ≥32 chars; must match NestJS `MENYA_BFF_SHARED_SECRET`. |
| `WEB_SESSION_COOKIE_NAME` | Optional | Default `mm_session`. |
| `VITE_API_BASE_URL` | Yes (build) | Browser registration client; must be a CORS-allowed HTTPS API URL. |
| `VERCEL` | Auto | Set by Vercel; enables `Secure` session cookies via forwarded proto. |

Do **not** prefix BFF secrets or API URLs with `VITE_`.

## Backend (NestJS host)

| Variable | Required | Notes |
|----------|----------|-------|
| `MENYA_BFF_SHARED_SECRET` | Yes | Same value as Vercel. |
| `CORS_ORIGINS` | Yes | Include production `SITE_ORIGIN` if browser calls API directly (registration). |
| `FRONTEND_SITE_ORIGIN` | Yes | Password reset links → `/auth/reset?token=…` |
| `AUTH_EXPOSE_RESET_TOKEN` | Yes | Must be `false` in production. |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | For Google sign-in | Redirect URI: `{SITE_ORIGIN}/auth/google/callback` in Google Cloud console. |
| `SMTP_*` | For email reset | Host, port, user, password, from. |
| `TWILIO_*` | For SMS reset | Account sid, auth token, from number. |
| `PASSWORD_RESET_WORKER_ENABLED` | Optional | Default `true`; set `false` only if another worker consumes the queue. |
| Redis, Postgres, JWT, web-session keys | Yes | See backend `.env.example`. |

## Builds (local CI)

```bash
npm test
npm run build
VERCEL=1 npm run build
```

## Manual HTTPS verification (production)

After deploy with credentials available:

1. Login → `mm_session` cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`.
2. Refresh page → session restored via BFF.
3. Logout → cookie cleared.
4. Change password → cookie cleared; login requires new password.
5. Forgot/reset → email/SMS only if providers configured (never `resetToken` in JSON when `AUTH_EXPOSE_RESET_TOKEN=false`).
6. Google sign-in → new session cookie; no tokens in browser storage or network JSON to the browser.
7. Pending/rejected users → 403 with account status message.

Do not treat local or mock-only runs as production verification.