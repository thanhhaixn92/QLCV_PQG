# AGENTS.md — VMS Navigator / Hoa Tiêu MB

## 1. Project Overview

- Project name: **VMS Navigator / Hoa Tiêu MB**.
- Stack:
  - Frontend: **React + TypeScript + Vite**.
  - Backend: **Express `server.ts`**.
  - Authentication: **Firebase Auth**.
  - Database: **Cloud Firestore named database**.
  - Storage: **Firebase Storage**.
  - AI integration: **Gemini API**.
  - External integration: **Google Drive API**.
- Current primary deployment may be **AI Studio preview** or **Render Web Service**.
- Do **not** assume the environment, deployment target, auth mode, database target, or runtime context unless the prompt states it clearly.

## 2. Core Commands

Use these commands when appropriate:

```bash
npm run lint
npm run build
npm start
```

- Do **not** use `vite preview` for production full-stack deployment.
- Health endpoint: **`/api/health`**.

## 3. Non-negotiable Safety Rules

- Do **not** log secrets, tokens, API keys, Firebase private keys, service account contents, or credentials.
- Do **not** print real environment variable values.
- Do **not** commit service account JSON files.
- Do **not** change the Firestore database ID.
- Do **not** change any of the following unless the task directly asks for it:
  - Auth flow.
  - Admin role behavior.
  - Firebase rules.
  - Task module.
  - Export module.
  - Render configuration.
- Do **not** perform broad refactors when the bug can be fixed minimally.
- Do **not** create a branch, commit, or PR when the user only asks for review/investigation.

## 4. Investigation Workflow

When asked to “rà lỗi” or investigate a problem:

- Analyze only; do **not** modify code yet.
- Search for patterns with `rg` before concluding.
- Clearly identify:
  - File paths.
  - Function/component names.
  - Root cause.
  - Minimal fix.
- Distinguish between issues caused by:
  - Code.
  - Environment variables/configuration.
  - Build/deploy setup.
  - Old/stale Firestore data.
  - Old/stale `localStorage` data.
- State which files should **not** be modified.

## 5. Fix Workflow

When asked to fix an issue:

- Only edit files explicitly requested or directly related to the issue.
- Keep changes small, focused, and reviewable.
- After making code changes, run:

```bash
npm run lint
npm run build
```

- Report clearly:
  - Files changed.
  - Why each file was changed.
  - Tests/checks run.
  - Remaining risks or follow-up items.

## 6. Firebase / Auth Rules

- Firebase `projectId`: **`gen-lang-client-0733170002`**.
- Firestore named database ID: **`ai-studio-b6074ed0-9102-4183-836c-45db24476dce`**.
- Do **not** use the default Firestore database if the source currently requires the named database.
- Do **not** enable Anonymous Auth on Render/production unless the task explicitly requires it.
- Current preferred sign-in flow: **Email/Password**.
- Admin email bootstrap is handled through **`ADMIN_EMAILS`**.
- Do **not** downgrade the admin role from a Firestore snapshot.

## 7. Render Rules

- Render deployment must use **Web Service**, not Static Site.
- Build Command:

```bash
npm install && npm run build
```

- Start Command:

```bash
npm start
```

- The server must bind to **`process.env.PORT`**.
- `/api` routes must be registered before the static fallback.
- `/api/health` must always return JSON.
- Rate limiting must not be applied to frontend static assets or static fallback routes.

## 8. AI Studio Rules

- When editing in AI Studio, avoid broad or unrelated changes.
- If the user asks for an AI Studio prompt, the prompt must lock down:
  - Files allowed to edit.
  - Files not allowed to edit.
  - Test commands.
  - Runtime checklist.
- Do **not** let AI Studio “optimize the whole system” when the task is only about one specific bug.

## 9. Current Known Sensitive Modules

Treat these areas as sensitive and avoid changing them unless directly required:

- Auth/Login/Profile/Admin role.
- Task CRUD and duplicate React keys.
- PDF/Word export.
- Firebase Admin initialization.
- Rate limiter and `/api/health`.
- AI chatbox and API key management.

## 10. Response Format for Investigation

For investigation/review responses, always return:

A. Tóm tắt lỗi  
B. File/hàm/component liên quan  
C. Bằng chứng từ source  
D. Nguyên nhân gốc  
E. Cách sửa tối thiểu  
F. File cần sửa  
G. File không nên sửa  
H. Lệnh kiểm tra  
I. Checklist runtime

Never include real secrets in this file or in investigation/fix reports.
