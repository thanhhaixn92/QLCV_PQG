import { describe, expect, it } from "vitest";
import { validateEditorialContent } from "./editorialValidation";

describe("editorial validation", () => {
  it("reports invalid document kinds", () => {
    const result = validateEditorialContent({ kind: "bad-kind", title: "T" } as any);
    expect(result.errors[0]).toContain("Loại tài liệu không hợp lệ");
  });

  it("warns when communication articles miss sapo", () => {
    const result = validateEditorialContent({
      kind: "news",
      title: "Tin hoạt động",
      sections: [{ heading: "Nội dung", content: "Chi tiết" }],
    } as any);
    expect(result.warnings).toContain("Bài viết truyền thông nên có phần Sapo (mở đầu).");
  });
});
