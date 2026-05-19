export type SlideDeckTheme =
  | "vms_enterprise"
  | "navy_clean"
  | "technical_report"
  | "training_light"
  | "conference_formal";

export interface SlideThemeConfig {
  id: SlideDeckTheme;
  label: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    mutedText: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
}

export const SLIDE_THEMES: Record<SlideDeckTheme, SlideThemeConfig> = {
  vms_enterprise: {
    id: "vms_enterprise",
    label: "Doanh nghiệp VMS",
    description: "Nhận diện màu navy chủ đạo của Hoa Tiêu Miền Bắc.",
    colors: {
      primary: "002D56",
      secondary: "F1F5F9",
      accent: "10B981", // emerald
      background: "FFFFFF",
      text: "0F172A",
      mutedText: "475569"
    },
    fonts: {
      heading: "Arial",
      body: "Arial"
    }
  },
  navy_clean: {
    id: "navy_clean",
    label: "Navy tối giản",
    description: "Sạch sẽ, ít màu sắc dư thừa, phù hợp báo cáo lãnh đạo.",
    colors: {
      primary: "1E293B",
      secondary: "F8FAFC",
      accent: "3B82F6",
      background: "FFFFFF",
      text: "1E293B",
      mutedText: "64748B"
    },
    fonts: {
      heading: "Arial",
      body: "Arial"
    }
  },
  technical_report: {
    id: "technical_report",
    label: "Báo cáo kỹ thuật",
    description: "Tập trung nội dung, phù hợp sơ đồ bảng biểu.",
    colors: {
      primary: "334155",
      secondary: "E2E8F0",
      accent: "F59E0B",
      background: "FAFAF9",
      text: "1C1917",
      mutedText: "57534E"
    },
    fonts: {
      heading: "Courier New",
      body: "Arial"
    }
  },
  training_light: {
    id: "training_light",
    label: "Đào tạo nội bộ",
    description: "Nền sáng, sắc màu tươi tắn, dễ đọc.",
    colors: {
      primary: "0369A1",
      secondary: "E0F2FE",
      accent: "0EA5E9",
      background: "FFFFFF",
      text: "0F172A",
      mutedText: "334155"
    },
    fonts: {
      heading: "Verdana",
      body: "Verdana"
    }
  },
  conference_formal: {
    id: "conference_formal",
    label: "Hội nghị trang trọng",
    description: "Sang trọng, độ tương phản cao, phù hợp màn hình lớn.",
    colors: {
      primary: "000000",
      secondary: "1E293B",
      accent: "D4AF37", // gold
      background: "FFFFFF",
      text: "111827",
      mutedText: "4B5563"
    },
    fonts: {
      heading: "Georgia",
      body: "Arial"
    }
  }
};
