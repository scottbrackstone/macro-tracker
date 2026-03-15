# Macro Tracker (MVP)

This repo contains:

- `backend/` FastAPI + PostgreSQL API
- `mobile/` React Native (Expo) app

## Backend quick start

1. Create a Postgres database named `macro_tracker`.
2. Create a virtualenv and install deps.
3. Copy `backend/.env.example` to `backend/.env` and fill values.
4. Run the server:
   - `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

## Mobile quick start

1. Create the Expo app in `mobile/` (if not already).
2. Install dependencies and run:
   - `npm install`
   - `npx expo start`

When running on a device or emulator, point API calls to your Mac's LAN IP
like `http://192.168.1.50:8000`.
