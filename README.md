# Hệ thống Trợ lý Biên tập & Quản lý Công việc (Maritime Pilot Assistant)

Ứng dụng hỗ trợ cán bộ nhân viên Công ty Hoa tiêu hàng hải miền Bắc trong việc quản lý công việc và biên tập nội dung bài viết.

## Các tính năng chính

1.  **Quản lý Công việc (AI Task Builder)**:
    *   Tự động trích xuất danh sách công việc từ nội dung chỉ đạo thô.
    *   Phân loại công việc theo lĩnh vực chuyên môn.
    *   Lưu trữ và quản lý tập trung trên Firebase.
2.  **Trợ lý Biên tập Bài viết**:
    *   Viết bài bằng AI dựa trên ý chính hoặc tài liệu tham khảo.
    *   **Lập kế hoạch hình ảnh**: 
        *   Mặc định quét cục bộ ghi chú trong văn bản (Local Scan).
        *   Sử dụng AI (`gemini-2.5-pro`) để đề xuất thêm các vị trí và nội dung ảnh phù hợp cho việc tải lên thủ công.
    *   **Quản lý hình ảnh thủ công**: Người dùng tải ảnh lên máy chủ, duyệt và quản lý ảnh bài viết.
    *   **Lưu trữ & Hiệu suất**: Tự động giới hạn kích thước nội dung (max 700k ký tự/phiên) và lưu trữ Firestore/Storage theo chuẩn Enterprise.
3.  **Xuất bản chuyên nghiệp**:
    *   Xuất file Word (Times New Roman, chèn ảnh tự động).
    *   Xuất file PDF trực tiếp từ trình duyệt.

## Công nghệ sử dụng

*   **Frontend**: React (Vite), Tailwind CSS, Lucide Icons, Framer Motion.
*   **Backend**: Node.js, Express.
*   **AI**: Gemini 2.5 Flash/Pro (Text).
*   **Database & Storage**: Firebase Firestore, Firebase Authentication, Firebase Storage.

## Cài đặt

1.  Cài đặt dependencies: `npm install`
2.  Cấu hình biến môi trường: Xem `.env.example`
3.  Chạy ở môi trường phát triển: `npm run dev`
4.  Xây dựng bản production: `npm run build`

## Chốt cấu hình trước khi Publish Internal
Cụ thể thay đổi bản cuối:
- **Model**: Mặc định sử dụng `gemini-2.5-flash` và `gemini-2.5-pro` (theo cấu hình .env).
- **Hình ảnh**: Loại bỏ hoàn toàn AI Generation, chuyển sang luồng đề xuất vị trí và tải lên thủ công.
- **Firebase rules**: Chuẩn hóa storage và firestore cho môi trường Enterprise.
- **Dọn dẹp**: Xóa các hàm cũ liên quan đến AI generation.

## Liên hệ
Phòng Công nghệ thông tin - Công ty Hoa tiêu hàng hải miền Bắc.

---
*Internal Notice: Proposal module is temporarily disabled / legacy module for transition into standalone webapp.*
