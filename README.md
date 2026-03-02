# SPHCC

Sports Predictive Health Command Center (SPHCC) MVP.

## Public URL
- GitHub Pages (frontend): https://azoz20121234-ui.github.io/SPHCC/

## Current Architecture
- Backend: Node.js + Express (`backend/src/server.js`)
- Database: SQLite (`backend/src/db/database.js`)
- Real-time: SSE stream on `GET /live`
- Frontend: static dashboard (`frontend/`) consuming live backend events

## Folder Structure
- `backend/src/server.js`: API + SSE + simulation endpoints
- `backend/src/db/database.js`: DB schema and data access
- `backend/src/riskEngine.js`: predictive risk calculations
- `backend/src/simulation/digitalTwin.js`: synthetic session simulator
- `frontend/`: dashboard UI (live metrics, gauges, alerts)
- `.github/workflows/deploy-pages.yml`: auto deploy frontend to GitHub Pages

## Database Schema
SQLite is initialized on server start with these core tables:
- `players`
- `metrics`
- `alerts`

Additional table for simulation tracking:
- `simulation_sessions`

## Run Locally
1. Install backend deps:
```bash
cd backend
npm install
```

2. Start backend:
```bash
npm run dev
```

3. Open UI from backend static hosting:
- http://localhost:4000

## Main Endpoints
- `GET /api/health`
- `GET /api/players`
- `POST /api/players`
- `GET /api/metrics/latest`
- `POST /api/metrics`
- `GET /api/alerts`
- `PATCH /api/alerts/:id/resolve`
- `GET /live` (SSE)
- `POST /api/simulation/start`
- `POST /api/simulation/stop/:sessionId`
- `GET /api/simulation/active`
- `GET /api/simulation/sessions`

## GitHub Pages Auto-Deploy
Any push to `main` that changes `frontend/**`, `README.md`, or the Pages workflow triggers deployment to:
- https://azoz20121234-ui.github.io/SPHCC/

## Notes
- GitHub Pages hosts frontend only.
- For live data on the public site, backend must be deployed on a public host and `sphcc_api_root` should point to that backend URL.
