# Validation and Important Edge Cases

## Validation performed

The application was validated locally with the frontend, backend, and MySQL database running together.

Validated:

- Backend API starts successfully on port 4000.
- MySQL database is connected and seeded.
- Authentication-protected API access works.
- Unauthenticated access to protected endpoints is rejected.
- Authenticated `GET /api/leads` returns HTTP 200 with lead records.
- Leads page successfully displays the returned lead data in the browser.
- Frontend runs through Vite on port 5173.
- Frontend and backend communicate successfully through the REST API.

## Important edge cases and business rules

- Duplicate leads are detected using phone/email information and surfaced as a warning rather than automatically merged.
- Active leads should have ownership and a next action.
- Lost status requires a reason.
- Enrolled status records conversion time.
- Assignment and status changes create timeline activities.
- Follow-up completion updates last-contacted and next-action fields.
- Multi-step mutations use Prisma transactions to maintain data consistency.
- Authentication and role-based authorization are enforced by the backend.
- Normal workflow does not permanently delete leads, helping preserve lead history.

## Known prototype limitations

This is an assessment prototype rather than a production deployment. Production hardening would include stronger operational monitoring, more comprehensive automated test coverage, production-grade secret management, and additional security controls around authentication and deployment.
