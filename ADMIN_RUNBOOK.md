# Hướng dẫn Vận hành dành cho Quản trị viên (Admin Runbook)

Tài liệu này dành cho nhân sự kỹ thuật quản lý và bảo trì hệ thống.

## 1. Cấu hình & Thay thế API Key
- **Gemini API**: Ứng dụng dùng `gemini-2.5-flash` làm mặc định để tối ưu quota.
- **Image Handling**: 
    - AI chỉ tham gia lập kế hoạch khi có yêu cầu (nút Gợi ý bằng AI). Mặc định quét ghi chú trong bài viết (Local Scan) để tiết kiệm quota.
    - Không còn chức năng tạo ảnh tự động. Biên tập viên tự tải ảnh lên.
- **Firebase**: Nếu đăng nhập lỗi, kiểm tra cấu hình trong `firebase-applet-config.json` và đảm bảo URL domain được allowlist trong Firebase Console.
- **Google Drive API**: 
    - Để quét thư mục Drive công khai, cần cấu hình `GOOGLE_DRIVE_API_KEY` trong biến môi trường server-side.
    - Thư mục được quét PHẢI ở chế độ "Bất kỳ ai có đường liên kết đều có thể xem" (Anyone with the link can view).

## 2. Kiểm tra Logs
- Backend log hiển thị các yêu cầu trích xuất task và lập kế hoạch hình.
- Lỗi phổ biến:
    - `429`: Hết quota AI (thường gặp ở bản Flash free). Đợi 1 phút.
    - `400`: Thiếu dữ liệu đầu vào.
    - `500`: Lỗi từ phía server hoặc Firebase.

## 3. Quản lý Dữ liệu Firestore
- Dữ liệu người dùng nằm trong collection `users`.
- Danh sách công việc: `users/{userId}/tasks`.
- Phiên biên tập: `users/{userId}/sessions`.
- **Lưu ý**: Dung lượng 1 document Firestore tối đa là 1MiB. Phiên biên tập bài viết nếu tích lũy quá nhiều version dài sẽ tiến gần giới hạn này. Hệ thống đã giới hạn bài viết ở 700k ký tự.

## 4. Bảo trì Hình ảnh (Storage)
- Ảnh minh họa chiếm dung lượng lớn nhất.
- Đường dẫn: `illustrations/{userId}/{sessionId}/`.
- Người dùng chỉ tải được ảnh (image/*) và tối đa 5MB/file.

## 5. Xử lý sự cố
- **Lỗi 429 Resource Exhausted**: Đề xuất người dùng sử dụng "Quét cục bộ" thay vì "Gợi ý AI" để giảm tần suất gọi API.
- **Không xuất được PDF**: Đảm bảo toàn bộ ảnh đã duyệt được tải xong trước khi bấm nút xuất PDF. Render preview đôi khi mất 1-2 giây cho ảnh từ Storage.
- **Mã lĩnh vực bài viết**: Nếu thay đổi 9 lĩnh vực của công ty, cần sửa cả `src/types.ts` và Prompt AI Task Builder trong `server.ts`.
