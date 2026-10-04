// "Translate & explain in Vietnamese" (SPEC §6). POST { phraseId } for a saved phrase
// (result is cached on Phrase.vi / Phrase.viNote), or POST { phrase, meaning, example }
// for an unsaved one (Add phrase auto-fill). Uses Claude when ANTHROPIC_API_KEY is set;
// otherwise falls back to the English "meaning" when it is already Vietnamese (imported
// from the tutor sheet), or reports that the key is missing.
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hasVietnamese, VI_OFFLINE_MESSAGE } from "@/lib/vietnamese";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const SYSTEM_PROMPT = `You help a Vietnamese learner preparing for IELTS (band 5.5 aiming for 6.5+) understand English phrases and collocations from their phrase bank.

Given an English phrase, its English meaning and an example sentence, reply with ONE JSON object and nothing else (no code fences, no commentary):
{"vi": "<Vietnamese meaning of the phrase, at most 12 words>", "viNote": "<at most 2 Vietnamese sentences explaining: register/formality, the grammar pattern that follows the phrase (e.g. + noun / + V-ing / + that-clause), typical collocates, and whether it suits Writing or Speaking>"}

Rules: write "vi" and "viNote" in natural Vietnamese; keep English words only for the phrase itself and its collocates; be concrete and brief; return valid JSON with double quotes.`;

type Body = {
  phraseId?: number | string | null;
  phrase?: string;
  meaning?: string;
  example?: string;
};

type Result = { vi: string; viNote: string; source: "cache" | "claude" | "meaning" | "offline"; message?: string };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

function parseVi(text: string): { vi: string; viNote: string } | null {
  let t = text.trim();
  // Strip ``` fences (with or without a language tag).
  t = t.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```\s*$/m, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
    const vi = typeof obj.vi === "string" ? obj.vi.trim() : "";
    const viNote = typeof obj.viNote === "string" ? obj.viNote.trim() : "";
    if (!vi && !viNote) return null;
    return { vi, viNote };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = ((await req.json().catch(() => null)) ?? {}) as Body;

  const rawId = body.phraseId;
  const phraseId = rawId == null || rawId === "" ? null : Number(rawId);
  if (phraseId != null && !Number.isInteger(phraseId)) return json({ error: "Bad phraseId" }, 400);

  let phrase = (body.phrase || "").trim();
  let meaning = (body.meaning || "").trim();
  let example = (body.example || "").trim();

  if (phraseId != null) {
    const row = await prisma.phrase.findUnique({ where: { id: phraseId } });
    if (!row) return json({ error: "Phrase not found" }, 404);
    if (row.vi && row.viNote) {
      const out: Result = { vi: row.vi, viNote: row.viNote, source: "cache" };
      return json(out);
    }
    phrase = row.phrase;
    meaning = row.meaning;
    example = row.example;
  }
  if (!phrase) return json({ error: "Enter the phrase first." }, 400);
  if (phrase.length > 200 || meaning.length > 1000 || example.length > 2000) return json({ error: "Input too long" }, 413);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    if (hasVietnamese(meaning)) {
      if (phraseId != null) {
        await prisma.phrase.update({ where: { id: phraseId }, data: { vi: meaning } }).catch(() => null);
      }
      const out: Result = { vi: meaning, viNote: "", source: "meaning" };
      return json(out);
    }
    const out: Result = { vi: "", viNote: "", source: "offline", message: VI_OFFLINE_MESSAGE };
    return json(out);
  }

  const client = new Anthropic({ apiKey });
  const user = [
    `Phrase: ${phrase}`,
    `English meaning: ${meaning || "(not given)"}`,
    `Example: ${example || "(not given)"}`,
  ].join("\n");

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: user }],
    });
    if (res.stop_reason === "refusal") return json({ error: "Claude declined to translate this phrase." }, 502);
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const parsed = parseVi(text);
    if (!parsed) return json({ error: "Claude did not return a usable JSON translation. Please try again." }, 502);

    if (phraseId != null) {
      await prisma.phrase.update({ where: { id: phraseId }, data: { vi: parsed.vi, viNote: parsed.viNote } });
    }
    const out: Result = { vi: parsed.vi, viNote: parsed.viNote, source: "claude" };
    return json(out);
  } catch (err) {
    let msg = "Translation failed. Please try again.";
    let status = 502;
    if (err instanceof Anthropic.AuthenticationError) {
      msg = "Your ANTHROPIC_API_KEY was rejected. Check the key in .env and restart the server.";
      status = 401;
    } else if (err instanceof Anthropic.RateLimitError) {
      msg = "Rate limited by the Claude API. Wait a moment and try again.";
      status = 429;
    } else if (err instanceof Anthropic.APIConnectionError) {
      msg = "Could not reach the Claude API. Check your internet connection.";
    } else if (err instanceof Anthropic.APIError) {
      msg = `Claude API error ${err.status}: ${err.message}`;
    }
    return json({ error: msg }, status);
  }
}
