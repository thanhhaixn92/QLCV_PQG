# Cloudflare Pages API fix for QLCV_PQG

## Đã bổ sung

1. `functions/api/[[path]].ts`
   - Bổ sung Cloudflare Pages Function dạng catch-all cho các route `/api/...`.
   - Sửa lỗi Cloudflare Pages chỉ deploy frontend tĩnh dẫn đến `405 Method Not Allowed` khi bấm “Bắt đầu xử lý”.
   - Hỗ trợ các endpoint chính:
     - `GET /api/health`
     - `POST /api/ai/process`
     - `POST /api/ai/search`
     - `POST /api/tasks/build`
     - `POST /api/editorial-images/plan`
     - `POST /api/editorial-images/generate` trả 410 theo thiết kế khóa tạo ảnh AI
     - một số endpoint Google Drive/link cơ bản.

2. `public/_redirects`
   - Bổ sung redirect SPA cho Cloudflare Pages để tránh lỗi refresh route bị 404.

## Việc phải cấu hình trong Cloudflare Pages

Vào:

`Workers & Pages → qlcv-pqg → Settings → Variables and Secrets`

Thêm Secret:

```txt
GEMINI_API_KEY=API_KEY_GEMINI_CỦA_BẠN
```

Tùy chọn thêm:

```txt
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODEL=gemini-2.5-flash-lite
GOOGLE_DRIVE_API_KEY=API_KEY_GOOGLE_DRIVE_NẾU_DÙNG_DRIVE
```

Sau khi thêm biến/secret, phải redeploy:

`Deployments → Retry deployment` hoặc push commit mới lên GitHub.

## Lưu ý

- Không đưa `GEMINI_API_KEY` vào biến `VITE_...` vì sẽ lộ ở frontend.
- Firebase web config có thể nằm trong frontend, nhưng Firestore Rules phải khóa theo user.
- Nếu dùng Firebase Storage trên Spark có thể bị giới hạn; cân nhắc Cloudflare R2/Supabase Storage cho file.
