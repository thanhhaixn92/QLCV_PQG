# Hướng dẫn Triển khai (Deployment Guide)

Dự án này bao gồm một ứng dụng Full-stack sử dụng **React (Vite)** cho Frontend và **Express** cho Backend, kết hợp với **Firebase** cho cơ sở dữ liệu và lưu trữ.

## 1. Yêu cầu hệ thống
- Node.js 18+
- Tài khoản Firebase (Spark hoặc Blaze plan)
- Google AI Studio API Key (để sử dụng Gemini)

## 2. Cấu hình Firebase
Trên Firebase Console:
1.  **Authentication**: Bật phương thức đăng nhập `Google`.
2.  **Firestore Database**: Tạo database mới. Đảm bảo rules được cập nhật từ `firestore.rules`.
3.  **Storage**: Kích hoạt Firebase Storage. Đảm bảo rules tương ứng từ `storage.rules`.

## 3. Biến môi trường
Tạo file `.env` từ `.env.example` và điền đầy đủ các giá trị:
- `GEMINI_API_KEY`: Lấy từ [Google AI Studio](https://aistudio.google.com/).
- `GEMINI_TEXT_MODEL`: Chốt ở `gemini-2.5-flash-lite` cho hiệu năng cao.
- `GEMINI_PRO_MODEL`: Chốt ở `gemini-2.5-pro` dùng cho phân tích sâu và lập kế hoạch công việc.
- `GEMINI_FALLBACK_MODEL`: Chốt ở `gemini-2.5-flash-lite`.
- `ALLOW_CUSTOM_MODELS`: Đặt `false` mặc định; chỉ bật `true` khi chủ động dùng model ngoài allowlist backend.
- `GOOGLE_API_KEY`: API Key từ Google Cloud Console để quét thư mục Drive và Search.
- `FIREBASE_PROJECT_ID`: ID dự án Firebase (`YOUR_FIREBASE_PROJECT_ID`).
- `FIRESTORE_DATABASE_ID`: ID database Firestore (`YOUR_FIRESTORE_DATABASE_ID`).
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Nội dung JSON Service Account.
- `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`: Nội dung JSON Service Account dạng Base64 (nếu không hỗ trợ multiline secret).
- `DEBUG_HEALTH`: Đặt `true` để xem chi tiết lỗi tại `/api/health`.
- Production auth: đặt `VITE_ENABLE_GOOGLE_AUTH=true` và `VITE_ENABLE_ANONYMOUS_AUTH=false`, trừ khi có quyết định vận hành riêng cho môi trường preview/dev.

### Lưu ý quan trọng về Bảo mật:
- **KHÔNG ĐƯỢC** commit Service Account JSON vào mã nguồn.
- Chỉ đặt Service Account trong phần **Secrets** hoặc **Environment Variables** của hệ thống.
- Hệ thống chỉ sẵn sàng khi `/api/health` có `"firestoreReady": true`.

## 4. Triển khai Local (Phát triển)
```bash
npm install
npm run dev
```
Ứng dụng sẽ chạy tại `http://localhost:3000`.

## 5. Triển khai Production
### Bước 1: Build Frontend
```bash
npm run build
```
Đảm bảo thư mục `dist/` được tạo ra ổn định và không có lỗi từ linter (`npm run lint`).

### Bước 2: Chạy Server
Sử dụng script start đã được cấu hình:
```bash
npm start
```
Hệ thống sẽ chạy ở port 3000 và phục vụ các file tĩnh từ `dist/`.

## 6. Kiểm tra sau triển khai
- Đăng nhập Google thành công.
- Tạo được bài viết bằng AI.
- Tải được ảnh thủ công lên Storage.
- Xuất được file PDF có đầy đủ ảnh đã duyệt.
- AI Task Builder trích xuất được công việc đúng định dạng.

## 7. Release Checklist
Trước khi triển khai production:
- [ ] Backup Firestore hoặc xác nhận backup tự động gần nhất còn dùng được.
- [ ] Chạy `npm ci`, `npm run lint`, `npm test`, `npm run build`, `npm run security:audit`.
- [ ] Deploy staging/preview và kiểm tra `/api/health` trả JSON, `modelConfigValid: true`.
- [ ] Smoke test: Auth, Task CRUD, Editorial save/reload, DOCX/PDF export, Drive import.
- [ ] Kiểm tra logs backend sau deploy, đặc biệt lỗi Auth audience, Firestore database ID, Gemini quota/model.
- [ ] Không bật Proposal API/Menu nếu chưa có quyết định release riêng.
