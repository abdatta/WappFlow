import { AlertCircle, RefreshCw, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { useRegisterSW } from "virtual:pwa-register/react";

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRegistered(r: any) {
      r &&
        setInterval(
          () => {
            r.update();
          },
          60 * 60 * 1000
        ); // Check for updates every hour
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRegisterError(error: any) {
      console.log("SW registration error", error);
    },
  });

  const [countdown, setCountdown] = useState(5);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
    setCountdown(5);
  };

  useEffect(() => {
    if (offlineReady) {
      console.log("App is ready to work offline");
      // Auto-hide offline ready message after 5 seconds
      const timer = setTimeout(() => setOfflineReady(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [offlineReady]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (needRefresh && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (needRefresh && countdown === 0) {
      updateServiceWorker(true);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [needRefresh, countdown, updateServiceWorker]);

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-[#1f2c34] border border-[#2a3942] rounded-lg shadow-lg p-4 flex items-start gap-4 max-w-sm">
        <div className="text-[#00a884] mt-1">
          {needRefresh ? <RefreshCw size={20} /> : <AlertCircle size={20} />}
        </div>

        <div className="flex-1">
          <h3 className="text-white font-medium mb-1">
            {needRefresh ? "Update Available" : "Offline Ready"}
          </h3>
          <p className="text-gray-300 text-sm mb-3">
            {needRefresh
              ? `New content available. Reloading in ${countdown}s...`
              : "App is ready to work offline."}
          </p>

          <div className="flex gap-2">
            {needRefresh && (
              <button
                className="bg-[#00a884] hover:bg-[#008f6f] text-[#111b21] px-3 py-1.5 rounded text-sm font-medium transition-colors"
                onClick={() => updateServiceWorker(true)}
              >
                Reload Now
              </button>
            )}
            <button
              className="bg-transparent border border-[#2a3942] text-gray-300 hover:bg-[#2a3942] px-3 py-1.5 rounded text-sm font-medium transition-colors"
              onClick={close}
            >
              Cancel
            </button>
          </div>
        </div>

        <button
          onClick={close}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
