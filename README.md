# SPHCC Platform MVP

منصة **Sports Predictive Health Command Center** لإدارة صحة اللاعبين لحظيًا داخل النادي/الملعب.

## رابط الواجهة العامة
- https://azoz20121234-ui.github.io/SPHCC/

## ماذا تحتوي المنصة الآن
- Backend حقيقي: `Node.js + Express`
- قاعدة بيانات حقيقية: `SQLite`
- بث حي: `SSE` عبر `GET /live`
- Dashboard React + Vite (RTL عربي) بثلاثة أوضاع:
  - Executive
  - Live Command Center
  - Tactical AI

## المجلدات
- `backend/src/server.js`: REST API + SSE + Simulation
- `backend/src/db/database.js`: schema + data access
- `backend/src/riskEngine.js`: fatigue/injury/hydration predictive formulas
- `backend/src/simulation/digitalTwin.js`: synthetic match simulation
- `frontend/`: React dashboard
- `.github/workflows/deploy-pages.yml`: نشر واجهة React تلقائيًا إلى GitHub Pages

## قاعدة البيانات
الجداول الأساسية:
- `players`
- `metrics`
- `alerts`

جدول إضافي:
- `simulation_sessions`

## تشغيل محلي (منصة فعلية)
1. تثبيت المتطلبات:
```bash
npm run backend:install
npm run frontend:install
```

2. تشغيل الـBackend (Terminal 1):
```bash
npm run backend:dev
```

3. تشغيل React (Terminal 2):
```bash
npm run frontend:dev
```

4. فتح الواجهة:
- `http://localhost:5173`

## API أساسية
- `GET /api/health`
- `GET /api/players`
- `POST /api/players`
- `GET /api/metrics/latest`
- `POST /api/metrics`
- `GET /api/alerts`
- `PATCH /api/alerts/:id/resolve`
- `GET /live`
- `POST /api/simulation/start`
- `POST /api/simulation/stop/:sessionId`
- `GET /api/simulation/active`
- `GET /api/simulation/sessions`

## النشر التلقائي للواجهة
أي Push على `main` يغيّر `frontend/**` يطلق GitHub Action ويبني Vite ثم ينشر `frontend/dist` على Pages.

## ملاحظة تشغيلية
GitHub Pages يستضيف الواجهة فقط. لتشغيل المنصة كاملة عبر نفس الرابط العام، انشر الـBackend على خدمة عامة (Render/Railway/Fly) واضبط:
- `localStorage.sphcc_api_root = "https://your-backend-url"`
