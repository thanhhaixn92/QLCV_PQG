import { ProposalDataAnalysisResponse, DetectedDataPoint, MissingDataPoint } from './types';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function analyzeDataLocally(rawText: string | null | undefined): ProposalDataAnalysisResponse {
  if (!rawText || !rawText.trim()) {
    return {
      summary: "Chưa có nội dung để phân tích.",
      detectedData: [],
      missingData: [],
      risks: [],
      suggestedTasks: [],
      conclusion: ""
    };
  }

  const lowerText = rawText.toLowerCase();
  
  const detectedData: DetectedDataPoint[] = [];
  const missingData: MissingDataPoint[] = [];
  let detectedCount = 0;
  
  // A mapping of keywords to properties
  const rules = [
    {
      keywords: ["tổ chức", "bộ máy", "phòng ban", "bộ phận"],
      group: "Tổ chức bộ máy",
    },
    {
      keywords: ["lao động", "nhân sự", "người", "nhân viên", "ai"],
      group: "Lao động",
    },
    {
      keywords: ["hoa tiêu", "cấp hạng", "hạng"],
      group: "Hoa tiêu",
    },
    {
      keywords: ["phương tiện", "tàu", "canô", "xe", "thiết bị", "thủy", "bộ"],
      group: "Phương tiện",
    },
    {
      keywords: ["tài chính", "doanh thu", "chi phí", "lợi nhuận", "tiền"],
      group: "Tài chính",
    },
    {
      keywords: ["quy chế", "quy định", "văn bản", "thông tư", "nghị định"],
      group: "Quy chế",
    },
    {
      keywords: ["điều hành", "lịch tàu", "kế hoạch"],
      group: "Điều hành",
    },
    {
      keywords: ["sản lượng"],
      group: "Sản lượng",
    }
  ];

  const lines = rawText.split("\n").filter(l => l.trim().length > 0);
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Determine status
    let status = "available";
    if (lowerLine.includes("chưa có") || lowerLine.includes("thiếu") || lowerLine.includes("cần bổ sung")) {
      status = "missing";
    } else if (lowerLine.includes("có một phần") || lowerLine.includes("chưa đủ") || lowerLine.includes("đang")) {
      status = "partial";
    } else if (lowerLine.includes("cần xác nhận") || lowerLine.includes("sơ bộ")) {
      status = "needs_verification";
    }
    
    // Determine group
    let matchingGroup = "Khác";
    for (const rule of rules) {
      if (rule.keywords.some(k => lowerLine.includes(k))) {
        matchingGroup = rule.group;
        break;
      }
    }

    // Try to extract some context or value
    // E.g. "Có 10 hoa tiêu hạng 1"
    
    const isNumberMention = /\d+/.test(line);
    const hasDate = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line);

    if (isNumberMention || hasDate || lowerLine.includes("đã có") || lowerLine.includes("ban hành") || lowerLine.includes("hoàn thành")) {
        // likely data point
        detectedCount++;
        if (status === "missing") {
           missingData.push({
             group: matchingGroup,
             title: line.substring(0, 80) + (line.length > 80 ? "..." : ""),
             reason: "Nhận diện thiếu số liệu từ văn bản",
             priority: "medium",
             suggestedSource: "Đề nghị cung cấp",
             responsibleUnit: "Ban Giám đốc",
             linkedOutlineCodes: []
           });
        } else {
           detectedData.push({
             group: matchingGroup,
             title: line.substring(0, 80) + (line.length > 80 ? "..." : ""),
             valueText: line,
             status: status as any,
             priority: "medium",
             purpose: "Trích xuất cục bộ",
             suggestedSource: "Văn bản thô",
             responsibleUnit: "",
             periodRequired: "",
             breakdownRequired: "",
             verificationNote: "Kết quả phân tích cục bộ, cần kiểm tra lại trước khi đưa vào đề án.",
             linkedOutlineCodes: [],
             confidence: "low"
           });
        }
    }
  }

  // Handle case where we didn't find specific numbered lines but want to capture the text
  if (detectedCount === 0 && lines.length > 0) {
      detectedData.push({
         group: "Khác",
         title: "Dữ liệu tổng hợp",
         valueText: rawText.substring(0, 500) + (rawText.length > 500 ? "..." : ""),
         status: "available",
         priority: "medium",
         purpose: "Trích xuất cục bộ tóm tắt",
         suggestedSource: "Văn bản thô",
         responsibleUnit: "",
         periodRequired: "",
         breakdownRequired: "",
         verificationNote: "Kết quả phân tích cục bộ, cần kiểm tra lại trước khi đưa vào đề án.",
         linkedOutlineCodes: [],
         confidence: "low"
      });
  }

  return {
    summary: "Đã phân tích cục bộ nội dung thô (Không dùng AI). Kết quả mang tính chất tham khảo dựa trên nhận diện từ khóa.",
    detectedData,
    missingData,
    risks: ["Phân tích cục bộ có thể bỏ sót ngữ cảnh phức tạp."],
    suggestedTasks: [],
    conclusion: "Vui lòng xem lại và chỉnh sửa các phân loại cho chính xác."
  };
}
