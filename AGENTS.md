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
* patch/test artifacts;
* node_modules;
* dist unless explicitly required by deployment workflow.

Do not change the following unless the task directly asks for it and the root cause requires it:

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
* #printable-article must refer to the exportable A4 article content, not a wrapper containing toolbar, validation panels, editor controls, or app UI.
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

10.1 Editorial UX Target Architecture — Intelligent Canvas Assistant

Target architecture của module Trợ lý biên tập là Intelligent Canvas Assistant.

Triết lý thiết kế:

* Canvas là nơi xem, chọn ngữ cảnh, kiểm chứng và áp dụng kết quả.
* Copilot là trung tâm cho các hành động thông minh.
* Header chỉ giữ thao tác hệ thống tối thiểu.

Header mục tiêu chỉ gồm:

* tên bài;
* trạng thái lưu;
* Lưu;
* Xuất;
* menu ba chấm cho thao tác phụ.

Rules:

* Không tiếp tục mở rộng module panel 6 mục như hướng dài hạn.
* Module panel 6 mục hiện tại nếu còn trong source chỉ là trạng thái transitional/legacy.
* Không biến app thành chat-only tuyệt đối: Lưu/Xuất/trạng thái tài liệu vẫn là thao tác hệ thống.
* Không đưa “Lịch sử”, “Nguồn tư liệu”, “Mẫu”, “Rà soát”, “Tóm tắt” thành menu ngang chính cạnh tranh với Copilot.
* Canvas phải là vùng chính để xem bản thảo/A4 Preview, kết quả rà soát/tóm tắt, nguồn tư liệu, lịch sử văn bản và proposal/diff trước khi áp dụng.

⸻

10.2 Floating Copilot Implementation Rules

Copilot có đúng 3 trạng thái chính:

* collapsed;
* expanded;
* fullscreen.

Rules:

* Không dùng nhiều snap states như peek/half nếu không có yêu cầu riêng.
* Không auto-open Copilot mặc định khi single click.
* Single click/tap block chỉ:
    * highlight block;
    * hiện pill “Hỏi AI”;
    * hiển thị badge context trên Copilot icon.
* Bấm pill, double click hoặc bấm Copilot icon mới mở Copilot.
* Nếu Copilot đang mở thì chọn block mới có thể cập nhật context ngay.

Pill “Hỏi AI” rules:

* Chọn 1 block: hiện pill gần block.
* Chọn 2–3 block: hiện một pill tổng.
* Chọn trên 3 block: chỉ hiện badge trên Copilot icon.
* Pill tự ẩn sau khoảng 5 giây nếu không bấm.
* Pill không được lệch khi scroll.
* Pill phải có z-index đủ cao nhưng không che nội dung chính.

State rules:

* Copilot state không được dùng global window variable.
* State nên tập trung trong React Context, store hiện có, hoặc component workspace rõ ràng.
* State tối thiểu:
    * isCopilotOpen;
    * copilotViewMode;
    * selectedContextItems;
    * activeCommandId;
    * pendingProposal;
    * onboardingSeen.

⸻

10.3 Context Attachment Rules

Context attachment là cách đưa nội dung đang chọn vào Copilot.

Các loại context gợi ý:

* paragraph;
* heading;
* table;
* figure;
* source;
* preflight_issue;
* history_session;
* draft;
* selection.

UI rules:

* UI không hiển thị khái niệm primary/supporting context cho user.
* UI chỉ hiển thị đơn giản, ví dụ:
    * “Đã chọn: 1 đoạn văn”;
    * “Đã chọn: 1 bảng”;
    * “Đã chọn: 2 nguồn tư liệu”.
* Mỗi attachment nên có:
    * loại context;
    * title/excerpt ngắn;
    * nút bỏ context.
* Không attach full text dài nếu chỉ cần excerpt.
* Không đưa secret/token/API key vào context.

⸻

10.4 Proposal / Apply / Cancel Safety Rules

AI/rule không được tự ghi đè nội dung.

Mọi sửa đổi nội dung phải qua:

* proposal preview;
* Apply;
* Cancel.

Rules:

* Apply mới cập nhật nội dung.
* Cancel không thay đổi nội dung gốc.
* Nếu chưa làm visual diff phức tạp, dùng preview card rõ:
    * nội dung hiện tại;
    * đề xuất mới.
* Khi Apply:
    * cập nhật đúng block nếu xác định được;
    * đánh dấu draft dirty;
    * không tự lưu đè session nếu user chưa lưu.
* Nếu không xác định được block an toàn, không apply tự động; báo rõ cần người dùng copy/sửa tay.

⸻

10.5 Editorial Workflow Router MVP Rules

Tên tầng là Editorial Workflow Router MVP.

Naming rules:

* Không gọi là Learning Loop.
* Không gọi là Hermes-like.
* Không gọi là auto-learning.

PR1 của router là rule-first + AI fallback.

Router order:

1. exact commandId;
2. alias hợp lệ;
3. keyword + contextType;
4. confidence threshold mặc định 0.85 cho keyword/context match;
5. AI fallback.

Rules:

* Exact commandId và alias hợp lệ được coi là match chắc chắn.
* Threshold 0.85 phải là hằng số cấu hình, không hard-code rải rác.
* Không fuzzy matching.
* Không Levenshtein.
* Không embedding.
* Không ML classifier.
* Không AI classifier để chọn rule trong MVP.
* Không auto-generate rule.
* Không tự học từ Apply.

⸻

10.6 EditorialExecutionResult Schema Rules

Rule và AI fallback phải trả cùng một schema thống nhất.

Rules:

* UI Copilot dùng chung schema để render Proposal / Preview / Apply / Cancel.
* Dùng source: "rule" | "ai".
* Không thêm executedBy nếu đã có source.
* Nên có:
    * commandId;
    * proposal;
    * confidence;
    * ruleId/ruleName/ruleVersion;
    * model;
    * fallbackReason;
    * telemetry;
    * error.
* Proposal nên là discriminated union, ví dụ:
    * replace_block;
    * insert_before;
    * insert_after;
    * add_caption;
    * review_report;
    * checklist;
    * message.

⸻

10.7 Static Rule Registry Rules

Rule registry ở MVP là static, reviewable.

Rules:

* Không để AI tự tạo rule.
* Core rules bắt buộc của PR1 router:
    1. create_table_caption;
    2. create_figure_caption;
    3. normalize_caption_title;
    4. check_missing_source_or_caption;
    5. remove_bad_technical_markers;
    6. create_a4_review_checklist;
    7. check_long_paragraph;
    8. normalize_basic_heading.
* Optional rules chỉ làm nếu không tăng rủi ro:
    * normalize_inline_spacing;
    * detect_table_missing_title;
    * suggest_list_to_table;
    * check_placeholder_caption.
* Tác vụ semantic như viết lại, tóm tắt, phản biện, phân tích pháp lý phải fallback AI, không giả lập bằng template cứng.

⸻

10.8 AI Case Logging and Telemetry Rules

Logging rules:

* Chỉ logging AI case khi gọi AI thật.
* Nếu codebase có backend/API proxy và Firebase token verification thì logging phải đi qua backend API.
* Không cho frontend ghi tùy tiện vào collection review/cases nếu chưa có pattern an toàn.
* Không refactor Auth/Firebase rules/Admin role chỉ để logging trong PR1.

Case logging chỉ lưu:

* userId;
* sessionId nếu có;
* commandId;
* source;
* model;
* contextTypes;
* excerpt ngắn;
* hash để đối chiếu, nhưng không coi hash là bảo mật;
* proposal type;
* applied status;
* timestamps;
* error/fallbackReason nếu có.

Không lưu:

* full text dài;
* file content đầy đủ;
* API key;
* token;
* dữ liệu nhạy cảm toàn văn.

Telemetry nhẹ cho rule/AI command có thể gồm:

* commandId;
* source;
* ruleId;
* model;
* contextTypes;
* durationMs;
* ok;
* errorCode;
* applied.

Không làm Admin Dashboard/Rule Management trong MVP.

⸻

10.9 PR Sequencing and Dependency Rules

Rules:

* Trước khi làm PR phụ thuộc, phải kiểm tra source thực tế đã có nền PR trước chưa.
* Ví dụ trước khi làm Workflow Router phải kiểm tra:
    * src/components/copilot/FloatingCopilot.tsx có tồn tại không;
    * A4PrintPreview.tsx đã hỗ trợ selectable blocks chưa;
    * EditorWorkspace.tsx đã có proposal/apply/cancel workflow chưa.
* Nếu PR nền chưa tích hợp vào source hiện tại, không được viết code giả định nó đã tồn tại.
* Không stack PR phụ thuộc lên PR chưa runtime PASS nếu user chưa yêu cầu.
* Nếu cần tiếp tục trên branch chưa merge, báo rõ branch phụ thuộc và changed files.

⸻

10.10 AI Studio / ZIP Handoff for Copilot Work

Rules:

* Khi ZIP handoff liên quan Copilot/A4 Preview, chỉ gồm file changed.
* Không đưa #printable-article wrapper app UI vào export.
* Interactive UI như pill, highlight, Copilot panel phải có cơ chế export-exclude hoặc không nằm trong #printable-article.
* Sau apply phải test export HTML/PDF/Word để chắc chắn không dính Copilot UI.

⸻

11. Required Response Format for Investigation

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

12. Required Response Format for Fix Reports

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

13. Default “Do Not Touch” List

Unless explicitly required by the verified root cause, do not modify:

AGENTS.md
server.ts
package.json
package-lock.json
metadata.json
.env
firestore.rules
storage.rules
Firebase config / Firestore database ID
Auth provider config
Admin role behavior
Rate limiter / API gateway
Render config
Task module
API key encryption/decryption

For export/publishing tasks, do not modify backend/auth/rate-limiter files.

For auth/API-key tasks, do not modify export/publishing files.

For task module tasks, do not modify export/auth/publishing files unless the root cause directly crosses modules.

⸻

14. Final Gate Before Handoff

Before reporting completion:

1. Check git status.
2. Confirm no forbidden files changed.
3. Confirm no temp artifacts are included.
4. Run lint/build when code changed.
5. Report exact changed files.
6. Provide runtime checklist.
7. Do not merge.
8. Do not sync AI Studio/GitHub on behalf of the user.