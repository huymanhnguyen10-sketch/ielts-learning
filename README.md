# Band Up — IELTS study hub

Single-learner IELTS study website that runs locally with no login. Phrase-based vocabulary with spaced repetition, sentence practice, flashcards and quick tests, a materials library, skill practice pages (Reading, Listening, Writing, Speaking) seeded with official IELTS.org sample tasks, mock-test score tracking, Vietnamese translations, and an AI tutor with an offline fallback. Built from the clickable prototype in `design/Main.dc.html` and the spec in `design/SPEC.md`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- Prisma 6 + SQLite (`prisma/dev.db`)
- Uploads stored on disk under `./uploads` (served by `/uploads/...` with HTTP range support)
- AI: Anthropic Claude via `@anthropic-ai/sdk`, optional (see Configuration)
- Tests: `node:test` through `tsx`; lint: ESLint 9 flat config with `eslint-config-next`

## Run it

```bash
npm install
npm run setup        # prisma generate + db push + seed (settings, starter plan, 12 sample phrases if SEED_SAMPLE_PHRASES=true)
npm run dev          # http://localhost:3000
```

For a production-style run: `npm run build && npm start`.

## Check it

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . (config in eslint.config.mjs)
npm test             # node:test suites in test/*.test.ts
```

On Windows, stop `next dev` before running `prisma generate`; the query engine DLL is locked while the dev server runs.

## Content imports

```bash
npm run import:sheet                 # tutor spreadsheet → phrase bank, speaking questions/answers, tips, links (default: ~/Downloads/IELTS Online Anh Huy.xlsx)
npm run import:sheet -- --file "C:\path\to\sheet.xlsx" --dry-run
npm run seed:official                # official IELTS.org sample tasks → reading passages, listening tests (with audio), writing prompts, library links
npx tsx scripts/backfill-vi.ts       # copy Vietnamese meanings into the vi field for phrases that have none (--dry-run supported)
npm run db:studio                    # Prisma Studio to inspect or edit data
```

All three scripts are idempotent: re-running updates existing rows and never duplicates. Note that `import:sheet` overwrites `meaning`, `example` and `topic` on phrases it already imported; review progress is kept. Official content comes from the free sample tasks published by IELTS.org (`data/official/*.json` holds the transcribed text with source URLs). No copyrighted Cambridge material is included.

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file, default `file:./dev.db` |
| `ANTHROPIC_API_KEY` | Enables Claude for the AI tutor and for Vietnamese "translate & explain". Leave empty to use the built-in offline coach (study plan, quiz, essay word check computed from your data); translation then only copies an existing Vietnamese meaning. |
| `ANTHROPIC_MODEL` | Claude model id, default `claude-opus-5-5` |
| `SEED_SAMPLE_PHRASES` | `true` seeds the 12 prototype phrases on an empty database (dev only) |

## Pages

| Route | What it does |
|---|---|
| `/` | Dashboard: today's vocab session, exam countdown, band gap, plan checklist, progress charts |
| `/review` | Spaced-repetition review (Again / Hard / Good / Easy, keyboard 1–4) |
| `/sentence` | Write your own sentence with a phrase; local checks before saving |
| `/practice` | Flashcards and timed quick tests with seven question types |
| `/bank`, `/add` | Phrase bank with filters; add a phrase by highlighting source text |
| `/reading` | Official passage bank with auto-marked questions; save highlights as phrases |
| `/listening` | Official listening tasks with audio, tapescripts and an answer checker |
| `/writing` | Task 1 / Task 2 editor with timer, prompt bank, drafts, collect phrases from an essay |
| `/speaking` | Part 1–3 question bank with your own answers, cue-card timer, tutor tips |
| `/library` | Upload or link study materials per skill |
| `/tests` | Log mock-test band scores |
| `/exam` | Placeholder for a future full mock exam |
| `/tutor` | AI tutor chat (Claude or offline coach), also available as a floating widget |

## Project layout

```
design/                     SPEC.md + Main.dc.html (source of truth for the UI)
prisma/schema.prisma        Phrase, Sentence, ReviewLog, Material, PlanTask, Score, Draft, Chat, ChatMessage,
                            QuizResult, SpeakingQuestion, Passage, ListeningTest, WritingPrompt, Settings
prisma/seed.ts              idempotent seed
data/official/              reading.json, listening.json, writing.json (IELTS.org samples with source URLs)
scripts/                    import-sheet.ts, seed-official.ts, backfill-vi.ts
src/app/<route>/page.tsx    server components for the routes above
src/app/api/tutor           streaming chat endpoint (Claude or offline coach)
src/app/api/translate       Vietnamese meaning + explanation for a phrase (Claude, with offline fallback)
src/app/uploads/[...path]   serves uploaded files with range support
src/components/             Sidebar, PageHeader, Toast, Timer, SkillMaterials, and feature folders:
                            dashboard/ vocab/ practice/ skills/ library/ progress/ tutor/
src/lib/actions/            "use server" actions: phrases, materials, plan, scores, drafts, chats,
                            settings, speaking, content, practice
src/lib/srs.ts              spaced-repetition rules (SPEC §6)
src/lib/quiz.ts             quick-test question generator (unit tested)
src/lib/stats.ts            dashboard aggregates + tutor context block
src/lib/content-types.ts    passage / listening / writing seed shapes and answer matching
src/lib/tutor/local-coach.ts offline tutor replies
test/quiz.test.ts           node:test suite for the quiz generator
uploads/                    uploaded library files (gitignored)
```

## Conventions

- Pages fetch data through server actions and pass plain props to `"use client"` components; mutations call an action, then `router.refresh()`.
- Never export non-functions from a `"use server"` file; keep constants in plain modules such as `src/lib/uploads.ts`.
- All dates are local `YYYY-MM-DD` strings (`src/lib/dates.ts`) so "today" and due dates follow your clock.
- Prisma is pinned to 6.19.3.

## Notes

- Re-running `npm run db:seed` never duplicates data.
- Backup = copy `prisma/dev.db` and the `uploads/` folder.
