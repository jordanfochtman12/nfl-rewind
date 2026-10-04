/**
 * Which decade's broadcast look a screen wears. The classes are styled in broadcast-next.css:
 * flat, blocky '60s-'70s bugs with a hint of CRT, '80s chrome, '90s gloss, 2000s glass, and
 * today's look from 2010 on. Off in settings means always today's look.
 */
import { useSettings } from "@/lib/settings-store";

export function eraLook(year: number): { cls: string; label: string } {
  if (year <= 1969) return { cls: "era-look era-60s", label: "1960s broadcast" };
  if (year <= 1979) return { cls: "era-look era-70s", label: "1970s broadcast" };
  if (year <= 1989) return { cls: "era-look era-80s", label: "1980s broadcast" };
  if (year <= 1999) return { cls: "era-look era-90s", label: "1990s broadcast" };
  if (year <= 2009) return { cls: "era-look era-00s", label: "2000s broadcast" };
  return { cls: "", label: "" };
}

/** The era class for a year, or none when the viewer turned era style off. */
export function useEraClass(year: number): string {
  const on = useSettings((s) => s.eraStyle);
  return on ? eraLook(year).cls : "";
}
