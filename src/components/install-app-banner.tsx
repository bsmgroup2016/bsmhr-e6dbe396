import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const DISMISS_KEY = "bsm.pwa.install.dismissed";

interface PromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * App-like install strip. Uses the native beforeinstallprompt flow on Android /
 * desktop Chrome, and shows the manual Share -> "Add to Home Screen" hint on iOS.
 */
export function InstallAppBanner() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || window.top !== window.self) return;

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIos) {
      setIosHint(true);
      setHidden(false);
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as PromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") dismiss();
  };

  if (hidden || (!prompt && !iosHint)) return null;

  return (
    <div className="flex items-center gap-3 border-b border-border/60 bg-primary/10 px-4 py-2 text-xs">
      <Download className="h-4 w-4 shrink-0 text-primary" />
      <span className="flex-1">
        {prompt
          ? "Install BSM WOMS on this device for faster, app-like access."
          : "Add BSM WOMS to your Home Screen: tap Share then \u201cAdd to Home Screen\u201d."}
      </span>
      {prompt ? (
        <Button size="sm" className="h-6 px-2" onClick={() => void install()}>
          Install
        </Button>
      ) : (
        <Share className="h-4 w-4 text-muted-foreground" />
      )}
      <button type="button" aria-label="Dismiss install banner" onClick={dismiss}>
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
