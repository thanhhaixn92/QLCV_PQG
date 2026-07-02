import React from "react";
import { Activity, ClipboardCheck, FileText, ShieldCheck } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AssistantContextSummaryItem } from "./assistantTypes";

interface AssistantContextPaneProps {
  title?: string;
  items: AssistantContextSummaryItem[];
  children?: React.ReactNode;
}

export function AssistantContextPane({ items, children }: AssistantContextPaneProps) {
  const [activeTabId, setActiveTabId] = React.useState<string>("activity");

  const supportItems = items.filter(it => {
    if (it.id === "activity") return true; 
    
    // Only show other tabs if they have meaningful content
    if (it.id === "context") return it.details && it.details.length > 0;
    if (it.id === "preflight") {
      return it.details && it.details.length > 0 && it.value !== "Bản thảo trống" && it.value !== "Đạt yêu cầu";
    }
    if (it.id === "sources") {
      return (it.details && it.details.length > 0) || it.value === "Đang thêm nguồn";
    }
    return false;
  });

  const order = ["activity", "context", "preflight", "sources"];
  const sortedSupportItems = [...supportItems].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  React.useEffect(() => {
    if (!sortedSupportItems.some(it => it.id === activeTabId)) {
      setActiveTabId("activity");
    }
  }, [sortedSupportItems, activeTabId]);

  const selectedItem = sortedSupportItems.find(it => it.id === activeTabId);

  const renderTabContent = () => {
    if (!selectedItem) return null;

    switch (selectedItem.id) {
      case "activity":
        return selectedItem.details && selectedItem.details.length > 0 ? (
          <div className="space-y-1 bg-white">
            {selectedItem.details.map((detail, idx) => (
              <div key={idx} className="flex items-start gap-1 text-[10px] text-slate-650 font-bold leading-normal">
                <span className="w-1 h-1 rounded-full bg-[#002D56] mt-1.5 shrink-0" />
                <span className="flex-1 truncate" title={detail}>{detail}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-1 text-[10.5px] font-bold text-slate-400">
            Chưa có hoạt động phiên này.
          </div>
        );

      case "context":
        return (
          <div className="space-y-1 bg-white">
            <div className="text-[10px] font-black text-[#002D56] uppercase tracking-wider">
              Đang chọn {selectedItem.value}
            </div>
            {selectedItem.details && selectedItem.details.map((detail, idx) => (
              <div key={idx} className="truncate text-[10.5px] text-slate-500 font-semibold italic border-l-2 border-[#002D56] pl-1.5 leading-snug">
                {detail}
              </div>
            ))}
          </div>
        );

      case "preflight":
        return (
          <div className="space-y-1 bg-white">
            <div className="text-[10px] font-bold text-slate-700">
              Trạng thái kiểm tra: <span className="text-[#002D56] font-black uppercase tracking-wider">{selectedItem.value}</span>
            </div>
            {selectedItem.details && selectedItem.details.length > 0 ? (
              <div className="space-y-1 max-h-[75px] overflow-y-auto custom-scrollbar pr-0.5">
                {selectedItem.details.map((detail, idx) => {
                  const isBlocker = detail.includes("LỖI CHẶN");
                  return (
                    <div key={idx} className={cn(
                      "text-[9.5px] leading-relaxed p-1 rounded border font-semibold",
                      isBlocker 
                        ? "bg-red-50/50 border-red-100 text-red-700" 
                        : "bg-amber-50/40 border-amber-100 text-amber-800"
                    )}>
                      {detail}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 font-bold italic leading-relaxed">
                Quét bản thảo sạch sẽ, sẵn sàng xuất bản.
              </div>
            )}
          </div>
        );

      case "sources":
        return (
          <div className="space-y-1 bg-white">
            <div className="text-[10px] font-black text-[#002D56] uppercase tracking-wider">
              {selectedItem.value}
            </div>
            {selectedItem.details && selectedItem.details.length > 0 && (
              <div className="space-y-1 max-h-[75px] overflow-y-auto custom-scrollbar">
                {selectedItem.details.map((detail, idx) => (
                  <div key={idx} className="text-[10px] text-slate-650 font-bold truncate bg-slate-50 px-1.5 py-0.5 rounded border border-slate-150">
                    📄 {detail}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section className="flex-none bg-slate-50 border-b border-slate-200" aria-label="Trung tâm hỗ trợ">
      {/* Horizontal Tabs Row */}
      <div className="flex border-b border-slate-150 px-2 bg-slate-100/60 overflow-x-auto select-none no-scrollbar">
        {sortedSupportItems.map((item) => {
          const isActive = activeTabId === item.id;
          const badgeCount = item.id === "preflight" && item.details ? item.details.length :
                             item.id === "context" && item.details ? item.details.length :
                             item.id === "sources" && item.details ? item.details.length : 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTabId(item.id)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider border-b-2 -mb-px transition-all outline-none whitespace-nowrap",
                isActive
                  ? "border-[#002D56] text-[#002D56]"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              )}
            >
              {item.id === "activity" && <Activity className="h-3.5 w-3.5 shrink-0" />}
              {item.id === "context" && <ShieldCheck className="h-3.5 w-3.5 shrink-0" />}
              {item.id === "preflight" && <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />}
              {item.id === "sources" && <FileText className="h-3.5 w-3.5 shrink-0" />}

              <span>{item.id === "context" ? "Canvas" : item.id === "activity" ? "Hoạt động" : item.id === "preflight" ? "Rà soát" : "Tài liệu"}</span>

              {badgeCount > 0 && item.id !== "activity" && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[8.5px] font-black leading-none",
                  isActive ? "bg-[#002D56] text-white" : "bg-slate-200 text-slate-600"
                )}>
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Window */}
      <div className="px-2 py-1.5 bg-white" data-export-exclude="true">
        <div className="max-h-[84px] min-h-[32px] overflow-y-auto custom-scrollbar">
          {renderTabContent()}
        </div>
      </div>

      {children}
    </section>
  );
}
