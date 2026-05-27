import { WorkTaskPriority, WorkTaskStatus, TASK_CATEGORIES } from "../types";

export function createClientId(): string {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
    try {
      return window.crypto.randomUUID();
    } catch (e) {
      // Fallback
    }
  }
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `client-${Date.now()}-${result}`;
}

export function extractJsonFromText(rawText: string): any {
  const raw = String(rawText || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {}

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }

  const firstObj = raw.indexOf("{");
  const lastObj = raw.lastIndexOf("}");
  if (firstObj >= 0 && lastObj > firstObj) {
    const block = raw.slice(firstObj, lastObj + 1);
    try {
      return JSON.parse(block);
    } catch (e) {
      const cleanBlock = block
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/\\n/g, " ")
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
        .trim();
      try {
        return JSON.parse(cleanBlock);
      } catch {}
    }
  }

  const firstArr = raw.indexOf("[");
  const lastArr = raw.lastIndexOf("]");
  if (firstArr >= 0 && lastArr > firstArr) {
    const block = raw.slice(firstArr, lastArr + 1);
    try {
      return JSON.parse(block);
    } catch (e) {
      const cleanBlock = block
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/\\n/g, " ")
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
        .trim();
      try {
        return JSON.parse(cleanBlock);
      } catch {}
    }
  }

  return null;
}

export function normalizeAIResponseToArray(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  if (typeof raw === "object") {
    if (Array.isArray(raw.tasks)) return raw.tasks;
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.taskDrafts)) return raw.taskDrafts;
  }

  return [];
}

export function ensureUniquePreviewTasks(tasks: any[]): any[] {
  const validCategories = TASK_CATEGORIES.map((cat) => cat.code);
  const validPriorities: WorkTaskPriority[] = ["low", "medium", "high", "urgent"];
  const validStatuses: WorkTaskStatus[] = ["todo", "doing", "review", "done", "blocked"];

  const parsedList = normalizeAIResponseToArray(tasks);

  return parsedList
    .map((t: any) => {
      if (!t || typeof t !== "object") return null;
      
      const title = String(t.title || t.name || "").trim();
      if (!title) return null;

      const priorityRaw = String(t.priority || "").toLowerCase();
      const priority: WorkTaskPriority = validPriorities.includes(priorityRaw as any)
        ? (priorityRaw as WorkTaskPriority)
        : "medium";

      const categoryCodeRaw = String(t.categoryCode || t.category || "").trim();
      const categoryCode = validCategories.includes(categoryCodeRaw)
        ? categoryCodeRaw
        : "LV_DH";

      const statusRaw = String(t.status || "").toLowerCase();
      const status: WorkTaskStatus = validStatuses.includes(statusRaw as any)
        ? (statusRaw as WorkTaskStatus)
        : "todo";

      const checklistRaw = Array.isArray(t.checklist) ? t.checklist : [];
      const checklist = checklistRaw
        .map((item: any, idx: number) => {
          if (!item) return null;
          const itemTitle = typeof item === "string" ? item : String(item.title || "").trim();
          if (!itemTitle) return null;
          return {
            id: `chk-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
            title: itemTitle,
            done: typeof item === "object" ? !!item.done : false,
            createdAt: Date.now()
          };
        })
        .filter(Boolean);

      return {
        clientId: createClientId(),
        title: title,
        description: String(t.description || t.desc || "").trim(),
        assignee: String(t.assignee || "").trim(),
        assigneeText: String(t.assigneeText || t.assignee || "").trim(),
        dueDate: String(t.dueDate || t.due_date || "").trim(),
        categoryCode: categoryCode,
        isDeputy: !!(t.isDeputy || t.deputy),
        priority: priority,
        status: status,
        source: "ai" as const,
        selected: true,
        checklist: checklist,
        sourceText: String(t.sourceText || "").trim(),
        nextActions: Array.isArray(t.nextActions) ? t.nextActions.map(String) : [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    })
    .filter((task): task is NonNullable<typeof task> => task !== null);
}
