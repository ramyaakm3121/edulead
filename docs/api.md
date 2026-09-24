# API

Base path: `/api`

Initial endpoints:
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/leads`
- `POST /api/leads`
- `GET /api/leads/:id`
- `PATCH /api/leads/:id`
- `PATCH /api/leads/:id/assign`
- `PATCH /api/leads/:id/status`
- `GET /api/leads/:id/activities`
- `POST /api/leads/:id/activities`
- `GET /api/followups/my`
- `GET /api/followups/overdue`
- `POST /api/leads/:id/followups`
- `PATCH /api/followups/:id`

## Activities and Follow-ups

- `GET /api/leads/:id/activities` — lead timeline
- `POST /api/leads/:id/activities` — add CALL, WHATSAPP, EMAIL, or NOTE
- `GET /api/followups/my` — current user's pending follow-ups
- `GET /api/followups/overdue` — overdue pending follow-ups; counsellors see their own, managers/admins see all
- `GET /api/leads/:id/followups` — follow-ups for a lead
- `POST /api/leads/:id/followups` — create a follow-up and update the lead's next action
- `PATCH /api/followups/:id` — complete/cancel/update a follow-up

Completing a follow-up updates `lastContactedAt`, recalculates the lead's next pending follow-up, and appends a `FOLLOW_UP_COMPLETED` activity in the same transaction.

## Dashboard and Reports

Dashboard endpoints: `GET /api/dashboard/summary`, `/funnel`, `/sources`, `/counsellors`, `/ageing`.

Reports endpoints: `GET /api/reports/funnel`, `/source-performance`, `/counsellor-performance`, `/ageing`.

Counsellors are scoped to their own leads. Managers and admins receive team-wide operational data.
