// AI tutor chat endpoint. Streams plain-text deltas; the chat id is returned in the
// X-Chat-Id header. Every message is persisted. Falls back to an offline coach when
// no ANTHROPIC_API_KEY is configured.
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getTutorContext } from "@/lib/stats";
import { getSettings } from "@/lib/actions/settings";
import { localReply } from "@/lib/tutor/local-coach";
import { statusName } from "@/lib/srs";
import { topicName } from "@/lib/topics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const SYSTEM_PROMPT = `You are the AI tutor inside "Band Up", a personal IELTS study hub used by one learner.
The learner is preparing for IELTS Academic, currently around band 5.5 and aiming higher within a few months, studying 15–30 minutes a day with a phrase-based vocabulary method (collocations collected from their own Writing, Reading and Listening; academic phrases are practised deeply, everyday phrases only need recognition).

What you do well:
- Study plans: concrete, realistic for the daily minutes available, tied to the exam date and weakest skill.
- Essay feedback: assess against the four IELTS criteria (Task Response/Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy), estimate a band for each, give the 3 most valuable fixes with rewritten examples, and point out which phrases from the learner's phrase bank they used and which ones they could have used.
- Quizzes from the phrase bank: ask one question at a time (meaning → phrase, or fill the gap), wait for the answer, then correct it and move on.
- Explaining question types (TFNG, Yes/No/NG, matching headings, gap fill, Task 1 types, Speaking parts) with short worked examples.
- Speaking ideas: brainstorm points, useful everyday phrases, and a model answer structure for Part 1/2/3.
- Score trends: interpret the logged mock-test scores honestly.

Style: warm, direct coach. Plain text (no Markdown headings or tables; short bullet lines with "•" are fine). British spelling. Keep answers compact unless the learner asks for detail. When the progress context is provided, use it instead of asking for information you already have. Do not invent scores or phrases that are not in the context.`;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { chatId?: number | null; message?: string; useContext?: boolean; page?: string; essay?: string }
    | null;
  const text = (body?.message || "").trim();
  if (!text) return new Response("Empty message", { status: 400 });
  if (text.length > 20000) return new Response("Message too long", { status: 413 });

  // Persist the user turn (creating the chat if needed; title = first message).
  let chatId = body?.chatId ?? null;
  const existing = chatId ? await prisma.chat.findUnique({ where: { id: chatId } }) : null;
  if (!existing) {
    const created = await prisma.chat.create({
      data: { title: text.length > 42 ? text.slice(0, 42) + "…" : text },
    });
    chatId = created.id;
  }
  const cid = chatId!;
  await prisma.chatMessage.create({ data: { chatId: cid, role: "user", text } });

  const history = await prisma.chatMessage.findMany({ where: { chatId: cid }, orderBy: { id: "asc" }, take: 60 });
  const prior = history.slice(0, -1); // everything before the message we just stored
  const lastAssistant = [...prior].reverse().find((m) => m.role === "assistant")?.text;

  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Chat-Id": String(cid),
    "X-Accel-Buffering": "no",
  };

  const finish = async (reply: string) => {
    await prisma.chatMessage.create({ data: { chatId: cid, role: "assistant", text: reply } });
    await prisma.chat.update({ where: { id: cid }, data: { updatedAt: new Date() } });
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const reply = await localReply(text, { essay: body?.essay, lastAssistant });
    await finish(reply);
    return new Response(reply, { headers: { ...headers, "X-Tutor-Mode": "offline" } });
  }

  const settings = await getSettings();
  const useCtx = body?.useContext ?? settings.tutorUseContext;
  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  if (useCtx) {
    const ctx = await getTutorContext(body?.page || "/", body?.essay);
    const phrases = await prisma.phrase.findMany({ orderBy: { id: "desc" }, take: 400 });
    const bank = phrases
      .map((p) => `- ${p.phrase} — ${p.meaning} [${p.kind}, ${topicName(p.topic)}, ${statusName(p)}]`)
      .join("\n");
    systemBlocks.push({
      type: "text",
      text: `Learner progress context (authoritative, from the app database):\n${ctx}\n\nPhrase bank (${phrases.length} most recent):\n${bank || "(empty)"}`,
    });
  }

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.text,
  }));

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const s = client.messages.stream({
          model: MODEL,
          max_tokens: 8000,
          system: systemBlocks,
          messages,
        });
        for await (const event of s) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal") {
          const note = "\n\nI can’t help with that request. Let’s get back to your IELTS preparation.";
          full += note;
          controller.enqueue(encoder.encode(note));
        }
      } catch (err) {
        let msg = "The tutor hit an error. Please try again.";
        if (err instanceof Anthropic.AuthenticationError) msg = "Your ANTHROPIC_API_KEY was rejected. Check the key in .env and restart the server.";
        else if (err instanceof Anthropic.RateLimitError) msg = "Rate limited by the Claude API. Wait a moment and try again.";
        else if (err instanceof Anthropic.APIConnectionError) msg = "Could not reach the Claude API. Check your internet connection.";
        else if (err instanceof Anthropic.APIError) msg = `Claude API error ${err.status}: ${err.message}`;
        full += (full ? "\n\n" : "") + msg;
        controller.enqueue(encoder.encode((full === msg ? "" : "\n\n") + msg));
      } finally {
        await finish(full.trim() || "(no reply)");
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { ...headers, "X-Tutor-Mode": "claude" } });
}
