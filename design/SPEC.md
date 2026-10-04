# Band Up — IELTS Study Hub: implementation spec

Source of truth for layout and behaviour: `design/Main.dc.html` (a clickable prototype).
It is a "Design Component" file: markup inside `<x-dc>` uses `{{holes}}`, `<sc-if>` and `<sc-for>`;
all logic lives in the `class Component extends DCLogic` script at the bottom (`renderVals()` = view model).
Treat it as a reference for structure, copy, styles and rules — rebuild it as a normal app, do not ship the DC runtime.

## 1. Goals and user

- Single learner, current band 5.5, target 6.5 in ~3 months, studies 15–30 min/day.
- Feature 1 (build now): phrase-based vocabulary learning + skill practice + library + AI tutor.
- Feature 2 (later, needs test sources): computer-based mock exam. Keep a placeholder page only.
- All UI copy in English.

## 2. Suggested stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + SQLite locally (Postgres when hosted)
- Uploads: local disk under `/uploads` (S3-compatible storage when hosted)
- AI: Anthropic Claude API from server routes only; key in `.env` as `ANTHROPIC_API_KEY`
- Single user first; add auth (e.g. NextAuth/email link) only when hosting online

## 3. Design tokens (colourful theme)

| Token | Value | Use |
|---|---|---|
| ink | `#1E1B3A` | body text |
| sidebar | `#2A1B6B`; active item `#4B38A3`; cards `#3A2A85`; text `#DCD5F8`, labels `#C9C0F2` / `#A99DE6` | left navigation |
| primary (violet) | `#5B3FD9`, hover `#4930B8`, soft `#EEEAFE`, text-on-soft `#3B2799`, light `#B7A8F5` | buttons, selected tabs, academic phrases, dashboard hero |
| highlight | yellow `#FFD166` (primary CTA on the violet hero, dark text) | |
| accent (orange) | `#FF9F43`, soft `#FFEBDA`, text `#8A4209` | everyday phrases, roadmap |
| muted | `#5B5775` | secondary text |
| ground / surface | `#F5F3FF` / `#FFFFFF` | page / cards |
| lines | `#E4E0F5`, input border `#D3CCEE`, track `#ECE8FA` | |
| skills | Reading `#2563EB`, Listening `#0EA5B7`, Writing `#F0623A`, Speaking `#A855F7` (tints `#E8F0FE`, `#E3F7FA`, `#FEECE6`, `#F5EBFE`) | bars, tiles, nav dots |
| other | Vocabulary `#E8488A`, Library `#16A34A`, Progress `#5B3FD9` | nav dots, page eyebrow pill |
| Vietnamese panel | bg `#FFF8EF`, border `#F1D3B3`, text `#3D1E04` | translate & explain |

- Each page has a colour: the nav item shows a small coloured square, and the page eyebrow is a filled pill in that colour.
- Dashboard: violet hero card; stat cards and sections get a 5px coloured top border (each a different colour).
- Topic cards each use one of 8 colour pairs (tint background + strong text; solid when selected). Review card top border: violet (academic) / orange (everyday).
- Keep text contrast ≥ 4.5:1: coloured text uses the darker variants (e.g. `#0B7C8A`, `#C02C6C`, `#C2410C`); light skill colours are only for fills/bars.
- Fonts: **Space Grotesk** (500/600/700) headings and numbers; **IBM Plex Sans** (400/500/600) body.
- Radius: cards 12px, buttons/inputs 8px, chips 10–12px. Touch targets ≥ 40–44px. Focus ring `3px #8DB8DA`.
- Layout: sidebar (flex basis 220px) + content (max-width 1080px); sidebar stacks on narrow screens. No emoji, no gradients; inline stroke SVG icons.

## 4. Navigation (sidebar)

- Dashboard · My library
- **Vocabulary:** Review (badge = cards due today) · Sentence practice · Flashcards & tests · Phrase bank · Add phrase
- **Skills:** Reading · Listening · Writing · Speaking
- **Progress:** Mock tests & scores · Mock exam (coming soon) · AI tutor
- Sidebar footer: target band stepper (4.0–9.0, step 0.5, default 6.5) + "N days to exam".
- Header on every page: eyebrow + H1, buttons "Add phrase" and "Upload material". Toast/status line for confirmations.
- Floating "Ask AI tutor" button bottom-right on every page except AI tutor; opens a mini chat panel.

## 5. Data model

```
Phrase { id, phrase, meaning, example, source: Writing|Reading|Listening|Speaking, sourceNote, topic,
         kind: academic|everyday, related, vi (Vietnamese meaning), viNote (Vietnamese explanation), reps, interval (days), ease (default 2.5), due (date),
         firstLearned (date|null), createdAt }
Sentence { id, phraseId, text, date }
ReviewLog { id, phraseId, grade, date }            // drives "Last 7 days"
Material { id, title, skill: Reading|Listening|Writing|Speaking|Vocabulary|Grammar|General,
           kind: PDF|Audio|Video|Image|Doc|File|Link|Note, size, url|filePath, note, studied, createdAt }
PlanTask { id, text, done, date }
Score { id, date, listening, reading, writing, speaking, overall }
Draft { id, task: 1|2, prompt, text, words, date }
Chat { id, title, createdAt } ; ChatMessage { id, chatId, role: user|assistant, text, createdAt }
Settings { targetBand=6.5, examDate=today+90, minutesPerDay=20, goalPhrases=500, reviewMode=produce|recognize }
```

Topics: Education, Environment, Technology, Health, Work & jobs, Society, Government, Crime, Travel, Task 1 trends, Daily life.
The 12 seed phrases in the prototype are samples — seed them only in dev.

## 6. Vocabulary rules (core feature)

**Daily plan** from `minutesPerDay` (15/20/30): `newN = round(min/3)`, `reviewN = round(min*1.5)`, `sentenceN = 30→4, 20→3, 15→2`.
Time estimates: ~20 s per review card, ~1 min per new phrase, ~2 min per sentence.

**Session queue** (`buildQueue`):
1. Due reviews = phrases with `reps>0 && due<=today`, academic first, then oldest due. Cap at `reviewN`.
   Everyday phrases may fill at most `floor(reviewN*0.3)` of the queue.
2. New phrases = `reps==0`, academic first, up to `newN − phrasesFirstLearnedToday`.

**Card**: academic → default "Meaning → phrase" (show meaning + example with the phrase blanked as `_____`; hint shows first letters).
Everyday phrases are always shown "Phrase → meaning" (recognition only). Toggle for direction.

**Grading** (`nextIv`): Again → 0 (re-queue at end of session, ease −0.2); Hard → new:1, else `max(1, round(iv*1.2))`, ease −0.15;
Good → new:1, second:3, else `round(iv*ease)`; Easy → new:3, else `round(max(iv,1)*ease*1.3)`, ease +0.15. Ease floor 1.3.
**Everyday phrases: interval ×2, minimum 3 days.** Show the next interval under each grade button.
Status: New (`reps==0`), Known (`interval>=21`), otherwise Learning.

**Sentence practice**: pick academic + already-reviewed phrases with the fewest own sentences first. Prompt:
"Write one sentence about {topic} using "{phrase}", as if you were writing Task 2."
Local check (before AI): all key words of the phrase present (ignore something/someone/sb/sth/one's; loose stem match),
≥10 words, capital letter, end punctuation, not identical to the example. Save only if the phrase is present.
Later: send to Claude for grammar/naturalness feedback.

**Add phrase**: paste source text → user highlights text → phrase field = selection, example = the sentence containing it.
Fields: phrase*, meaning*, example, source, topic, source note, related phrases, type (academic/everyday). Reject duplicates.
Capture entry points: Reading passage highlight → "Save as phrase"; Writing "Collect phrases from essay" (opens Add phrase with the essay as source).

**Translate & explain in Vietnamese** (button on the Review card, Sentence practice, each Phrase bank row, and Add phrase):
- Shows a panel (`lang="vi"`, soft orange `#FFF8EF`, border `#F1D3B3`) with **Nghĩa** (Vietnamese meaning) and
  **Giải thích** (short Vietnamese explanation: register/formality, grammar pattern after the phrase, typical collocates, Writing vs Speaking use).
- On the Review card, only available after "Show answer" (or in Phrase → meaning mode) so it doesn't give the answer away. Resets on the next card.
- Generation: server route calls Claude with the phrase, English meaning and example; returns JSON `{ vi, viNote }` (viNote ≤ 2 sentences).
  Cache the result on the Phrase (`vi`, `viNote` fields) so it's generated once; user can edit it.
- Add phrase: optional "Vietnamese meaning" + "Explanation in Vietnamese" fields with an auto-fill button that calls the same route.
- The 12 seed phrases include sample `vi`/`viNote`; the prototype shows a "Preview" note for phrases without them.

**Flashcards & tests** (Vocabulary → "Flashcards & tests"; source = the phrase bank):
- Setup page: two mode cards (Flashcards, Quick test) + shared settings: phrases from (whole bank / still learning / new / academic / everyday),
  topic, number of questions (5/10/15/20), countdown speed (Relaxed 30 s, Normal 20 s, Fast 12 s per question → one total countdown),
  question-type toggles (all on by default, at least one required). Shows how many phrases match; tests need ≥ 4 phrases in the bank.
  Test history list (score %, correct/total, speed, date-time).
- Flashcards: shuffled deck; 3D flip card (front phrase or meaning — toggle; back = the other side + example + Vietnamese meaning if present;
  respect prefers-reduced-motion). Buttons "Still learning" / "I know it" (advance), Previous / Skip, Shuffle. End screen: known vs learning,
  "Study 'still learning' again", "Shuffle all again", "Take a quick test".
- Quick test: phrases drawn at random (cycling if fewer than the question count); each question gets a random type from the enabled
  types that fit that phrase:
  - Multiple choice: meaning → pick the phrase (4 options; distractors = other phrases)
  - Choose the meaning: phrase → pick the meaning
  - Vietnamese → English: Vietnamese meaning → pick the phrase (only if `vi` exists)
  - True / False: "X means Y" (50% true; false uses another phrase's meaning)
  - Fill in the blank: example sentence with the phrase blanked → type it (case/punctuation-insensitive); only when the example contains the exact phrase
  - Missing word: phrase with one key word (≥ 4 letters, not something/someone/etc.) blanked → pick from 4 words taken from other phrases
  - Word order: shuffled word chips → tap in order (Undo); auto-checks when all words are placed
  Immediate feedback after each answer (correct option green ✓, chosen wrong option orange ✗, answer + meaning + example), then Next.
  Dark countdown bar on top (turns orange under 25%); Finish button; time up = auto-submit, unanswered count as wrong.
- Results: score ring + %, time used, title by score, per-type breakdown, every answer (yours vs correct). Actions: Retry mistakes
  (new test from the wrong phrases), Add mistakes to today's review (set due = today for reviewed phrases), New test, Settings.
- Persist test results (`QuizResult { id, date, right, total, speed, types, wrongPhraseIds }`).

**Phrase bank**: topic grid with counts; filters (search, source, type, status); each row shows meaning, example, chips
(topic, source+note, status + next review, # own sentences) and actions: toggle Academic/Everyday flag, Practise, Delete.

## 7. Other pages

- **Dashboard**: today's vocab session card (minute picker, 3 steps, Start review / Practise sentences); stats (exam date picker +
  countdown, latest overall + gap to target, phrases learned / goal with "about N per day", library count); Today's plan checklist;
  Band by skill bars with target marker; 3-month roadmap (Month 1 build bank by topic / Month 2 use actively / Month 3 consolidate,
  "You are here" from days elapsed); phrase sources bars; academic vs everyday split; last 7 days reviews; skill tiles.
- **My library**: upload (drag-drop + picker, file it under a skill), add link/note, filter chips by skill, search, mark studied, remove, open.
  Each skill page shows a strip of that skill's materials with an upload button.
- **Reading**: passage + True/False/Not Given questions with check/reset (sample content; later load passages from library/test bank).
- **Listening**: audio player for uploaded audio; answer checker (my answers vs key, one per line, `a/b` alternatives allowed);
  40 answers → band via table 39–40=9, 37–38=8.5, 35–36=8, 32–34=7.5, 30–31=7, 26–29=6.5, 23–25=6, 18–22=5.5, 16–17=5, 13–15=4.5, 10–12=4.
- **Writing**: Task 1/2 tabs, editable prompt, essay editor, live word count vs 150/250, timer 20/40 min, four-criteria self-check,
  saved drafts, "Collect phrases from essay".
- **Speaking**: Part 1/2/3; Part 2 cue card + notes, 60 s prep auto-rolls into 120 s speaking timer; shows everyday phrases to try.
  Later: in-browser recording (MediaRecorder).
- **Mock tests & scores**: log L/R/W/S (0–9 step 0.5), overall = average rounded IELTS-style (.25 → .5, .75 → next whole), history table.
- **Mock exam**: placeholder describing the planned computer-based simulation for all four skills.

## 8. AI tutor

- Full page: chat history sidebar (search, open, delete, new chat; title = first message) + thread + composer (Enter sends, Shift+Enter newline).
- Mini panel from the floating button shares the active chat.
- "Use my progress as context" toggle; when on, send a compact context block with each request: target band, exam date/days left,
  latest scores, phrase counts (learning/known, academic/everyday), weakest skill, current essay (if on Writing), page the user is on.
- Starter suggestions change by page (e.g. Writing → "Check my essay").
- Capabilities to implement with tools or prompt instructions: study plan, essay feedback (mention bank phrases used/unused),
  quiz from the phrase bank, explain question types, speaking ideas, score trend.
- The prototype uses canned keyword replies; replace with streaming Claude responses. Persist every message.

## 9. Build order

1. Data layer + settings + seed (dev only)
2. Vocabulary: Add phrase, Phrase bank, Review (SRS), Sentence practice, Dashboard
3. Library + uploads
4. Skills pages, scores
5. AI tutor (API route, streaming, persistence)
6. Mock exam (Phase 2, after test sources exist)
