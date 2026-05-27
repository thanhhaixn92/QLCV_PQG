export interface ProposalTemplateOutlineItem {
  id: string;
  title: string;
  level: number;
  order: number;
  parentId?: string;
  code?: string;
  guidance?: string;
  itemType?: "section" | "content" | "appendix" | "table" | "attachment";
  isContainer?: boolean;
  canHaveDraft?: boolean;
  countInProgress?: boolean;
}

export interface ProposalTemplate {
  id: string;
  name: string;
  description: string;
  outlineItems: ProposalTemplateOutlineItem[];
}

export const STANDARD_PROPOSAL_TEMPLATE: ProposalTemplate = {
  id: 'standard_proposal',
  name: 'Cấu trúc đề án chuẩn',
  description: 'Mẫu đề án hành chính sự nghiệp/doanh nghiệp phổ thông',
  outlineItems: [
    { id: '1', title: 'MỞ ĐẦU', level: 1, order: 0, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: '2', title: 'PHẦN I. Căn cứ xây dựng đề án và bối cảnh thực hiện', level: 1, order: 1, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: '3', title: 'PHẦN II. Thực trạng tổ chức và hoạt động của đối tượng đề án', level: 1, order: 2, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: '4', title: 'PHẦN III. Phương án đề xuất', level: 1, order: 3, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: '5', title: 'PHẦN IV. Đánh giá tác động của đề án', level: 1, order: 4, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: '6', title: 'PHẦN V. Kế hoạch và tổ chức thực hiện', level: 1, order: 5, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: '7', title: 'PHẦN VI. Kết luận và kiến nghị', level: 1, order: 6, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: '8', title: 'PHỤ LỤC KÈM THEO ĐỀ ÁN', level: 1, order: 7, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false }
  ]
};

export const RESTRUCTURE_AFTER_MERGER_TEMPLATE: ProposalTemplate = {
  id: 'pilot_restructure_after_merger',
  name: 'Mẫu đề án rà soát, kiện toàn tổ chức bộ máy sau hợp nhất',
  description: 'Chuyên biệt cho Công ty TNHH MTV Hoa tiêu hàng hải miền Bắc',
  outlineItems: [
    // MỞ ĐẦU
    { id: 'm1', title: 'MỞ ĐẦU', level: 1, order: 0, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: 'm1_1', title: '1. Sự cần thiết xây dựng đề án', level: 2, order: 1, parentId: 'm1', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'm1_2', title: '2. Cơ sở xây dựng đề án', level: 2, order: 2, parentId: 'm1', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'm1_3', title: '3. Mục tiêu của đề án', level: 2, order: 3, parentId: 'm1', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'm1_4', title: '4. Phạm vi, đối tượng, thời kỳ xây dựng đề án', level: 2, order: 4, parentId: 'm1', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'm1_5', title: '5. Phương pháp xây dựng đề án và nguồn số liệu', level: 2, order: 5, parentId: 'm1', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'm1_6', title: '6. Kết cấu đề án', level: 2, order: 6, parentId: 'm1', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },

    // PHẦN I
    { id: 'p1', title: 'PHẦN I. Bối cảnh, cơ sở ...', level: 1, order: 7, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: 'p1_1', title: '1.1. Bối cảnh sau hợp nhất', level: 2, order: 8, parentId: 'p1', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p1_2', title: '1.2. Yêu cầu đặt ra ...', level: 2, order: 9, parentId: 'p1', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p1_3', title: '1.3. Căn cứ chính trị, ...', level: 2, order: 10, parentId: 'p1', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p1_4', title: '1.4. Nguyên tắc xây dựng đề án', level: 2, order: 11, parentId: 'p1', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },

    // PHẦN II
    { id: 'p2', title: 'PHẦN II. Thực trạng tổ chức ...', level: 1, order: 12, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: 'p2_1', title: '2.1. Khái quát về ...', level: 2, order: 13, parentId: 'p2', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p2_2', title: '2.2. Thực trạng tổ chức tại Văn phòng Công ty', level: 2, order: 14, parentId: 'p2', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p2_3', title: '2.3. Thực trạng tổ chức tại Chi nhánh Hoa tiêu III', level: 2, order: 15, parentId: 'p2', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p2_4', title: '2.4. Thực trạng tổ chức tại Chi nhánh Hoa tiêu IV', level: 2, order: 16, parentId: 'p2', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p2_5', title: '2.5. Thực trạng tổ chức tại Chi nhánh Hoa tiêu VI', level: 2, order: 17, parentId: 'p2', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p2_6', title: '2.6. Thực trạng điều hành hoa tiêu, phương tiện, dịch vụ hàng hải', level: 2, order: 18, parentId: 'p2', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p2_7', title: '2.7. Thực trạng nhân sự, lao động, tiền lương, đào tạo', level: 2, order: 19, parentId: 'p2', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p2_8', title: '2.8. Thực trạng tài chính, tài sản, phương tiện', level: 2, order: 20, parentId: 'p2', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p2_9', title: '2.9. Đánh giá chung: kết quả, hạn chế, nguyên nhân, vấn đề đặt ra', level: 2, order: 21, parentId: 'p2', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },

    // PHẦN III
    { id: 'p3', title: 'PHẦN III. Phương án kiện toàn tổ chức bộ máy', level: 1, order: 22, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: 'p3_1', title: '3.1. Quan điểm và mục tiêu kiện toàn', level: 2, order: 23, parentId: 'p3', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p3_2', title: '3.2. Phương án bổ sung 01 Phó Giám đốc phụ trách hoa tiêu', level: 2, order: 24, parentId: 'p3', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p3_3', title: '3.3. Phương án thành lập Phòng Điều hành trung tâm và Dịch vụ hàng hải', level: 2, order: 25, parentId: 'p3', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p3_4', title: '3.4. Kiện toàn chức năng, nhiệm vụ các phòng tại Văn phòng Công ty', level: 2, order: 26, parentId: 'p3', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p3_5', title: '3.5. Phương án tổ chức lại các phòng tại chi nhánh', level: 2, order: 27, parentId: 'p3', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p3_6', title: '3.6. So sánh, lựa chọn phương án tối ưu', level: 2, order: 28, parentId: 'p3', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p3_7', title: '3.7. Phương án bố trí nhân sự sau kiện toàn', level: 2, order: 29, parentId: 'p3', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p3_8', title: '3.8. Phương án sửa đổi, bổ sung hệ thống quy chế nội bộ', level: 2, order: 30, parentId: 'p3', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },

    // PHẦN IV
    { id: 'p4', title: 'PHẦN IV. Đánh giá tác động', level: 1, order: 31, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: 'p4_1', title: '4.1. Tác động đối với tổ chức bộ máy', level: 2, order: 32, parentId: 'p4', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p4_2', title: '4.2. Tác động đối với người lao động', level: 2, order: 33, parentId: 'p4', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p4_3', title: '4.3. Tác động đối với hoạt động cung cấp dịch vụ hoa tiêu', level: 2, order: 34, parentId: 'p4', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p4_4', title: '4.4. Tác động tài chính, tài sản, phương tiện', level: 2, order: 35, parentId: 'p4', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p4_5', title: '4.5. Tác động đối với khách hàng, đối tác, cơ quan quản lý', level: 2, order: 36, parentId: 'p4', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p4_6', title: '4.6. Rủi ro và biện pháp kiểm soát', level: 2, order: 37, parentId: 'p4', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },

    // PHẦN V
    { id: 'p5', title: 'PHẦN V. Tổ chức thực hiện', level: 1, order: 38, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: 'p5_1', title: '5.1. Lộ trình triển khai', level: 2, order: 39, parentId: 'p5', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p5_2', title: '5.2. Phân công trách nhiệm', level: 2, order: 40, parentId: 'p5', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p5_3', title: '5.3. Nguồn lực thực hiện', level: 2, order: 41, parentId: 'p5', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p5_4', title: '5.4. Cơ chế kiểm tra, giám sát, báo cáo', level: 2, order: 42, parentId: 'p5', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p5_5', title: '5.5. KPI theo dõi sau kiện toàn', level: 2, order: 43, parentId: 'p5', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },

    // PHẦN VI
    { id: 'p6', title: 'PHẦN VI. Kết luận và kiến nghị', level: 1, order: 44, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: 'p6_1', title: '6.1. Kết luận', level: 2, order: 45, parentId: 'p6', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },
    { id: 'p6_2', title: '6.2. Kiến nghị', level: 2, order: 46, parentId: 'p6', itemType: "content", isContainer: false, canHaveDraft: true, countInProgress: true },

    // PHỤ LỤC
    { id: 'pl', title: 'PHỤ LỤC CẦN KÈM THEO ĐỀ ÁN', level: 1, order: 47, itemType: "section", isContainer: true, canHaveDraft: false, countInProgress: false },
    { id: 'pl_1', title: '1. Sơ đồ tổ chức hiện tại', level: 2, order: 48, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_2', title: '2. Sơ đồ tổ chức đề xuất', level: 2, order: 49, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_3', title: '3. Bảng so sánh mô hình cơ sở', level: 2, order: 50, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_4', title: '4. Bảng thống kê lao động toàn Công ty', level: 2, order: 51, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_5', title: '5. Bảng thống kê lao động theo từng phòng, chi nhánh', level: 2, order: 52, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_6', title: '6. Bảng thống kê hoa tiêu theo hạng', level: 2, order: 53, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_7', title: '7. Bảng sản lượng dẫn tàu theo đơn vị, tuyến, loại tàu', level: 2, order: 54, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_8', title: '8. Bảng doanh thu, chi phí, lợi nhuận theo đơn vị', level: 2, order: 55, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_9', title: '9. Bảng thống kê phương tiện thủy, bộ, trang thiết bị', level: 2, order: 56, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_10', title: '10. Ma trận chức năng, nhiệm vụ', level: 2, order: 57, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_11', title: '11. Ma trận RACI', level: 2, order: 58, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_12', title: '12. Bộ KPI sau kiện toàn', level: 2, order: 59, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_13', title: '13. Danh mục quy chế, quy định cần sửa đổi, bổ sung, ban hành mới', level: 2, order: 60, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_14', title: '14. Lộ trình triển khai chi tiết', level: 2, order: 61, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true },
    { id: 'pl_15', title: '15. Dự thảo quyết định, quy chế, phân công Ban điều hành', level: 2, order: 62, parentId: 'pl', itemType: "appendix", isContainer: false, canHaveDraft: false, countInProgress: true }
  ]
};

export const PROPOSAL_TEMPLATES = [
  STANDARD_PROPOSAL_TEMPLATE,
  RESTRUCTURE_AFTER_MERGER_TEMPLATE
];
