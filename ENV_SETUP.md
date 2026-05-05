# Environment Variables

This project uses environment variables to configure API endpoints. Copy `.env.example` to `.env.local` and update the values as needed.

## Required Environment Variables

- `NEXT_PUBLIC_API_BASE_URL`: Base URL for the API server used by all dashboard fetches (e.g. `http://localhost:3001` for local dev, `/api` when proxied by the same host, or `https://staging-api.jataka.ai` for staging). All `fetch` calls in `app/**` and `lib/**` read this value.
- `NEXT_PUBLIC_GITHUB_APP_NAME`: GitHub App slug used to build the install URL (`https://github.com/apps/<name>/installations/new`). Defaults to `jataka-ai`.

## Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Update the values in `.env.local` as needed for your environment.

## Notes

- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser and must not contain sensitive information.
- `lib/api-config.ts` is a legacy helper that still references `NEXT_PUBLIC_API_URL`; the rest of the dashboard standardizes on `NEXT_PUBLIC_API_BASE_URL`. Prefer the latter for new code and when configuring deployments.
- The GitHub App's "Setup URL" should be set to `<dashboard-host>/github/callback` so the OAuth flow returns users to the integrations wizard.
