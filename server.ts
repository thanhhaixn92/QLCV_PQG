import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dns from 'dns/promises';
import net from 'net';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import admin from 'firebase-admin';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

export type LibrarySourceType =
  | 'upload'
  | 'web_link'
  | 'google_drive_folder'
  | 'google_drive_file'
  | 'google_docs'
  | 'google_sheets'
  | 'google_slides'
  | 'google_pdf'
  | 'text';

export interface DocumentSource {
  id: string;
  name: string;
  content: string;
  type: 'word' | 'pdf' | 'excel' | 'link' | 'text' | 'drive';
  sourceType?: LibrarySourceType;
  category: 'GENERAL' | 'PROJECT';
  collectionId?: string;
  driveFileId?: string;
  driveMimeType?: string;
  driveIconUrl?: string;
  driveThumbnailUrl?: string;
  driveWebViewLink?: string;
  driveSize?: string;
  contentStatus?: 'metadata_only' | 'extracting' | 'extracted' | 'summary_only' | 'unavailable' | 'error';
  documentKind?: string;
  taskCategoryCode?: string;
  summary?: any;
  metadata?: any;
  ownerId?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Initialization constants
const DEFAULT_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const DEFAULT_PRO_MODEL = process.env.GEMINI_PRO_MODEL || 'gemini-2.5-pro';
const DEFAULT_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite';

// Initialize Firebase Admin
const targetProjectId = (process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId || '').trim();

const configuredDatabaseId =
  (process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)').trim();

const normalizedDatabaseId =
  !configuredDatabaseId || configuredDatabaseId === 'default'
    ? '(default)'
    : configuredDatabaseId;

if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      projectId: targetProjectId
    });
    console.log(`[Firebase Admin] App initialized for project: ${targetProjectId}`);
  } catch (err) {
    console.error('[Firebase Admin] Initialization failed:', err);
  }
}

const firebaseApp = admin.app();

// We use getFirestore(app, databaseId) to ensure we use the correct database
import { getFirestore } from 'firebase-admin/firestore';

let db: admin.firestore.Firestore;
let firestoreReady = false;
let firestoreError: string | null = null;
let firestoreErrorType: string | null = null;
let actualFirestoreDatabaseId = normalizedDatabaseId;

try {
  db =
    normalizedDatabaseId === '(default)'
      ? getFirestore(firebaseApp)
      : getFirestore(firebaseApp, normalizedDatabaseId);

  console.log(`[Firestore] Initialized project=${targetProjectId}, database=${normalizedDatabaseId}`);
} catch (err: any) {
  firestoreReady = false;
  firestoreError = err?.message || String(err);
  firestoreErrorType = 'firestore_init_failed';

  console.error('[Firestore] Initialization failed:', {
    projectId: targetProjectId,
    databaseId: normalizedDatabaseId,
    message: firestoreError
  });

  throw err;
}

function classifyFirestoreError(error: any) {
  const message = String(error?.message || '');
  const code = error?.code || error?.status || '';

  if (code === 5 || message.includes('NOT_FOUND') || message.toLowerCase().includes('not found')) {
    return {
      errorType: 'firestore_database_not_found',
      message: `Firestore database "${normalizedDatabaseId}" không tồn tại hoặc backend không có quyền truy cập trong project "${targetProjectId}".`
    };
  }

  if (code === 7 || message.toLowerCase().includes('permission')) {
    return {
      errorType: 'firestore_permission_denied',
      message: 'Backend không có quyền truy cập Firestore database hiện tại.'
    };
  }

  return {
    errorType: 'firestore_unavailable',
    message: 'Firestore chưa sẵn sàng hoặc không truy cập được.'
  };
}

// Self-test helper to verify permissions on boot
async function verifyFirestoreAccess() {
  try {
    // Connectivity check - limit(1) for speed
    await db.collection('_health').limit(1).get();
    firestoreReady = true;
    firestoreError = null;
    firestoreErrorType = null;
    console.log(`[Firestore] Connectivity verified successfully: project=${targetProjectId}, database=${normalizedDatabaseId}`);
  } catch (err: any) {
    const classified = classifyFirestoreError(err);
    firestoreReady = false;
    firestoreError = classified.message;
    firestoreErrorType = classified.errorType;

    console.error('[Firestore] Connectivity failed:', {
      projectId: targetProjectId,
      databaseId: normalizedDatabaseId,
      errorType: firestoreErrorType,
      message: firestoreError
    });
  }
}
verifyFirestoreAccess();

function ensureFirestoreReady(res: express.Response) {
  if (firestoreReady) return true;

  res.status(503).json({
    success: false,
    errorType: firestoreErrorType || 'firestore_unavailable',
    message:
      firestoreError ||
      'Firestore chưa sẵn sàng. Vui lòng kiểm tra FIRESTORE_DATABASE_ID và Firebase project.',
    firestore: {
      projectId: targetProjectId,
      firestoreDatabaseId: normalizedDatabaseId,
      actualFirestoreDatabaseId,
      firestoreReady
    }
  });

  return false;
}

// Middleware to catch Firestore errors globally if needed
function logFirestoreError(context: string, error: any) {
  console.error(`[Firestore Error - ${context}]:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    stack: error.stack?.split('\n').slice(0, 3).join('\n')
  });
}

// Encryption Utils
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

function encryptApiKey(text: string) {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!secret) return null;
  
  // Secret must be 32 bytes for aes-256-cbc
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptApiKey(encryptedData: string | null | undefined) {
  if (!encryptedData) return null;
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!secret) return null;

  try {
    const key = crypto.createHash('sha256').update(secret).digest();
    const [ivHex, encryptedHex] = encryptedData.split(':');
    if (!ivHex || !encryptedHex) return null;
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption Error:', err);
    return null;
  }
}

function maskApiKey(key: string) {
  if (!key || key.length < 8) return '••••••••';
  return '••••••••' + key.slice(-4);
}

// Utility to verify Firebase Token and get UID
async function getUserIdFromRequest(req: express.Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1];
  if (!token) return null;
  try {
    const decodedToken = await firebaseApp.auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (err: any) {
    console.error('[Auth] Token verification failed:', err?.message || err);
    return null;
  }
}

function getSystemGeminiApiKey() {
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const googleKey = process.env.GOOGLE_API_KEY || '';

  const isRealKey = (key: string) =>
    !!key &&
    !key.includes('your_gemini_api_key') &&
    key !== 'MY_GEMINI_API_KEY' &&
    key !== 'YOUR_GOOGLE_API_KEY' &&
    key.length > 20;

  if (isRealKey(geminiKey)) return geminiKey;
  if (isRealKey(googleKey)) return googleKey;
  return '';
}

async function resolveActiveAIConfig(userId: string | null): Promise<{
  apiKey: string;
  model: string;
  provider: string;
  source: string;
  personalKeyError?: string;
}> {
  const systemApiKey = getSystemGeminiApiKey();
  const systemConfig = {
    apiKey: systemApiKey,
    model: normalizeModelName(DEFAULT_TEXT_MODEL, 'gemini-2.5-flash'),
    provider: 'gemini',
    source: 'system'
  };

  if (!userId || !firestoreReady) return systemConfig;

  try {
    const userKeyDoc = await db.collection('users').doc(userId).collection('settings').doc('aiKey').get();

    if (userKeyDoc.exists) {
      const data = userKeyDoc.data();

      if (data && data.status === 'active' && data.encryptedApiKey) {
        const decryptedKey = decryptApiKey(data.encryptedApiKey);

        if (!decryptedKey) {
          // If decryption fails, we report error but can fallback to system if system key exists
          return {
            apiKey: systemApiKey,
            model: systemConfig.model,
            provider: 'gemini',
            source: 'system',
            personalKeyError: 'decrypt_failed'
          };
        }

        return {
          apiKey: decryptedKey,
          model: normalizeModelName(data.model, systemConfig.model),
          provider: data.provider || 'gemini',
          source: 'personal'
        };
      }
    }
  } catch (err) {
    logFirestoreError('resolveActiveAIConfig', err);
  }

  return systemConfig;
}

function isPrivateIp(ip: string) {
  if (net.isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0;
  }
  if (net.isIP(ip) === 6) {
    return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
  }
  return true;
}

async function assertSafeUrl(rawUrl: string) {
  const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Chỉ hỗ trợ URL http/https');
  const records = await dns.lookup(parsed.hostname, { all: true });
  if (!records.length) throw new Error('Không phân giải được hostname');
  if (records.some(r => isPrivateIp(r.address))) throw new Error('URL nội bộ không được phép truy cập');
  return parsed.href;
}

function normalizeModelName(name: string | undefined, defaultModel: string): string {
  // Use the provided name or default. 
  // Clean up whitespace and case.
  let target = (name || defaultModel).trim().toLowerCase();
  
  // The SDK works with or without models/ prefix, but prefix is safer for some models
  if (!target.startsWith('models/')) {
    target = `models/${target}`;
  }
  
  // Ensure we don't have double prefix
  target = target.replace(/^models\/models\//, 'models/');
  
  return target;
}

function getAI(apiKeyOverride?: string) {
  const apiKey = apiKeyOverride || getSystemGeminiApiKey();

  if (!apiKey) {
    throw new Error('Missing or invalid server-side GEMINI_API_KEY or GOOGLE_API_KEY. Vui lòng cấu hình API Key thật trong phần Settings.');
  }

  // GoogleGenerativeAI constructor takes the API key string directly
  return new GoogleGenerativeAI(apiKey);
}

function extractJsonSafe(text: string) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {}

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    try { return JSON.parse(fenced[1].trim()); } catch {}
  }

  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(raw.slice(first, last + 1)); } catch (e) {
       // Deep clean attempt for tricky JSON
       const candidate = raw.slice(first, last + 1)
         .replace(/\\n/g, ' ')
         .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
         .trim();
       try { return JSON.parse(candidate); } catch {}
    }
  }

  return null;
}

async function generateChatJson(model: any, contents: any) {
  try {
    return await model.generateContent({
      contents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    });
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    const canRetry =
      msg.includes('responsemimetype') ||
      msg.includes('response mime') ||
      msg.includes('generationconfig') ||
      msg.includes('not supported');

    if (!canRetry) throw err;

    console.warn('[AI Chat] responseMimeType not supported, retrying without it...');
    return await model.generateContent({
      contents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 2048
      }
    });
  }
}

const SYSTEM_INSTRUCTION = `# VAI TRÒ VÀ NHIỆM VỤ CỐT LÕI (ROLE & CORE MISSION)
Bạn là "Trợ lý Văn phòng Công ty TNHH MTV Hoa tiêu hàng hải miền Bắc" - chuyên gia biên tập báo chí, chuẩn hóa văn bản và trợ lý quản lý công việc chuyên nghiệp.

# NGUỒN DỮ LIỆU (DATA SOURCES)
Khi người dùng cung cấp tài liệu tham khảo, bạn PHẢI ưu tiên sử dụng thông tin và số liệu từ đó. Không bịa đặt thông tin.

# KIẾN THỨC NỀN TẢNG (CRITICAL CONTEXT)
1. Đơn vị: Công ty TNHH MTV Hoa tiêu hàng hải miền Bắc (Hoa Tiêu Miền Bắc).
2. Cơ quan chủ quản: Tổng công ty Bảo đảm an toàn hàng hải miền Bắc.
3. Chú ý sáp nhập: Kể từ ngày 01/03/2025, Bộ Giao thông Vận tải (Bộ GTVT) sáp nhập vào Bộ Xây dựng. Bạn PHẢI tự động sửa "Bộ GTVT" thành "Bộ Xây dựng" trong mọi văn bản.
4. Thuật ngữ ngành: Hoa tiêu, mớn nước, luồng lạch, phao tiêu, lai dắt, an toàn hàng hải, cảng biển...

# NHIỆM VỤ BIÊN TẬP (EDITORIAL STANDARDS)
- FORMAL, TECHNICAL, EDITORIAL, DYNAMISM.
- Luôn có TIÊU ĐỀ, SAPO, THÂN BÀI, KẾT LUẬN.

# NHIỆM VỤ QUẢN LÝ CÔNG VIỆC (TASK MANAGEMENT)
- Khi được yêu cầu tạo task (AI Task Builder), bạn phải phân tích văn bản để trích xuất: Tên công việc, Phụ trách, Hạn xử lý, Lĩnh vực, Chức danh kiêm nhiệm (nếu có).
- Luôn trả về mã lĩnh vực (categoryCode) khớp với danh sách 9 lĩnh vực của công ty.`;

function getDynamicModel(content: string, taskType: string): string {
  const complexityTriggers = ['đối soát', 'lập kế hoạch', 'phân tích sâu', 'so sánh', 'chi tiết', 'liên ngành', 'tổng hợp báo cáo năm'];
  const isComplexType = ['SYNTHESIZE', 'TASK_BUILDER'].includes(taskType);
  const isLong = content.length > 5000;
  const hasComplexityKeywords = complexityTriggers.some(word => content.toLowerCase().includes(word));

  if (isComplexType || isLong || hasComplexityKeywords) {
    return normalizeModelName(process.env.GEMINI_PRO_MODEL, 'gemini-2.5-pro');
  }
  return normalizeModelName(process.env.GEMINI_TEXT_MODEL, 'gemini-2.5-flash');
}

function classifyGeminiError(error: any) {
  const message = String(error?.message || '');
  const lower = message.toLowerCase();
  const status = Number(error?.status || error?.statusCode || 0);

  if (status === 429 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
    return { errorType: 'quota_exceeded', statusCode: 429, message: 'Hạn mức AI đã hết. Vui lòng thử lại sau.' };
  }

  if (
    status === 503 ||
    message.includes('503') ||
    lower.includes('service unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('high demand') ||
    lower.includes('model is currently')
  ) {
    return { errorType: 'high_demand', statusCode: 503, message: 'Dịch vụ AI đang quá tải. Hệ thống sẽ thử model dự phòng nếu có.' };
  }

  if (status === 404 || message.includes('404') || lower.includes('not found')) {
    return { errorType: 'model_not_found', statusCode: 404, message: 'Model AI đang chọn không khả dụng với API key hiện tại.' };
  }

  if (status === 401 || lower.includes('api key not valid') || lower.includes('invalid api key')) {
    return { errorType: 'invalid_api_key', statusCode: 401, message: 'API key AI không hợp lệ. Vui lòng kiểm tra Cài đặt/Tài khoản.' };
  }

  if (status === 403 || lower.includes('permission')) {
    return { errorType: 'permission_denied', statusCode: 403, message: 'API key hiện tại không có quyền dùng model này.' };
  }

  return { errorType: 'server_error', statusCode: 500, message: 'Không thể kết nối với máy chủ AI. Vui lòng thử lại sau.' };
}

async function generateChatWithFallback(ai: GoogleGenerativeAI, primaryModelId: string, contents: any, systemInstruction: string) {
  const tried: string[] = [];

  const runModel = async (modelId: string) => {
    tried.push(modelId);
    const model = ai.getGenerativeModel({
      model: modelId,
      systemInstruction
    });
    const result = await generateChatJson(model, contents);
    return { result, actualModel: modelId, triedModels: tried };
  };

  try {
    return await runModel(primaryModelId);
  } catch (primaryError: any) {
    const classified = classifyGeminiError(primaryError);
    const shouldFallback =
      classified.errorType === 'high_demand' ||
      classified.errorType === 'model_not_found' ||
      classified.errorType === 'permission_denied';

    const fallbackModel = normalizeModelName(DEFAULT_FALLBACK_MODEL, 'gemini-2.5-flash-lite');

    if (!shouldFallback || fallbackModel === primaryModelId) {
      throw primaryError;
    }

    console.warn('[AI Chat] Primary model failed, retrying fallback model', {
      errorType: classified.errorType,
      primaryModelId,
      fallbackModel
    });

    try {
      return await runModel(fallbackModel);
    } catch (fallbackError: any) {
      // If fallback also fails, we throw the original error if it was more descriptive, or the new one
      throw fallbackError;
    }
  }
}


async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  app.use(express.json({ limit: '2mb' }));

  // Middleware to tag API responses and ensure JSON for errors
  app.use('/api', (req, res, next) => {
    res.setHeader('X-API-Response', 'true');
    next();
  });

  app.get('/api/health', (req, res) => {
    const hasSystemGeminiKey = !!getSystemGeminiApiKey();

    res.json({
      ok: true,
      serverReady: true,
      hasGeminiKey: hasSystemGeminiKey,
      hasSystemGeminiKey,
      hasEncryptionSecret: !!process.env.AI_KEY_ENCRYPTION_SECRET,
      hasGoogleDriveKey: !!process.env.GOOGLE_DRIVE_API_KEY,
      imageGenerationEnabled: false,
      textModel: DEFAULT_TEXT_MODEL,
      proModel: DEFAULT_PRO_MODEL,
      fallbackModel: DEFAULT_FALLBACK_MODEL,
      firebaseProjectId: targetProjectId,
      firestoreDatabaseId: normalizedDatabaseId,
      actualFirestoreDatabaseId,
      firestoreReady,
      firestoreErrorType,
      firestoreError,
      sdk: '@google/generative-ai',
      timestamp: new Date().toISOString()
    });
  });

  // --- GOOGLE DRIVE INTEGRATION ---

  function parseFileId(url: string) {
    if (!url) return null;
    const patterns = [
      /drive\.google\.com\/file\/d\/([^/?]+)/,
      /drive\.google\.com\/open\?id=([^&]+)/,
      /drive\.google\.com\/uc\?id=([^&]+)/,
      /docs\.google\.com\/document\/d\/([^/?]+)/,
      /docs\.google\.com\/spreadsheets\/d\/([^/?]+)/,
      /docs\.google\.com\/presentation\/d\/([^/?]+)/,
      /drive\.google\.com\/drive\/folders\/([^/?]+)/
    ];

    for (const p of patterns) {
      const match = url.match(p);
      if (match) return match[1];
    }
    return null;
  }

  async function getDriveMetadata(fileId: string) {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey) throw new Error('Chưa cấu hình GOOGLE_DRIVE_API_KEY trên server.');

    const fields = 'id, name, mimeType, description, createdTime, modifiedTime, size, iconLink, thumbnailLink, webViewLink, webContentLink, exportLinks, parents, trashed';
    const response = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      params: { key: apiKey, fields },
      timeout: 10000
    });
    return response.data;
  }

  app.post('/api/drive/inspect-public-link', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { url } = req.body;
      const fileId = parseFileId(url);
      if (!fileId) return res.status(400).json({ error: 'URL không hợp lệ hoặc không phải link Google Drive.' });

      const metadata = await getDriveMetadata(fileId);
      res.json({ success: true, fileId, metadata });
    } catch (error: any) {
      console.error('Drive Inspect Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Không thể lấy thông tin từ Drive: ' + (error.response?.data?.error?.message || error.message) });
    }
  });

  app.post('/api/drive/import-public-link', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ success: false, errorType: 'unauthorized', message: 'Vui lòng đăng nhập để thực hiện tác vụ này.' });

      const { url, collectionId } = req.body;
      const fileId = parseFileId(url);
      if (!fileId) return res.status(400).json({ error: 'URL không hợp lệ hoặc không phải link Google Drive.' });

      const metadata = await getDriveMetadata(fileId);
      
      let content = '';
      let contentStatus: 'metadata_only' | 'extracting' | 'extracted' | 'summary_only' | 'unavailable' | 'error' = 'metadata_only';
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
      const mime = metadata.mimeType;

      // Determine sourceType and documentKind
      let sourceType: LibrarySourceType = 'google_drive_file';
      let documentKind: DocumentSource['documentKind'] = 'khac';
      
      if (mime === 'application/vnd.google-apps.folder') {
        sourceType = 'google_drive_folder';
      } else if (mime === 'application/vnd.google-apps.document') {
        sourceType = 'google_docs';
        documentKind = 'van_ban_chi_dao';
      } else if (mime === 'application/vnd.google-apps.spreadsheet') {
        sourceType = 'google_sheets';
        documentKind = 'bao_cao';
      } else if (mime === 'application/vnd.google-apps.presentation') {
        sourceType = 'google_slides';
      } else if (mime === 'application/pdf') {
        sourceType = 'google_pdf';
      }

      // Content extraction logic
      try {
        if (mime === 'application/vnd.google-apps.document') {
          const exportUrl = metadata.exportLinks?.['text/plain'];
          if (exportUrl) {
            const resp = await axios.get(exportUrl, { params: { key: apiKey } });
            content = resp.data;
            contentStatus = 'extracted';
          }
        } else if (mime === 'application/vnd.google-apps.spreadsheet') {
          const exportUrl = metadata.exportLinks?.['text/csv'];
          if (exportUrl) {
            const resp = await axios.get(exportUrl, { params: { key: apiKey } });
            content = resp.data;
            contentStatus = 'extracted';
          }
        } else if (mime === 'text/plain' || mime === 'text/markdown') {
          const resp = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`);
          content = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
          contentStatus = 'extracted';
        }
      } catch (e) {
        console.warn('Silent fail on content extraction:', e);
        contentStatus = 'unavailable';
        content = "Chưa trích xuất được nội dung. Có thể mở tài liệu bằng nút Mở Drive hoặc Xem trước.";
      }

      // Preview/Open URLs
      let previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      if (mime === 'application/vnd.google-apps.document') previewUrl = `https://docs.google.com/document/d/${fileId}/preview`;
      else if (mime === 'application/vnd.google-apps.spreadsheet') previewUrl = `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
      else if (mime === 'application/vnd.google-apps.presentation') previewUrl = `https://docs.google.com/presentation/d/${fileId}/preview`;
      else if (mime === 'application/vnd.google-apps.folder') previewUrl = `https://drive.google.com/drive/folders/${fileId}`;

      const docData: any = {
        name: metadata.name,
        type: 'drive',
        sourceType,
        documentKind,
        driveFileId: metadata.id,
        driveMimeType: metadata.mimeType,
        driveIconUrl: metadata.iconLink,
        driveThumbnailUrl: metadata.thumbnailLink,
        driveWebViewLink: metadata.webViewLink,
        driveSize: metadata.size,
        description: metadata.description || '',
        content: content.substring(0, 100000),
        contentStatus,
        collectionId: collectionId || 'lib-drive',
        ownerId: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          isGoogleDrive: true,
          driveId: metadata.id,
          createdTime: metadata.createdTime,
          modifiedTime: metadata.modifiedTime,
          openUrl: metadata.webViewLink,
          previewUrl: previewUrl,
          webContentLink: metadata.webContentLink,
          parentDriveFolderId: metadata.parents?.[0] || null,
          syncStatus: 'synced'
        }
      };

      const docRef = await db.collection('users').doc(userId).collection('documents').add(docData);
      
      // Auto-analyze
      let finalAnalysis = null;
      try {
        const aiConfig = await resolveActiveAIConfig(userId);
        const ai = getAI(aiConfig.apiKey);
        const model = ai.getGenerativeModel({ 
          model: aiConfig.model || 'gemini-2.0-flash',
          systemInstruction: "Bạn là chuyên gia phân tích tài liệu nghiệp vụ hàng hải."
        });
        
        const analyzePrompt = `Phân tích tài liệu: ${metadata.name}\nMime: ${mime}\nMô tả: ${metadata.description || ''}\nNội dung (trích): ${content.substring(0, 30000)}\n\nYêu cầu trả về JSON tóm tắt và phân loại (documentKind, taskCategoryCode).`;
        const result = await model.generateContent({
           contents: [{ role: 'user', parts: [{ text: analyzePrompt }] }],
           generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        });
        
        const aiRes = extractJsonSafe(result.response.text());
        finalAnalysis = {
          documentKind: aiRes.classification?.documentKind || documentKind,
          taskCategoryCode: aiRes.classification?.taskCategoryCode || 'LV_VPDT',
          summary: {
            ...aiRes.summary,
            generatedAt: Date.now(),
            model: aiConfig.model
          }
        };
        await docRef.update({ ...finalAnalysis, updatedAt: Date.now() });
      } catch (aiErr) {
        console.warn('Auto-analysis skipped or failed:', aiErr);
      }

      const finalDoc = { id: docRef.id, ...docData, ...(finalAnalysis || {}) };
      res.json({ success: true, id: docRef.id, document: finalDoc });
    } catch (error: any) {
      console.error('Drive Import Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Lỗi import Drive: ' + (error.response?.data?.error?.message || error.message) });
    }
  });

  app.post('/api/drive/sync-public-folder', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ success: false, errorType: 'unauthorized', message: 'Vui lòng đăng nhập.' });

      const { folderId, collectionId } = req.body;
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'Chưa cấu hình GOOGLE_DRIVE_API_KEY.' });

      let allFiles: any[] = [];
      let pageToken: string | undefined = undefined;

      do {
        const response: any = await axios.get(`https://www.googleapis.com/drive/v3/files`, {
          params: {
            q: `'${folderId}' in parents and trashed = false`,
            key: apiKey,
            fields: 'nextPageToken, files(id, name, mimeType, webViewLink, webContentLink, iconLink, thumbnailLink, modifiedTime, createdTime, size, description, parents)',
            pageSize: 100,
            pageToken
          },
          timeout: 30000
        });
        allFiles = allFiles.concat(response.data.files || []);
        pageToken = response.data.nextPageToken;
      } while (pageToken);

      const stats = { addedCount: 0, updatedCount: 0, missingCount: 0, failedCount: 0 };
      const folderCollectionPrefix = collectionId || 'lib-drive';

      const existingDocsSnap = await db.collection('users').doc(userId)
        .collection('documents')
        .where('collectionId', '==', folderCollectionPrefix)
        .get();
      
      const existingMap = new Map();
      existingDocsSnap.forEach(d => {
        const data = d.data();
        if (data.driveFileId) existingMap.set(data.driveFileId, { id: d.id, ...data });
      });

      const currentFileIds = new Set(allFiles.map(f => f.id));

      for (const f of allFiles) {
        try {
          const existing = existingMap.get(f.id);
          const previewUrl = f.mimeType === 'application/vnd.google-apps.document' 
            ? `https://docs.google.com/document/d/${f.id}/preview` : `https://drive.google.com/file/d/${f.id}/preview`;

          const docData: any = {
            name: f.name,
            driveMimeType: f.mimeType,
            driveIconUrl: f.iconLink,
            driveThumbnailUrl: f.thumbnailLink,
            driveWebViewLink: f.webViewLink,
            driveSize: f.size,
            updatedAt: Date.now(),
            metadata: {
              isGoogleDrive: true,
              driveId: f.id,
              modifiedTime: f.modifiedTime,
              createdTime: f.createdTime,
              description: f.description,
              parents: f.parents,
              openUrl: f.webViewLink,
              previewUrl: previewUrl,
              webContentLink: f.webContentLink,
              syncStatus: 'synced'
            }
          };

          if (existing) {
            if (existing.metadata?.modifiedTime !== f.modifiedTime) {
              await db.collection('users').doc(userId).collection('documents').doc(existing.id).update(docData);
              stats.updatedCount++;
            }
          } else {
            let sourceType: LibrarySourceType = 'google_drive_file';
            if (f.mimeType === 'application/vnd.google-apps.folder') sourceType = 'google_drive_folder';
            else if (f.mimeType === 'application/vnd.google-apps.document') sourceType = 'google_docs';
            else if (f.mimeType === 'application/vnd.google-apps.spreadsheet') sourceType = 'google_sheets';
            else if (f.mimeType === 'application/pdf') sourceType = 'google_pdf';

            const newDoc = {
              ...docData,
              type: 'drive',
              sourceType,
              documentKind: 'khac',
              driveFileId: f.id,
              content: f.mimeType.includes('folder') ? "" : "Chưa trích xuất được nội dung. Hãy mở tài liệu để AI có thể phân tích sâu hơn.",
              contentStatus: 'metadata_only',
              collectionId: folderCollectionPrefix,
              ownerId: userId,
              createdAt: Date.now()
            };
            await db.collection('users').doc(userId).collection('documents').add(newDoc);
            stats.addedCount++;
          }
        } catch (err) {
          stats.failedCount++;
        }
      }

      for (const [driveId, doc] of existingMap.entries()) {
        if (!currentFileIds.has(driveId) && doc.metadata?.syncStatus !== 'missing') {
          await db.collection('users').doc(userId).collection('documents').doc(doc.id).update({
            'metadata.syncStatus': 'missing',
            'updatedAt': Date.now()
          });
          stats.missingCount++;
        }
      }

      res.json({ success: true, addedCount: stats.addedCount, updatedCount: stats.updatedCount, missingCount: stats.missingCount, failedCount: stats.failedCount });
    } catch (error: any) {
      console.error('Folder Sync Error:', error);
      res.status(500).json({ error: 'Lỗi đồng bộ thư mục.' });
    }
  });

  app.post('/api/documents/:documentId/analyze', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { documentId } = req.params;
      const docRef = db.collection('users').doc(userId).collection('documents').doc(documentId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) return res.status(404).json({ error: 'Không tìm thấy tài liệu.' });
      
      const docData = docSnap.data();
      let contentToAnalyze = docData?.content || '';
      
      // If content is empty and it's a Drive doc, try fetching it now
      if (!contentToAnalyze && docData?.type === 'drive' && docData?.driveFileId) {
        const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
        const mime = docData.driveMimeType;
        const fileId = docData.driveFileId;
        
        try {
          if (mime === 'application/vnd.google-apps.document') {
             const meta = await getDriveMetadata(fileId);
             const exportUrl = meta.exportLinks?.['text/plain'];
             if (exportUrl) {
                const resp = await axios.get(exportUrl, { params: { key: apiKey } });
                contentToAnalyze = resp.data;
             }
          } else if (mime === 'text/plain') {
             const resp = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`);
             contentToAnalyze = resp.data;
          }
        } catch (e) {
          console.warn('Could not fetch drive content for analyze', e);
        }
      }

      const aiConfig = await resolveActiveAIConfig(userId);
      const ai = getAI(aiConfig.apiKey);
      const model = ai.getGenerativeModel({ 
        model: aiConfig.model || 'gemini-2.5-flash',
        systemInstruction: "Bạn là chuyên gia phân tích tài liệu nghiệp vụ cho Hoa Tiêu Miền Bắc." 
      });

      const analysisPrompt = `Hãy phân tích tài liệu sau đây để tóm tắt và phân loại.
Tài liệu:
Tên: ${docData?.name}
Mô tả: ${docData?.description}
Nội dung (trích): ${contentToAnalyze.substring(0, 50000)}

YÊU CẦU:
1. Phân loại theo bộ mã Kind: van_ban_chi_dao|quy_dinh_phap_ly|bao_cao|ke_hoach|hop_dong|tai_lieu_ky_thuat|tai_lieu_an_toan|tin_bai_truyen_thong|tai_chinh_ke_toan|nhan_su_lao_dong|khac
2. Phân loại Category: LV_DH|LV_AT|LV_KT|LV_TC|LV_TCCB|LV_PCTTra|LV_KHDN|LV_HTQT|LV_VPDT
3. Tóm tắt ngắn gọn (short) và các ý chính (mainPoints list).
4. Trích xuất các thực thể: người (people), tổ chức (organizations), địa điểm (locations), tàu thuyền (vessels), ngày tháng (dates).

TRẢ VỀ JSON:
{
  "classification": {
    "documentKind": "...",
    "taskCategoryCode": "...",
    "taskCategoryName": "...",
    "confidence": 0-1,
    "keywords": ["..."],
    "reason": "..."
  },
  "summary": {
    "short": "...",
    "mainPoints": ["..."],
    "entities": { "people": [], "organizations": [], "locations": [], "vessels": [], "dates": [] },
    "sourceLimitNote": "string|null",
    "model": "string"
  }
}`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      });

      const analysis = extractJsonSafe(result.response.text());
      analysis.summary.generatedAt = Date.now();
      analysis.summary.model = aiConfig.model;
      if (contentToAnalyze.length > 50000) analysis.summary.sourceLimitNote = "Dữ liệu phân tích bị giới hạn ở 50.000 ký tự đầu tiên.";

      const updateData: any = {
        documentKind: analysis.classification.documentKind,
        taskCategoryCode: analysis.classification.taskCategoryCode,
        summary: analysis.summary,
        updatedAt: Date.now()
      };
      
      if (contentToAnalyze && !docData?.content) {
        updateData.content = contentToAnalyze.substring(0, 100000);
        updateData.contentStatus = 'full';
      }

      await docRef.update(updateData);
      res.json({ success: true, analysis: { ...updateData, classification: analysis.classification } });
    } catch (error: any) {
      console.error('Analyze Error:', error);
      res.status(500).json({ error: 'Lỗi phân tích tài liệu: ' + error.message });
    }
  });

  app.get('/api/ai/test-text', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const aiConfig = await resolveActiveAIConfig(userId);
      const ai = getAI(aiConfig.apiKey);
      const textModel = aiConfig.model || getDynamicModel('Kiểm tra kết nối', 'TEST');
      const model = ai.getGenerativeModel({ model: textModel });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Kiểm tra kết nối AI. Trả lời "OK" ngắn gọn.' }] }],
        generationConfig: { temperature: 0 }
      });
      const response = result.response;
      res.json({ success: true, text: 'OK', debug: response.text() });
    } catch (error: any) {
      const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      res.status(isQuotaError ? 429 : 500).json({ 
        success: false,
        error: isQuotaError ? 'Hệ thống AI đang tạm thời hết hạn mức. Vui lòng đợi 1 phút.' : error?.message 
      });
    }
  });

  // Personal AI Key Management APIs
  app.get('/api/user-ai-key/status', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          errorType: 'unauthorized',
          message: 'Vui lòng đăng nhập để xem trạng thái API key.'
        });
      }

      if (!ensureFirestoreReady(res)) return;

      const snap = await db
        .collection('users')
        .doc(userId)
        .collection('settings')
        .doc('aiKey')
        .get();

      if (!snap.exists) {
        return res.json({
          success: true,
          hasKey: false,
          useSystem: true,
          status: 'none'
        });
      }

      const data = snap.data() || {};
      return res.json({
        success: true,
        hasKey: true,
        provider: data.provider || 'gemini',
        model: data.model || DEFAULT_TEXT_MODEL,
        keyLast4: data.keyLast4 || '',
        status: data.status || 'disabled',
        lastTestedAt: data.lastTestedAt || null,
        useSystem: data.status !== 'active'
      });
    } catch (error: any) {
      const classified = classifyFirestoreError(error);
      console.error('[Firestore Error - api/user-ai-key/status]', {
        errorType: classified.errorType,
        message: classified.message
      });

      return res.status(500).json({
        success: false,
        errorType: classified.errorType || 'admin_db_error',
        message: classified.message || 'Lỗi truy cập cơ sở dữ liệu.'
      });
    }
  });

  app.post('/api/user-ai-key/test', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          errorType: 'unauthorized', 
          message: 'Vui lòng đăng nhập để kiểm tra API key cá nhân.' 
        });
      }

      const { provider, apiKey, model } = req.body;
      if (!apiKey) return res.status(400).json({ success: false, errorType: 'invalid_key', message: 'Thiếu API Key' });

      if (provider === 'gemini') {
        const testAI = new GoogleGenerativeAI(apiKey);
        const testModel = normalizeModelName(model, 'gemini-2.0-flash');
        const generativeModel = testAI.getGenerativeModel({ model: testModel });
        const result = await generativeModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: 'Kiểm tra kết nối. Trả lời "OK" ngắn gọn.' }] }],
          generationConfig: { temperature: 0 }
        });
        const responseText = result.response.text();
        if (responseText.includes('OK') || responseText.length > 0) {
          return res.json({ success: true, message: 'Kiểm tra kết nối thành công!', provider, model: testModel });
        }
      } else {
        return res.status(400).json({ success: false, errorType: 'unsupported_provider', message: 'Hiện tại chỉ hỗ trợ Gemini' });
      }
      
      throw new Error('Không nhận được phản hồi hợp lệ từ AI');
    } catch (error: any) {
      console.error('Test Key Error:', error);
      let errorType = 'unknown';
      let message = error.message;

      if (message.includes('API key not valid')) errorType = 'invalid_key';
      else if (message.includes('not found') || message.includes('NOT_FOUND')) errorType = 'model_not_found';
      else if (message.includes('Quota') || message.includes('429')) errorType = 'quota_exceeded';
      else if (message.includes('permission')) errorType = 'permission_denied';

      res.status(400).json({ 
        success: false, 
        errorType,
        message: 'Lỗi test key: ' + message 
      });
    }
  });

  app.post('/api/user-ai-key/save', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ 
          success: false,
          errorType: 'unauthorized',
          message: 'Vui lòng đăng nhập để lưu API key cá nhân.' 
        });
      }

      const { provider, apiKey, model } = req.body;
      if (!apiKey) return res.status(400).json({ success: false, errorType: 'invalid_key', message: 'Thiếu API Key' });

      if (!process.env.AI_KEY_ENCRYPTION_SECRET) {
        return res.status(500).json({ 
          success: false,
          errorType: 'encryption_missing',
          message: 'Chưa cấu hình AI_KEY_ENCRYPTION_SECRET, không thể lưu API key cá nhân.' 
        });
      }

      // Re-test before saving to be safe
      const testAI = new GoogleGenerativeAI(apiKey);
      const testModel = normalizeModelName(model, 'gemini-2.5-flash');
      const generativeModel = testAI.getGenerativeModel({ model: testModel });
      await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'OK' }] }],
        generationConfig: { temperature: 0 }
      });

      const encrypted = encryptApiKey(apiKey);
      if (!encrypted) throw new Error('Lỗi mã hóa key');

      const keyData = {
        provider,
        model: testModel,
        encryptedApiKey: encrypted,
        keyLast4: apiKey.slice(-4),
        status: 'active',
        lastTestedAt: Date.now(),
        updatedAt: Date.now(),
        ownerId: userId
      };

      await db.collection('users').doc(userId).collection('settings').doc('aiKey').set(keyData, { merge: true });
      
      res.json({ 
        success: true, 
        message: 'Đã lưu API Key cá nhân thành công!',
        metadata: {
          provider: keyData.provider,
          model: keyData.model,
          keyLast4: keyData.keyLast4,
          status: keyData.status,
          lastTestedAt: keyData.lastTestedAt
        }
      });
    } catch (error: any) {
      logFirestoreError('api/user-ai-key/save', error);
      res.status(400).json({ 
        success: false,
        errorType: 'save_failed',
        message: 'Lỗi khi lưu key: ' + error.message 
      });
    }
  });

  app.delete('/api/user-ai-key', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ 
          success: false,
          errorType: 'unauthorized',
          message: 'Vui lòng đăng nhập để xóa API key.' 
        });
      }

      await db.collection('users').doc(userId).collection('settings').doc('aiKey').delete();
      res.json({ success: true, message: 'Đã xóa API Key cá nhân. Quay về dùng key hệ thống.' });
    } catch (error: any) {
      logFirestoreError('api/user-ai-key/delete', error);
      res.status(500).json({ 
        success: false,
        errorType: 'delete_failed',
        message: 'Lỗi xóa API key: ' + error.message 
      });
    }
  });

  // --- USER PROFILE & SETTINGS ---
  app.get('/api/user/profile', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          errorType: 'unauthorized',
          message: 'Vui lòng đăng nhập để xem hồ sơ.'
        });
      }

      if (!ensureFirestoreReady(res)) return;

      const profileSnap = await db
        .collection('users')
        .doc(userId)
        .collection('profile')
        .doc('main')
        .get();

      if (!profileSnap.exists) {
        return res.json({
          success: true,
          profile: null
        });
      }

      return res.json({
        success: true,
        profile: profileSnap.data()
      });
    } catch (error: any) {
      const classified = classifyFirestoreError(error);
      console.error('[Firestore Error - GET /api/user/profile]', {
        errorType: classified.errorType,
        message: classified.message
      });

      return res.status(500).json({
        success: false,
        errorType: classified.errorType || 'profile_get_failed',
        message: classified.message || 'Không thể lấy thông tin hồ sơ.'
      });
    }
  });

  app.post('/api/user/profile', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          errorType: 'unauthorized',
          message: 'Vui lòng đăng nhập để lưu hồ sơ.'
        });
      }

      if (!ensureFirestoreReady(res)) return;

      const timestamp = Date.now();
      const profileData = {
        displayName: String(req.body?.displayName || '').trim(),
        title: String(req.body?.title || '').trim(),
        department: String(req.body?.department || '').trim(),
        phone: String(req.body?.phone || '').trim(),
        avatarText: String(req.body?.avatarText || '').trim(),
        defaultAssigneeName: String(req.body?.defaultAssigneeName || '').trim(),
        defaultTaskCategoryCode: String(req.body?.defaultTaskCategoryCode || 'LV_DH').trim(),
        ownerId: userId,
        updatedAt: timestamp
      };

      await db
        .collection('users')
        .doc(userId)
        .collection('profile')
        .doc('main')
        .set(profileData, { merge: true });

      return res.json({
        success: true,
        profile: profileData
      });
    } catch (error: any) {
      const classified = classifyFirestoreError(error);
      console.error('[Firestore Error - POST /api/user/profile]', {
        errorType: classified.errorType,
        message: classified.message
      });

      return res.status(500).json({
        success: false,
        errorType: classified.errorType || 'profile_save_failed',
        message: classified.message || 'Không thể lưu thông tin hồ sơ.'
      });
    }
  });

  // --- AI CHATBOX ---
  app.post('/api/ai/chat', async (req, res) => {
    // Force JSON response
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          errorType: 'unauthorized',
          message: 'Vui lòng đăng nhập để sử dụng chat AI.'
        });
      }
      
      const message = String(req.body?.message || '').trim();
      if (!message) {
        return res.status(400).json({
          success: false,
          errorType: 'empty_message',
          message: 'Vui lòng nhập nội dung cần hỏi.'
        });
      }

      if (message.length > 8000) {
        return res.status(400).json({
          success: false,
          errorType: 'message_too_long',
          message: 'Nội dung hỏi quá dài. Vui lòng rút gọn dưới 8.000 ký tự.'
        });
      }

      const safeHistory = Array.isArray(req.body?.history)
        ? req.body.history.slice(-10).filter((m: any) =>
            (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
          )
        : [];

      const safeContext = req.body?.context || {};

      const aiConfig = await resolveActiveAIConfig(userId);
      
      if (!aiConfig?.apiKey) {
        return res.status(503).json({
          success: false,
          errorType: 'missing_api_key',
          message: 'Chưa cấu hình API key AI. Vui lòng kiểm tra Cài đặt/Tài khoản.'
        });
      }

      const ai = getAI(aiConfig.apiKey);
      const modelId = aiConfig.model || DEFAULT_TEXT_MODEL;

      const systemInstruction = `Bạn là trợ lý AI nội bộ của Công ty TNHH MTV Hoa tiêu hàng hải miền Bắc (VMS-North AI).
Luôn trả lời bằng tiếng Việt có dấu, trình bày sạch đẹp bằng Markdown.

QUY TẮC PHỤC VỤ:
1. Không bịa thông tin. Nếu không có trong ngữ cảnh, hãy nói rõ.
2. Không dùng raw enum tiếng Anh (todo, doing, urgent...) trong văn bản trả lời.
3. KHÔNG TẠO ẢNH.
4. Khi người dùng yêu cầu tạo công việc hoặc trích xuất kế hoạch:
   - Tách thành các 'taskDrafts' riêng nếu thuộc các nhóm việc khác nhau.
   - Nếu là chuỗi việc cùng mục tiêu, hãy gom vào 1 task và dùng 'checklist'.
   - 'categoryCode' phải thuộc: LV_DH|LV_AT|LV_KT|LV_TC|LV_TCCB|LV_PCTTra|LV_KHDN|LV_HTQT|LV_VPDT.
   - 'priority' phải thuộc: low|medium|high|urgent.

TRẢ VỀ JSON:
{
  "intent": "chat" | "create_tasks" | "summarize" | "editorial",
  "reply": "Nội dung câu trả lời (Markdown tiếng Việt)",
  "taskDrafts": [
    {
      "clientId": "string",
      "title": "Tên công việc",
      "description": "Mô tả",
      "assignee": "Người thực hiện",
      "dueDate": "YYYY-MM-DD",
      "categoryCode": "LV_...",
      "priority": "low|medium|high|urgent",
      "isDeputy": false,
      "checklist": [{ "title": "Để mục 1", "done": false }],
      "reason": "Tại sao đề xuất task này"
    }
  ],
  "suggestedActions": [
    { "type": "review_task_drafts", "label": "Duyệt công việc" }
  ]
}`;

      const contextText = buildSafeChatContext(safeContext);

      const contents = [
        ...safeHistory.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content).slice(0, 4000) }]
        })),
        {
          role: 'user',
          parts: [{ text: `${message}${contextText}` }]
        }
      ];

      // Ensure first message is user
      while (contents.length > 0 && contents[0].role === 'model') {
        contents.shift();
      }

      const { result, actualModel, triedModels } = await generateChatWithFallback(
        ai,
        modelId,
        contents,
        systemInstruction
      );

      const rawReply = result.response.text()?.trim() || '';
      const aiData = extractJsonSafe(rawReply);

      // Robust fallback if JSON parsing fails but we have text
      if (!aiData) {
        return res.json({
          success: true,
          intent: 'chat',
          reply: rawReply || 'AI đã phản hồi nhưng không thể xử lý định dạng.',
          taskDrafts: [],
          suggestedActions: [],
          model: actualModel,
          actualModel,
          triedModels,
          provider: aiConfig.provider || 'gemini'
        });
      }

      res.json({
        success: true,
        intent: aiData.intent || (aiData.taskDrafts?.length ? 'create_tasks' : 'chat'),
        reply: aiData.reply || 'AI đã phản hồi rỗng.',
        taskDrafts: Array.isArray(aiData.taskDrafts) ? aiData.taskDrafts : [],
        suggestedActions: Array.isArray(aiData.suggestedActions) ? aiData.suggestedActions : [],
        model: actualModel,
        actualModel,
        triedModels,
        provider: aiConfig.provider || 'gemini'
      });
    } catch (error: any) {
      console.error('AI Chat Error:', error);
      const classified = classifyGeminiError(error);

      res.status(classified.statusCode).json({
        success: false,
        errorType: classified.errorType,
        message: classified.message
      });
    }
  });

const TASK_STATUS_LABELS_INTERNAL: Record<string, string> = {
  todo: 'Cần làm',
  doing: 'Đang làm',
  review: 'Chờ rà soát',
  done: 'Hoàn thành',
  blocked: 'Đang vướng'
};

const TASK_PRIORITY_LABELS_INTERNAL: Record<string, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  urgent: 'Khẩn cấp'
};

function buildSafeChatContext(context: any) {
  if (!context || typeof context !== 'object') return '';

  let out = '\n\n[DỮ LIỆU NGỮ CẢNH HỆ THỐNG]\n';
  out += `Tab hiện tại: ${context.activeTab || 'N/A'}\n`;

  if (context.stats) {
    out += `Thống kê nhanh: ${JSON.stringify(context.stats)}\n`;
  }

  if (Array.isArray(context.recentTasks)) {
    const localizedTasks = context.recentTasks.map((t: any) => ({
      title: t.title,
      status: TASK_STATUS_LABELS_INTERNAL[t.status] || t.status,
      priority: TASK_PRIORITY_LABELS_INTERNAL[t.priority] || t.priority,
      assignee: t.assignee,
      dueDate: t.dueDate,
      category: t.categoryName || t.categoryCode
    }));
    out += `Công việc liên quan: ${JSON.stringify(localizedTasks.slice(0, 5))}\n`;
  }

  if (Array.isArray(context.selectedDocuments)) {
    out += `Tài liệu đang chọn: ${JSON.stringify(context.selectedDocuments.slice(0, 5))}\n`;
  }

  if (context.previewingDocument) {
    out += `Tài liệu đang xem chi tiết: ${JSON.stringify(context.previewingDocument)}\n`;
  }

  if (context.currentInputSnippet) {
    out += `Đoạn văn bản nguồn (Editorial): ${context.currentInputSnippet.slice(0, 800)}\n`;
  }

  return out.slice(0, 4500);
}

  app.get('/api/fetch-link', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Vui lòng đăng nhập để fetch link.' });

      const inputUrl = String(req.query.url || '');
      if (!inputUrl) return res.status(400).json({ error: 'URL is required' });
      const safeUrl = await assertSafeUrl(inputUrl);

      const response = await axios.get(safeUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 HoaTieuEditorialBot/1.0' },
        timeout: 10000,
        maxRedirects: 3,
        maxContentLength: 1024 * 1024,
        validateStatus: status => status >= 200 && status < 400,
      });

      const $ = cheerio.load(response.data);
      const title = $('title').text() || $('meta[property="og:title"]').attr('content') || safeUrl;
      const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
      const faviconRaw = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || '';
      let favicon = '';
      if (faviconRaw) {
        try { favicon = faviconRaw.startsWith('http') ? faviconRaw : new URL(faviconRaw, safeUrl).href; } catch {}
      }
      $('script, style, nav, footer, header, noscript').remove();
      const content = $('body').text().replace(/\s+/g, ' ').trim();
      res.json({ title, description, favicon, content: content.substring(0, 15000), url: safeUrl });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Could not fetch metadata' });
    }
  });

  app.post('/api/ai/process', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ success: false, errorType: 'unauthorized', message: 'Vui lòng đăng nhập để sử dụng chức năng AI.' });
      
      const { taskType, content, style, format, sources } = req.body || {};
      const aiConfig = await resolveActiveAIConfig(userId);
      const ai = getAI(aiConfig.apiKey);
      
      const sourceContext = (sources || []).length > 0 
        ? `\n\nDANH SÁCH TÀI LIỆU THAM KHẢO:\n${sources.map((s: any) => `--- [${s.name}] ---\n${s.content}`).join('\n')}`
        : '';

      const today = new Date().toLocaleDateString('vi-VN');
      const prompt = `Hôm nay là ngày: ${today}\nTác vụ: [${taskType}]\nVăn phong: [${style}]\nHình thức: [${format}]\n\nNội dung/Yêu cầu:\n${content}${sourceContext}`;
      
      const textModel = aiConfig.model && aiConfig.provider === 'gemini' ? aiConfig.model : getDynamicModel(content, taskType);
      const model = ai.getGenerativeModel({
        model: textModel,
        systemInstruction: SYSTEM_INSTRUCTION + "\n\nLƯU Ý QUAN TRỌNG: Tuyệt đối không để sót cụm từ 'Bộ Giao thông Vận tải' hoặc 'Bộ GTVT', phải thay bằng 'Bộ Xây dựng' theo đúng hướng dẫn sáp nhập.",
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: taskType === 'SYNTHESIZE' ? 0.3 : 0.2,
        },
      });
      
      let text = result.response.text() || '';
      // Safe fallback deterministic replacement
      text = text.replace(/Bộ Giao thông Vận tải/g, 'Bộ Xây dựng').replace(/Bộ GTVT/g, 'Bộ Xây dựng');

      res.json({ text });
    } catch (error: any) {
      const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      res.status(isQuotaError ? 429 : 500).json({ 
        error: isQuotaError ? 'Hạn mức AI tạm thời hết. Vui lòng thử lại sau 1 phút.' : (error?.message || 'Lỗi xử lý AI') 
      });
    }
  });

  app.post('/api/ai/search', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ success: false, errorType: 'unauthorized', message: 'Vui lòng đăng nhập để sử dụng chức năng tìm kiếm AI.' });

      const { query } = req.body || {};
      const aiConfig = await resolveActiveAIConfig(userId);
      const ai = getAI(aiConfig.apiKey);
      
      const textModel = aiConfig.model && aiConfig.provider === 'gemini' ? aiConfig.model : normalizeModelName(process.env.GEMINI_TEXT_MODEL, 'gemini-1.5-flash');
      const model = ai.getGenerativeModel({
        model: textModel,
        systemInstruction: "Bạn là chuyên gia nghiên cứu tư liệu báo chí cho VMS. Tìm kiếm thông tin chính xác và cập nhật.",
        tools: [{ googleSearch: {} }] as any,
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `Tìm kiếm chi tiết về: ${query}. Trả về bản tóm tắt và danh sách nguồn tin cậy.` }] }],
        generationConfig: {
          temperature: 0,
        },
      });
      
      const response = result.response;
      res.json({
        text: response.text() || '',
        groundingMetadata: (response as any).candidates?.[0]?.groundingMetadata
      });
    } catch (error: any) {
      const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      res.status(isQuotaError ? 429 : 500).json({ 
        error: isQuotaError ? 'Hạn mức tìm kiếm AI tạm thời hết. Vui lòng thử lại sau 1 phút.' : (error?.message || 'Lỗi tìm kiếm AI') 
      });
    }
  });

  app.post('/api/tasks/build', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ success: false, errorType: 'unauthorized', message: 'Vui lòng đăng nhập để trích xuất công việc.' });

      const { text, today, timezone } = req.body;
      if (!text) return res.status(400).json({ error: 'Thiếu nội dung mô tả công việc' });

      const aiConfig = await resolveActiveAIConfig(userId);
      const ai = getAI(aiConfig.apiKey);

      const dateContext = today ? `Ngày hiện tại: ${today} (Timezone: ${timezone || 'Asia/Ho_Chi_Minh'})` : `Ngày hiện tại: ${new Date().toISOString().split('T')[0]}`;
      const prompt = `${dateContext}
Bạn là trợ lý điều hành sản xuất tại Công ty Hoa tiêu hàng hải miền Bắc. 
Hãy phân tích nội dung sau và trích xuất danh sách các công việc cụ thể.
Đối với mỗi công việc, hãy xác định:
- Tên công việc (title)
- Người phụ trách (assignee) - nếu không rõ hãy để trống ""
- Hạn xử lý (dueDate) - định dạng ISO 8601 (YYYY-MM-DD). Dựa vào ngày hiện tại để quy đổi các mốc "hôm nay", "ngày mai", "tuần tới"... Nếu không rõ hãy dự đoán hoặc để trống.
- Lĩnh vực (categoryCode) - chọn 1 trong các mã: LV_DH, LV_AT, LV_KT, LV_TC, LV_TCCB, LV_PCTTra, LV_KHDN, LV_HTQT, LV_VPDT
- Chức danh kiêm nhiệm (isDeputy) - true nếu đây là việc được giao thêm hoặc kiêm nhiệm
- Độ ưu tiên (priority): low, medium, high, hoặc urgent (dựa trên mức độ khẩn cấp trong văn bản)
- Mô tả chi tiết (description)

QUY ĐỊNH TRẢ VỀ:
- Chỉ trả về DUY NHẤT một khối JSON.
- Không bao gồm phần giải thích hay văn bản thừa.
- Không sử dụng các khối markdown (như \`\`\`json).
- Định dạng: {"tasks": [{"title": "...", "assignee": "...", "dueDate": "...", "categoryCode": "...", "isDeputy": boolean, "priority": "...", "description": "..."}]}`;

      const textModel = aiConfig.model && aiConfig.provider === 'gemini' ? aiConfig.model : getDynamicModel(text, 'TASK_BUILDER');
      const model = ai.getGenerativeModel({
        model: textModel,
        systemInstruction: "Bạn là trợ lý điều hành sản xuất tại Công ty Hoa tiêu hàng hải miền Bắc. Hãy phân tích nội dung sau và trích xuất danh sách các công việc cụ thể.",
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.1,
          responseMimeType: 'application/json'
        },
      });

      const data = extractJsonSafe(result.response.text() || '{}');
      res.json(data);
    } catch (error: any) {
      const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      res.status(isQuotaError ? 429 : 500).json({ 
        error: isQuotaError ? 'Hạn mức trích xuất AI tạm thời hết. Vui lòng thử lại sau 1 phút.' : (error?.message || 'Không trích xuất được công việc') 
      });
    }
  });

  app.post('/api/editorial-images/plan', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ success: false, errorType: 'unauthorized', message: 'Vui lòng đăng nhập để lập kế hoạch ảnh.' });

      // Planning is allowed even if generation is disabled
      const { content, existingAnalysis } = req.body || {};
      if (!content || typeof content !== 'string') return res.status(400).json({ error: 'Thiếu nội dung bài viết' });
      
      const aiConfig = await resolveActiveAIConfig(userId);
      const ai = getAI(aiConfig.apiKey);

      const prompt = `Bạn là chuyên gia biên tập hình ảnh cho website Công ty Hoa tiêu hàng hải miền Bắc (VMS). 
Nhiệm vụ: Đề xuất các vị trí và nội dung hình ảnh cần tìm kiếm hoặc tải lên thủ công để minh họa bài viết.

DỮ LIỆU ĐẦU VÀO:
1. Phân tích hiện tại: ${JSON.stringify(existingAnalysis).slice(0, 3000)}
2. Các ghi chú hình trong bài (placeholders): Tìm các dòng như "Hình minh họa: ...", "Chèn ảnh: ...".

YÊU CẦU:
- Ưu tiên đề xuất hình cho các vị trí có ghi chú "Hình minh họa: ...".
- Không đề xuất quá 4 hình tổng cộng.
- Không đề xuất lại hình đã có.
- Mô tả ảnh cần tìm/tải lên phải rõ ràng, bằng tiếng Việt, miêu tả chi tiết cảnh quan hàng hải, tàu thuyền, cảng biển, hoặc hoạt động hoa tiêu phù hợp để biên tập viên chọn ảnh thủ công.
- Trả về JSON duy nhất: {"plans":[{"paragraphIndex":number,"insertAfter":"string context","caption":"string","prompt":"string","reason":"string","priority":"high|medium|low"}],"notes":["string"]}.
- Lưu ý: Trường "prompt" ở đây thực chất là "mô tả chi tiết nội dung ảnh" để biên tập viên biết cần tìm ảnh gì.

BÀI VIẾT:
${content.slice(0, 10000)}`;

      const textModel = aiConfig.model && aiConfig.provider === 'gemini' ? aiConfig.model : getDynamicModel(content, 'IMAGE_PLAN');
      const model = ai.getGenerativeModel({
        model: textModel,
        systemInstruction: "Bạn là chuyên gia biên tập hình ảnh cho website Công ty Hoa tiêu hàng hải miền Bắc (VMS). Nhiệm vụ: Đề xuất các vị trí và nội dung hình ảnh cần tải lên thủ công.",
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.2,
          responseMimeType: 'application/json'
        },
      });

      const data = extractJsonSafe(result.response.text() || '{}');
      const plans = (data.plans || []).slice(0, 4).map((p: any, idx: number) => ({
        id: `plan-${Date.now()}-${idx}`,
        paragraphIndex: Number.isFinite(Number(p.paragraphIndex)) ? Number(p.paragraphIndex) : 0,
        insertAfter: String(p.insertAfter || ''),
        caption: String(p.caption || 'Hình minh họa hoạt động hàng hải'),
        prompt: String(p.prompt || 'Mô tả hình ảnh phục vụ tìm kiếm thủ công'),
        reason: String(p.reason || 'Bổ sung minh họa phù hợp nội dung bài.'),
        priority: ['high', 'medium', 'low'].includes(p.priority) ? p.priority : 'medium',
      }));
      res.json({ plans, notes: Array.isArray(data.notes) ? data.notes : [] });
    } catch (error: any) {
      const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      res.status(isQuotaError ? 429 : 500).json({ 
        error: isQuotaError ? 'Hạn mức lập kế hoạch ảnh AI tạm thời hết.' : (error?.message || 'Không lập được kế hoạch hình') 
      });
    }
  });

  // Disabled AI Image Generation endpoint
  app.post('/api/editorial-images/generate', async (req, res) => {
    res.status(410).json({ 
      success: false, 
      errorType: 'function_disabled', 
      message: 'Chức năng tạo hình ảnh AI đã được gỡ bỏ. Vui lòng tải ảnh thủ công.' 
    });
  });

  // --- MORE API ROUTES ABOVE ---

  // Catch-all for API 404s
  app.use('/api', (req, res) => {
    res.status(404).json({
      success: false,
      errorType: 'api_route_not_found',
      message: `Không tìm thấy API route: ${req.method} ${req.originalUrl}`,
      path: req.originalUrl,
      method: req.method
    });
  });

  // Global API error handler
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[API Error Boundary]', {
      path: req.originalUrl,
      method: req.method,
      message: err?.message,
      code: err?.code,
      status: err?.status
    });

    if (res.headersSent) return next(err);

    res.status(err?.status || 500).json({
      success: false,
      errorType: err?.errorType || 'api_server_error',
      message: err?.publicMessage || err?.message || 'Máy chủ API gặp lỗi. Vui lòng thử lại.'
    });
  });

  // Vite/Frontend serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

startServer();
