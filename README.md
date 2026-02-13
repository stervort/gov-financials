# Gov Financials App (Starter Skeleton)

Starter repo for the Government Financial Statements compiler web app (V1):
- Import Trial Balance (CSV)
- Detect funds (e.g., 10-xxxx -> fund 10) with rules; supports QuickBooks-style TBs via manual/rules later
- Map accounts to firm-controlled FS groups (persist year-to-year)
- UI shell (dashboard) that looks professional quickly
- Multi-tenant-ready data model (Org/User/Engagement)

Exports (Excel/DOCX), statement rendering, reconciliations, and tie engine are stubbed as folders for the next step.

## Tech
Next.js (App Router) + Tailwind + Prisma (Postgres)

## Run locally
1) `cp .env.example .env`
2) Start Postgres (example):
```bash
docker run --name govfs-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=govfs -p 5432:5432 -d postgres:16
```
3) `npm install`
4) `npx prisma migrate dev`
5) `npm run dev`

Open http://localhost:3000

## Render
Deploy as a Render Blueprint using `render.yaml`. Set env vars: DATABASE_URL, APP_URL, SESSION_SECRET.
