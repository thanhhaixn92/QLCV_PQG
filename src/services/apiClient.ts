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
      let isStartingServer = false;

      // Handle HTML strictly
      if (contentType.includes('text/html') || raw.trim().startsWith('<')) {
        const trimmedRaw = raw.trim();
        isStartingServer =
          trimmedRaw.includes('Starting Server') ||
          trimmedRaw.includes('starting server') ||
          trimmedRaw.includes('<title>Starting Server');

        if (allowHtmlRetry && isStartingServer && attempt < retries) {
          console.warn('[API] Backend chưa sẵn sàng, retry...', {
            url,
            attempt: attempt + 1,
            status: res.status
          });
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }

        console.error('[API] HTML instead of JSON', { url, status: res.status, rawPreview: trimmedRaw.slice(0, 300) });
        throw new Error('Máy chủ API đang trả HTML thay vì JSON. Kiểm tra route/proxy backend.');
      }

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        console.error('[API] Parse Error', { url, status: res.status, rawPreview: raw.slice(0, 200) });
        throw new Error('Máy chủ API trả dữ liệu không hợp lệ (không phải JSON).');
      }

      if (!res.ok || data?.success === false) {
        const errorMessage = data?.message || data?.error || data?.errorType || 'Đã xảy ra lỗi.';
        const err: any = new Error(errorMessage);
        err.status = res.status;
        err.errorType = data?.errorType || data?.error;
        err.data = data;

        // Skip retry for definitively failing client errors (400, 401, 403, 404) or application-level errors
        const isClientError = res.status >= 400 && res.status < 500;
        const isDocNotFound = res.status === 404;
        const isAppError = data?.success === false && !isStartingServer;

        if ((isClientError && !isStartingServer) || isAppError || isDocNotFound) {
          throw err; // Stop retrying immediately
        }
        
        // Let it fall through to catch block for potential retry
        throw err;
      }

      return data as T;
    } catch (err: any) {
      lastError = err;

      if (err?.name === 'AbortError') {
        const timeoutErr: any = new Error('Yêu cầu hết thời gian. Vui lòng thử lại.');
        timeoutErr.status = 408;
        lastError = timeoutErr;
      }

      // Handle Safari "Load failed" / Network errors
      if (err instanceof TypeError && (err.message === 'Load failed' || err.message === 'Failed to fetch')) {
        const networkErr: any = new Error('Lỗi kết nối mạng hoặc máy chủ đang khởi động lại. Vui lòng đợi trong giây lát.');
        networkErr.status = 503; // Treat as 503 to allow retries
        lastError = networkErr;
        err = networkErr; // Re-assign so retry logic sees the new status
      }

      // If it's a definitive error we shouldn't retry, re-throw it
      if (err.status && ((err.status >= 400 && err.status < 500) || err.status === 410)) {
        throw err;
      }

      if (attempt < retries) {
        // Only retry on network errors, 5xx server errors, or timeouts
        const shouldRetry = !err.status || (err.status >= 500);
        if (shouldRetry) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
      }
      throw lastError;
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
