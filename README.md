# Band Up — IELTS study hub

Single-learner IELTS study website: phrase-based vocabulary with spaced repetition, sentence practice, a materials library, skill practice pages (Reading, Listening, Writing, Speaking), mock-test score tracking and an AI tutor. Built from the clickable prototype in `design/Main.dc.html` and the spec in `design/SPEC.md`.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Prisma 6 + SQLite (`prisma/dev.db`)
- Uploads stored on disk under `./uploads` (served by `/uploads/...`)
- AI tutor: Anthropic Claude API (optional, see below)

## Run it

```bash
npm install
npm run setup        # prisma generate + db push + seed (settings, starter plan, 12 sample phrases)
npm run dev          # http://localhost:3000
```

For a production-style run: `npm run build && npm start`.

## Content imports

```bash
npm run import:sheet                 # tutor spreadsheet → phrase bank, speaking questions/answers, tips (default: ~/Downloads/IELTS Online Anh Huy.xlsx)
npm run import:sheet -- --file "C:\path\to\sheet.xlsx" --dry-run
npm run seed:official                # official IELTS.org sample tasks → reading passages, listening tests (with audio), writing prompts
```

Both scripts are idempotent: re-running updates existing rows and never duplicates. Official content comes from the free sample tasks published by IELTS.org (`data/official/*.json` holds the transcribed text with source URLs).

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file, default `file:./dev.db` |
| `ANTHROPIC_API_KEY` | Enables the AI tutor with Claude. Leave empty to use the built-in offline coach (study plan, quiz, essay word check computed from your data). |
| `ANTHROPIC_MODEL` | Claude model id, default `claude-opus-5-5` |
| `SEED_SAMPLE_PHRASES` | `true` seeds the 12 prototype phrases on an empty database (dev only) |

## Project layout

```
prisma/schema.prisma      data model (Phrase, Sentence, ReviewLog, Material, PlanTask, Score, Draft, Chat, ChatMessage, Settings)
prisma/seed.ts            idempotent seed
src/app/                  routes: / library review sentence bank add reading listening writing speaking tests exam tutor
src/app/api/tutor         streaming chat endpoint (Claude or offline coach)
src/app/uploads/[...path] serves uploaded files with range support
src/components/           UI (sidebar, header, toast, tutor widget, feature components)
src/lib/actions/          server actions (phrases, materials, plan, scores, drafts, chats, settings)
src/lib/srs.ts            spaced-repetition rules (SPEC §6)
src/lib/stats.ts          dashboard aggregates + tutor context block
uploads/                  uploaded library files (gitignored)
```

## Notes

- All dates are local `YYYY-MM-DD` strings so "today" and due dates follow your clock.
- Re-running `npm run db:seed` never duplicates data.
- Backup = copy `prisma/dev.db` and the `uploads/` folder.
