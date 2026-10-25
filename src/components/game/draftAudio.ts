import { createContext, useContext, type ReactNode } from "react";

export interface DraftAudio {
  enabled: boolean;
  busy: boolean;
  hidden: boolean;
  controls: ReactNode;
}
export const DraftAudioContext = createContext<DraftAudio>({
  enabled: false,
  busy: false,
  hidden: false,
  controls: null,
});
export const useDraftAnnouncer = () => useContext(DraftAudioContext);
