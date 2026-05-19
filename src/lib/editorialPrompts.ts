import { EditorialDocumentKind } from '../types/editorial';
import { DocumentSource } from '../types';

export function buildEditorialPrompt(
  kind: EditorialDocumentKind,
  userInput: string,
  sources: DocumentSource[],
  options?: any
): string {
  const instructionsByKind: Record<EditorialDocumentKind, string> = {
    website_article: `Bạn là một nhà báo, biên tập viên chuyên nghiệp. Dựa vào yêu cầu và thông tin cung cấp, hãy viết một bài đăng website theo đúng cấu trúc:
- Tiêu đề chính hấp dẫn (viết hoa/đậm).
- Sapo (2-3 câu tóm tắt nội dung cốt lõi và giá trị của bài viết).
- Các mục nội dung phân chia rõ ràng (Bối cảnh, Nội dung chính, Ý nghĩa / Tác động, Định hướng tiếp theo...).
- Văn phong chuyên nghiệp, phù hợp với website của doanh nghiệp nhà nước, không phóng đại, thông tin chính xác.`,
    news: `Bạn là phóng viên tin tức. Dựa vào yêu cầu và thông tin cung cấp, hãy viết một bản tin nhanh theo mô hình kim tự tháp ngược:
- Tiêu đề tin (viết hoa/đậm).
- Sapo (1-2 câu trả lời Ai? Việc gì? Ở đâu? Khi nào? Vì sao?).
- Thân tin (các chi tiết quan trọng nhất đưa lên trước, thông tin bổ sung, bối cảnh đưa ra sau).
- Văn phong khách quan, ngắn gọn, chính xác. Không bình luận dài dòng.`,
    press_release: `Bạn là chuyên viên PR/Truyền thông. Dựa vào yêu cầu và thông tin cung cấp, hãy soạn một thông cáo báo chí:
- Bắt đầu bằng: TÊN ĐƠN VỊ - THÔNG CÁO BÁO CHÍ.
- Tiêu đề thông cáo rõ thông điệp chính.
- Nêu rõ thời gian, địa điểm phát hành.
- Sapo tuyên bố chính.
- Nội dung chi tiết (khoảng 3-4 mục rõ ràng).
- Đoạn thông tin liên hệ báo chí ở cuối.
- Câu văn ngắn, rõ, dễ trích dẫn mang tính chất đối ngoại.`,
    administrative_report: `Bạn là thư ký hành chính của công ty. Dựa vào yêu cầu, hãy soạn một Báo cáo hành chính:
- Có phần đầu (Quốc hiệu, Tiêu ngữ, Tên cơ quan, Số, Ngày tháng năm).
- Tên báo cáo: BÁO CÁO Về việc...
- Các tiểu mục rõ ràng: I. Tình hình chung, II. Kết quả thực hiện, III. Khó khăn vướng mắc, IV. Kiến nghị đề xuất.
- Thông tin Người ký, Nơi nhận.
- Văn phong hành chính, nghiêm túc, có số liệu minh chứng.`,
    announcement: `Bạn là thư ký hành chính. Dựa vào yêu cầu, hãy soạn một Thông báo nội bộ hoặc bên ngoài:
- Có phần đầu (Quốc hiệu, Tiêu ngữ, Tên cơ quan, Số, Ngày... nếu là thể thức chính quy).
- Tên thông báo: THÔNG BÁO Về việc...
- Nêu rõ nội dung thông báo, đối tượng áp dụng, thời gian địa điểm (nếu có), yêu cầu triển khai.
- Thông tin Người ký, Nơi nhận.
- Cực kỳ ngắn gọn, rõ ràng, dễ hiểu.`,
    official_letter: `Bạn là thư ký hành chính. Dựa vào yêu cầu, hãy soạn Công văn (trao đổi, đề nghị, chỉ đạo, báo cáo):
- Thể thức: Quốc hiệu, Tiêu ngữ, Kính gửi, V/v, Nơi nhận, Người ký.
- Chia thành đoạn rõ ràng: Căn cứ/Lý do, Nội dung chính/Đề nghị, Đầu mối phối hợp/Kết luận.
- Văn phong đi thẳng vào vấn đề, không dùng câu cảm xúc.`,
    plan: `Bạn là chuyên viên lập kế hoạch. Dựa vào yêu cầu, hãy soạn Kế hoạch triển khai công việc:
- Thể thức: Quốc hiệu, Tiêu ngữ, Tên KẾ HOẠCH Về việc...
- Cấu trúc: I. Mục đích yêu cầu, II. Nội dung thực hiện (cụ thể việc gì), III. Thời gian tiến độ, IV. Phân công trách nhiệm (ai làm gì, rõ ràng), V. Tổ chức thực hiện.
- Liệt kê các nhiệm vụ (có thể thành bảng nếu cần).`,
    meeting_minutes: `Bạn là thư ký cuộc họp. Hãy ghi lại Biên bản họp:
- Tên đơn vị, BIÊN BẢN HỌP, Thời gian, Địa điểm, Thành phần, Chủ trì, Thư ký.
- Nội dung: tóm tắt ý kiến phát biểu chính.
- Kết luận/Chỉ đạo của người chủ trì.
- Các nhiệm vụ được giao cụ thể cho từng người/bộ phận kèm thời hạn.`,
    speech_outline: `Bạn là chuyên viên tổng hợp viết diễn văn. Hãy soạn Đề cương phát biểu/thuyết trình:
- Đối tượng nghe, chủ đề, thời lượng.
- Các phần: Lời chào/Mở đầu, Vấn đề đặt ra, Nội dung cốt lõi, Liên hệ thực tiễn, Nhiệm vụ giải pháp, Lời kết/thông điệp.
- Tính nói, dễ nhớ, có điểm nhấn.`,
    briefing_note: `Bạn là chuyên viên tham mưu. Hãy soạn Phiếu tóm tắt (Briefing Note) cho lãnh đạo:
- Tóm tắt cực ngắn gọn vấn đề (5-7 dòng).
- Bối cảnh / Vấn đề cần xin ý kiến.
- Điểm cần lưu ý / Rủi ro.
- Phương án xử lý / Kiến nghị (quan trọng nhất).
- Rất súc tích, gạch đầu dòng, chỉ nêu ý cốt lõi.`,
    summary_note: `Bạn là chuyên viên tổng hợp. Hãy soạn Tài liệu tổng hợp (Summary Note) từ nhiều nguồn dữ liệu:
- Tiêu đề phản ánh đúng trọng tâm vấn đề được tổng hợp.
- Tóm tắt tổng quan.
- Phân tích chi tiết theo từng chủ đề hoặc sự kiện.
- Điểm cần lưu ý hoặc xu hướng rút ra.
- Trình bày rõ ràng, mạch lạc, dễ hiểu.`,
    slide_outline: `Bạn là chuyên gia xây dựng bài thuyết trình. Hãy tạo phác thảo trình chiếu theo yêu cầu.`
  };

  const instruction = instructionsByKind[kind] || instructionsByKind['website_article'];

  let prompt = `YÊU CẦU:
${instruction}

NHIỆM VỤ HIỆN TẠI:
${userInput}

CHÚ Ý QUAN TRỌNG:
1. Bạn trả về nội dung hoàn chỉnh định dạng bằng Markdown rõ ràng. Đừng dùng Markdown block code (như \`\`\`markdown ... \`\`\`), hãy trả về plain markdown có format.
2. KHÔNG lấy thông tin ngoài nếu không cần thiết, nếu thiếu dữ kiện trong nguồn hãy ghi chú mốc "[Cần kiểm chứng]" hoặc "[Bổ sung: ...]" chứ KHÔNG BỊA ĐẶT số liệu, tên người, định danh.
3. Nếu tài liệu là văn bản hành chính, phải có đầy đủ [Nơi nhận], [Người ký], v.v. để nó thành một văn bản mẫu có thể dùng luôn.`;

  return prompt;
}
