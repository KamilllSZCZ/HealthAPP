# LifeSync — Product Requirements (PRD)

## Original Problem Statement
LifeSync is a production-ready Progressive Web App (React Native Expo web + FastAPI + MongoDB) for complete personal life, health, supplementation, nutrition, meal-prep, hydration, habit, performance and productivity management. It aims to replace Samsung Health, Notion, TickTick and MyFitnessPal. OLED dark mode, multi-device sync.

## Critical Product Pivot (User Message 252)
- **Remove ALL AI functionality** (AI Analyst, recommendations, insights) → replace with **rule-based statistics, charts and trend analysis**. ✅ DONE
- No placeholder screens — ship complete modules.
- Priority-1 modules: Authentication, Dashboard, Supplement Tracking, Water Tracking.

## User Choices (confirmed this fork)
- Remove all AI, use rule-based stats. ✅
- Accent color: **Emerald/teal green** (`#10D9A6`) on OLED black. ✅
- Build Priority-1 core first, then continue. ✅
- Auth: **JWT email/password only** for now (Google login wired but secondary). ✅

## Architecture
- `/app/backend/server.py` — FastAPI, MongoDB (motor), JWT auth, all endpoints (~1331 lines, refactor pending).
- `/app/frontend/app` — Expo Router file-based routes (`index`, `login`, `(tabs)/*`, secondary screens).
- `/app/frontend/src` — `api.ts`, `auth.tsx`, `theme.ts`, `components/ui.tsx`, `components/charts.tsx`, `utils/storage`.
- **Frontend is served as a STATIC EXPORT** via `expo export -p web` → `npx serve -s dist -l 3000` (supervisor program `expo`). NO hot reload — must `sudo supervisorctl restart expo` to rebuild after frontend changes (~60s).
- Backend has `--reload` (hot reload on).

## Implemented (✅ as of 2026-06-08)
- JWT auth (register/login/me/logout), Emergent Google session wired.
- Real emerald-themed Login/Register screen (replaced debug page).
- Dashboard (completion ring, health score, quick-hydrate, customizable widget grid).
- Supplement tracking (full CRUD, take/untake, 30-day adherence, stock/cost computed).
- Water tracking (log, today, 14-day history, streak, bar chart).
- **AI REMOVED**: deleted GPT-5.2 `/ai/report` + `/ai/reports`, removed `emergentintegrations` + `EMERGENT_LLM_KEY` usage.
- **Rule-based `GET /api/stats/report?period=weekly|monthly`** → summary, highlights[], suggestion, metrics. Analytics tab "Your Summary" card uses it (no AI button).
- Analytics: health score, trends line charts, rule-based correlations/insights.
- Tested: 18/18 backend pytest (`/app/backend/tests/test_lifesync_api.py`) + frontend flows. iteration_1.json all green.

## Test Credentials
See `/app/memory/test_credentials.md` — qa.tester@lifesync.app / QaTest1234!

## Backlog / Roadmap
### P1 (next)
- Nutrition, Weight, Sleep, Journal, Weekly Review — verify end-to-end & ensure rule-based (not placeholders).
- Migrate deprecated `props.pointerEvents` → `style.pointerEvents` (console warning).
### P2
- Goals module, Projects module, Habits, Check-in screens.
- Samsung Health / Health Connect sync architecture (currently mock sync endpoint).
### P3 / Refactor
- Split `server.py` into `/app/backend/routes` + `/app/backend/models`.
- Advanced analytics & historical comparisons.
