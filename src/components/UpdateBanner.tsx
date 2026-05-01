import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { invoke } from "@tauri-apps/api/core";
import { X, Download, ChevronDown, ChevronUp } from "lucide-react";

const DISMISSED_KEY = "espy_dismissed_update_version";

export default function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [visible, setVisible] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    check()
      .then((u) => {
        if (!u) return;
        setUpdate(u);
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed !== u.version) setVisible(true);
      })
      .catch(() => {});
  }, []);

  if (!update || !visible) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, update.version);
    setVisible(false);
  };

  const handleInstall = async () => {
    setInstalling(true);
    let downloaded = 0;
    let total = 0;
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? 0;
      else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        if (total > 0) setProgress(Math.round((downloaded / total) * 100));
      }
    });
    await invoke("restart_app");
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-card shadow-lg">
      <div className="flex items-start gap-3 p-4">
        <Download className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Update v{update.version} available</p>
          {update.body && (
            <button
              onClick={() => setShowNotes((s) => !s)}
              className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 hover:text-foreground transition-colors"
            >
              What's new
              {showNotes ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
          {showNotes && update.body && (
            <div className="mt-2 text-xs text-muted-foreground border-t pt-2 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {update.body}
            </div>
          )}
          {installing && (
            <p className="text-xs text-muted-foreground mt-1">
              {progress < 100 ? `Downloading... ${progress}%` : "Installing..."}
            </p>
          )}
        </div>
        {!installing && (
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!installing && (
        <div className="border-t px-4 py-3 flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Update now
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 rounded border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
}
