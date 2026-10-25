import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useGameStore } from "@/lib/game-store";
import { useSettings } from "@/lib/settings-store";
import { TitleScreen } from "./TitleScreen";

/** Keep the title and its small startup path separate from the football engine. */
export function GameEntry() {
  const screen = useGameStore((state) => state.screen);
  const uiScale = useSettings((state) => state.uiScale);
  const highContrast = useSettings((state) => state.highContrast);
  const navigate = useNavigate();

  useEffect(() => {
    if (screen !== "title") void navigate({ to: "/league", replace: true });
  }, [navigate, screen]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--user-ui-scale", String(uiScale / 100));
    root.dataset.contrast = highContrast ? "high" : "standard";
    return () => {
      root.style.removeProperty("--user-ui-scale");
      delete root.dataset.contrast;
    };
  }, [highContrast, uiScale]);

  // This only removes a legacy local voice model; keep that cleanup off the first paint.
  useEffect(() => {
    void import("@/lib/voice/speech")
      .then(({ clearOldVoiceModel }) => clearOldVoiceModel())
      .catch(() => {});
  }, []);

  return <TitleScreen />;
}
