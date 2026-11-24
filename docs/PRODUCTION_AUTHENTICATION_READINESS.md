# MenyaMuhinzi — Production authentication readiness

This runbook covers the NestJS API + TanStack Start BFF + opaque `mm_session` cookie model.

## Architecture

```
Browser → TanStack server functions (BFF) → NestJS /api/v1
              ↓
         HttpOnly mm_session (opaque web session id only)
```

JWT access/refresh tokens and password-reset plaintext never reach the browser.

## Database migrations (do not run on production without authorization)

Apply in order after backup:

```bash
cd MenyaMuhinzi-Backend
npx prisma migrate deploy
```

New migrations for authentication:

| Migration | Purpose |
|-----------|---------|
| `20261124180000_user_oauth_identities` | Google OIDC subject linkage |
| `20261124183000_password_reset_deliveries` | Encrypted delivery store; queue jobs are reference-only |

Precautions: run on staging first; verify `user_oauth_identities` unique `(provider, subject)`; verify no plaintext reset tokens remain in Redis job payloads after deploy.

## Backend environment variables

| Variable | Consumer | Required in prod |
|----------|----------|------------------|
| `DATABASE_URL` | NestJS | Yes |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | NestJS (sessions, queues, OAuth state) | Yes |
| `JWT_*` / `WEB_SESSION_*` | NestJS | Yes (distinct secrets) |
| `MENYA_BFF_SHARED_SECRET` | NestJS + Vercel BFF | Yes (must match) |
| `FRONTEND_SITE_ORIGIN` | NestJS (reset links, OAuth redirect check) | Yes |
| `CORS_ORIGINS` | NestJS | Yes (include public API origin for registration) |
| `AUTH_EXPOSE_RESET_TOKEN` | NestJS | Must be `false` |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | NestJS | If Google sign-in enabled |
| `SMTP_*` | NestJS password-reset worker | If email reset enabled |
| `TWILIO_*` | NestJS password-reset worker | If SMS reset enabled |
| `PASSWORD_RESET_WORKER_ENABLED` | NestJS | Default `true` |

## Frontend (Vercel) environment variables

| Variable | Consumer | Required in prod |
|----------|----------|------------------|
| `API_BASE_URL` | BFF server functions | Yes (HTTPS `/api/v1`) |
| `SITE_ORIGIN` | BFF CSRF/origin | Yes (exact site URL) |
| `MENYA_BFF_SHARED_SECRET` | BFF | Yes |
| `WEB_SESSION_COOKIE_NAME` | BFF | Optional (`mm_session`) |
| `VITE_API_BASE_URL` | Browser registration client | Yes |

Never use `VITE_` for BFF secrets.

## Google Cloud Console

- OAuth client type: Web application.
- Authorized redirect URI: `{SITE_ORIGIN}/auth/google/callback` (must match `FRONTEND_SITE_ORIGIN` on NestJS).
- Scopes: OpenID, email, profile (server requests `openid email profile`).

## SMTP / Twilio

Configure on **NestJS only**. Worker reports `SMTP_NOT_CONFIGURED` / `TWILIO_NOT_CONFIGURED` without claiming delivery.

## Builds (local CI)

Frontend (`MenyaMuhinzi`):

```bash
npm test
npm run build
VERCEL=1 npm run build
```

Backend (`MenyaMuhinzi-Backend`):

```bash
npm test
npm run build
npm run test:integration   # requires Docker Postgres/Redis
```

## Production smoke tests (after deploy authorization)

| Check | Staging | Production |
|-------|---------|------------|
| Email/password login | Manual | Manual |
| `mm_session` HttpOnly, Secure, SameSite=Lax, Path=/ | Inspect cookie | Inspect cookie |
| Page refresh restores session | Manual | Manual |
| Logout clears cookie | Manual | Manual |
| Forgot → reset delivery | Manual (providers required) | Manual |
| Change password revokes session | Manual | Manual |
| Google sign-in | Manual (Google credentials) | Manual |
| Pending/rejected cannot sign in | Manual | Manual |
| Admin approvals | Manual | Manual |

## Rollback

1. Revert Vercel deployment to previous build.
2. Revert NestJS deployment / container image.
3. Do **not** roll back DB migrations without a DBA plan (`password_reset_deliveries` is additive).

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| 403 on login POST | `SITE_ORIGIN` mismatch vs browser `Origin` |
| 401 BFF → Nest | `MENYA_BFF_SHARED_SECRET` mismatch |
| Reset email not sent | SMTP not configured; check worker logs for `SMTP_NOT_CONFIGURED` |
| Google button hidden | Backend `google/status` → `enabled: false` |
| Queue jobs without delivery | `FRONTEND_SITE_ORIGIN` unset or worker disabled |

See also `docs/VERCEL_PRODUCTION.md`.