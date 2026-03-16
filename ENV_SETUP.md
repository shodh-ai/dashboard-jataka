# Environment Variables

This project uses environment variables to configure API endpoints. Copy `.env.example` to `.env.local` and update the values as needed.

## Required Environment Variables

- `NEXT_PUBLIC_API_URL`: Base URL for the API server (default: `http://localhost:3001`)

## Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Update the values in `.env.local` as needed for your environment.

## Notes

- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser and should not contain sensitive information.
- The API URL is used throughout the application via the centralized configuration in `lib/api-config.ts`.
