/**
 * Per-page colour (SPEC §3): the sidebar shows a small square in this colour next to
 * each nav item, and the page eyebrow is a filled pill in it. Ported from the
 * prototype's PAGECOL map (design/Main.dc.html).
 */
export const PAGE_COLOR: Record<string, string> = {
  "/": "#FF9F43",
  "/library": "#16A34A",
  "/review": "#E8488A",
  "/sentence": "#E8488A",
  "/practice": "#E8488A",
  "/bank": "#E8488A",
  "/add": "#E8488A",
  "/reading": "#2563EB",
  "/listening": "#0EA5B7",
  "/writing": "#F0623A",
  "/speaking": "#A855F7",
  "/tests": "#5B3FD9",
  "/exam": "#5B3FD9",
  "/tutor": "#5B3FD9",
};

export const DEFAULT_PAGE_COLOR = "#5B3FD9";

export function pageColor(pathname: string | null | undefined): string {
  if (!pathname) return DEFAULT_PAGE_COLOR;
  if (PAGE_COLOR[pathname]) return PAGE_COLOR[pathname];
  // Nested routes (e.g. /practice/quiz) inherit their section colour.
  const base = "/" + pathname.split("/").filter(Boolean)[0];
  return PAGE_COLOR[base] ?? DEFAULT_PAGE_COLOR;
}

/** Selected-tab style shared by filter/tab buttons (prototype `onTab`). */
export function onTab(on: boolean) {
  return {
    background: on ? "#5B3FD9" : "#FFFFFF",
    color: on ? "#FFFFFF" : "#1E1B3A",
    borderColor: on ? "#5B3FD9" : "#D3CCEE",
  };
}

/** Academic / everyday chip colours (prototype `kindStyle`). */
export function kindStyle(kind: string) {
  return kind === "everyday"
    ? { bg: "#FFEBDA", fg: "#8A4209", bd: "#E8B98E", label: "Everyday / spoken" }
    : { bg: "#EEEAFE", fg: "#3B2799", bd: "#B7A8F5", label: "Academic" };
}

/** The 8 topic-card colour pairs [strong, tint] (prototype `topicCards`). */
export const TOPIC_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#5B3FD9", "#EEEAFE"],
  ["#2563EB", "#E8F0FE"],
  ["#16A34A", "#E7F6EC"],
  ["#0B7C8A", "#E3F7FA"],
  ["#C02C6C", "#FDE8F1"],
  ["#C2410C", "#FEECE6"],
  ["#7E22CE", "#F5EBFE"],
  ["#B45309", "#FEF3DC"],
];

/** Skill tints for tiles (prototype `TINT`). */
export const SKILL_TINT: Record<string, string> = {
  Listening: "#E3F7FA",
  Reading: "#E8F0FE",
  Writing: "#FEECE6",
  Speaking: "#F5EBFE",
};
