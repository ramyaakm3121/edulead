# Mandatory AI Usage Report

## Overview

AI tools were used at different stages of the EduLead project for business research, UI/UX exploration, development support, debugging, and documentation. I used different tools for different purposes and made the final implementation and verification decisions myself.

## AI Tools Used

- Perplexity
- Claude
- ChatGPT

## 1. Business Problem Research — Perplexity

I first used Perplexity to research and understand the business problem, user challenges, and what a useful lead-management solution should provide.

The research helped me understand:

- the business context and problem space;
- the needs of users managing and following up with leads;
- what information users need to access quickly;
- what functionality would be useful in a practical workflow.

This research helped define the product direction before detailed UI and implementation work.

## 2. UI/UX Exploration — Claude

After understanding the problem, I used Claude to explore the UI/UX direction.

Claude helped me:

- explore dashboard and lead-management layouts;
- think through user flows and information hierarchy;
- generate UI prototype ideas;
- refine prompts for the implementation stage.

I reviewed these ideas and used the parts that matched the project requirements.

## 3. Development and Debugging — ChatGPT

I then used ChatGPT as a development and debugging assistant.

It helped with:

- frontend/backend integration;
- authentication and API behavior;
- database-related troubleshooting;
- understanding and debugging existing code;
- refining implementation steps;
- project documentation and validation.

One important debugging task involved the Leads page. An unauthenticated `/api/leads` request returned HTTP 401, while an authenticated request returned the lead records successfully. Inspection showed that the frontend was using `fetch().json()` while the shared request helper expected a different response structure. ChatGPT helped identify the mismatch and suggested the change to `client/src/lib/api.ts`. I applied and verified the change in the application.

## Most Useful AI-Assisted Prompt

"Help me troubleshoot why the Leads page is not displaying the lead data. The backend `/api/leads` endpoint requires authentication, and I want to identify whether the issue is authentication, the API, or the frontend."

## AI Output That Needed Correction

AI suggestions were not always used exactly as provided. An initial terminal/nano editing workflow did not save the intended change, so I verified the actual file and repeated the edit. During debugging, I also identified that an Axios interceptor does not automatically apply to raw `fetch()` calls. These issues were resolved by checking the real application behavior rather than relying on assumptions.

## Human Contribution and Verification

AI tools supported research, design exploration, development, and debugging, but I made the final product and implementation decisions. I selected the relevant suggestions, integrated them into the codebase, and manually verified the final application.

I verified that:

- authentication works;
- authenticated API requests return lead records;
- the Leads page displays the returned data;
- frontend and backend work together locally;
- validation and edge cases are documented in `docs/validation.md`.
