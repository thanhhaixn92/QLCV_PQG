# VMS Navigator - Smoke Test / Checklist

This document contains the standard checklist to verify the core operational health of VMS Navigator after a deployment or major change.

## 1. Authentication & Basics
- [ ] **Login:** Connect to Firebase Auth, login with a valid user account.
- [ ] **Profile Check:** Ensure the user profile loads correctly across app components.
- [ ] **UI Rendering:** Dashboard loads cleanly on both desktop and tablet without overlapping panels.

## 2. Tasks Management
- [ ] **Create Task:** Add a new task (e.g. from the Home Dashboard or Task tab). Check that it persists in Firestore.
- [ ] **Edit Task:** Update task details and status.
- [ ] **AI Task Planner:** Use AI to plan a new series of tasks and verify it populates the task list.

## 3. Editorial & AI
- [ ] **Editorial Session:** Create a new writing/reviewing session in "Biên tập".
- [ ] **Save Session:** Type some content, save the session, reload the page, and open it from History.
- [ ] **Chatbox:** Open the AI floating chatbox and verify it answers general or context-aware queries.
- [ ] **Upload Document (PDF/Docx):** Ensure document parsing completes without errors and populates the source context.
- [ ] **Upload Image for OCR:** Try uploading an image with text and ensure text extraction (if applicable) initiates.
- [ ] **Export Content:** Test exporting the current editorial content to Word (Docx) and PDF.

## 4. Storage & Integrations
- [ ] **Google Drive Import:** Open Drive Browser, import a public link, and sync small folders. 
- [ ] **Firebase Storage:** Verify image uploads for avatars or inline image processing persist in Firebase Storage buckets.

## 5. Security & Logs
- [ ] **Access Control:** Try to access `/api/user/profile` without a token via Postman/cURL; it should return 401 JSON.
- [ ] **Logs:** Admin actions and editorial creations should write to `activityLogs`. AI operations should append to `aiUsageLogs`.

## Completion
If all the above tests pass, the core workflows are functional. 
