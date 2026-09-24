// Manual API smoke-test checklist for the Lead CRUD milestone.
// Run against a seeded local server with a valid JWT.
// 1. GET /api/leads
// 2. POST /api/leads with unique phone
// 3. POST same phone again -> possibleDuplicates should be returned
// 4. GET /api/leads/:id -> timeline + follow-ups
// 5. PATCH /api/leads/:id/assign as MANAGER
// 6. PATCH /api/leads/:id/status -> QUALIFIED
// 7. PATCH /api/leads/:id/status -> LOST without lostReason -> 400 LOST_REASON_REQUIRED
