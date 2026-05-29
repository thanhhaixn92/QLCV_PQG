AGENTS.md — VMS Navigator / Hoa Tiêu MB

1. Project Overview

* Project name: VMS Navigator / Hoa Tiêu MB.
* Stack:
    * Frontend: React + TypeScript + Vite.
    * Backend: Express server.ts.
    * Authentication: Firebase Auth.
    * Database: Cloud Firestore named database.
    * Storage: Firebase Storage.
    * AI integration: Gemini API.
    * External integration: Google Drive API.
* Current deployment context may be AI Studio preview or Render Web Service.
* Do not assume the environment, deployment target, auth mode, database target, or runtime context unless the user states it clearly.

2. Core Commands

Use these commands when appropriate:

npm run lint
npm run build
npm start

* Do not use vite preview for production full-stack deployment.
* Health endpoint: /api/health.
* /api/health must always return JSON.

3. Non-negotiable Safety Rules

* Do not log secrets, tokens, API keys, Firebase private keys, service account contents, or credentials.
* Do not print real environment variable values.
* Do not commit service account JSON files.
* Do not change the Firestore database ID.
* Do not change any of the following unless the task directly asks for it:
    * Auth flow.
    * Admin role behavior.
    * Firebase rules.
    * Task module.
    * Export module.
    * Render configuration.
    * API gateway/rate limiter.
* Do not refactor broadly when the error can be fixed with a minimal targeted change.
* Do not create a branch, commit, or PR when the user only asks for investigation/review.

4. Investigation Workflow

When the user asks to “rà lỗi”, “kiểm tra lỗi”, “xác định lỗi”, or similar:

1. Read this AGENTS.md first.
2. Do not modify code.
3. Use rg to find relevant source patterns before concluding.
4. Identify:
    * Relevant files.
    * Relevant function/component.
    * Suspicious lines/blocks.
    * Root cause.
    * Minimal fix.
    * Files that should not be touched.
5. Distinguish whether the issue is caused by:
    * Code.
    * Environment variables.
    * Build/deploy configuration.
    * Firestore/localStorage stale data.
    * Runtime/browser behavior.
6. Return a structured report, not a patch, unless the user explicitly asks to fix.

5. Fix Workflow

When the user explicitly asks to fix code:

1. Keep the change small and reviewable.
2. Modify only files directly related to the verified root cause.
3. Do not touch sensitive modules unless directly required.
4. Run:

npm run lint
npm run build

5. Report:
    * Files changed.
    * Why each file was changed.
    * Test commands and results.
    * Runtime checklist.
    * Remaining risks.

6. Firebase / Auth Rules

* Firebase project ID: gen-lang-client-0733170002.
* Firestore named database ID: ai-studio-b6074ed0-9102-4183-836c-45db24476dce.
* Do not silently fall back to (default) if the source requires the named database.
* Render/production should not enable Anonymous Auth unless explicitly requested.
* Email/Password is the preferred auth flow for current preview/production work.
* Admin bootstrap may use ADMIN_EMAILS.
* Do not downgrade an admin role from a Firestore profile snapshot if the effective server/API role is admin.

7. Render Rules

* Render deployment uses Web Service, not Static Site.
* Build Command:

npm install && npm run build

* Start Command:

npm start

* Server must bind to process.env.PORT.
* /api/* routes must be registered before static/index fallback.
* /api/health must always return JSON.
* Rate limiter must not block frontend static/fallback routes.
* Rate limiter should not make /api/health unusable during startup checks.

8. AI Studio Rules

* When working in AI Studio, avoid broad automatic refactors.
* If asked to produce an AI Studio prompt, lock the scope:
    * files allowed to change;
    * files not allowed to change;
    * confirmed root cause;
    * exact fix strategy;
    * lint/build commands;
    * runtime checklist.
* Do not let AI Studio “optimize the whole system” for a single isolated bug.
* Do not sync to GitHub if the change list includes unrelated deletion such as AGENTS.md — Deleted.

9. Current Sensitive Modules

Be extra careful with:

* Auth/Login/Profile/Admin role.
* Task CRUD and duplicate React render keys.
* PDF/Word export.
* Firebase Admin initialization.
* Rate limiter and /api/health.
* AI chatbox and API key management.
* Firestore named database configuration.
* User API key encryption/decryption.

10. Required Response Format for Investigation

When investigating, respond with:

A. Summary of the issue
B. Relevant files/functions/components
C. Evidence from source
D. Root cause
E. Minimal fix proposal
F. Files that need changes
G. Files that should not be changed
H. Commands to run
I. Runtime checklist

Do not include secrets, tokens, API keys, Firebase private keys, or service account JSON.
