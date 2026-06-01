AGENTS.md — VMS Navigator / Hoa Tiêu MB

1. Project Overview

Project name: VMS Navigator / Hoa Tiêu MB.

Current stack:

* Frontend: React + TypeScript + Vite.
* Backend: Express, entrypoint server.ts.
* Authentication: Firebase Auth.
* Database: Cloud Firestore named database.
* Storage: Firebase Storage.
* AI integration: Gemini API through backend-controlled routes.
* External integration: Google Drive API.
* Deployment/test contexts may include Google AI Studio Preview and Render Web Service.

Do not assume the active environment, deployment target, auth mode, database target, AI provider, or runtime context unless the user explicitly states it or the code/config clearly proves it.

This project prioritizes:

* Runtime stability.
* iPad/mobile responsiveness.
* Safe Firebase/Auth/Firestore behavior.
* Secure API key handling.
* Stable task/document/editor workflows.
* A4 print-ready article preview.
* Reliable DOCX/PDF export.
* Minimal, reviewable changes.
* Human-in-the-loop AI actions.
* Data safety before UI ambition.

⸻

2. Core Commands

Use these commands when appropriate:

npm run lint
npm run build
npm start

Rules:

* Use npm run lint and npm run build after any code fix unless the user explicitly asks for audit-only work.
* Do not use vite preview as a production full-stack server.
* Render deployment must use Web Service, not Static Site, for this full-stack app.
* Health endpoint: /api/health.
* /api/health must always return JSON.
* Do not make /api/health depend on authenticated user state, Firestore availability, AI provider availability, or rate-limited user flows.
* If npm run test:e2e exists, run it when the environment supports Playwright/browser execution. If blocked by browser/system dependencies, report clearly and do not pretend PASS.

⸻

3. Mandatory Workflow Rules

3.1 Audit / investigation only

When the user asks to “rà lỗi”, “kiểm tra lỗi”, “xác định lỗi”, “audit”, “review”, “nghiên cứu lỗi”, or similar:

1. Read this AGENTS.md first.
2. Do not modify code.
3. Do not commit.
4. Do not create a PR.
5. Use rg or equivalent source search before concluding.
6. Identify:
    * relevant files;
    * relevant functions/components;
    * suspicious lines/blocks;
    * likely root cause;
    * minimal fix proposal;
    * files that must not be touched.
7. Distinguish whether the issue is caused by:
    * code;
    * environment variables;
    * build/deploy config;
    * Firebase/Auth config;
    * Firestore rules or named database mismatch;
    * localStorage/browser stale state;
    * runtime/browser behavior;
    * AI Studio/Render environment behavior.
8. Return a structured report, not a patch, unless the user explicitly asks to fix.

3.2 Fix workflow

When the user explicitly asks to fix code:

1. Do not modify main directly.
2. Create a dedicated branch for the fix.
3. Keep the change small and reviewable.
4. Modify only files directly related to the verified root cause.
5. Do not touch sensitive modules unless directly required.
6. Run:

npm run lint
npm run build

7. Create a PR if repository tooling permits.
8. Do not merge.
9. Report:
    * branch name;
    * PR status;
    * files changed;
    * why each file changed;
    * files intentionally not changed;
    * lint/build results;
    * runtime checklist;
    * remaining risks.

3.3 ZIP handoff workflow

When the user asks for a ZIP handoff for AI Studio:

1. Create a ZIP outside the repo if possible.
2. Include only the changed files required for replacement.
3. Preserve exact relative paths, for example:

src/components/editorial/A4PrintPreview.tsx
src/lib/publishing/articleDocument.ts

4. Do not include the whole source tree unless explicitly requested.
5. Do not include:
    * node_modules;
    * dist;
    * .git;
    * .env;
    * service account JSON;
    * PDF/DOCX test output;
    * HTML export output;
    * Playwright report/test-results;
    * screenshots/videos/traces;
    * temporary patch files;
    * unrelated source folders.
6. Do not commit the ZIP.
7. Report the ZIP name and exact internal file list.

⸻

4. Non-Negotiable Safety Rules

Do not log or expose:

* secrets;
* tokens;
* API keys;
* Gemini API keys;
* service account contents;
* Firebase private keys;
* encryption keys;
* raw environment variable values;
* user personal credentials.

Do not commit:

* .env;
* service account JSON;
* private keys;
* generated PDF/DOCX/ZIP outputs;
* generated HTML export outputs;
* patch/test artifacts;
* Playwright reports/test-results/screenshots/videos/traces;
* node_modules;
* dist unless explicitly required by deployment workflow.

Do not change the following unless the task directly asks for it and the verified root cause requires it:

* Auth/Login/Profile/Admin role behavior.
* Firebase config.
* Firestore named database ID.
* Firestore rules.
* Storage rules.
* Task module.
* Export module.
* Render configuration.
* API gateway/rate limiter.
* Firebase Admin initialization.
* User API key encryption/decryption.
* server.ts.
* package.json.
* package-lock.json.
* metadata.json.

Do not refactor broadly when a minimal targeted change can fix the issue.

Do not downgrade, remove, or bypass existing security checks to make a test pass.

⸻

5. Firebase / Auth / API Key Rules

Known current Firebase configuration identifiers may appear in code/config, but never assume they can be changed casually:

* Firebase project ID: gen-lang-client-0733170002.
* Firestore named database ID: ai-studio-b6074ed0-9102-4183-836c-45db24476dce.

Rules:

* Do not change the Firestore database ID.
* Do not silently fall back to (default) when the source requires the named database.
* Render/production should not enable Anonymous Auth unless explicitly requested.
* Do not reintroduce anonymous auth fallback if it has been intentionally disabled.
* Email/Password or Google login flows must not be altered unless the task directly concerns auth.
* Admin bootstrap may use ADMIN_EMAILS.
* Do not downgrade an admin role from a Firestore profile snapshot if the effective server/API role is admin.
* Do not open user-scoped Firestore listeners before a valid non-anonymous user is available.
* Do not use placeholder no-uid or no-email as a real auth identity.

5.1 Firebase Web API key vs AI API key

Distinguish these clearly:

* Firebase Web API key:
    * identifies a Firebase project/app for Firebase services;
    * must be restricted to Firebase-related APIs;
    * is not the same as a Gemini Developer API key.
* Gemini / AI provider API key:
    * must be treated as a sensitive credential;
    * must not be embedded in frontend source;
    * must not be stored in localStorage/sessionStorage/draft;
    * must not be logged;
    * must be handled through backend routes only.

User personal AI keys:

* Do not save raw keys in frontend storage.
* Do not echo raw keys back to the client after saving.
* Client may display only safe metadata such as provider, model, status, and key suffix if implemented.
* Cancel/close actions in API key forms must clear raw key values from React state.
* Test/save/delete API key actions must require a valid Firebase user/token.

⸻

6. Render Deployment Rules

Render deployment uses Web Service, not Static Site.

Expected commands:

npm install && npm run build
npm start

Server rules:

* Express server must bind to process.env.PORT.
* Public HTTP server must bind to the Render-provided port.
* /api/* routes must be registered before static/index fallback.
* Static frontend fallback must not intercept API routes.
* /api/health must always return JSON.
* Rate limiter must not block frontend static assets or SPA fallback.
* Rate limiter must not make /api/health unusable during startup checks.
* Do not use vite preview for Render production full-stack deployment.

⸻

7. AI Studio Rules

When preparing work for AI Studio:

* AI Studio is for applying provided ZIP/source, running lint/build, opening Preview, and runtime testing.
* Do not ask AI Studio to refactor or optimize the whole app for a single bug.
* Do not ask AI Studio to infer broad fixes from symptoms when Codex/Claude has not reviewed the code.
* AI Studio must not self-sync GitHub, self-stage, or self-commit.
* The user manually decides whether to use the GitHub tab.
* Runtime test must happen before final sync/merge decisions.
* If AI Studio changed files include unrelated deletions such as AGENTS.md — Deleted, stop and report.

When writing an AI Studio prompt, always lock:

* files allowed to change;
* files not allowed to change;
* exact source/ZIP to apply;
* no refactor/no dependency change;
* npm run lint;
* npm run build;
* Preview/runtime checklist;
* requirement to report changed files;
* requirement not to sync/commit/stage.

⸻

8. Current Sensitive Modules

Be extra careful with:

* Auth/Login/Profile/Admin role.
* Firebase client config.
* Firebase Admin initialization.
* Firestore named database configuration.
* Firestore listeners and user-scoped paths.
* Task CRUD and duplicate React render keys.
* PDF/DOCX export.
* A4 Print Preview / publishing engine.
* Rate limiter and /api/health.
* AI chatbox.
* Floating Copilot / Editorial Copilot.
* API key management.
* User API key encryption/decryption.
* Render configuration.
* Google Drive API integration.

⸻

9. A4 Publishing / Editorial Export Rules

The editorial module is moving toward a template-driven A4 publishing engine.

Target architecture:

User input
→ AI analysis
→ template recommendation
→ user confirms template
→ AI creates block outline
→ validation
→ AI fills block content
→ validation
→ ArticleDocument
→ HTML A4 Print Preview
→ DOCX
→ PDF Văn bản
→ later: browser/Playwright PDF if approved

Current source of truth for visual article preview:

#printable-article

Rules:

* There should be one primary preview: A4 Print Preview.
* Do not maintain a separate “web preview” and “print preview” unless explicitly requested.
* #printable-article must refer to the exportable A4 article content, not a wrapper containing toolbar, validation panels, editor controls, Copilot UI, pill UI, selection highlights, or app UI.
* Interactive UI such as Copilot panel, pill “Hỏi AI”, context highlight, selection badge, toolbars, and validation panels must not be included in exported HTML/PDF/DOCX.
* Validation warnings may be displayed in UI, but must not be included in exported PDF/DOCX unless explicitly designed as part of the article.
* Do not let .prose or global typography styles accidentally override A4 print layout.
* Keep CSS scoped to the A4 preview/export container.
* Body paragraphs should be justified.
* Headings/titles should not be justified.
* Figure placeholder + caption should be treated as one semantic group.
* Do not duplicate image alt text, placeholder label, caption, and paragraph text.
* If title and caption are identical, render only one user-facing caption.
* Placeholder images are intentional content and must not be removed.
* Do not expose raw markers:
    * [PLACEHOLDER ...]
    * [— ẢNH —]
    * [— PLACEHOLDER —]
* Publishing markers such as [Bổ sung: ...] should produce warnings, not crashes.

9.1 ArticleDocument foundation rules

When working on publishing foundation files:

* Keep schemaVersion, documentVersion, templateId, templateVersion, locale, metadata, and blocks.
* Template registry must resolve templates by templateId + templateVersion.
* Block types must be explicit and validated.
* Do not let AI or parser invent unknown block types.
* Validation must return structured errors/warnings.
* Do not silently drop invalid blocks without reporting.
* Keep renderer behavior semantic:
    * paragraph → paragraph;
    * heading → heading;
    * unordered list → bullet list;
    * ordered list → ordered list;
    * lead-in list → label/body structure;
    * figure-placeholder → placeholder block + caption;
    * page-break → page break intent.

9.2 Export strategy

Do not try to force one renderer to solve every output need.

* DOCX:
    * editable Word document;
    * semantic, print-ready;
    * not necessarily pixel-perfect HTML.
* PDF Văn bản:
    * semantic pdfmake output;
    * stable, selectable text;
    * not expected to match browser HTML 100%.
* PDF Bản in giống Preview:
    * future browser/Playwright rendering if approved;
    * requires separate PR because it may affect package/deployment.

Do not add Playwright, Puppeteer, html2canvas, or new export dependencies without explicit user approval.

⸻

10. Prompting / AI Generation Rules for Article Content

AI must not freely invent layout.

Preferred future flow:

1. System or user selects article type/template.
2. AI may recommend a template, but user or deterministic rules should confirm it.
3. AI generates a block outline.
4. Validate outline.
5. AI fills block content.
6. Validate filled document.
7. Render from ArticleDocument.

Rules for future AI outputs:

* Prefer structured JSON matching ArticleDocument.
* Do not allow unknown block types.
* Do not allow HTML inside plain text slots.
* Enforce slot character limits.
* Use contentHint from block registry.
* On validation failure, repair only invalid blocks where possible.
* For long articles, prefer two-phase generation over one-shot generation.

⸻

11. Editorial UX Target Architecture — Intelligent Canvas Assistant

Target architecture of the Editorial Assistant is:

Intelligent Canvas Assistant
= Canvas-first
+ Copilot-primary
+ Header-minimal
+ Human-in-the-loop AI actions

Principles:

* Canvas is where the user reads, selects context, verifies output, and applies results.
* Copilot is the central place for intelligent actions.
* Header only holds minimal system actions.
* The app must not become chat-only: Save/Export/document state remain system actions.
* Do not continue expanding the 6-item module panel as the long-term UX direction.
* If the 6-item module panel still exists in source, treat it as transitional/legacy.
* Do not introduce a second module sidebar that competes with the Canvas.
* Global app sidebar may exist, but must be thin/icon-only/collapsible where possible.

Target header:

[Document title]   [Saved / Unsaved status]   [Save] [Export ▾] [⋯]

Export dropdown:

* Word
* PDF
* HTML A4

Overflow menu may contain:

* Lịch sử văn bản
* Nguồn tư liệu
* Mẫu văn bản
* Cài đặt xuất bản
* Xóa bản nháp

These overflow actions must not become a heavy horizontal module menu.

⸻

12. Floating Copilot Implementation Rules

Floating Copilot has three states only:

* collapsed
* expanded
* fullscreen

Rules:

* Do not introduce many snap states such as peek or half unless explicitly requested.
* Do not auto-open Copilot by default on single click.
* Single click/tap block should only:
    * highlight the block;
    * show pill “Hỏi AI”;
    * show context badge on Copilot icon.
* Open Copilot only when user:
    * clicks pill “Hỏi AI”;
    * double-clicks a supported block;
    * clicks Copilot icon;
    * uses a supported shortcut if implemented.
* If Copilot is already open, selecting another supported block may update the context immediately.
* If user scrolls, taps empty space, clicks a system button, or navigates normally, Copilot must not open unexpectedly.

Pill “Hỏi AI” rules:

* Selecting 1 block: show pill near the block.
* Selecting 2–3 blocks: show one aggregate pill, for example “Hỏi AI về 3 nội dung”.
* Selecting more than 3 blocks: do not show multiple pills; only show badge on Copilot icon.
* Pill should auto-hide after about 5 seconds if not clicked.
* Pill should reappear when user interacts again with the selected block.
* Pill must have enough z-index, but must not obscure core reading/editing content.
* Pill position must be anchored reliably and must not drift badly during scroll.
* There must be a clear way to clear selected context.

Copilot state rules:

* Do not use global window variables for Copilot state.
* Keep state in React Context, an existing store, or a clearly scoped workspace component.
* Minimum state shape should cover:
    * isCopilotOpen
    * copilotViewMode
    * selectedContextItems
    * activeCommandId
    * pendingProposal
    * onboardingSeen

Onboarding:

* If Copilot opens expanded on first visit, it must happen only once.
* Use a clear flag such as vms-editorial-copilot-onboarding-seen.
* Do not reopen onboarding every time the user enters the module.

⸻

13. Context Attachment Rules

Context attachment is how selected Canvas content is passed into Copilot.

Suggested context types:

* paragraph
* heading
* table
* figure
* source
* preflight_issue
* history_session
* draft
* selection

UI rules:

* Do not expose primary/supporting context terminology to users.
* User-facing text should be simple:
    * “Đã chọn: 1 đoạn văn”
    * “Đã chọn: 1 bảng”
    * “Đã chọn: 2 nguồn tư liệu”
* Each attachment should include:
    * context type;
    * short title/excerpt;
    * remove button.
* Do not attach full long text when a short excerpt and stable reference are enough.
* Do not include secrets, tokens, API keys, private keys, or raw credential values in context attachment.
* If selected content changes after attachment, the UI should avoid stale/confusing actions. A lightweight refresh/clear mechanism is acceptable.

⸻

14. Proposal / Apply / Cancel Safety Rules

AI/rule output must not overwrite user content automatically.

Every content-changing operation must go through:

Proposal preview
→ Apply
→ Cancel

Rules:

* Apply is the only action that changes content.
* Cancel must leave original content unchanged.
* If visual diff is too complex, show a clear preview card with:
    * current content;
    * proposed content.
* When Apply:
    * update the correct block if safely identifiable;
    * mark draft dirty;
    * do not auto-save over session unless the user explicitly saves.
* If the correct target block cannot be safely identified:
    * do not apply automatically;
    * show a message requiring user review/copy/manual edit.
* Apply/Cancel must not reset input/output/source/session.
* Proposal UI must work the same whether the result comes from a rule or AI fallback.

⸻

15. Editorial Workflow Router MVP Rules

The workflow layer name is:

Editorial Workflow Router MVP

Do not call it:

* Learning Loop
* Hermes-like
* Auto-learning
* Self-learning workflow

PR1 of this router must be:

Rule-first + AI fallback

Router order:

1. exact commandId
2. valid alias
3. keyword + contextType
4. default confidence threshold 0.85 for keyword/context match
5. AI fallback

Rules:

* Exact commandId and valid aliases are considered deterministic matches.
* DEFAULT_RULE_CONFIDENCE_THRESHOLD = 0.85 should be a module-level constant.
* Do not hard-code threshold values in many places.
* Do not use fuzzy matching.
* Do not use Levenshtein.
* Do not use embedding.
* Do not use ML classifier.
* Do not use AI classifier to choose deterministic rules in MVP.
* Do not auto-generate rules.
* Do not learn new rules from Apply/Cancel.
* Do not create an admin dashboard or rule management UI in MVP.
* Do not create a parallel workflow engine if an existing AIWorkflowManager, workflowService, or equivalent service exists. Extend or wrap existing patterns.

Semantic tasks must fallback AI:

* rewrite paragraph;
* summarize source;
* critique content;
* legal/policy analysis;
* long-form drafting;
* complex comparison;
* argumentative strengthening.

Do not fake semantic quality with rigid templates.

⸻

16. EditorialExecutionResult Schema Rules

Rule and AI fallback must return a shared schema so the Copilot UI can render Proposal / Preview / Apply / Cancel consistently.

Use:

source: "rule" | "ai"

Do not add executedBy if source already exists.

Suggested fields:

* ok
* source
* commandId
* proposal
* confidence
* ruleId
* ruleName
* ruleVersion
* model
* fallbackReason
* telemetry
* error

Proposal should be a discriminated union, with variants such as:

* replace_block
* insert_before
* insert_after
* add_caption
* review_report
* checklist
* message

Rules:

* Do not let UI implement separate rendering branches for rule vs AI beyond small badges.
* UI should show:
    * Rule badge + rule name/version for rule source;
    * AI badge + model for AI source.
* Missing data must produce structured error/message, not crashes.

⸻

17. Static Rule Registry Rules

Rule registry in MVP is static and reviewable.

Do not let AI create or mutate rules.

Core rules for Editorial Workflow Router PR1:

1. create_table_caption
2. create_figure_caption
3. normalize_caption_title
4. check_missing_source_or_caption
5. remove_bad_technical_markers
6. create_a4_review_checklist
7. check_long_paragraph
8. normalize_basic_heading

Optional rules only if low-risk:

9. normalize_inline_spacing
10. detect_table_missing_title
11. suggest_list_to_table
12. check_placeholder_caption

Rules:

* If optional rules are not implemented, report them as Remaining risks / future work.
* Do not silently claim optional rules are implemented if they are not.
* Rule output must use EditorialExecutionResult.
* Rule must not directly apply content changes.
* Rule must produce proposal/review/checklist/message for UI preview.

⸻

18. AI Case Logging and Telemetry Rules

AI case logging applies only when real AI is called.

If the codebase has backend/API proxy and Firebase token verification:

* AI case logging should go through backend API.
* Do not let frontend write arbitrary case logs directly to review/cases collections unless there is a safe existing pattern.

If no safe endpoint exists:

* Either create a minimal endpoint with Firebase ID token verification, or report the limitation.
* Do not refactor Auth/Firebase rules/Admin role just for logging in MVP.
* Do not modify Firestore rules unless explicitly required and approved.

AI case logging may store:

* userId
* sessionId if available
* commandId
* source: "ai"
* model
* contextTypes
* short excerpt with clear character limit
* hash for correlation, but never treat hash as security
* proposal type
* applied status: pending | applied | cancelled
* timestamps
* error/fallbackReason if any

AI case logging must not store:

* full long text;
* full file contents;
* API key;
* token;
* service account data;
* sensitive data in full.

Telemetry for rule/AI command may include:

* commandId
* source
* ruleId
* model
* contextTypes
* durationMs
* ok
* errorCode
* applied

Do not build Admin Dashboard / Rule Management / Analytics UI in MVP.

⸻

19. PR Sequencing and Dependency Rules

Before implementing a PR that depends on a previous PR, check the actual source first.

Examples:

Before implementing Editorial Workflow Router, verify whether:

* src/components/copilot/FloatingCopilot.tsx exists;
* A4PrintPreview.tsx supports selectable blocks;
* EditorWorkspace.tsx has proposal/apply/cancel workflow;
* Copilot command IDs already exist.

Rules:

* If a foundation PR is not present in the source, do not write code assuming it exists.
* Do not stack dependent PRs on an unmerged/unapplied foundation unless the user explicitly asks to continue on that branch.
* If continuing on a non-main branch, report the branch dependency clearly.
* If the user needs AI Studio handoff, only package the correct changed files for the branch being tested.
* Do not merge/cherry-pick/sync without explicit user confirmation.

⸻

20. AI Studio / ZIP Handoff for Copilot Work

When ZIP handoff relates to Copilot/A4 Preview:

* Include only changed files.
* Ensure relative paths are exact.
* Do not include the entire project unless explicitly requested.
* Do not include output artifacts.
* Do not include .env, service account JSON, node_modules, dist, .git, Playwright reports, screenshots, videos, traces.

Export safety:

* #printable-article must remain exportable article content only.
* Copilot panel, pill “Hỏi AI”, context highlights, selection UI, validation UI, toolbar UI, and app shell UI must not be inside export content.
* After apply, runtime test must include export HTML/PDF/Word to ensure Copilot UI does not leak into output.

AI Studio prompt must require:

* apply uploaded ZIP/source only;
* no self-fix;
* no refactor;
* no dependency change;
* no stage/commit/sync;
* run lint/build;
* open Preview;
* report changed files;
* report file cấm;
* report output artifacts;
* runtime checklist.

⸻

21. Required Response Format for Investigation

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
J. Remaining risks

Do not include secrets, tokens, API keys, Firebase private keys, or service account JSON.

⸻

22. Required Response Format for Fix Reports

When fixing code, respond with:

A. Root cause
B. Branch created
C. PR status
D. Changed files
E. Files not changed
F. File-scope safety check
G. npm run lint result
H. npm run build result
I. ZIP handoff path and contents, if created
J. Runtime checklist
K. Remaining risks

If a requested branch/PR/fetch cannot be completed because the environment lacks remote access, say so explicitly and do not pretend it succeeded.

⸻

23. Default “Do Not Touch” List

Unless explicitly required by the verified root cause, do not modify:

* AGENTS.md
* server.ts
* package.json
* package-lock.json
* metadata.json
* .env
* firestore.rules
* storage.rules
* Firebase config / Firestore database ID
* Auth provider config
* Admin role behavior
* Rate limiter / API gateway
* Render config
* Task module
* API key encryption/decryption
* Export PDF/DOCX engine

For export/publishing tasks, do not modify backend/auth/rate-limiter files.

For auth/API-key tasks, do not modify export/publishing files.

For task module tasks, do not modify export/auth/publishing files unless the root cause directly crosses modules.

For Copilot/editorial UX tasks, do not modify Task module, Auth/Admin, Firebase rules, or export engine unless the verified root cause directly requires it.

⸻

24. Final Gate Before Handoff

Before reporting completion:

1. Check git status.
2. Confirm no forbidden files changed.
3. Confirm no temp artifacts are included.
4. Run lint/build when code changed.
5. Report exact changed files.
6. Provide runtime checklist.
7. Do not merge.
8. Do not sync AI Studio/GitHub on behalf of the user.
9. If creating ZIP, include only changed files and report internal file list.
10. If runtime cannot be tested, say exactly what remains unverified.