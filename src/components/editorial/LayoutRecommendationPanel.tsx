import React from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, FileText, LayoutTemplate, Loader2, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  getArticleLayout,
  getDefaultArticleLayout,
  listArticleLayouts,
  type ArticleLayoutDefinition,
} from "../../lib/publishing/layoutRegistry";
import type { ArticleBlockType } from "../../lib/publishing/articleDocument";

export type EditorialContentIntent =
  | "tin-ngan"
  | "bai-chuyen-sau"
  | "tong-thuat-hoat-dong"
  | "bai-thanh-tuu"
  | "giai-thich-chinh-sach"
  | "ho-so-don-vi"
  | "anh-dan-dat";

export type EditorialLengthEstimate = "1–2 trang" | "3–4 trang" | "5–7 trang";

export interface LayoutRecommendationReason {
  summary: string;
  matchedSignals: string[];
}

export interface LayoutRecommendation {
  layout: ArticleLayoutDefinition;
  contentIntent: EditorialContentIntent;
  lengthEstimate: EditorialLengthEstimate;
  reason: LayoutRecommendationReason;
  plannedBlocks: ArticleBlockType[];
}

interface LayoutRecommendationPanelProps {
  userBrief: string;
  recommendations: LayoutRecommendation[];
  isLoading?: boolean;
  errorMessage?: string;
  onSelectLayout: (recommendation: LayoutRecommendation) => void;
  onUseDefaultLayout: () => void;
  onBackToBrief: () => void;
}

const CONTENT_INTENT_LABELS: Record<EditorialContentIntent, string> = {
  "tin-ngan": "Tin ngắn / tin website",
  "bai-chuyen-sau": "Bài chuyên sâu",
  "tong-thuat-hoat-dong": "Tổng thuật hoạt động",
  "bai-thanh-tuu": "Bài thành tựu / số liệu",
  "giai-thich-chinh-sach": "Giải thích chính sách",
  "ho-so-don-vi": "Hồ sơ đơn vị",
  "anh-dan-dat": "Ảnh dẫn dắt",
};

const BLOCK_LABELS: Record<ArticleBlockType, string> = {
  title: "Tiêu đề",
  sapo: "Sapo",
  "section-heading": "Đề mục",
  paragraph: "Đoạn nội dung",
  "lead-in-list": "Danh sách nhấn mạnh",
  "bullet-list": "Gạch đầu dòng",
  "ordered-list": "Danh sách đánh số",
  quote: "Trích dẫn",
  "fact-box": "Fact box",
  table: "Bảng",
  "figure-placeholder": "Vị trí ảnh",
  callout: "Callout",
  conclusion: "Kết luận",
  "page-break": "Ngắt trang",
};

const KEYWORD_GROUPS = {
  shortNews: ["tin", "website", "ngắn", "ngan", "hoạt động", "hoat dong"],
  unitProfile: ["giới thiệu đơn vị", "gioi thieu don vi", "hồ sơ", "ho so", "năng lực", "nang luc", "tổ chức", "to chuc"],
  achievement: ["thành tựu", "thanh tuu", "số liệu", "so lieu", "kết quả", "ket qua", "5 tháng", "5 thang", "báo cáo", "bao cao"],
  policy: ["chính sách", "chinh sach", "quy định", "quy dinh", "đề án", "de an", "căn cứ", "can cu", "pháp lý", "phap ly"],
  photoLed: ["ảnh", "anh", "hình ảnh", "hinh anh", "phóng sự ảnh", "phong su anh"],
};

function normalizeBrief(value: string): string {
  return value.toLocaleLowerCase("vi-VN").replace(/\s+/g, " ").trim();
}

function findSignals(normalizedBrief: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => normalizedBrief.includes(keyword));
}

function resolveLayout(layoutId: string): ArticleLayoutDefinition | undefined {
  const direct = listArticleLayouts().find((layout) => layout.layoutId === layoutId);
  return direct ? getArticleLayout(direct.layoutId, direct.layoutVersion) : undefined;
}

function estimateLength(layout: ArticleLayoutDefinition): EditorialLengthEstimate {
  if (layout.estimatedPages <= 2) return "1–2 trang";
  if (layout.estimatedPages <= 4) return "3–4 trang";
  return "5–7 trang";
}

function createRecommendation(
  layoutId: string,
  contentIntent: EditorialContentIntent,
  reasonSummary: string,
  matchedSignals: string[],
): LayoutRecommendation | undefined {
  const layout = resolveLayout(layoutId);
  if (!layout) return undefined;

  return {
    layout,
    contentIntent,
    lengthEstimate: estimateLength(layout),
    reason: {
      summary: reasonSummary,
      matchedSignals,
    },
    plannedBlocks: layout.blockSequence.slice(0, 7),
  };
}

function uniqueRecommendations(recommendations: Array<LayoutRecommendation | undefined>): LayoutRecommendation[] {
  const seen = new Set<string>();
  const compact: LayoutRecommendation[] = [];

  recommendations.forEach((recommendation) => {
    if (!recommendation) return;
    const key = `${recommendation.layout.layoutId}@${recommendation.layout.layoutVersion}`;
    if (seen.has(key)) return;
    seen.add(key);
    compact.push(recommendation);
  });

  return compact.slice(0, 3);
}

export function recommendArticleLayoutsForBrief(userBrief: string): LayoutRecommendation[] {
  const normalizedBrief = normalizeBrief(userBrief);
  const shortNewsSignals = findSignals(normalizedBrief, KEYWORD_GROUPS.shortNews);
  const unitProfileSignals = findSignals(normalizedBrief, KEYWORD_GROUPS.unitProfile);
  const achievementSignals = findSignals(normalizedBrief, KEYWORD_GROUPS.achievement);
  const policySignals = findSignals(normalizedBrief, KEYWORD_GROUPS.policy);
  const photoSignals = findSignals(normalizedBrief, KEYWORD_GROUPS.photoLed);

  if (photoSignals.length > 0) {
    return uniqueRecommendations([
      createRecommendation(
        "photo-led-placeholder-a4",
        "anh-dan-dat",
        "Phù hợp bài có nhiều hình ảnh/phóng sự ảnh, ưu tiên placeholder ảnh, chú thích và nhịp nội dung trực quan.",
        photoSignals,
      ),
      createRecommendation(
        "event-recap-a4",
        "tong-thuat-hoat-dong",
        "Phù hợp bài phản ánh hoạt động trực quan, cần bối cảnh, diễn biến, kết quả và 2–3 vị trí ảnh.",
        [...photoSignals, ...shortNewsSignals],
      ),
      createRecommendation(
        "standard-news-a4",
        "tin-ngan",
        "Phù hợp bản tin website có ảnh minh họa, giữ cấu trúc tin rõ và dễ xuất bản A4.",
        photoSignals,
      ),
    ]);
  }

  if (unitProfileSignals.length > 0) {
    return uniqueRecommendations([
      createRecommendation(
        "unit-profile-a4",
        "ho-so-don-vi",
        "Phù hợp bài giới thiệu đơn vị 5–7 trang, cần các khối hồ sơ, năng lực, tổ chức và định hướng.",
        unitProfileSignals,
      ),
      createRecommendation(
        "feature-article-a4",
        "bai-chuyen-sau",
        "Phù hợp nội dung dài hơn, cần nhiều đề mục và nhịp kể chuyện về truyền thống, con người, năng lực.",
        unitProfileSignals,
      ),
      createRecommendation(
        "data-achievement-a4",
        "bai-thanh-tuu",
        "Phù hợp nếu hồ sơ đơn vị cần nhấn mạnh kết quả, số liệu hoặc thành tựu nổi bật.",
        unitProfileSignals,
      ),
    ]);
  }

  if (achievementSignals.length > 0) {
    return uniqueRecommendations([
      createRecommendation(
        "data-achievement-a4",
        "bai-thanh-tuu",
        "Phù hợp bài có nhiều số liệu/kết quả, cần block KPI và thành tựu nổi bật.",
        achievementSignals,
      ),
      createRecommendation(
        "event-recap-a4",
        "tong-thuat-hoat-dong",
        "Phù hợp bài tổng kết hoạt động, nhấn mạnh diễn biến, kết quả và ý nghĩa sau sự kiện/giai đoạn.",
        [...achievementSignals, ...shortNewsSignals],
      ),
      createRecommendation(
        "standard-news-a4",
        "tin-ngan",
        "Phù hợp khi cần chuyển kết quả báo cáo thành tin/bài phản ánh ngắn gọn cho website.",
        achievementSignals,
      ),
    ]);
  }

  if (policySignals.length > 0) {
    return uniqueRecommendations([
      createRecommendation(
        "policy-admin-a4",
        "giai-thich-chinh-sach",
        "Phù hợp bài chính sách/quy định, ưu tiên cấu trúc rõ, căn cứ và các luận điểm hành chính.",
        policySignals,
      ),
      createRecommendation(
        "explainer-a4",
        "giai-thich-chinh-sach",
        "Phù hợp bài giải thích chính sách/chủ đề chuyên môn theo từng ý dễ đọc.",
        policySignals,
      ),
      createRecommendation(
        "feature-article-a4",
        "bai-chuyen-sau",
        "Phù hợp nếu cần phát triển thành bài phân tích chuyên sâu có bối cảnh và tác động.",
        policySignals,
      ),
    ]);
  }

  if (shortNewsSignals.length > 0) {
    return uniqueRecommendations([
      createRecommendation(
        "standard-news-a4",
        "tin-ngan",
        "Phù hợp bài tin website ngắn, ưu tiên tiêu đề rõ, sapo, nội dung chính và 1–2 placeholder hình ảnh.",
        shortNewsSignals,
      ),
      createRecommendation(
        "event-recap-a4",
        "tong-thuat-hoat-dong",
        "Phù hợp bài tổng thuật hoạt động, cần bối cảnh, diễn biến, kết quả và ý nghĩa.",
        shortNewsSignals,
      ),
      createRecommendation(
        "photo-led-placeholder-a4",
        "anh-dan-dat",
        "Phù hợp nếu hoạt động có nhiều hình ảnh và cần nhấn mạnh trải nghiệm trực quan.",
        shortNewsSignals,
      ),
    ]);
  }

  return uniqueRecommendations([
    createRecommendation(
      "standard-news-a4",
      "tin-ngan",
      "Layout mặc định an toàn cho tin/bài phản ánh thông thường, dễ đọc trên A4 và website.",
      [],
    ),
    createRecommendation(
      "feature-article-a4",
      "bai-chuyen-sau",
      "Phù hợp khi yêu cầu chưa rõ nhưng có thể phát triển thành bài chuyên sâu nhiều đề mục.",
      [],
    ),
    createRecommendation(
      "explainer-a4",
      "giai-thich-chinh-sach",
      "Phù hợp khi nội dung cần giải thích theo cấu trúc từng ý và kiểm soát mạch lập luận.",
      [],
    ),
  ]);
}

function getPrimaryIntent(recommendations: LayoutRecommendation[]): string {
  const primary = recommendations[0];
  return primary ? CONTENT_INTENT_LABELS[primary.contentIntent] : "Chưa xác định";
}

function getPrimaryLength(recommendations: LayoutRecommendation[]): string {
  return recommendations[0]?.lengthEstimate || "Chưa xác định";
}

function getBriefPreview(userBrief: string): string {
  const trimmed = userBrief.trim();
  if (!trimmed) return "Chưa có mô tả yêu cầu. Hệ thống sẽ dùng layout mặc định an toàn.";
  return trimmed.length > 360 ? `${trimmed.slice(0, 360)}…` : trimmed;
}

export const LayoutRecommendationPanel = ({
  userBrief,
  recommendations,
  isLoading = false,
  errorMessage,
  onSelectLayout,
  onUseDefaultLayout,
  onBackToBrief,
}: LayoutRecommendationPanelProps) => {
  const defaultLayout = getDefaultArticleLayout();

  return (
    <section className="p-4 sm:p-6 flex-1 w-full overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 bg-gradient-to-r from-[#002D56] to-slate-800 text-white">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Đề xuất layout A4
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Xác nhận layout trước khi tạo bài</h2>
                <p className="max-w-3xl text-sm leading-6 text-blue-50/90">
                  Hệ thống phân tích yêu cầu và đề xuất layout từ Layout Registry. Bạn có thể chọn layout phù hợp hoặc dùng layout mặc định để tiếp tục.
                </p>
              </div>
              <button
                type="button"
                onClick={onBackToBrief}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại chỉnh yêu cầu
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                <FileText className="h-4 w-4 text-[#002D56]" />
                Tóm tắt yêu cầu
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{getBriefPreview(userBrief)}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Loại nội dung dự kiến</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{getPrimaryIntent(recommendations)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Độ dài dự kiến</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{getPrimaryLength(recommendations)}</p>
              </div>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang chuẩn bị đề xuất layout...
          </div>
        )}

        {errorMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-bold">Không thể xác thực layout đề xuất.</p>
              <p className="mt-1 leading-6">{errorMessage}</p>
            </div>
          </div>
        )}

        {!isLoading && recommendations.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <LayoutTemplate className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Chưa có đề xuất layout phù hợp.</p>
            <p className="mt-1 text-xs text-slate-500">Bạn vẫn có thể dùng layout mặc định: {defaultLayout.label}.</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((recommendation) => (
            <article
              key={`${recommendation.layout.layoutId}-${recommendation.layout.layoutVersion}`}
              className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">
                    {CONTENT_INTENT_LABELS[recommendation.contentIntent]}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{recommendation.layout.label}</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  {recommendation.layout.estimatedPages} trang
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">{recommendation.layout.description}</p>

              <div className="mt-4 space-y-3 text-xs text-slate-600">
                <div>
                  <p className="font-bold text-slate-800">Phù hợp cho</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recommendation.layout.recommendedFor.map((item) => (
                      <span key={item} className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="font-bold text-slate-800">Mật độ</p>
                    <p className="mt-1 capitalize text-slate-600">{recommendation.layout.visualDensity}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="font-bold text-slate-800">Độ dài</p>
                    <p className="mt-1 text-slate-600">{recommendation.lengthEstimate}</p>
                  </div>
                </div>

                <div>
                  <p className="font-bold text-slate-800">Block chính dự kiến</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recommendation.plannedBlocks.map((block, index) => (
                      <span key={`${block}-${index}`} className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600">
                        {BLOCK_LABELS[block] || block}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-bold text-emerald-800">Lý do đề xuất</p>
                      <p className="mt-1 leading-5 text-emerald-700">{recommendation.reason.summary}</p>
                      {recommendation.reason.matchedSignals.length > 0 && (
                        <p className="mt-2 text-[11px] font-semibold text-emerald-700/80">
                          Tín hiệu: {recommendation.reason.matchedSignals.slice(0, 5).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectLayout(recommendation)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#002D56] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
              >
                <CheckCircle2 className="h-4 w-4" />
                Chọn layout này
              </button>
            </article>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Muốn tiếp tục nhanh?</p>
            <p className="mt-1 text-xs text-slate-500">Dùng layout mặc định an toàn: {defaultLayout.label} ({defaultLayout.estimatedPages} trang).</p>
          </div>
          <button
            type="button"
            onClick={onUseDefaultLayout}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800",
              recommendations.length === 0 && "border-blue-200 bg-blue-50 text-blue-800",
            )}
          >
            <LayoutTemplate className="h-4 w-4" />
            Dùng layout mặc định
          </button>
        </div>
      </div>
    </section>
  );
};
