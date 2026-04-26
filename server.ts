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

// Initialize Firebase Admin
const configProjectId = firebaseConfig.projectId;
const configDatabaseId = firebaseConfig.firestoreDatabaseId;

// Priority: Env Var > Config File > Default Hardcoded (Fallback)
const projectId = process.env.FIREBASE_PROJECT_ID || configProjectId || 'gen-lang-client-0733170002';
const databaseId = process.env.FIRESTORE_DATABASE_ID || configDatabaseId;

console.log('[Firebase Init] Diagnostics:', {
  detectedProjectId: projectId,
  detectedDatabaseId: databaseId || '(default)',
  envProjectId: process.env.FIREBASE_PROJECT_ID ? 'set' : 'not-set',
  envDatabaseId: process.env.FIRESTORE_DATABASE_ID ? 'set' : 'not-set',
  configProjectId: configProjectId ? 'present' : 'absent'
});

if (!admin.apps.length) {
  try {
    admin.initializeApp();
    console.log('[Firebase Init] Admin SDK Initialized using ADC. Resolved Project ID:', admin.app().options.projectId);
  } catch (err) {
    console.error('[Firebase Init] Error initializing Admin SDK:', err);
  }
} else {
    console.log('[Firebase Init] Admin SDK already initialized. Project ID:', admin.app().options.projectId);
}

// We use getFirestore(app, databaseId) to ensure we use the correct database
import { getFirestore } from 'firebase-admin/firestore';

let db: admin.firestore.Firestore;
try {
  // If databaseId is 'default' or '(default)', we should use the default database
  const isDefault = !databaseId || databaseId === '(default)' || databaseId === '';
  
  if (!isDefault) {
    db = getFirestore(admin.app(), databaseId);
    console.log(`[Firestore] Proactive attempt with custom database: ${databaseId}`);
  } else {
    db = getFirestore(admin.app());
    console.log('[Firestore] Proactive attempt with (default) database');
  }
} catch (err) {
  console.error('[Firestore] Initialization failed, falling back to basic initialization:', err);
  db = getFirestore(admin.app());
}

// Self-test helper to verify permissions on boot
async function verifyFirestoreAccess() {
  try {
    // Try to access a simple document to verify connectivity
    await db.collection('_health').doc('check').get();
    console.log('[Firestore] Connectivity verified successfully.');
  } catch (err: any) {
    console.error('[Firestore] Connectivity test failed:', err.message);
    if (err.message?.includes('permission') || err.code === 7) {
      console.warn('[Firestore] PERMISSION_DENIED on custom database. Attempting fallback to (default) database...');
      try {
        const fallbackDb = getFirestore(admin.app());
        await fallbackDb.collection('_health').doc('check').get();
        db = fallbackDb;
        console.log('[Firestore] Fallback to (default) database successful.');
      } catch (fallbackErr: any) {
        console.error('[Firestore] Fallback also failed:', fallbackErr.message);
      }
    }
  }
}
verifyFirestoreAccess();

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
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (err) {
    return null;
  }
}

async function resolveActiveAIConfig(userId: string | null) {
  const systemConfig = {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
    provider: 'gemini'
  };

  if (!userId) return systemConfig;

  try {
    const userKeyDoc = await db.collection('users').doc(userId).collection('settings').doc('aiKey').get();
    if (userKeyDoc.exists) {
      const data = userKeyDoc.data();
      if (data && data.status === 'active' && data.encryptedApiKey) {
        const decryptedKey = decryptApiKey(data.encryptedApiKey);
        if (decryptedKey) {
          // Double check the model format
          const userModel = normalizeModelName(data.model, systemConfig.model);
          return {
            apiKey: decryptedKey,
            model: userModel,
            provider: data.provider || 'gemini'
          };
        }
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
  const gKey = apiKeyOverride || process.env.GEMINI_API_KEY;
  const oKey = process.env.GOOGLE_API_KEY;
  
  let apiKey = '';

  if (gKey && !gKey.includes('your_gemini_api_key') && gKey !== 'MY_GEMINI_API_KEY') {
    apiKey = gKey;
  } else if (oKey && oKey.startsWith('AIzaSy')) {
    apiKey = oKey;
  }

  if (!apiKey) {
    throw new Error('Missing or invalid server-side GEMINI_API_KEY or GOOGLE_API_KEY. Vui lòng cấu hình API Key thật trong phần Settings.');
  }

  // GoogleGenerativeAI constructor takes the API key string directly
  return new GoogleGenerativeAI(apiKey);
}

function extractJson(text: string) {
  if (!text) throw new Error('AI trả về nội dung rỗng');
  
  // Clean markdown if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
  }

  // Try parsing directly first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // If direct parse fails, try to find a JSON block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('AI Response Header (Failed JSON):', text.slice(0, 200));
      throw new Error('AI không trả JSON hợp lệ (Không tìm thấy cặp ngoặc nhọn)');
    }

    const rawJson = match[0];
    try {
      return JSON.parse(rawJson);
    } catch (e2) {
      // Final attempt: clean the matched block
      const finalTry = rawJson.replace(/\\n/g, ' ').trim();
      try {
        return JSON.parse(finalTry);
      } catch (e3) {
        console.error('Failed to parse final try:', finalTry.slice(0, 500));
        throw new Error('Không thể parse JSON từ phản hồi của AI. Vui lòng thử lại.');
      }
    }
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


async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => {
    const gKey = process.env.GEMINI_API_KEY || '';
    const oKey = process.env.GOOGLE_API_KEY || '';
    
    const isRealKey = (key: string) => 
      key && 
      !key.includes('your_gemini_api_key') && 
      key !== 'MY_GEMINI_API_KEY' && 
      key !== 'YOUR_GOOGLE_API_KEY' &&
      (key.startsWith('AIza') || key.length > 20);

    const hasGeminiKey = isRealKey(gKey) || isRealKey(oKey);

    res.json({
      ok: true,
      hasSystemGeminiKey: hasGeminiKey,
      hasEncryptionSecret: !!process.env.AI_KEY_ENCRYPTION_SECRET,
      hasGoogleDriveKey: !!process.env.GOOGLE_DRIVE_API_KEY,
      imageGenerationEnabled: false,
      textModel: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
      fallbackModel: process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite',
      firestoreDatabaseId: databaseId || '(default)',
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
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { url, collectionId } = req.body;
      const fileId = parseFileId(url);
      if (!fileId) return res.status(400).json({ error: 'URL không hợp lệ.' });

      const metadata = await getDriveMetadata(fileId);
      
      // Attempt to fetch content for Docs/Sheets/Slides/Text/PDF
      let content = '';
      let contentStatus = 'metadata_only';

      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
      const mime = metadata.mimeType;

      if (mime === 'application/vnd.google-apps.document') {
        const exportUrl = metadata.exportLinks?.['text/plain'];
        if (exportUrl) {
          const resp = await axios.get(exportUrl, { params: { key: apiKey } });
          content = resp.data;
          contentStatus = 'full';
        }
      } else if (mime === 'application/vnd.google-apps.spreadsheet') {
        const exportUrl = metadata.exportLinks?.['text/csv'];
        if (exportUrl) {
          const resp = await axios.get(exportUrl, { params: { key: apiKey } });
          content = resp.data;
          contentStatus = 'full';
        }
      } else if (mime === 'text/plain' || mime === 'text/markdown') {
        const resp = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`);
        content = resp.data;
        contentStatus = 'full';
      }

      const docData = {
        name: metadata.name,
        type: 'drive',
        driveFileId: metadata.id,
        driveMimeType: metadata.mimeType,
        driveIconUrl: metadata.iconLink,
        driveThumbnailUrl: metadata.thumbnailLink,
        driveWebViewLink: metadata.webViewLink,
        driveSize: metadata.size,
        description: metadata.description || '',
        content: content.substring(0, 100000), // Limit storage
        contentStatus,
        collectionId: collectionId || 'lib-drive',
        ownerId: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          parents: metadata.parents,
          createdTime: metadata.createdTime,
          modifiedTime: metadata.modifiedTime
        }
      };

      const docRef = await db.collection('users').doc(userId).collection('documents').add(docData);
      res.json({ success: true, id: docRef.id, document: { id: docRef.id, ...docData } });
    } catch (error: any) {
      console.error('Drive Import Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Lỗi import Drive: ' + (error.response?.data?.error?.message || error.message) });
    }
  });

  app.post('/api/drive/sync-public-folder', async (req, res) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { folderId, collectionId, nextPageToken } = req.body;
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;

      if (!apiKey) return res.status(500).json({ error: 'Chưa cấu hình GOOGLE_DRIVE_API_KEY.' });

      const response = await axios.get(`https://www.googleapis.com/drive/v3/files`, {
        params: {
          q: `'${folderId}' in parents and trashed = false`,
          key: apiKey,
          fields: 'nextPageToken, files(id, name, mimeType, webViewLink, iconLink, thumbnailLink, modifiedTime, size, description)',
          pageSize: 100,
          pageToken: nextPageToken
        },
        timeout: 15000
      });

      const files = response.data.files || [];
      const stats = { added: 0, updated: 0, failed: 0 };

      // Batch check existing docs in this collection for this folder
      const existingDocsSnap = await db.collection('users').doc(userId)
        .collection('documents')
        .where('collectionId', '==', collectionId || 'lib-drive')
        .get();
      
      const existingMap = new Map();
      existingDocsSnap.forEach(d => {
        const data = d.data();
        if (data.driveFileId) existingMap.set(data.driveFileId, { id: d.id, ...data });
      });

      for (const f of files) {
        try {
          const existing = existingMap.get(f.id);
          const docData = {
            name: f.name,
            driveMimeType: f.mimeType,
            driveIconUrl: f.iconLink,
            driveThumbnailUrl: f.thumbnailLink,
            driveWebViewLink: f.webViewLink,
            driveSize: f.size,
            updatedAt: Date.now(),
            metadata: {
              modifiedTime: f.modifiedTime,
              description: f.description
            }
          };

          if (existing) {
            // Update if modifiedTime changed (simple check)
            if (existing.metadata?.modifiedTime !== f.modifiedTime) {
              await db.collection('users').doc(userId).collection('documents').doc(existing.id).update(docData);
              stats.updated++;
            }
          } else {
            // Add new
            const newDoc = {
              ...docData,
              type: 'drive',
              driveFileId: f.id,
              content: '',
              contentStatus: 'metadata_only',
              collectionId: collectionId || 'lib-drive',
              ownerId: userId,
              createdAt: Date.now()
            };
            await db.collection('users').doc(userId).collection('documents').add(newDoc);
            stats.added++;
          }
        } catch (err) {
          console.error(`Sync File Fail: ${f.name}`, err);
          stats.failed++;
        }
      }

      res.json({ 
        success: true, 
        stats, 
        nextPageToken: response.data.nextPageToken 
      });
    } catch (error: any) {
      console.error('Folder Sync Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Lỗi đồng bộ thư mục: ' + (error.response?.data?.error?.message || error.message) });
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

      const analysis = extractJson(result.response.text());
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

      const doc = await db.collection('users').doc(userId).collection('settings').doc('aiKey').get();
      if (!doc.exists) {
        return res.json({ hasKey: false, useSystem: true });
      }

      const data = doc.data();
      res.json({
        success: true,
        hasKey: true,
        provider: data?.provider,
        model: data?.model,
        keyLast4: data?.keyLast4,
        status: data?.status,
        lastTestedAt: data?.lastTestedAt,
        useSystem: data?.status !== 'active'
      });
    } catch (error: any) {
      logFirestoreError('api/user-ai-key/status', error);
      res.status(500).json({ 
        success: false, 
        errorType: 'admin_db_error', 
        message: 'Lỗi truy cập cơ sở dữ liệu: ' + error.message 
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
        const testModel = normalizeModelName(model, 'gemini-2.5-flash');
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

  app.get('/api/fetch-link', async (req, res) => {
    try {
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
      const { taskType, content, style, format, sources } = req.body || {};
      const userId = await getUserIdFromRequest(req);
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
      const { query } = req.body || {};
      const userId = await getUserIdFromRequest(req);
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

  app.get('/api/drive/sync-public-folder', async (req, res) => {
    try {
      const folderId = String(req.query.folderId || '');
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: 'Chưa cấu hình GOOGLE_DRIVE_API_KEY trên server.' });
      }

      if (!folderId) {
        return res.status(400).json({ error: 'Thiếu folderId' });
      }

      // Call Google Drive API v3 to list files in folder
      const response = await axios.get(`https://www.googleapis.com/drive/v3/files`, {
        params: {
          q: `'${folderId}' in parents and trashed = false`,
          key: apiKey,
          fields: 'nextPageToken, files(id, name, mimeType, webViewLink, webContentLink, iconLink, thumbnailLink, modifiedTime, size)',
          pageSize: 100
        },
        timeout: 10000
      });

      res.json({ 
        files: response.data.files || [],
        nextPageToken: response.data.nextPageToken
      });
    } catch (error: any) {
      console.error('Drive Sync Error:', error.response?.data || error.message);
      const isAuthError = error.response?.status === 403 || error.response?.status === 401;
      const isNotFoundError = error.response?.status === 404;

      if (isAuthError) {
        return res.status(403).json({ error: 'Không đọc được thư mục. Hãy kiểm tra thư mục đã bật chia sẻ công khai hoặc Drive API key.' });
      }
      if (isNotFoundError) {
        return res.status(404).json({ error: 'Không tìm thấy thư mục. Vui lòng kiểm tra lại link.' });
      }

      res.status(500).json({ error: 'Lỗi đồng bộ Drive: ' + (error.response?.data?.error?.message || error.message) });
    }
  });

  app.post('/api/tasks/build', async (req, res) => {
    try {
      const { text, today, timezone } = req.body;
      if (!text) return res.status(400).json({ error: 'Thiếu nội dung mô tả công việc' });

      const userId = await getUserIdFromRequest(req);
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

      const data = extractJson(result.response.text() || '{}');
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
      // Planning is allowed even if generation is disabled
      const { content, existingAnalysis } = req.body || {};
      if (!content || typeof content !== 'string') return res.status(400).json({ error: 'Thiếu nội dung bài viết' });
      
      const userId = await getUserIdFromRequest(req);
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

      const data = extractJson(result.response.text() || '{}');
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
