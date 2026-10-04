/** IELTS-style rounding: .25 → .5, .75 → next whole. */
export function roundBand(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.25) return f;
  if (d < 0.75) return f + 0.5;
  return f + 1;
}

export function fmtBand(b: number | null | undefined): string {
  return b == null || Number.isNaN(b) ? "–" : Number(b).toFixed(1);
}

export function isValidBand(v: unknown): v is number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return !Number.isNaN(n) && n >= 0 && n <= 9 && (n * 2) % 1 === 0;
}

/** Listening raw score (out of 40) → band. */
export function listeningBand(c: number): number {
  const t: Array<[number, number]> = [
    [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6],
    [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5],
  ];
  for (const [min, band] of t) if (c >= min) return band;
  return c > 0 ? 2 : 0;
}

export type MaterialKind = "PDF" | "Audio" | "Video" | "Image" | "Doc" | "File" | "Link" | "Note";

export function kindOf(name: string, type = ""): MaterialKind {
  const n = (name || "").toLowerCase();
  if (/\.pdf$/.test(n) || type === "application/pdf") return "PDF";
  if (type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|aac)$/.test(n)) return "Audio";
  if (type.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/.test(n)) return "Video";
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return "Image";
  if (/\.(docx?|txt|rtf|odt|md|pptx?|xlsx?)$/.test(n)) return "Doc";
  return "File";
}

export function fmtSize(b: number | null | undefined): string {
  if (b == null) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Mark listening answers against a key. Alternatives in the key use "a/b". */
export function markAnswers(mine: string, key: string) {
  const norm = (t: string) => t.split("\n").map((x) => x.trim().toLowerCase().replace(/\s+/g, " "));
  const k = norm(key);
  const m = norm(mine);
  const total = k.filter(Boolean).length;
  let correct = 0;
  const wrong: string[] = [];
  k.forEach((ans, i) => {
    if (!ans) return;
    const opts = ans.split("/").map((x) => x.trim());
    if (opts.includes(m[i] || "")) correct++;
    else wrong.push(`Q${i + 1}: you wrote “${m[i] || "—"}”, answer “${ans}”`);
  });
  return { total, correct, wrong };
}
