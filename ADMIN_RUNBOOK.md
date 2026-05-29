# Hướng dẫn Vận hành dành cho Quản trị viên (Admin Runbook)

Tài liệu này dành cho nhân sự kỹ thuật quản lý và bảo trì hệ thống.

## 1. Môi trường & Secrets
- Tuyệt đối **không đưa API Keys (Secret), Service Account JSON, hay thông tin nhạy cảm vào repo**. 
- Toàn bộ secret (`GEMINI_API_KEY`, `GOOGLE_DRIVE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`) cần được quản lý qua Secret Manager / Environment Variables trên nền tảng runtime.

## 2. Cấu hình & Thay thế API Key
- **Gemini API**: Ứng dụng dùng `gemini-2.5-flash` làm mặc định. Đã cấu hình Zod validation cho toàn bộ luồng tạo JSON (Chat, Task, Slide, Plan).
- **Firebase**: 
    - PROJECT_ID và DATABASE_ID phải được cấu hình qua biến môi trường. 
    - Tuyệt đối không hardcode ID vào mã nguồn.
- **Google Drive API**: Thư mục quét công khai cần `GOOGLE_DRIVE_API_KEY`.

## 3. Quản lý Dữ liệu: Backup, Restore & Rollback
### 3.1 Backup/Export Firestore
Khuyến nghị thiết lập Cron Job hoặc công cụ tự động Export dữ liệu hàng ngày qua Google Cloud Storage (GCS).
```bash
gcloud firestore export gs://[YOUR_BACKUP_BUCKET] \
    --project="gen-lang-client-0733170002" \
    --database="ai-studio-b6074ed0-9102-4183-836c-45db24476dce"
```
*Lưu ý: Thay đổi bucket tương ứng. Sử dụng service account có quyền `roles/datastore.importExportAdmin`.*

### 3.2 Restore Drill (Diễn tập phục hồi)
Cần định kỳ kiểm tra các bản export (ít nhất 1 tháng/lần) bằng tính năng nhập (import) trên một project dev/staging để xác minh mức độ toàn vẹn của dữ liệu:
```bash
gcloud firestore import gs://[YOUR_BACKUP_BUCKET]/[EXPORT_PREFIX] \
    --project="[STAGING_PROJECT]"
```

### 3.3 Rollback Checklist
Khi gặp lỗi nghiêm trọng trên production sau khi release, thực hiện rollback:
- [ ] Xác định nguyên nhân (UI lỗi, Network 4xx, Backend crash).
- [ ] Dừng CI/CD pipeline để ngăn chặn deploy đè.
- [ ] Khôi phục bản release trước (Cloud Run -> Revisions -> Rollback).
- [ ] Xác nhận `/api/health` quay về phiên bản API hợp lệ.
- [ ] Test khẩn cấp (Smoke Test) hệ thống ở version rollback.
- [ ] Nếu rollback Database Migration: Chạy ngược script migration (tuỳ vào độ an toàn đã tính trước) HOẶC restore từ GCS Backup.

## 4. Quy trình Di chuyển dữ liệu Sessions (Migration)
Để chuyển đổi dữ liệu từ Schema cũ sang Schema mới (sub-collections), hãy thực hiện:

1. **Backup**: Luôn thực hiện backup Firestore (xem mục 3.1) trước khi chạy trên production.
2. **Dry Run**: Kiểm tra tác động mà không thay đổi dữ liệu thật:
   ```bash
   DRY_RUN=true tsx scripts/migrate-sessions.ts
   ```
3. **Apply Migration**: 
   ```bash
   DRY_RUN=false tsx scripts/migrate-sessions.ts
   ```
   Script này **non-destructive** (mặc định không xóa trường cũ) và **idempotent**.
4. **Cleanup (Tùy chọn)**: Chỉ thực hiện sau khi hệ thống vận hành ổn định tối thiểu 24-48 giờ.
   ```bash
   DRY_RUN=false CLEANUP_OLD_FIELDS=true tsx scripts/migrate-sessions.ts
   ```
   *Cảnh báo: Lệnh này xóa dữ liệu cũ.*

## 5. Nhật ký Hệ thống (Logging)
- **Activity Logs**: Các thao tác quan trọng (Dashboard, Task updates, Editorial Saves) được ghi lại vào collection `activityLogs` của user.
- **AI Usage Logs**: Bất kì hành vi tương tác với Gemini (chat, extract, plan, review) đều ghi log vào collection con `aiUsageLogs`.
- **System/Admin Errors**: Tại Backend (`server.ts`), các lỗi Firestore, lỗi API sẽ trả về JSON HTTP Error Code cho frontend xử lý và log tại stdout của backend (Cloud Logging nhận các event).

## 6. Bảo mật & Quyền riêng tư
1. **Owner-based Access**: Dữ liệu người dùng được phân tách theo `userId` trong Firestore Security Rules.
2. **Fail-closed Auth**: Mọi API ghi dữ liệu đều verify Firebase Token. Không có fallback parse thủ công.
3. **Storage Quota**: Ảnh minh họa bị giới hạn 5MB và chỉ chấp nhận định dạng ảnh.

## 7. Bảo trì Hình ảnh (Storage)
- Đường dẫn: `illustrations/{userId}/{sessionId}/`.
- Người dùng chỉ tải được ảnh (image/*) và tối đa 5MB/file.

## 8. Xử lý sự cố
- **Lỗi 429**: Đợi 1 phút (AI Quota).
- **Lỗi 401/403**: Kiểm tra chênh lệch Project ID giữa frontend và backend (X-Auth-Audience-Mismatch).
- **Lỗi Firestore Timeout**: Tắt local cache nếu cần (chỉnh trong `firebase.ts`).

## 9. Cấu hình Xác thực (Authentication)
Ứng dụng hỗ trợ đăng nhập qua Google và Chế độ khách (Anonymous).

Để dùng chế độ khách (phù hợp trong môi trường dev/preview):
1. Mở Firebase Console > Authentication > Sign-in method.
2. Bật (Enable) Anonymous provider.
3. Thiết lập biến môi trường (trong .env/Cloud Run):
   `VITE_ENABLE_GOOGLE_AUTH=false`
   `VITE_ENABLE_ANONYMOUS_AUTH=true`
4. Rebuild và redeploy ứng dụng.

Để bật lại Google Login trên domain thật (production):
1. Mở Firebase Console > Authentication > Sign-in method > Bật Google provider.
2. Mở Firebase Console > Authentication > Settings > Authorized domains.
3. Thêm domain production thật của ứng dụng vào danh sách.
4. Thiết lập biến môi trường:
   `VITE_ENABLE_GOOGLE_AUTH=true`
5. Test xác thực trực tiếp trên domain production (không test trong AI Studio preview portal để tránh lỗi popup blocked/unauthorized domain).