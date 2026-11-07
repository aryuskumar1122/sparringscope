# SparringScope

A starter app for a public sparring-video page and a private, privacy-conscious visitor analytics dashboard.

## What works in this starter

- Public `/` video collection page.
- First-party random browser ID for approximate repeat-visit counts.
- Browser-reported device, OS, browser and coarse screen-size bucket.
- Click event timestamp.
- Optional MaxMind GeoLite2 City lookup. Raw IP is used transiently and is not stored.
- Private dashboard at `/?admin=1`, protected by a bearer token.
- Story-period / Highlight-period classification based on a configured publication timestamp.

## Important limitations

- Browser/device characteristics do not identify a person or distinguish Story from Highlight.
- Instagram does not reliably reveal the viewer's Instagram username or exact link placement to an external site.
- The 24-hour phase is assigned by the server based on your Story publication time. A Highlight can be opened during the first 24 hours too, so this is a time-period label, not proof of placement.
- IP geolocation is approximate and may be wrong, especially with VPNs, proxies, mobile carriers and corporate networks.
- This starter does not perform invasive fingerprinting, collect GPS coordinates, or store raw IP addresses.
- The sample admin token mechanism is for local development. Before public deployment, add proper admin authentication, HTTPS, rate limiting, CSRF protections where applicable, secure secrets, retention controls and a trusted reverse-proxy configuration.

## Requirements

- Python 3.12+
- uv
- Node.js 20+
- Docker Desktop

## 1. Configure environment

From the project root:

```bash
cp .env.example .env
```

Edit `.env` and set a long random `ADMIN_TOKEN`.

To classify the first 24 hours, set `STORY_PUBLISHED_AT` to the time you publish the Story in ISO-8601 format with timezone, e.g.:

```env
STORY_PUBLISHED_AT=2026-11-07T12:30:00+00:00
```

For local development, the backend defaults to SQLite if `DATABASE_URL` is not set. To use the included PostgreSQL service, keep the example `DATABASE_URL`.

## 2. Start PostgreSQL

```bash
docker compose up -d
```

## 3. Start API

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

Health check: http://localhost:8000/health

## 4. Start frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Public page: http://localhost:5173/

Private dashboard: http://localhost:5173/?admin=1

Paste the `ADMIN_TOKEN` from `.env` into the dashboard.

## 5. Add your videos

Edit `backend/app/main.py`, in the `/api/videos` endpoint. Add your video embed URLs and descriptions. For YouTube, use an embed URL such as `https://www.youtube-nocookie.com/embed/VIDEO_ID`. Only publish videos you have permission to share.

## 6. Enable approximate city lookup (optional)

1. Obtain a MaxMind GeoLite2 City database under its applicable license and terms.
2. Put the `.mmdb` file somewhere outside version control.
3. Set `MAXMIND_DB_PATH=/absolute/path/to/GeoLite2-City.mmdb` in `.env`.
4. Restart the API.

No raw IP address is written to the click event database. Location can still be unavailable or inaccurate.

## Suggested next engineering steps

1. Add Alembic migrations instead of `create_all`.
2. Add secure admin login and session management.
3. Add retention/deletion controls and a visible analytics notice.
4. Add a proper video management flow.
5. Add campaign creation if you later want verified Story-vs-Highlight attribution through separate links.
6. Add automated tests for tracking, time-phase classification, and authorization.
