# Gov Financials App — Slice 2 (TB Preview + Fund Rules UI)

Includes:
- Engagements
- TB Import (CSV) + preview + stats
- Fund detection rules UI (regex + capture group) + re-run
- Fund manager (fund type + major)

## Local run
```bash
cp .env.example .env
docker run --name govfs-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=govfs -p 5432:5432 -d postgres:16
npm install
npx prisma migrate dev
npm run dev
```

## TB CSV columns
Account, Description, FINAL BALANCE, Group, Subgroup (case-insensitive).
FINAL BALANCE supports parentheses credits like (1,234.56).
