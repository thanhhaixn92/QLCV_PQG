import { Ship, AlertTriangle } from "lucide-react";

export function StartupOverlay({
  state,
}: {
  state: "booting" | "ready" | "degraded" | "failed";
}) {
  const isVisible = state === "booting";
  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50 font-sans p-6 transition-opacity duration-500 ${isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
    >
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center animate-bounce duration-1000">
          <Ship className="w-8 h-8 text-[#002D56]" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 animate-pulse">
          Đang khởi tạo hệ thống...
        </h2>
        <p className="text-slate-500 text-sm">Vui lòng đợi giây lát</p>
      </div>
    </div>
  );
}

export function DegradedBanner({
  state,
  error,
  onRetry,
}: {
  state: "booting" | "ready" | "degraded" | "failed";
  error: string | null;
  onRetry: () => void;
}) {
  if (state !== "degraded" && state !== "failed") return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9990] bg-amber-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-4 shadow-md">
      <AlertTriangle className="w-4 h-4" />
      <span>Một số dịch vụ đang ngoại tuyến {error ? `(${error})` : ""}</span>
      <button
        onClick={onRetry}
        className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-xs font-bold transition-colors"
      >
        Thử lại
      </button>
    </div>
  );
}
