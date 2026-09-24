# Architecture

React client communicates with the Express REST API. The API enforces authentication, role-based authorization, business rules, and transactional workflows. Prisma provides typed database access and migrations for MySQL.

## Trade-offs

- A React + Express REST architecture keeps the frontend and backend separated and easy to develop independently.
- Prisma provides typed database access and migrations, with MySQL used as the persistent relational store.
- Authentication and role-based authorization are enforced at the API layer so access rules are applied consistently.
- Transactional workflows are used where related lead, follow-up, and activity changes need to remain consistent.
