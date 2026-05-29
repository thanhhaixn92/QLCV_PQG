import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  Timestamp,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { 
  Proposal, 
  ProposalSource, 
  ProposalOutlineItem, 
  ProposalDraft, 
  ProposalDataTable, 
  ProposalExport, 
  ProposalActivityLog,
  ProposalStatus,
  ProposalChecklistItem,
  ProposalDataRequirement,
  ProposalEvidenceLink
} from './types';
import { WorkTask } from '../../types';

const getProposalsRef = (userId: string) => collection(db, 'users', userId, 'proposals');
const getProposalDoc = (userId: string, proposalId: string) => doc(db, 'users', userId, 'proposals', proposalId);

// Core Proposal Functions

export const createProposal = async (userId: string, data: Partial<Proposal>): Promise<string> => {
  const proposalsRef = getProposalsRef(userId);
  const now = Date.now();
  const docRef = await addDoc(proposalsRef, {
    ...data,
    ownerId: userId,
    status: data.status || 'draft',
    progressPercent: data.progressPercent || 0,
    sourceCount: 0,
    draftCount: 0,
    taskCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
};

export const listProposals = async (userId: string): Promise<Proposal[]> => {
  const proposalsRef = getProposalsRef(userId);
  const q = query(proposalsRef, orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Proposal));
};

export const getProposal = async (userId: string, proposalId: string): Promise<Proposal | null> => {
  const docRef = getProposalDoc(userId, proposalId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { ...snapshot.data(), id: snapshot.id } as Proposal;
};

export const updateProposal = async (userId: string, proposalId: string, data: Partial<Proposal>): Promise<void> => {
  const docRef = getProposalDoc(userId, proposalId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Date.now(),
  });
};

export const archiveProposal = async (userId: string, proposalId: string): Promise<void> => {
  return updateProposal(userId, proposalId, { status: 'archived' as ProposalStatus });
};

// Subcollection Functions

// Sources
export const addSource = async (userId: string, proposalId: string, source: Partial<ProposalSource>): Promise<string> => {
  const sourcesRef = collection(db, 'users', userId, 'proposals', proposalId, 'sources');
  const docRef = await addDoc(sourcesRef, {
    ...source,
    proposalId,
    createdAt: Date.now(),
  });
  
  // Increment source count in parent
  const proposal = await getProposal(userId, proposalId);
  if (proposal) {
    await updateProposal(userId, proposalId, { sourceCount: (proposal.sourceCount || 0) + 1 });
  }
  
  return docRef.id;
};

export const listSources = async (userId: string, proposalId: string): Promise<ProposalSource[]> => {
  const sourcesRef = collection(db, 'users', userId, 'proposals', proposalId, 'sources');
  const q = query(sourcesRef, orderBy('order', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProposalSource));
};

// Outline Items
export const addOutlineItem = async (userId: string, proposalId: string, item: Partial<ProposalOutlineItem>): Promise<string> => {
  const outlineRef = collection(db, 'users', userId, 'proposals', proposalId, 'outlineItems');
  const docRef = await addDoc(outlineRef, {
    ...item,
    proposalId,
    createdAt: Date.now(),
  });
  return docRef.id;
};

export const listOutlineItems = async (userId: string, proposalId: string): Promise<ProposalOutlineItem[]> => {
  const outlineRef = collection(db, 'users', userId, 'proposals', proposalId, 'outlineItems');
  const q = query(outlineRef, orderBy('order', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProposalOutlineItem));
};

export const updateOutlineItem = async (userId: string, proposalId: string, itemId: string, data: Partial<ProposalOutlineItem>) => {
  const docRef = doc(db, 'users', userId, 'proposals', proposalId, 'outlineItems', itemId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Date.now()
  });
};

export const deleteOutlineItem = async (userId: string, proposalId: string, itemId: string) => {
  const docRef = doc(db, 'users', userId, 'proposals', proposalId, 'outlineItems', itemId);
  await deleteDoc(docRef);
};

export const clearOutlineItems = async (userId: string, proposalId: string) => {
  const outlineRef = collection(db, 'users', userId, 'proposals', proposalId, 'outlineItems');
  const snapshot = await getDocs(outlineRef);
  const promises = snapshot.docs.map(d => deleteDoc(d.ref));
  await Promise.all(promises);
};

export const saveOutlineItems = async (userId: string, proposalId: string, items: Partial<ProposalOutlineItem>[]) => {
  const batch = writeBatch(db);
  const outlineRef = collection(db, 'users', userId, 'proposals', proposalId, 'outlineItems');
  
  items.forEach((item, index) => {
    const docRef = doc(outlineRef);
    batch.set(docRef, {
      ...item,
      proposalId,
      order: item.order ?? index,
      createdAt: Date.now()
    });
  });
  
  await batch.commit();
};

export const addOutlineItemsBatch = async (userId: string, proposalId: string, items: Partial<ProposalOutlineItem>[]) => {
  const batch = writeBatch(db);
  const outlineRef = collection(db, 'users', userId, 'proposals', proposalId, 'outlineItems');
  
  items.forEach((item) => {
    const docRef = doc(outlineRef);
    const now = Date.now();
    batch.set(docRef, {
      ...item,
      proposalId,
      createdAt: now,
      updatedAt: now
    });
  });
  
  await batch.commit();
};

export const suggestProposalOutline = async (
  userId: string, 
  proposalId: string, 
  data: { 
    proposal: Partial<Proposal>; 
    sources: ProposalSource[]; 
    objectives: string; 
  }
) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthorized');
  const token = await user.getIdToken();

  const response = await fetch(`/api/proposals/${proposalId}/outline/ai-suggest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'AI suggest failed');
  }
  return result.result;
};

export const suggestDraftContent = async (
  userId: string,
  proposalId: string,
  data: {
    proposal: Partial<Proposal>;
    outlineItem: ProposalOutlineItem;
    sources: ProposalSource[];
    currentContent: string;
    actionType: 'write' | 'review_logic' | 'missing_data' | 'administrative_style' | 'executive_summary';
  }
) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthorized');
  const token = await user.getIdToken();

  const response = await fetch(`/api/proposals/${proposalId}/draft/ai-assist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'AI suggest draft failed');
  }
  return result.result;
};

// Drafts
export const listDrafts = async (userId: string, proposalId: string): Promise<ProposalDraft[]> => {
  const draftsRef = collection(db, 'users', userId, 'proposals', proposalId, 'drafts');
  const q = query(draftsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProposalDraft));
};

export const getDraftByOutlineItem = async (userId: string, proposalId: string, outlineItemId: string): Promise<ProposalDraft | null> => {
  const draftsRef = collection(db, 'users', userId, 'proposals', proposalId, 'drafts');
  const q = query(draftsRef, where('outlineItemId', '==', outlineItemId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as ProposalDraft;
};

export const createDraftForOutlineItem = async (userId: string, proposalId: string, outlineItem: ProposalOutlineItem): Promise<string> => {
  const draftsRef = collection(db, 'users', userId, 'proposals', proposalId, 'drafts');
  const now = Date.now();
  const docRef = await addDoc(draftsRef, {
    proposalId,
    outlineItemId: outlineItem.id,
    outlineCode: outlineItem.code || '',
    title: outlineItem.title,
    content: '',
    status: 'empty',
    wordCount: 0,
    version: 1,
    createdAt: now,
    updatedAt: now,
    updatedBy: userId
  });
  
  // Update parent metadata
  const proposal = await getProposal(userId, proposalId);
  if (proposal) {
    await updateProposal(userId, proposalId, { 
      draftCount: (proposal.draftCount || 0) + 1 
    });
  }
  
  return docRef.id;
};

export const updateDraft = async (userId: string, proposalId: string, draftId: string, patch: Partial<ProposalDraft>): Promise<void> => {
  const draftDoc = doc(db, 'users', userId, 'proposals', proposalId, 'drafts', draftId);
  const now = Date.now();
  await updateDoc(draftDoc, {
    ...patch,
    updatedAt: now,
    updatedBy: userId
  });

  // Optional: Sync status to outlineItem if outlineItemId is in draft
  const draftSnap = await getDoc(draftDoc);
  if (draftSnap.exists()) {
    const draftData = draftSnap.data() as ProposalDraft;
    if (draftData.outlineItemId && patch.status) {
      let outlineStatus: ProposalOutlineItem['status'] = 'writing';
      if (patch.status === 'completed') outlineStatus = 'completed';
      if (patch.status === 'needs_data') outlineStatus = 'needs_data';
      if (patch.status === 'needs_review') outlineStatus = 'needs_review';
      if (patch.status === 'empty') outlineStatus = 'not_started';
      if (patch.status === 'drafting') outlineStatus = 'writing';
      
      await updateOutlineItem(userId, proposalId, draftData.outlineItemId, { status: outlineStatus });
    }
  }
};

export const updateDraftByOutlineItem = async (userId: string, proposalId: string, outlineItemId: string, content: string, status?: ProposalDraft['status']): Promise<void> => {
  const draftsRef = collection(db, 'users', userId, 'proposals', proposalId, 'drafts');
  const q = query(draftsRef, where('outlineItemId', '==', outlineItemId));
  const snapshot = await getDocs(q);
  
  const now = Date.now();
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const updateData: any = {
    content,
    wordCount,
    updatedAt: now,
    updatedBy: userId
  };
  
  if (status) {
    updateData.status = status;
  } else if (content.length > 10) {
    updateData.status = 'drafting';
  }

  if (snapshot.empty) {
    const outlineItems = await listOutlineItems(userId, proposalId);
    const item = outlineItems.find(i => i.id === outlineItemId);
    await addDoc(draftsRef, {
      proposalId,
      outlineItemId,
      outlineCode: item?.code || '',
      title: item?.title || 'Bản thảo mới',
      content,
      status: updateData.status || 'drafting',
      wordCount,
      version: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId
    });
  } else {
    const draftDoc = doc(db, 'users', userId, 'proposals', proposalId, 'drafts', snapshot.docs[0].id);
    await updateDoc(draftDoc, updateData);
  }

  // Update outline item status too
  let outlineStatus: ProposalOutlineItem['status'] = 'writing';
  if (updateData.status === 'completed') outlineStatus = 'completed';
  if (updateData.status === 'needs_data') outlineStatus = 'needs_data';
  if (updateData.status === 'needs_review') outlineStatus = 'needs_review';
  
  await updateOutlineItem(userId, proposalId, outlineItemId, { status: outlineStatus });
};

export const saveDraftVersion = async (userId: string, proposalId: string, draftId: string, content: string): Promise<void> => {
  const versionsRef = collection(db, 'users', userId, 'proposals', proposalId, 'drafts', draftId, 'versions');
  const draftDoc = doc(db, 'users', userId, 'proposals', proposalId, 'drafts', draftId);
  const draftSnap = await getDoc(draftDoc);
  
  if (draftSnap.exists()) {
    const currentData = draftSnap.data() as ProposalDraft;
    const newVersion = (currentData.version || 0) + 1;
    
    // Save to subcollection
    await addDoc(versionsRef, {
      content,
      version: newVersion,
      createdAt: Date.now()
    });
    
    // Update main doc
    await updateDoc(draftDoc, {
      content,
      version: newVersion,
      updatedAt: Date.now(),
      wordCount: content.trim().split(/\s+/).length
    });
  }
};

export const listDraftVersions = async (userId: string, proposalId: string, draftId: string): Promise<any[]> => {
  const versionsRef = collection(db, 'users', userId, 'proposals', proposalId, 'drafts', draftId, 'versions');
  const q = query(versionsRef, orderBy('version', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
};

// Tasks
export const addProposalTask = async (userId: string, proposalId: string, task: Partial<WorkTask>): Promise<string> => {
  const tasksRef = collection(db, 'users', userId, 'tasks');
  const now = Date.now();
  const docRef = await addDoc(tasksRef, {
    title: task.title ?? "Nhiệm vụ mới",
    description: task.description ?? "",
    status: task.status ?? "todo",
    priority: task.priority ?? "medium",
    assignee: task.assignee ?? "Chưa gán",
    isDeputy: task.isDeputy ?? false,
    categoryCode: task.categoryCode ?? "LV_DH",
    dueDate: task.dueDate || null,
    ownerId: userId,
    proposalId,
    createdAt: now,
    updatedAt: now,
    source: task.source || 'manual'
  });
  
  // Update parent metadata
  const proposal = await getProposal(userId, proposalId);
  if (proposal) {
    await updateProposal(userId, proposalId, { taskCount: (proposal.taskCount || 0) + 1 });
  }
  
  return docRef.id;
};

export const listProposalTasks = async (userId: string, proposalId: string): Promise<WorkTask[]> => {
  const tasksRef = collection(db, 'users', userId, 'tasks');
  const q = query(
    tasksRef, 
    where('proposalId', '==', proposalId)
  );
  const snapshot = await getDocs(q);
  const tasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as WorkTask));
  // Sort client-side to avoid index requirement
  return tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const updateProposalTask = async (
  userId: string, 
  proposalId: string, 
  taskId: string, 
  patch: Partial<WorkTask>
): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'tasks', taskId);
  const oldSnap = await getDoc(docRef);
  
  if (!oldSnap.exists()) return;
  const oldData = oldSnap.data() as WorkTask;

  await updateDoc(docRef, {
    ...patch,
    updatedAt: Date.now()
  });

  // Linked logic: If task status changes to 'done', update source item
  if (patch.status === 'done' || patch.status === 'completed') {
    if (oldData.sourceType === 'data_requirement' && (oldData as any).sourceId) {
      await updateDataRequirement(userId, proposalId, (oldData as any).sourceId, {
        status: 'collected',
        taskStatus: 'done'
      });
    } else if (oldData.sourceType === 'checklist_item' && (oldData as any).sourceId) {
      await updateChecklistItem(userId, proposalId, (oldData as any).sourceId, {
        status: 'pass',
        taskStatus: 'done'
      });
    }
  } else if (patch.status) {
    // If status changes to something else, sync taskStatus to source
    if (oldData.sourceType === 'data_requirement' && (oldData as any).sourceId) {
      await updateDataRequirement(userId, proposalId, (oldData as any).sourceId, {
        taskStatus: patch.status as any
      });
    } else if (oldData.sourceType === 'checklist_item' && (oldData as any).sourceId) {
      await updateChecklistItem(userId, proposalId, (oldData as any).sourceId, {
        taskStatus: patch.status as any
      });
    }
  }
};

export const deleteProposalTask = async (userId: string, proposalId: string, taskId: string): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'tasks', taskId);
  const oldSnap = await getDoc(docRef);
  
  if (oldSnap.exists()) {
    const oldData = oldSnap.data() as WorkTask;
    // Clear task references in sources
    if ((oldData.sourceType as string) === 'data_requirement' && (oldData as any).sourceId) {
      await updateDataRequirement(userId, proposalId, (oldData as any).sourceId, {
        taskId: null as any,
        taskStatus: null as any
      });
    } else if (oldData.sourceType === 'checklist_item' && (oldData as any).sourceId) {
      await updateChecklistItem(userId, proposalId, (oldData as any).sourceId, {
        taskId: null as any,
        taskStatus: null as any
      });
    }
  }

  await deleteDoc(docRef);

  // Update parent metadata
  const proposal = await getProposal(userId, proposalId);
  if (proposal) {
    await updateProposal(userId, proposalId, { taskCount: Math.max(0, (proposal.taskCount || 1) - 1) });
  }
};

export const applyProposalTemplate = async (
  userId: string, 
  proposalId: string, 
  templateItems: any[], 
  mode: 'append' | 'replace'
) => {
  let startOrder = 0;
  
  if (mode === 'replace') {
    await clearOutlineItems(userId, proposalId);
  } else {
    // For append, find max order
    const existing = await listOutlineItems(userId, proposalId);
    if (existing.length > 0) {
      startOrder = Math.max(...existing.map(i => i.order)) + 1;
    }
  }
  
  // Map template items to ProposalOutlineItem
  const itemsToSave: Partial<ProposalOutlineItem>[] = templateItems.map(item => ({
    title: item.title,
    level: item.level,
    order: startOrder + item.order,
    templateItemId: item.id,
    parentTemplateId: item.parentId || null,
    code: item.code || '',
    guidance: item.guidance || '',
    status: 'not_started' as any
  }));

  await addOutlineItemsBatch(userId, proposalId, itemsToSave);
};

// Activity Logging
export const logProposalActivity = async (userId: string, proposalId: string, log: Partial<ProposalActivityLog>): Promise<void> => {
  const activityRef = collection(db, 'users', userId, 'proposals', proposalId, 'activityLogs');
  await addDoc(activityRef, {
    ...log,
    proposalId,
    userId,
    createdAt: Date.now(),
  });
};

// Checklist Items
export const addChecklistItem = async (userId: string, proposalId: string, item: Partial<ProposalChecklistItem>): Promise<string> => {
  const checklistRef = collection(db, 'users', userId, 'proposals', proposalId, 'checklistItems');
  const now = Date.now();
  const docRef = await addDoc(checklistRef, {
    ...item,
    proposalId,
    createdAt: now,
    updatedAt: now
  });
  return docRef.id;
};

export const listChecklistItems = async (userId: string, proposalId: string): Promise<ProposalChecklistItem[]> => {
  const checklistRef = collection(db, 'users', userId, 'proposals', proposalId, 'checklistItems');
  const q = query(checklistRef, orderBy('createdAt', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProposalChecklistItem));
};

export const updateChecklistItem = async (userId: string, proposalId: string, itemId: string, patch: Partial<ProposalChecklistItem>): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'proposals', proposalId, 'checklistItems', itemId);
  await updateDoc(docRef, {
    ...patch,
    updatedAt: Date.now()
  });
};

export const deleteChecklistItem = async (userId: string, proposalId: string, itemId: string): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'proposals', proposalId, 'checklistItems', itemId);
  await deleteDoc(docRef);
};

export const createTemplateChecklist = async (userId: string, proposalId: string): Promise<void> => {
  const batch = writeBatch(db);
  const checklistRef = collection(db, 'users', userId, 'proposals', proposalId, 'checklistItems');
  const now = Date.now();

  const groups = [
    { name: "Mở đầu", items: ["Sapo hấp dẫn", "Tóm tắt mục tiêu chính", "Đối tượng thụ hưởng"] },
    { name: "Căn cứ pháp lý và căn cứ nội bộ", items: ["Văn bản quy phạm pháp luật", "Nghị quyết của Đảng ủy", "Quyết định của HĐTV/Ban lãnh đạo"] },
    { name: "Số liệu bắt buộc", items: ["Số liệu 3 năm gần nhất", "Dự báo tăng trưởng", "Số liệu đối chiếu thị trường"] },
    { name: "Thực trạng", items: ["Phân tích SWOT", "Các tồn tại chưa giải quyết", "Lợi thế cạnh tranh hiện có"] },
    { name: "Phương án tổ chức bộ máy", items: ["Sơ đồ tổ chức mới", "Chức năng nhiệm vụ các bộ phận", "Mối quan hệ công tác"] },
    { name: "Phòng Điều hành trung tâm và Dịch vụ hàng hải", items: ["Quy trình phối hợp", "Ứng dụng CNTT/Số hóa", "Tiêu chuẩn dịch vụ"] },
    { name: "Nhân sự và vị trí việc làm", items: ["Danh mục VTVL", "Bản mô tả công việc (JD)", "Kế hoạch đào tạo/tuyển dụng"] },
    { name: "Tài chính, chi phí và hiệu quả", items: ["Dự toán chi phí đầu tư", "Dự toán chi phí vận hành", "Phân tích điểm hòa vốn", "Hiệu quả kinh tế - xã hội"] },
    { name: "RACI, KPI và cơ chế quản trị", items: ["Ma trận trách nhiệm RACI", "Bộ chỉ số KPI chính", "Chế độ báo cáo và giám sát"] },
    { name: "Hệ thống quy chế cần sửa đổi", items: ["Quy chế tổ chức hoạt động", "Quy chế lương/thưởng", "Quy trình nghiệp vụ cụ thể"] },
    { name: "Phụ lục", items: ["Các biểu mẫu chi tiết", "Ảnh minh họa/Sơ đồ", "Các văn bản đính kèm"] }
  ];

  groups.forEach(group => {
    group.items.forEach(title => {
      const docRef = doc(checklistRef);
      batch.set(docRef, {
        proposalId,
        group: group.name,
        title,
        status: 'missing',
        priority: 'high',
        createdAt: now,
        updatedAt: now
      });
    });
  });

  await batch.commit();
};

/**
 * Data Requirements
 */
export const addDataRequirement = async (userId: string, proposalId: string, item: Partial<ProposalDataRequirement>): Promise<string> => {
  const dataRef = collection(db, 'users', userId, 'proposals', proposalId, 'dataRequirements');
  const now = Date.now();
  const docRef = await addDoc(dataRef, {
    ...item,
    proposalId,
    createdAt: now,
    updatedAt: now
  });
  return docRef.id;
};

export const listDataRequirements = async (userId: string, proposalId: string): Promise<ProposalDataRequirement[]> => {
  const dataRef = collection(db, 'users', userId, 'proposals', proposalId, 'dataRequirements');
  const q = query(dataRef, orderBy('createdAt', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProposalDataRequirement));
};

export const updateDataRequirement = async (userId: string, proposalId: string, itemId: string, patch: Partial<ProposalDataRequirement>): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'proposals', proposalId, 'dataRequirements', itemId);
  await updateDoc(docRef, {
    ...patch,
    updatedAt: Date.now()
  });
};

export const deleteDataRequirement = async (userId: string, proposalId: string, itemId: string): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'proposals', proposalId, 'dataRequirements', itemId);
  await deleteDoc(docRef);
};

export const batchUpdateDataRequirements = async (
  userId: string, 
  proposalId: string, 
  items: Partial<ProposalDataRequirement>[]
) => {
  const batch = writeBatch(db);
  const dataRef = collection(db, 'users', userId, 'proposals', proposalId, 'dataRequirements');
  
  items.forEach(item => {
    if (item.id) {
      const docRef = doc(dataRef, item.id);
      batch.update(docRef, {
        ...item,
        updatedAt: Date.now()
      });
    } else {
      const docRef = doc(dataRef);
      batch.set(docRef, {
        ...item,
        id: docRef.id,
        proposalId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  });

  await batch.commit();
};

export const createTemplateDataRequirements = async (userId: string, proposalId: string): Promise<void> => {
  const batch = writeBatch(db);
  const dataRef = collection(db, 'users', userId, 'proposals', proposalId, 'dataRequirements');
  const now = Date.now();

  const groups = [
    { 
      name: "Tổ chức bộ máy, đầu mối, chức năng", 
      items: [
        { title: "Sơ đồ tổ chức 3 cấp hiện tại", purpose: "Đánh giá sự phù hợp của bộ máy", responsibleUnit: "Phòng Tổ chức cán bộ" },
        { title: "Quy định chức năng nhiệm vụ các phòng/ban", purpose: "Phân định trách nhiệm RACI", responsibleUnit: "Phòng Pháp chế - Tổ chức" }
      ] 
    },
    { 
      name: "Lao động, nhân sự, chức danh", 
      items: [
        { title: "Danh sách lao động theo chức danh", purpose: "Lập định biên nhân sự", responsibleUnit: "Phòng TCCB" },
        { title: "Bảng lương bình quân 12 tháng", purpose: "Tính toán chi phí nhân công", responsibleUnit: "Phòng Tài chính" }
      ] 
    },
    { 
      name: "Hoa tiêu hàng hải", 
      items: [
        { title: "Danh sách hoa tiêu theo hạng", purpose: "Xác định năng lực dẫn tàu", responsibleUnit: "Phòng Hoa tiêu" },
        { title: "Kế hoạch đào tạo/nâng hạng 2 năm tới", purpose: "Dự báo nguồn lực", responsibleUnit: "Phòng Hoa tiêu" }
      ] 
    },
    { 
      name: "Sản lượng dẫn tàu và tuyến dẫn", 
      items: [
        { title: "Thống kê lượt tàu dẫn theo tuyến (3 năm)", purpose: "Phân tích thị trường/Sản lượng", responsibleUnit: "Phòng Kế hoạch" },
        { title: "Số giờ dẫn tàu trung bình/lượt", purpose: "Tính định mức lao động", responsibleUnit: "Phòng Kế hoạch" }
      ] 
    },
    { 
      name: "Điều hành, lịch tàu, thời gian đáp ứng", 
      items: [
        { title: "Thời gian chờ hoa tiêu trung bình (Phút)", purpose: "Đánh giá chất lượng dịch vụ", responsibleUnit: "Phòng Điều hành" }
      ] 
    },
    { 
      name: "Phương tiện, tài sản, trang thiết bị", 
      items: [
        { title: "Danh mục cano hoa tiêu/Tình trạng", purpose: "Xác định nhu cầu đầu tư", responsibleUnit: "Phòng Thiết bị" },
        { title: "Định mức tiêu hao nhiên liệu/giờ", purpose: "Tính toán giá thành", responsibleUnit: "Phòng Tài chính - Thiết bị" }
      ] 
    },
    { 
      name: "Tài chính, doanh thu, chi phí, lợi nhuận", 
      items: [
        { title: "Báo cáo KQKD 3 năm gần nhất", purpose: "Cơ sở tính toán hiệu quả tài chính", responsibleUnit: "Phòng Tài chính" },
        { title: "Cơ cấu chi phí cố định/biến đổi", purpose: "Phân tích điểm hòa vốn", responsibleUnit: "Phòng Tài chính" }
      ] 
    },
    { 
      name: "Quy chế, văn bản nội bộ", 
      items: [
        { title: "Quy chế chi tiêu nội bộ hiện hành", purpose: "Điều chỉnh cơ chế tài chính", responsibleUnit: "Phòng Tài chính" }
      ] 
    }
  ];

  groups.forEach(group => {
    group.items.forEach(dataItem => {
      const docRef = doc(dataRef);
      batch.set(docRef, {
        ...dataItem,
        proposalId,
        group: group.name,
        status: 'not_requested',
        createdAt: now,
        updatedAt: now
      });
    });
  });

  await batch.commit();
};

/**
 * Evidence Links
 */
export const addEvidenceLink = async (
  userId: string, 
  proposalId: string, 
  link: Omit<ProposalEvidenceLink, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const linksRef = collection(db, 'users', userId, 'proposals', proposalId, 'evidenceLinks');
  
  // Check for duplicates
  const q = query(
    linksRef, 
    where('sourceId', '==', link.sourceId),
    where('targetType', '==', link.targetType),
    where('targetId', '==', link.targetId)
  );
  
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }

  const now = Date.now();
  const docRef = await addDoc(linksRef, {
    ...link,
    proposalId,
    createdAt: now,
    updatedAt: now
  });
  return docRef.id;
};

export const removeEvidenceLink = async (userId: string, proposalId: string, linkId: string): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'proposals', proposalId, 'evidenceLinks', linkId);
  await deleteDoc(docRef);
};

export const listEvidenceLinksForProposal = async (userId: string, proposalId: string): Promise<ProposalEvidenceLink[]> => {
  const linksRef = collection(db, 'users', userId, 'proposals', proposalId, 'evidenceLinks');
  const snapshot = await getDocs(linksRef);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProposalEvidenceLink));
};

export const listEvidenceLinksForTarget = async (
  userId: string, 
  proposalId: string, 
  targetType: ProposalEvidenceLink['targetType'], 
  targetId: string
): Promise<ProposalEvidenceLink[]> => {
  const linksRef = collection(db, 'users', userId, 'proposals', proposalId, 'evidenceLinks');
  const q = query(
    linksRef, 
    where('targetType', '==', targetType),
    where('targetId', '==', targetId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProposalEvidenceLink));
};
