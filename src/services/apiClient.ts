export interface ApiFetchOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  allowHtmlRetry?: boolean;
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[UNHANDLED REJECTION]', {
      message: event.reason?.message || 'Unknown error',
      error: event.reason,
      timestamp: new Date().toISOString()
    });
  });
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
  const method = fetchOptions.method || 'GET';

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

        // Only log and retry 'Backend chưa sẵn sàng' if status is NOT 2xx AND it's clearly a Starting Server page
        const is2xx = res.status >= 200 && res.status < 300;
        if (allowHtmlRetry && isStartingServer && !is2xx && attempt < retries) {
          console.warn('[API] Backend chưa sẵn sàng, retry...', {
            url,
            attempt: attempt + 1,
            status: res.status
          });
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }

        // If it's HTML with status 200-299 but contains "Starting Server", we might still need to retry but let's be quiet about it or check if it's genuinely the proxy
        if (allowHtmlRetry && isStartingServer && is2xx && attempt < retries) {
          // We retry but don't log the "Backend chưa sẵn sàng" message to satisfy YÊU CẦU 1
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }

        // If it's HTML with status 200 and NOT starting server, don't retry, just fail
        const errMsg = 'API trả HTML thay vì JSON. Vui lòng reload preview.';
        console.error(`[API ERROR] ${method} ${url} - Status: ${res.status} - Error: html_response - Message: ${errMsg}`);
        console.error('[API]', {
          method,
          path: url,
          status: res.status,
          errorCode: 'html_response',
          errorType: 'html_response',
          message: errMsg,
          timestamp: new Date().toISOString(),
          retryCount: attempt
        });
        const err = new Error(errMsg);
        (err as any)._logged = true;
        (err as any).status = res.status;
        throw err;
      }

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        const errMsg = 'Máy chủ API trả dữ liệu không hợp lệ (không phải JSON).';
        console.error(`[API ERROR] ${method} ${url} - Status: ${res.status} - Error: json_parse_error - Message: ${errMsg}`);
        console.error('[API]', {
          method,
          path: url,
          status: res.status,
          errorCode: 'json_parse_error',
          errorType: 'json_parse_error',
          message: errMsg,
          timestamp: new Date().toISOString(),
          retryCount: attempt
        });
        const err = new Error(errMsg);
        (err as any)._logged = true;
        (err as any).status = res.status;
        throw err;
      }

      // If status is 200-299, we should NOT retry even if it has success: false (unless specified)
      if (res.ok && data?.success !== false) {
        return data as T;
      }

      if (!res.ok || data?.success === false) {
        const errorMessage = data?.message || data?.error || data?.errorType || 'Đã xảy ra lỗi.';
        const err: any = new Error(errorMessage);
        err.status = res.status;
        err.errorType = data?.errorType || data?.error;
        err.errorCode = data?.error;
        err.data = data;

        console.error(`[API ERROR] ${method} ${url} - Status: ${res.status} - Error: ${err.errorType || err.errorCode || 'unknown'} - Message: ${errorMessage}`);
        const apiError = {
          method,
          path: url,
          status: res.status,
          errorCode: data?.error,
          errorType: data?.errorType,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          retryCount: attempt
        };
        console.error('[API]', apiError);
        err._logged = true;

        // Skip retry for definitively failing client errors (400, 401, 403, 404) or application-level errors
        const isClientError = res.status >= 400 && res.status < 500;
        const isDocNotFound = res.status === 404;
        const isAppError = data?.success === false; // Any success: false is an app error
        
        // Specific AI errors that should NOT be retried on frontend (since backend already retries or they are terminal)
        const isQuotaError = err.errorType === 'quota_exceeded' || errorMessage.toLowerCase().includes('hạn mức');
        const isOverloadedError = err.errorType === 'ai_overloaded' || errorMessage.toLowerCase().includes('quá tải');

        if (isClientError || isAppError || isDocNotFound || isQuotaError || isOverloadedError) {
          throw err; // Stop retrying immediately
        }
        
        // Let it fall through to catch block for potential retry (e.g. 500, 502, 503, 504 server errors)
        throw err;
      }

      return data as T;
    } catch (err: any) {
      if (!err._logged) {
        // Prepare properties
        let errorStatus = err.status || 500;
        let errorMsg = err.message;

        if (err?.name === 'AbortError') {
          errorMsg = 'Yêu cầu hết thời gian. Vui lòng thử lại.';
          errorStatus = 408;
        }

        // Handle Safari "Load failed" / Network errors
        if (err instanceof TypeError && (err.message === 'Load failed' || err.message === 'Failed to fetch')) {
          errorMsg = 'Lỗi kết nối mạng hoặc máy chủ đang khởi động lại. Vui lòng đợi trong giây lát.';
          errorStatus = 503; // Treat as 503 to allow retries
        }

        console.error(`[API ERROR] ${method} ${url} - Status: ${errorStatus} - Error: ${err.errorType || err.name || 'unknown'} - Message: ${errorMsg}`);
        const apiError = {
          method,
          path: url,
          status: errorStatus,
          errorCode: err.errorCode || err.name,
          errorType: err.errorType || err.name,
          message: errorMsg,
          timestamp: new Date().toISOString(),
          retryCount: attempt
        };
        console.error('[API]', apiError);
        
        // Cannot assign to readonly property 'message' on standard errors in strict mode
        const normalizedErr: any = new Error(errorMsg);
        normalizedErr.status = errorStatus;
        normalizedErr.errorType = err.errorType || err.name;
        normalizedErr.errorCode = err.errorCode || err.name;
        normalizedErr._logged = true;
        
        err = normalizedErr;
      }
      
      lastError = err;

      // If it's a definitive error we shouldn't retry, re-throw it
      if (err.status && ((err.status >= 400 && err.status < 500) || err.status === 410)) {
        throw err;
      }
      
      // Also don't retry if it's an app-level error found in data
      if (err.errorType === 'quota_exceeded' || err.errorType === 'ai_overloaded') {
         throw err;
      }

      if (attempt < retries) {
        // Only retry on network errors, 5xx server errors (not overloaded), or timeouts
        const shouldRetry = !err.status || (err.status >= 500 && err.status !== 503 && err.errorType !== 'ai_overloaded');
        
        // Actually, for 503, YÊU CẦU 1 says don't retry if it's ai_overloaded.
        // If status is 503 but it's NOT ai_overloaded, maybe it's the backend really being down.
        
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
