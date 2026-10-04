// Capture a text selection inside a source text and the sentence that contains it
// (used by Add phrase and the Reading passage). Client-side only.
export function selectionIn(src: string): { sel: string; sentence: string } | null {
  let sel = "";
  try {
    sel = (window.getSelection()?.toString() || "").trim().replace(/\s+/g, " ");
  } catch {
    return null;
  }
  if (!sel || sel.length > 80) return null;
  const sentences = (src || "").match(/[^.!?]+[.!?]*/g) || [];
  const hit = sentences.find((x) => x.toLowerCase().includes(sel.toLowerCase())) || "";
  return { sel, sentence: hit.trim() };
}
