import { WritingStyle, DocumentSource, OutputFormat, EditorialImageAnalysis, EditorialIllustration, EditorialIllustrationPlan } from "../types";

const SYSTEM_INSTRUCTION = `# VAI TRÒ VÀ NHIỆM VỤ CỐT LÕI (ROLE & CORE MISSION)
Bạn là "Trợ lý Văn phòng Công ty Hoa tiêu hàng hải miền Bắc" - chuyên gia biên tập báo chí, chuẩn hóa văn bản và trợ lý quản lý công việc chuyên nghiệp.

# NGUỒN DỮ LIỆU (DATA SOURCES)
Khi người dùng cung cấp tài liệu tham khảo, bạn PHẢI ưu tiên sử dụng thông tin và số liệu từ đó. Không bịa đặt thông tin.

# KIẾN THỨC NỀN TẢNG (CRITICAL CONTEXT)
1. Đơn vị: Công ty TNHH MTV Hoa tiêu hàng hải miền Bắc (VMS North Pilot).
2. Cơ quan chủ quản: Tổng công ty Bảo đảm an toàn hàng hải miền Bắc.
3. Chú ý sáp nhập: Kể từ ngày 01/03/2025, Bộ Giao thông Vận tải (Bộ GTVT) sáp nhập vào Bộ Xây dựng. Bạn PHẢI tự động sửa "Bộ GTVT" thành "Bộ Xây dựng" trong mọi văn bản.
4. Thuật ngữ ngành: Hoa tiêu, mớn nước, luồng lạch, phao tiêu, lai dắt, an toàn hàng hải, cảng biển...

# NHIỆM VỤ BIÊN TẬP (EDITORIAL STANDARDS)
- FORMAL, TECHNICAL, EDITORIAL, DYNAMISM.
- Luôn có TIÊU ĐỀ, SAPO, THÂN BÀI, KẾT LUẬN.

# NHIỆM VỤ QUẢN LÝ CÔNG VIỆC (TASK MANAGEMENT)
- Khi được yêu cầu tạo task (AI Task Builder), bạn phải phân tích văn bản để trích xuất: Tên công việc, Phụ trách, Hạn xử lý, Lĩnh vực, Chức danh kiêm nhiệm (nếu có).
- Luôn trả về mã lĩnh vực (categoryCode) khớp với danh sách 9 lĩnh vực của công ty.`;

async function fetchWithAI(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  const token = (options as any).token;
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  
  let attempt = 0;
  while (attempt <= maxRetries) {
    const response = await fetch(url, { ...options, headers });
    if (response.status === 429 && attempt < maxRetries) {
      // Wait before retry: 3s, 8s...
      const waitTime = (attempt + 1) * 3000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      attempt++;
      continue;
    }
    return response;
  }
  return fetch(url, { ...options, headers });
}

export async function processTask(
  taskType: string, 
  content: string, 
  style: WritingStyle = 'FORMAL',
  format: OutputFormat = 'ARTICLE',
  sources: DocumentSource[] = [],
  token?: string
) {
  const response = await fetchWithAI('/api/ai/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskType, content, style, format, sources }),
    token
  } as any);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const rawType = data.errorType || data.error;
    const mappedMessage =
      rawType === "quota_exceeded"
        ? "Hạn mức AI tạm thời hết. Vui lòng thử lại sau hoặc đổi model/API key."
        : rawType === "invalid_api_key"
        ? "API key AI không hợp lệ hoặc chưa có quyền truy cập model."
        : rawType === "model_not_available"
        ? "Model AI đang chọn không khả dụng. Vui lòng đổi sang model ổn định hơn."
        : rawType === "validation_error"
        ? "Dữ liệu đầu vào hoặc định dạng trả về chưa hợp lệ."
        : rawType === "provider_error"
        ? "Nhà cung cấp AI trả lỗi. Vui lòng thử lại, kiểm tra model/API key/quota."
        : `Lỗi server (${response.status}): ${response.statusText}`;

    const errorMessage = data.message || data.errorMessage || mappedMessage;
    const err = new Error(errorMessage) as any;
    if (data.retryAfterSeconds) {
       err.retryAfterSeconds = data.retryAfterSeconds;
    }
    if (rawType === "quota_exceeded") {
       err.isQuota = true;
    }
    throw err;
  }

  const data = await response.json();
  if (data.isReview) return data; 
  return data.text as string;
}

export async function searchWebSources(query: string, token?: string) {
  const response = await fetchWithAI('/api/ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    token
  } as any);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const errorMessage = data.error || `Lỗi tìm kiếm (${response.status}): ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return response.json();
}

import { apiFetchJson } from './apiClient';

export async function checkHealth() {
  return apiFetchJson('/api/health', {
    retries: 5,
    retryDelayMs: 800,
    timeoutMs: 15000,
    allowHtmlRetry: true
  });
}

export async function planEditorialImages(content: string, existingAnalysis: Partial<EditorialImageAnalysis>, token?: string) {
  const response = await fetchWithAI('/api/editorial-images/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, existingAnalysis }),
    token
  } as any);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const errorMessage = data.error || `Lỗi lập kế hoạch ảnh (${response.status}): ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return response.json() as Promise<{ plans: EditorialIllustrationPlan[]; notes: string[] }>;
}
