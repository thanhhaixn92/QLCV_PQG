import { 
  addDoc, 
  collection, 
  serverTimestamp, 
  updateDoc, 
  doc 
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { 
  Proposal, 
  ProposalOutlineItem, 
  ProposalDraft, 
  ProposalChecklistItem, 
  ProposalDataRequirement,
  ProposalExport,
  ProposalExportPreviewContent
} from "./types";

/**
 * Build content for preview based on export type
 */
export async function buildProposalExportPreview(
  proposal: Proposal,
  outlineItems: ProposalOutlineItem[],
  drafts: ProposalDraft[],
  checklistItems: ProposalChecklistItem[],
  dataRequirements: ProposalDataRequirement[],
  exportType: ProposalExport['exportType']
): Promise<ProposalExportPreviewContent> {
  
  const sortedOutline = [...outlineItems].sort((a, b) => a.order - b.order);

  switch (exportType) {
    case 'full_draft':
      return buildFullDraftPreview(proposal, sortedOutline, drafts, checklistItems, dataRequirements);
    case 'outline':
      return buildOutlinePreview(proposal, sortedOutline);
    case 'data_requirements':
      return buildDataRequirementsPreview(proposal, dataRequirements);
    case 'checklist':
      return buildChecklistPreview(proposal, checklistItems);
    case 'progress_report':
      return buildProgressReportPreview(proposal, sortedOutline, drafts, checklistItems, dataRequirements);
    default:
      throw new Error(`Unsupported export type: ${exportType}`);
  }
}

function buildFullDraftPreview(
  proposal: Proposal,
  outlineItems: ProposalOutlineItem[],
  drafts: ProposalDraft[],
  checklistItems: ProposalChecklistItem[],
  dataRequirements: ProposalDataRequirement[]
): ProposalExportPreviewContent {
  const sections = outlineItems.map(item => {
    const draft = drafts.find(d => d.outlineItemId === item.id);
    const canHaveDraft = item.canHaveDraft !== false;
    const isSection = item.itemType === 'section';
    
    let content = '';
    let isMissing = false;

    if (isSection) {
      // Sections don't usually have content in full draft, just headings
    } else if (canHaveDraft) {
      if (draft && draft.content) {
        content = draft.content;
      } else {
        content = '[Chưa có nội dung bản thảo]';
        isMissing = true;
      }
    }

    return {
      id: item.id,
      title: item.title,
      level: item.level,
      code: item.code,
      type: item.itemType as any || (item.level === 1 ? 'section' : 'content'),
      content,
      isMissing
    };
  });

  const totalDraftable = outlineItems.filter(i => i.canHaveDraft !== false && i.itemType !== 'section').length;
  const completedDrafts = drafts.filter(d => d.status === 'completed' || d.content.length > 100).length;

  return {
    title: 'Bản thảo tổng hợp đề án',
    projectName: proposal.name,
    exportType: 'full_draft',
    sections,
    summary: {
      totalItems: totalDraftable,
      completedItems: completedDrafts,
      missingItems: totalDraftable - completedDrafts,
      completionRate: totalDraftable > 0 ? Math.round((completedDrafts / totalDraftable) * 100) : 0
    },
    appendices: [
      {
        title: 'Danh mục số liệu cần thu thập',
        type: 'data_requirements',
        content: dataRequirements
      },
      {
        title: 'Checklist kiểm soát chất lượng',
        type: 'checklist',
        content: checklistItems
      }
    ]
  };
}

function buildOutlinePreview(proposal: Proposal, outlineItems: ProposalOutlineItem[]): ProposalExportPreviewContent {
  const sections = outlineItems.map(item => ({
    title: item.title,
    level: item.level,
    code: item.code,
    type: item.itemType as any || (item.level === 1 ? 'section' : 'content'),
    metadata: {
      guidance: item.guidance,
      status: item.status
    }
  }));

  return {
    title: 'Đề cương đề án',
    projectName: proposal.name,
    exportType: 'outline',
    sections
  };
}

function buildDataRequirementsPreview(proposal: Proposal, dataRequirements: ProposalDataRequirement[]): ProposalExportPreviewContent {
  const sections = dataRequirements.map(req => ({
    title: req.title,
    level: 1,
    type: 'content' as const,
    content: `Đơn vị: ${req.responsibleUnit || 'N/A'}\nMục đích: ${req.purpose || ''}\nTrạng thái: ${req.status}`,
    metadata: req
  }));

  return {
    title: 'Danh mục số liệu thu thập',
    projectName: proposal.name,
    exportType: 'data_requirements',
    sections
  };
}

function buildChecklistPreview(proposal: Proposal, checklistItems: ProposalChecklistItem[]): ProposalExportPreviewContent {
  const sections = checklistItems.map(item => ({
    title: item.title,
    level: 1,
    type: 'content' as const,
    content: `Nhóm: ${item.group}\nTrạng thái: ${item.status}\nMức độ: ${item.priority}`,
    metadata: item
  }));

  return {
    title: 'Checklist nội dung đề án',
    projectName: proposal.name,
    exportType: 'checklist',
    sections
  };
}

function buildProgressReportPreview(
  proposal: Proposal, 
  outlineItems: ProposalOutlineItem[], 
  drafts: ProposalDraft[],
  checklistItems: ProposalChecklistItem[],
  dataRequirements: ProposalDataRequirement[]
): ProposalExportPreviewContent {
  const totalItems = outlineItems.filter(i => i.countInProgress).length;
  const completedItems = outlineItems.filter(i => i.countInProgress && i.status === 'completed').length;
  
  const sections = [
    {
      title: 'Tổng quan tiến độ',
      level: 1,
      type: 'section' as const,
      content: `Đề án: ${proposal.name}\nTổng số mục nội dung: ${totalItems}\nHoàn thành: ${completedItems}\nTỷ lệ: ${totalItems > 0 ? Math.round((completedItems/totalItems)*100) : 0}%`
    },
    {
      title: 'Chi tiết các mục đang thực hiện',
      level: 1,
      type: 'section' as const,
      content: outlineItems.filter(i => i.status !== 'completed' && i.countInProgress).map(i => `- ${i.code || ''} ${i.title}: ${i.status}`).join('\n')
    }
  ];

  return {
    title: 'Báo cáo tiến độ xây dựng đề án',
    projectName: proposal.name,
    exportType: 'progress_report',
    sections
  };
}

/**
 * Save export record to Firestore
 */
export async function createExportRecord(
  userId: string,
  proposalId: string,
  data: Partial<ProposalExport>
): Promise<string> {
  const colRef = collection(db, 'users', userId, 'proposals', proposalId, 'exports');
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  return docRef.id;
}

export async function updateExportStatus(
  userId: string,
  proposalId: string,
  exportId: string,
  status: ProposalExport['status'],
  url?: string
) {
  const docRef = doc(db, 'users', userId, 'proposals', proposalId, 'exports', exportId);
  await updateDoc(docRef, {
    status,
    exportUrl: url || '',
    updatedAt: Date.now()
  });
}
