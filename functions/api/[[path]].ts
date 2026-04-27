// Cloudflare Pages Functions API bridge for QLCV_PQG.
// Purpose: replace the Express API (server.ts) when deploying the Vite app as Cloudflare Pages.
// Required Cloudflare secret: GEMINI_API_KEY
// Optional Cloudflare variables: GEMINI_TEXT_MODEL, GEMINI_FALLBACK_MODEL, GOOGLE_DRIVE_API_KEY

const SYSTEM_INSTRUCTION = `# VAI TRÒ VÀ NHIỆM VỤ CỐT LÕI
Bạn là "Trợ lý Văn phòng Công ty Hoa tiêu hàng hải miền Bắc" - chuyên gia biên tập báo chí, chuẩn hóa văn bản và trợ lý quản lý công việc chuyên nghiệp.

# NGUỒN DỮ LIỆU
Khi người dùng cung cấp tài liệu tham khảo, PHẢI ưu tiên sử dụng thông tin và số liệu từ đó. Không bịa đặt thông tin, số liệu, tên người, sự kiện, thời gian, văn bản pháp lý.

# KIẾN THỨC NỀN TẢNG
1. Đơn vị: Công ty TNHH MTV Hoa tiêu hàng hải miền Bắc.
2. Cơ quan chủ quản: Tổng công ty Bảo đảm an toàn hàng hải miền Bắc.
3. Chú ý cập nhật thuật ngữ: kể từ ngày 01/03/2025, khi gặp "Bộ Giao thông Vận tải" hoặc "Bộ GTVT" trong bối cảnh hiện hành, phải thay/chuẩn hóa thành "Bộ Xây dựng" nếu phù hợp ngữ cảnh.
4. Thuật ngữ ngành: hoa tiêu, mớn nước, luồng lạch, phao tiêu, lai dắt, an toàn hàng hải, cảng biển.

# CHUẨN BIÊN TẬP
Văn phong trang trọng, chính xác, phù hợp thông tin điện tử doanh nghiệp nhà nước; ưu tiên cấu trúc tiêu đề, sapo, thân bài, kết luận khi viết bài.`;

type Env = {
  GEMINI_API_KEY?: string;
  GEMINI_TEXT_MODEL?: string;
  GEMINI_FALLBACK_MODEL?: string;
  GEMINI_PRO_MODEL?: string;
  GOOGLE_DRIVE_API_KEY?: string;
};

type PagesContext = {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
};

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/api';

  if (request.method === 'OPTIONS') return empty(204);

  try {
    if (request.method === 'GET' && pathname === '/api/health') return handleHealth(env);
    if (request.method === 'GET' && pathname === '/api/fetch-link') return await handleFetchLink(request);
    if (request.method === 'GET' && pathname === '/api/user-ai-key/status') return handleUserAIKeyStatus(env);
    if (request.method === 'DELETE' && pathname === '/api/user-ai-key') return handleDeleteUserAIKey();

    if (request.method === 'POST' && pathname === '/api/ai/process') return await handleAIProcess(request, env);
    if (request.method === 'POST' && pathname === '/api/ai/search') return await handleAISearch(request, env);
    if (request.method === 'POST' && pathname === '/api/tasks/build') return await handleTasksBuild(request, env);
    if (request.method === 'POST' && pathname === '/api/editorial-images/plan') return await handleEditorialImagesPlan(request, env);
    if (request.method === 'POST' && pathname === '/api/editorial-images/generate') return handleEditorialImagesGenerateDisabled();
    if (request.method === 'POST' && pathname === '/api/user-ai-key/test') return await handleUserAIKeyTest(request);
    if (request.method === 'POST' && pathname === '/api/user-ai-key/save') return handleUserAIKeySaveUnsupported();
    if (request.method === 'POST' && pathname === '/api/drive/inspect-public-link') return await handleDriveInspectPublicLink(request, env);
    if (request.method === 'POST' && pathname === '/api/drive/import-public-link') return await handleDriveImportPublicLink(request, env);
    if (request.method === 'POST' && pathname === '/api/drive/sync-public-folder') return await handleDriveSyncPublicFolder(request, env);

    const documentAnalyzeMatch = pathname.match(/^\/api\/documents\/([^/]+)\/analyze$/);
    if (request.method === 'POST' && documentAnalyzeMatch) return await handleDocumentAnalyze(request, env);

    return json({
      success: false,
      errorType: 'METHOD_NOT_ALLOWED',
      error: `Endpoint ${request.method} ${pathname} chưa được hỗ trợ trên Cloudflare Pages Functions.`,
      message: `Endpoint ${request.method} ${pathname} chưa được hỗ trợ trên Cloudflare Pages Functions.`,
    }, 405);
  } catch (error: any) {
    const message = error?.message || 'Lỗi server không xác định.';
    const status = inferStatusFromError(message);
    return json({
      success: false,
      errorType: status === 401 ? 'UNAUTHORIZED' : status === 429 ? 'QUOTA_EXHAUSTED' : 'SERVER_ERROR',
      error: message,
      message,
    }, status);
  }
}

function handleHealth(env: Env): Response {
  const hasGeminiKey = isRealKey(env.GEMINI_API_KEY);
  return json({
    ok: true,
    status: 'ok',
    runtime: 'cloudflare-pages-functions',
    hasSystemGeminiKey: hasGeminiKey,
    hasGeminiKey,
    hasGoogleDriveKey: isRealKey(env.GOOGLE_DRIVE_API_KEY),
    textModel: env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
    fallbackModel: env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash',
    fallbackChain: getFallbackModels(env, env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash'),
  });
}

function handleUserAIKeyStatus(env: Env): Response {
  return json({
    hasKey: false,
    useSystem: true,
    provider: 'gemini',
    model: env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
    status: isRealKey(env.GEMINI_API_KEY) ? 'system_key_ready' : 'missing_system_key',
  });
}

function handleDeleteUserAIKey(): Response {
  return json({ success: true, message: 'Cloudflare Pages đang dùng API key hệ thống; không có API key cá nhân để xóa.' });
}

async function handleUserAIKeyTest(request: Request): Promise<Response> {
  const body = await readJson(request);
  const apiKey = String(body?.apiKey || '').trim();
  const model = normalizeModelName(body?.model || 'gemini-2.5-flash');

  if (!isRealKey(apiKey)) {
    return json({ success: false, errorType: 'missing_key', message: 'Vui lòng nhập API key Gemini hợp lệ.' }, 400);
  }

  const text = await callGeminiText({
    apiKey,
    model,
    systemInstruction: 'Trả lời ngắn gọn bằng tiếng Việt.',
    prompt: 'Kiểm tra kết nối. Hãy trả lời: Kết nối Gemini thành công.',
    temperature: 0,
    maxOutputTokens: 128,
  });

  return json({ success: true, message: text || 'Kết nối Gemini thành công.' });
}

function handleUserAIKeySaveUnsupported(): Response {
  return json({
    success: false,
    errorType: 'not_supported_on_cloudflare_pages',
    message: 'Bản Cloudflare Pages chưa hỗ trợ lưu API key cá nhân. Hãy cấu hình GEMINI_API_KEY trong Cloudflare Variables/Secrets.',
  }, 501);
}

async function handleAIProcess(request: Request, env: Env): Promise<Response> {
  requireAuthHeader(request);
  const apiKey = requireGeminiKey(env);
  const body = await readJson(request);
  const taskType = String(body?.taskType || 'WRITE_NEW');
  const content = String(body?.content || '').trim();
  const style = String(body?.style || 'FORMAL');
  const format = String(body?.format || 'ARTICLE');
  const sources = Array.isArray(body?.sources) ? body.sources : [];

  if (!content) return json({ success: false, error: 'Thiếu nội dung/yêu cầu cần xử lý.', message: 'Thiếu nội dung/yêu cầu cần xử lý.' }, 400);

  const sourceContext = sources.length > 0
    ? `\n\nDANH SÁCH TÀI LIỆU THAM KHẢO:\n${sources.map((s: any) => `--- [${safeText(s?.name, 120)}] ---\n${safeText(s?.content, 12000)}`).join('\n')}`
    : '';

  const today = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const prompt = `Hôm nay là ngày: ${today}\nTác vụ: [${taskType}]\nVăn phong: [${style}]\nHình thức: [${format}]\n\nNội dung/Yêu cầu:\n${content}${sourceContext}`;

  const model = getDynamicModel(env, content, taskType);
  const text = await callGeminiTextWithFallback({
    apiKey,
    model,
    fallbackModels: getFallbackModels(env, model),
    systemInstruction: SYSTEM_INSTRUCTION + '\n\nLƯU Ý QUAN TRỌNG: Tuyệt đối không để sót cụm từ "Bộ Giao thông Vận tải" hoặc "Bộ GTVT" trong văn bản hiện hành; phải thay bằng "Bộ Xây dựng" khi phù hợp ngữ cảnh.',
    prompt,
    temperature: taskType === 'SYNTHESIZE' ? 0.3 : 0.2,
    maxOutputTokens: 8192,
  });

  return json({ text: normalizeVietnamTransportMinistry(text) });
}

async function handleAISearch(request: Request, env: Env): Promise<Response> {
  requireAuthHeader(request);
  const apiKey = requireGeminiKey(env);
  const body = await readJson(request);
  const query = String(body?.query || '').trim();
  if (!query) return json({ success: false, error: 'Thiếu từ khóa tìm kiếm.', message: 'Thiếu từ khóa tìm kiếm.' }, 400);

  const searchModel = normalizeModelName(env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash');
  const result = await callGeminiRawWithFallback({
    apiKey,
    model: searchModel,
    fallbackModels: getFallbackModels(env, searchModel),
    systemInstruction: 'Bạn là chuyên gia nghiên cứu tư liệu báo chí cho Công ty Hoa tiêu hàng hải miền Bắc. Ưu tiên thông tin chính xác, cập nhật, có nguồn tin cậy.',
    prompt: `Tìm kiếm/tổng hợp chi tiết về: ${query}. Trả về bản tóm tắt ngắn gọn và các nguồn/đường dẫn nếu có. Không bịa nguồn.`,
    temperature: 0,
    maxOutputTokens: 2048,
    tools: [{ googleSearch: {} }],
  });

  return json({
    text: extractGeminiText(result),
    groundingMetadata: result?.candidates?.[0]?.groundingMetadata,
  });
}

async function handleTasksBuild(request: Request, env: Env): Promise<Response> {
  requireAuthHeader(request);
  const apiKey = requireGeminiKey(env);
  const body = await readJson(request);
  const text = String(body?.text || '').trim();
  const today = String(body?.today || new Date().toISOString().slice(0, 10));
  const timezone = String(body?.timezone || 'Asia/Ho_Chi_Minh');

  if (!text) return json({ success: false, error: 'Thiếu nội dung mô tả công việc.', message: 'Thiếu nội dung mô tả công việc.' }, 400);

  const prompt = `Phân tích nội dung sau để trích xuất danh sách công việc cho Công ty Hoa tiêu hàng hải miền Bắc.\nNgày hiện tại: ${today}. Múi giờ: ${timezone}.\n\nDanh mục lĩnh vực hợp lệ:\n- LV_DH: Điều hành sản xuất\n- LV_AT: An toàn hàng hải\n- LV_KT: Kỹ thuật - Vật tư\n- LV_TC: Tài chính - Kế toán\n- LV_TCCB: Tổ chức cán bộ - Lao động\n- LV_PCTTra: Pháp chế - Thanh tra\n- LV_KHDN: Kế hoạch - Kinh doanh\n- LV_HTQT: Hợp tác quốc tế\n- LV_VPDT: Văn phòng - Đoàn thể\n\nYêu cầu trả về JSON thuần, không markdown, dạng:\n{ "tasks": [ { "title": "...", "description": "...", "assignee": "", "dueDate": "YYYY-MM-DD hoặc rỗng", "priority": "low|medium|high|urgent", "status": "todo", "categoryCode": "LV_DH", "isDeputy": false } ] }\n\nNội dung:\n${text}`;

  const taskModel = normalizeModelName(env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash');
  const raw = await callGeminiTextWithFallback({
    apiKey,
    model: taskModel,
    fallbackModels: getFallbackModels(env, taskModel),
    systemInstruction: 'Bạn là trợ lý lập kế hoạch công việc. Chỉ trả JSON hợp lệ, không giải thích.',
    prompt,
    temperature: 0.1,
    maxOutputTokens: 4096,
  });

  const data = extractJson(raw);
  const validCodes = new Set(['LV_DH', 'LV_AT', 'LV_KT', 'LV_TC', 'LV_TCCB', 'LV_PCTTra', 'LV_KHDN', 'LV_HTQT', 'LV_VPDT']);
  const tasks = (Array.isArray(data?.tasks) ? data.tasks : []).slice(0, 30).map((task: any) => ({
    title: safeText(task?.title || 'Công việc mới', 200),
    description: safeText(task?.description || '', 2000),
    assignee: safeText(task?.assignee || '', 120),
    dueDate: safeText(task?.dueDate || '', 30),
    priority: ['low', 'medium', 'high', 'urgent'].includes(task?.priority) ? task.priority : 'medium',
    status: ['todo', 'in_progress', 'done'].includes(task?.status) ? task.status : 'todo',
    categoryCode: validCodes.has(task?.categoryCode) ? task.categoryCode : 'LV_DH',
    isDeputy: Boolean(task?.isDeputy),
  }));

  return json({ tasks });
}

async function handleEditorialImagesPlan(request: Request, env: Env): Promise<Response> {
  requireAuthHeader(request);
  const apiKey = requireGeminiKey(env);
  const body = await readJson(request);
  const content = String(body?.content || '').trim();
  const existingAnalysis = body?.existingAnalysis || {};

  if (!content) return json({ success: false, error: 'Thiếu nội dung bài viết để lập kế hoạch ảnh.', message: 'Thiếu nội dung bài viết để lập kế hoạch ảnh.' }, 400);

  const prompt = `Phân tích bài viết sau và đề xuất tối đa 4 vị trí minh họa phù hợp.\nTránh đề xuất trùng các vị trí đã có trong phân tích cục bộ sau: ${JSON.stringify(existingAnalysis).slice(0, 4000)}\n\nChỉ trả JSON thuần dạng:\n{ "plans": [ { "paragraphIndex": 0, "insertAfter": "câu/đoạn neo", "caption": "chú thích hình", "prompt": "mô tả hình cần tìm/tải", "reason": "lý do", "priority": "high|medium|low" } ], "notes": ["..."] }\n\nBài viết:\n${content.slice(0, 30000)}`;

  const imagePlanModel = normalizeModelName(env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash');
  const raw = await callGeminiTextWithFallback({
    apiKey,
    model: imagePlanModel,
    fallbackModels: getFallbackModels(env, imagePlanModel),
    systemInstruction: 'Bạn là biên tập viên ảnh minh họa báo chí. Chỉ trả JSON hợp lệ, không markdown.',
    prompt,
    temperature: 0.2,
    maxOutputTokens: 2048,
  });

  const data = extractJson(raw);
  const plans = (Array.isArray(data?.plans) ? data.plans : []).slice(0, 4).map((p: any, idx: number) => ({
    id: `plan-${Date.now()}-${idx}`,
    paragraphIndex: Number.isFinite(Number(p?.paragraphIndex)) ? Number(p.paragraphIndex) : 0,
    insertAfter: safeText(p?.insertAfter || '', 400),
    caption: safeText(p?.caption || 'Hình minh họa hoạt động hàng hải', 300),
    prompt: safeText(p?.prompt || 'Ảnh minh họa phù hợp nội dung bài viết', 1000),
    reason: safeText(p?.reason || 'Bổ sung minh họa phù hợp nội dung bài.', 500),
    priority: ['high', 'medium', 'low'].includes(p?.priority) ? p.priority : 'medium',
  }));

  return json({ plans, notes: Array.isArray(data?.notes) ? data.notes.map((n: any) => String(n)).slice(0, 8) : [] });
}

function handleEditorialImagesGenerateDisabled(): Response {
  return json({
    success: false,
    errorType: 'function_disabled',
    error: 'Chức năng tạo hình ảnh AI đã được gỡ bỏ. Vui lòng tải ảnh thủ công.',
    message: 'Chức năng tạo hình ảnh AI đã được gỡ bỏ. Vui lòng tải ảnh thủ công.',
  }, 410);
}

async function handleFetchLink(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const inputUrl = String(url.searchParams.get('url') || '').trim();
  if (!inputUrl) return json({ success: false, error: 'URL is required', message: 'URL is required' }, 400);
  const safeUrl = assertSafeHttpUrl(inputUrl);

  const resp = await fetch(safeUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 HoaTieuEditorialBot/1.0' },
    redirect: 'follow',
  });
  if (!resp.ok) return json({ success: false, error: `Không thể tải link: HTTP ${resp.status}`, message: `Không thể tải link: HTTP ${resp.status}` }, 400);

  const html = await resp.text();
  const title = pickMeta(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || safeUrl;
  const description = pickMeta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) || pickMeta(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i) || '';
  const faviconRaw = pickMeta(html, /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']*)["'][^>]*>/i) || '';
  let favicon = '';
  if (faviconRaw) {
    try { favicon = faviconRaw.startsWith('http') ? faviconRaw : new URL(faviconRaw, safeUrl).href; } catch {}
  }
  const content = htmlToText(html).slice(0, 15000);

  return json({ title: decodeHtml(title), description: decodeHtml(description), favicon, content, url: safeUrl });
}

async function handleDriveInspectPublicLink(request: Request, env: Env): Promise<Response> {
  const apiKey = requireDriveKey(env);
  const body = await readJson(request);
  const url = String(body?.url || '').trim();
  const fileId = extractDriveFileId(url);
  if (!fileId) return json({ success: false, error: 'Không nhận diện được Google Drive fileId từ link.', message: 'Không nhận diện được Google Drive fileId từ link.' }, 400);
  const metadata = await getDriveMetadata(fileId, apiKey);
  return json({ success: true, file: metadata });
}

async function handleDriveImportPublicLink(request: Request, env: Env): Promise<Response> {
  const apiKey = requireDriveKey(env);
  const body = await readJson(request);
  const url = String(body?.url || '').trim();
  const fileId = extractDriveFileId(url);
  if (!fileId) return json({ success: false, error: 'Không nhận diện được Google Drive fileId từ link.', message: 'Không nhận diện được Google Drive fileId từ link.' }, 400);

  const metadata = await getDriveMetadata(fileId, apiKey);
  const content = await downloadDriveText(fileId, metadata.mimeType, apiKey);

  return json({
    success: true,
    document: {
      name: metadata.name,
      content,
      type: 'drive',
      sourceType: classifyDriveSourceType(metadata.mimeType),
      category: 'PROJECT',
      driveFileId: fileId,
      driveMimeType: metadata.mimeType,
      driveWebViewLink: metadata.webViewLink,
      contentStatus: content ? 'full' : 'metadata_only',
      metadata,
    },
    message: 'Đã đọc metadata/nội dung từ Google Drive. Bản Cloudflare trả tài liệu về frontend; nếu cần lưu tự động vào Firestore, cần bổ sung logic phía frontend.',
  });
}

async function handleDriveSyncPublicFolder(request: Request, env: Env): Promise<Response> {
  const apiKey = requireDriveKey(env);
  const body = await readJson(request);
  const folderId = String(body?.folderId || body?.id || '').trim() || extractDriveFileId(String(body?.url || ''));
  if (!folderId) return json({ success: false, error: 'Thiếu Google Drive folderId.', message: 'Thiếu Google Drive folderId.' }, 400);

  const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
  listUrl.searchParams.set('key', apiKey);
  listUrl.searchParams.set('q', `'${folderId}' in parents and trashed=false`);
  listUrl.searchParams.set('fields', 'files(id,name,mimeType,webViewLink,iconLink,thumbnailLink,size,modifiedTime),nextPageToken');
  listUrl.searchParams.set('pageSize', '100');

  const resp = await fetch(listUrl.toString());
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return json({ success: false, error: data?.error?.message || `Drive API error ${resp.status}`, message: data?.error?.message || `Drive API error ${resp.status}` }, resp.status);
  return json({ files: data.files || [], nextPageToken: data.nextPageToken });
}

async function handleDocumentAnalyze(request: Request, env: Env): Promise<Response> {
  requireAuthHeader(request);
  const apiKey = requireGeminiKey(env);
  const body = await readJson(request);
  const content = String(body?.content || body?.text || '').trim();
  if (!content) return json({ success: false, error: 'Thiếu nội dung tài liệu để phân tích.', message: 'Thiếu nội dung tài liệu để phân tích.' }, 400);

  const prompt = `Phân tích tài liệu sau cho kho tư liệu văn phòng. Chỉ trả JSON thuần dạng:\n{ "summary": { "short": "...", "mainPoints": ["..."], "entities": { "people": [], "organizations": [], "locations": [], "vessels": [], "dates": [] }, "sourceLimitNote": null }, "documentKind": "khac", "taskCategoryCode": "LV_DH" }\n\nTài liệu:\n${content.slice(0, 30000)}`;
  const analyzeModel = normalizeModelName(env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash');
  const raw = await callGeminiTextWithFallback({
    apiKey,
    model: analyzeModel,
    fallbackModels: getFallbackModels(env, analyzeModel),
    systemInstruction: 'Bạn là chuyên gia phân loại và tóm tắt tài liệu. Chỉ trả JSON hợp lệ.',
    prompt,
    temperature: 0.1,
    maxOutputTokens: 2048,
  });

  return json(extractJson(raw));
}

async function callGeminiTextWithFallback(args: {
  apiKey: string;
  model: string;
  fallbackModels?: string[];
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: any[];
}): Promise<string> {
  const data = await callGeminiRawWithFallback(args);
  const text = extractGeminiText(data);
  if (!text) {
    throw new Error('Gemini đã phản hồi nhưng nội dung rỗng. Vui lòng thử lại với yêu cầu rõ hơn.');
  }
  return text;
}

async function callGeminiRawWithFallback(args: {
  apiKey: string;
  model: string;
  fallbackModels?: string[];
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: any[];
}): Promise<any> {
  const models = uniqueModels([args.model, ...(args.fallbackModels || [])]);
  let lastError: any = null;

  for (const model of models) {
    try {
      return await callGeminiRaw({ ...args, model });
    } catch (error: any) {
      lastError = error;
      const message = String(error?.message || '');
      const canFallback = /model|not found|not supported|quota|RESOURCE_EXHAUSTED|429|503|500/i.test(message);
      if (!canFallback) break;
    }
  }

  throw lastError || new Error('Không gọi được Gemini API.');
}

async function callGeminiText(args: {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const data = await callGeminiRaw(args);
  return extractGeminiText(data);
}

async function callGeminiRaw(args: {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: any[];
}): Promise<any> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent`;
  const body: any = {
    contents: [{ role: 'user', parts: [{ text: args.prompt }] }],
    generationConfig: {
      temperature: args.temperature ?? 0.2,
      maxOutputTokens: args.maxOutputTokens ?? 4096,
    },
  };
  if (args.systemInstruction) body.systemInstruction = { parts: [{ text: args.systemInstruction }] };
  if (args.tools) body.tools = args.tools;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': args.apiKey,
    },
    body: JSON.stringify(body),
  });
  const responseText = await resp.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { raw: responseText };
  }

  if (!resp.ok) {
    const message = data?.error?.message || data?.raw || `Gemini API error ${resp.status}`;
    const isQuota = resp.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(message);
    const isModelError = resp.status === 404 || /model|not found|not supported/i.test(message);

    if (isQuota) {
      throw new Error(`Hạn mức AI tạm thời hết hoặc API key chưa đủ quota cho model ${args.model}.`);
    }
    if (isModelError) {
      throw new Error(`Model Gemini không khả dụng với API key hiện tại: ${args.model}.`);
    }
    throw new Error(`Gemini API error ${resp.status}: ${message}`);
  }
  return data;
}

function requireGeminiKey(env: Env): string {
  const key = String(env.GEMINI_API_KEY || '').trim();
  if (!isRealKey(key)) {
    throw new Error('Server Cloudflare chưa cấu hình GEMINI_API_KEY. Vào Cloudflare Pages → Settings → Variables and Secrets để thêm secret này rồi redeploy.');
  }
  return key;
}

function requireDriveKey(env: Env): string {
  const key = String(env.GOOGLE_DRIVE_API_KEY || '').trim();
  if (!isRealKey(key)) throw new Error('Server Cloudflare chưa cấu hình GOOGLE_DRIVE_API_KEY.');
  return key;
}

function requireAuthHeader(request: Request): void {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    throw new Error('Thiếu thông tin đăng nhập. Vui lòng đăng nhập lại rồi thử tiếp.');
  }
}

function getDynamicModel(env: Env, content: string, taskType: string): string {
  if (taskType === 'SYNTHESIZE' || content.length > 12000) return normalizeModelName(env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash');
  return normalizeModelName(env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash');
}

function getFallbackModels(env: Env, primaryModel: string): string[] {
  return uniqueModels([
    primaryModel,
    env.GEMINI_FALLBACK_MODEL || '',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash',
  ]);
}

function uniqueModels(models: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const model of models) {
    const normalized = normalizeModelName(model || '');
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function inferStatusFromError(message: string): number {
  if (/thiếu thông tin đăng nhập|unauthorized|authorization/i.test(message)) return 401;
  if (/thiếu|không hợp lệ|validation/i.test(message)) return 400;
  if (/hạn mức|quota|RESOURCE_EXHAUSTED|429/i.test(message)) return 429;
  return 500;
}

function normalizeModelName(model: string): string {
  return String(model || 'gemini-2.5-flash').replace(/^models\//, '').trim();
}

function extractGeminiText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p: any) => p?.text || '').join('').trim();
}

function extractJson(text: string): any {
  const cleaned = String(text || '').replace(/```json/gi, '```').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  return {};
}

function normalizeVietnamTransportMinistry(text: string): string {
  return String(text || '').replace(/Bộ Giao thông Vận tải/g, 'Bộ Xây dựng').replace(/Bộ GTVT/g, 'Bộ Xây dựng');
}

function safeText(value: any, maxLength: number): string {
  return String(value || '').slice(0, maxLength);
}

function isRealKey(key?: string): boolean {
  const value = String(key || '').trim();
  return Boolean(value && !value.includes('your_') && value !== 'MY_GEMINI_API_KEY' && value !== 'YOUR_GOOGLE_API_KEY');
}

async function readJson(request: Request): Promise<any> {
  try { return await request.json(); } catch { return {}; }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function empty(status = 204): Response {
  return new Response(null, { status, headers: corsHeaders() });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function assertSafeHttpUrl(inputUrl: string): string {
  const normalized = inputUrl.startsWith('www.') ? `https://${inputUrl}` : inputUrl;
  const url = new URL(normalized);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Chỉ hỗ trợ URL http/https.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) throw new Error('URL không được phép.');
  return url.toString();
}

function pickMeta(html: string, regex: RegExp): string {
  const match = html.match(regex);
  return match?.[1]?.trim() || '';
}

function htmlToText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function decodeHtml(text: string): string {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractDriveFileId(input: string): string {
  if (!input) return '';
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

async function getDriveMetadata(fileId: string, apiKey: string): Promise<any> {
  const metadataUrl = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  metadataUrl.searchParams.set('key', apiKey);
  metadataUrl.searchParams.set('fields', 'id,name,mimeType,webViewLink,webContentLink,iconLink,thumbnailLink,size,modifiedTime');
  const resp = await fetch(metadataUrl.toString());
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error?.message || `Drive API error ${resp.status}`);
  return data;
}

async function downloadDriveText(fileId: string, mimeType: string, apiKey: string): Promise<string> {
  let downloadUrl = '';
  if (mimeType === 'application/vnd.google-apps.document') {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain&key=${encodeURIComponent(apiKey)}`;
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/csv&key=${encodeURIComponent(apiKey)}`;
  } else if (mimeType === 'application/vnd.google-apps.presentation') {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain&key=${encodeURIComponent(apiKey)}`;
  } else if (/^text\//.test(mimeType) || /json|csv|xml|markdown/.test(mimeType)) {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`;
  } else {
    return '';
  }

  const resp = await fetch(downloadUrl);
  if (!resp.ok) return '';
  return (await resp.text()).slice(0, 50000);
}

function classifyDriveSourceType(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.document') return 'google_docs';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'google_sheets';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'google_slides';
  if (mimeType === 'application/pdf') return 'google_pdf';
  if (mimeType?.startsWith('image/')) return 'google_image';
  return 'google_drive_file';
}
