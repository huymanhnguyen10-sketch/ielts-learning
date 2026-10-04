import { test } from "node:test";
import assert from "node:assert/strict";
import {
  genQuiz,
  qApplicable,
  norm,
  filterPool,
  gapCands,
  shuffle,
  QUIZ_TYPE_KEYS,
  type PoolItem,
  type QuizType,
} from "../src/lib/quiz";

function mk(
  id: number,
  phrase: string,
  meaning: string,
  example: string,
  topic = "education",
  kind = "academic",
  vi = "",
  reps = 0,
  interval = 0,
): PoolItem {
  return { id, phrase, meaning, example, topic, kind, reps, interval, vi };
}

const ITEMS: PoolItem[] = [
  mk(1, "play a crucial role in", "to be very important for", "Teachers play a crucial role in shaping young minds.", "education", "academic", "đóng vai trò quan trọng"),
  mk(2, "a double-edged sword", "something with both good and bad effects", "Technology is a double-edged sword for students.", "technology", "academic", "", 3, 21),
  mk(3, "pose a threat to", "to be a danger to", "Pollution poses a threat to public health.", "environment", "academic", "", 1, 3),
  mk(4, "in the long run", "over a long period of time", "Investing in education pays off in the long run.", "society", "everyday"),
  mk(5, "make ends meet", "to have just enough money to live", "Many students work part-time to make ends meet.", "work", "everyday", "kiếm đủ sống"),
  mk(6, "give rise to", "to cause something to happen", "Unemployment can give rise to social problems.", "society", "academic"),
  mk(7, "keep up with", "to stay at the same level as", "Older people struggle to keep up with new technology.", "technology", "everyday"),
  mk(8, "a wide range of", "many different kinds of", "The library offers a wide range of resources.", "education", "academic"),
];

/** Deterministic LCG so tests are reproducible. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("shuffle returns a permutation and leaves the input untouched", () => {
  const src = [1, 2, 3, 4, 5];
  const out = shuffle(src, seeded(1));
  assert.deepEqual(src, [1, 2, 3, 4, 5]);
  assert.deepEqual(out.slice().sort(), src);
});

test("norm ignores case, curly quotes, punctuation and spacing", () => {
  assert.equal(norm("  Play a  Crucial Role in! "), "play a crucial role in");
  assert.equal(norm("one’s"), "one's");
});

test("filterPool honours source and topic", () => {
  assert.equal(filterPool(ITEMS, "all", "All").length, 8);
  assert.deepEqual(filterPool(ITEMS, "learning", "All").map((i) => i.id), [1, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(filterPool(ITEMS, "new", "All").map((i) => i.id), [1, 4, 5, 6, 7, 8]);
  assert.deepEqual(filterPool(ITEMS, "everyday", "All").map((i) => i.id), [4, 5, 7]);
  assert.deepEqual(filterPool(ITEMS, "academic", "technology").map((i) => i.id), [2]);
});

test("gapCands drops short and stop words", () => {
  assert.deepEqual(gapCands({ phrase: "play a crucial role in" }), ["play", "crucial", "role"]);
  assert.deepEqual(gapCands({ phrase: "do something with this" }), []);
});

test("genQuiz returns `count` questions cycling the pool", () => {
  const pool = ITEMS.slice(0, 3);
  for (let seed = 1; seed <= 20; seed++) {
    const qz = genQuiz(pool, ITEMS, 10, QUIZ_TYPE_KEYS, seeded(seed));
    assert.equal(qz.length, 10);
    const counts = new Map<number, number>();
    for (const q of qz) counts.set(q.itemId, (counts.get(q.itemId) ?? 0) + 1);
    // 10 over 3 items → each appears 3 or 4 times
    for (const id of pool.map((p) => p.id)) {
      const c = counts.get(id) ?? 0;
      assert.ok(c === 3 || c === 4, `item ${id} drawn ${c} times`);
    }
  }
});

test("every question's type is enabled and applicable to its phrase", () => {
  const enabled: QuizType[] = ["fill", "gap", "order", "vi"];
  for (let seed = 1; seed <= 30; seed++) {
    const qz = genQuiz(ITEMS, ITEMS, 15, enabled, seeded(seed));
    for (const q of qz) {
      const it = ITEMS.find((i) => i.id === q.itemId)!;
      const others = ITEMS.filter((x) => x.id !== it.id && x.meaning !== it.meaning);
      assert.ok(enabled.includes(q.type), `type ${q.type} is not enabled`);
      assert.ok(qApplicable(q.type, it, others), `type ${q.type} not applicable to "${it.phrase}"`);
    }
  }
});

test("fallback type when no enabled type fits: mcPhrase (≥3 others) else tf", () => {
  // "vi" is enabled but item 2 has no vi → must fall back to mcPhrase
  const qz = genQuiz([ITEMS[1]], ITEMS, 3, ["vi"], seeded(7));
  assert.ok(qz.every((q) => q.type === "mcPhrase"));
  // only two items in the bank → tf
  const two = ITEMS.slice(0, 2);
  const qz2 = genQuiz([two[1]], two, 2, ["vi"], seeded(7));
  assert.ok(qz2.every((q) => q.type === "tf"));
});

test("fill questions blank the phrase in the example", () => {
  // "poses a threat to" does not contain the exact phrase, so item 3 is not fill-applicable
  const pool = ITEMS.filter((i) => qApplicable("fill", i, []));
  assert.equal(pool.length, ITEMS.length - 1);
  for (let seed = 1; seed <= 10; seed++) {
    const qz = genQuiz(pool, ITEMS, 8, ["fill"], seeded(seed));
    for (const q of qz) {
      assert.equal(q.type, "fill");
      assert.equal(q.kind, "type");
      assert.ok(q.main.includes("_____"), `expected blank in "${q.main}"`);
      assert.ok(!q.main.toLowerCase().includes(q.phrase.toLowerCase()), "phrase must not appear in the prompt");
      assert.equal(q.answer, q.phrase);
      assert.equal(q.sub, "Meaning: " + q.meaning);
    }
  }
});

test("gap questions offer 4 unique options containing the answer", () => {
  for (let seed = 1; seed <= 15; seed++) {
    const qz = genQuiz(ITEMS, ITEMS, 8, ["gap"], seeded(seed));
    for (const q of qz) {
      assert.equal(q.type, "gap");
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4);
      assert.ok(q.options.includes(q.answer));
      assert.ok(q.main.includes("_____"));
      const filled = q.main.replace("_____", q.answer).toLowerCase();
      assert.equal(filled, q.phrase.toLowerCase());
    }
  }
});

test("multiple-choice questions have 4 options with the answer and no duplicates", () => {
  const qz = genQuiz(ITEMS, ITEMS, 12, ["mcPhrase", "mcMeaning", "vi"], seeded(3));
  for (const q of qz) {
    assert.equal(q.options.length, 4);
    assert.ok(q.options.includes(q.answer));
    assert.equal(new Set(q.options).size, 4);
    if (q.type === "vi") assert.equal(q.lang, "vi");
    if (q.type === "mcMeaning") assert.equal(q.answer, q.meaning);
  }
});

test("order chips are a permutation of the phrase words", () => {
  for (let seed = 1; seed <= 15; seed++) {
    const qz = genQuiz(ITEMS, ITEMS, 8, ["order"], seeded(seed));
    for (const q of qz) {
      assert.equal(q.type, "order");
      assert.equal(q.kind, "order");
      const words = q.phrase.split(/\s+/);
      assert.deepEqual(q.chips.slice().sort(), words.slice().sort());
      assert.equal(q.main, q.meaning);
    }
  }
});

test("true/false questions quote the phrase and use another meaning when false", () => {
  const qz = genQuiz(ITEMS, ITEMS, 20, ["tf"], seeded(11));
  for (const q of qz) {
    assert.deepEqual(q.options, ["True", "False"]);
    assert.ok(q.main.startsWith("“" + q.phrase + "” means “"));
    if (q.answer === "True") assert.ok(q.main.includes(q.meaning));
    else assert.ok(!q.main.includes("“" + q.meaning + "”"));
  }
});

test("empty pool yields no questions", () => {
  assert.deepEqual(genQuiz([], ITEMS, 10, QUIZ_TYPE_KEYS), []);
});
