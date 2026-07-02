export function createApiNotFoundResponse(method: string, originalUrl: string) {
  return {
    success: false,
    errorType: "api_route_not_found",
    message: `Không tìm thấy API route: ${method} ${originalUrl}`,
    path: originalUrl,
    method,
  };
}
