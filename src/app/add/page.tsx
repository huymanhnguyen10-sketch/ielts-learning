import { AddPhrase } from "@/components/vocab/AddPhrase";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <AddPhrase
      initial={{
        phrase: one(sp.phrase),
        example: one(sp.example),
        source: one(sp.source),
        note: one(sp.note),
        src: one(sp.src),
      }}
    />
  );
}
