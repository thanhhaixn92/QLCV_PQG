import { describe, expect, it } from "vitest";
import {
  cmToTwip,
  parseFigurePlaceholderText,
  runsToPlainText,
} from "./exportArticleModel";

describe("export article model", () => {
  it("converts centimeters to twips", () => {
    expect(cmToTwip(2.54)).toBe(1440);
  });

  it("preserves run spacing when flattening text", () => {
    expect(runsToPlainText([{ text: "Hoa " }, { text: "tiêu" }])).toBe("Hoa tiêu");
  });

  it("parses figure placeholders", () => {
    const parsed = parseFigurePlaceholderText("[ẢNH: Cảng Hải Phòng - Tàu vào luồng]");
    expect(parsed).toEqual({
      label: "KHUNG ẢNH: Cảng Hải Phòng - Tàu vào luồng",
      caption: undefined,
    });
  });
});
