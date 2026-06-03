# ShiftFlow — Setup Guide

## 1. Install dependencies
```bash
cd shift-scheduler
npm install
```

## 2. Supabase setup
1. Go to https://supabase.com and create a new project
2. Go to **SQL Editor** and run the file: `supabase/migrations/001_initial.sql`
3. Go to **Storage** → Create a bucket named `schedules` → set to **Public** or **Private with signed URLs**
4. Go to **Authentication** → **Providers** → Enable **Google** (optional)
5. Go to **Project Settings** → **API** → Copy:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

## 3. Email setup (Resend)
1. Go to https://resend.com → Create account → Get API key
2. Verify your sending domain (or use resend's sandbox for testing)

## 4. Environment variables
```bash
cp .env.local.example .env.local
# Fill in all values
```

## 5. Run
```bash
npm run dev
# → http://localhost:3000
```

---

## Flow summary
1. **Admin** signs up → creates a Team → adds shifts → sets requirements matrix → adds agents
2. **Admin** opens the Schedule page → copies share links → sends to agents
3. **Agents** open their personal link → select shifts for each day → submit
4. **Admin** watches the matrix update in real-time → sees OK/LESS/MORE badges
5. **Admin** clicks **Confirm** to lock the week
6. **Admin** clicks **Export & Email** → Excel + PDF are generated, uploaded to storage, and emailed to managers

## Project structure
```
src/
  app/
    auth/login/           → Admin login (email + Google)
    auth/callback/        → OAuth callback
    dashboard/            → Admin dashboard (teams list)
    dashboard/teams/[id]/
      shifts/             → Shift configuration
      requirements/       → Min agents matrix
      agents/             → Agent management + share links
      schedule/           → MAIN MATRIX VIEW + export
    schedule/[token]/     → Agent submission page (public, no login)
  api/
    teams/                → CRUD teams
    weeks/                → Open new week
    schedule/[token]/     → GET + POST for agent submissions
    export/[weekId]/      → Generate Excel/PDF, upload, email
  lib/
    types.ts              → All TypeScript interfaces
    utils.ts              → Date helpers, color utils
    supabase/             → Client/server/service clients
```
