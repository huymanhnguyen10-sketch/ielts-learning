/**
 * One-off backfill for the "Translate & explain in Vietnamese" feature (SPEC §6).
 *
 *   npx tsx scripts/backfill-vi.ts [--dry-run]
 *
 * Phrases imported from the tutor's spreadsheet often have a Vietnamese string in `meaning`.
 * For every phrase whose `vi` is empty and whose `meaning` contains Vietnamese letters,
 * copy `meaning` into `vi` so the Vietnamese panel shows it without an API call.
 */
import { PrismaClient } from "@prisma/client";
import { hasVietnamese } from "../src/lib/vietnamese";

const DRY = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.phrase.findMany({
    where: { vi: "" },
    select: { id: true, phrase: true, meaning: true },
    orderBy: { id: "asc" },
  });
  const targets = rows.filter((r) => hasVietnamese(r.meaning));
  for (const r of targets) {
    if (DRY) {
      console.log(`[dry-run] #${r.id} ${r.phrase} → vi = ${r.meaning.trim()}`);
      continue;
    }
    await prisma.phrase.update({ where: { id: r.id }, data: { vi: r.meaning.trim() } });
  }
  const total = await prisma.phrase.count();
  console.log(
    `${DRY ? "Would backfill" : "Backfilled"} vi for ${targets.length} phrase(s) ` +
      `(${rows.length} had no Vietnamese meaning; ${total} phrases in total).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
