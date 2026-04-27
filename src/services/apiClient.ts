export interface ApiFetchOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  allowHtmlRetry?: boolean;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function apiFetchJson<T = any>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    retries = 3,
    retryDelayMs = 800,
    timeoutMs = 30000,
    allowHtmlRetry = true,
    ...fetchOptions
  } = options;

  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });

      const raw = await res.text();
      const contentType = res.headers.get('content-type') || '';

      let data: any = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        const trimmedRaw = raw.trim();
        const isHtml = trimmedRaw.startsWith('<!doctype html') || trimmedRaw.startsWith('<html') || trimmedRaw.startsWith('<!DOCTYPE html');
        const isStartingServer =
          raw.includes('Starting Server') ||
          raw.includes('starting server') ||
          raw.includes('<title>Starting Server');

        if (allowHtmlRetry && isHtml && isStartingServer && attempt < retries) {
          console.warn('[API] Backend chưa sẵn sàng, retry...', {
            url,
            attempt: attempt + 1,
            status: res.status,
            contentType
          });

          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }

        console.error('[API] Non-JSON response', {
          url,
          status: res.status,
          contentType,
          rawPreview: raw.slice(0, 300)
        });

        throw new Error('Máy chủ API chưa trả dữ liệu JSON hợp lệ. Vui lòng thử lại sau vài giây.');
      }

      if (!res.ok || data?.success === false) {
        const err: any = new Error(data?.message || `API lỗi HTTP ${res.status}`);
        err.status = res.status;
        err.errorType = data?.errorType;
        err.data = data;
        throw err;
      }

      return data as T;
    } catch (err: any) {
      lastError = err;

      if (err?.name === 'AbortError') {
        lastError = new Error('API phản hồi quá lâu. Vui lòng thử lại.');
      }

      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

export async function waitForBackendReady(maxAttempts = 12) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const health = await apiFetchJson('/api/health', {
        retries: 0,
        timeoutMs: 8000,
        allowHtmlRetry: true
      });

      if (health?.ok) return health;
    } catch (err) {
      // retry below
    }

    await sleep(800 * (i + 1));
  }

  throw new Error('Backend chưa sẵn sàng. Vui lòng tải lại ứng dụng sau vài giây.');
}
