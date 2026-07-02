import { describe, expect, it } from "vitest";
import { createApiNotFoundResponse } from "./apiResponses";

describe("API responses", () => {
  it("keeps unknown API routes as JSON error objects", () => {
    expect(createApiNotFoundResponse("GET", "/api/unknown")).toEqual({
      success: false,
      errorType: "api_route_not_found",
      message: "Không tìm thấy API route: GET /api/unknown",
      path: "/api/unknown",
      method: "GET",
    });
  });
});
