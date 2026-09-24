# EduLead — Admission Lead Management

A full-stack admissions CRM prototype for the Edumerge Junior Software Engineer assessment (Assignment 5).

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- ORM: Prisma
- Database: MySQL
- Auth: JWT + bcrypt

## Product flow

Lead capture → duplicate check → assignment → activity/follow-up → status progression → conversion/lost → manager visibility.

## Project structure

```text
edulead/
├── client/                 # React frontend
├── server/                 # Express + Prisma backend
├── docs/                   # Architecture, API and assumptions
└── README.md
```

## Run locally

### 1. Database

Create a MySQL database and set `DATABASE_URL` in `server/.env`.

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/edulead"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=4000
CLIENT_URL="http://localhost:5173"
```

### 2. Backend

```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

API: `http://localhost:4000`

### 3. Frontend

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

Frontend: `http://localhost:5173`

## Demo account

```text
manager@edulead.local
Password@123
```

Other seeded accounts use the same password. See `server/prisma/seed.ts`.

## Implemented screens

- Login
- Dashboard
- Lead list and filters
- New lead
- Lead details
- Lead Health Card
- Activity timeline
- Follow-ups
- My Tasks
- Reports

## Implemented API areas

- Authentication
- Leads
- Activities
- Follow-ups
- Dashboard
- Reports
- User lookup
- Course lookup
- Source lookup

## Engineering rules implemented

- Backend-enforced RBAC
- Duplicate detection by phone/email with warning rather than automatic merge
- Active leads should have ownership and a next action
- Lost status requires a reason
- Enrolled status records conversion time
- Assignment and status changes create timeline activities
- Follow-up completion updates last-contacted and next-action fields
- Multi-step mutations use Prisma transactions
- Normal workflow does not permanently delete leads

## Validation status

The source tree has been created, but dependency installation was not completed in the execution environment used to assemble this project. Run `npm install`, Prisma generation/migration and the builds locally before the assessment submission.
