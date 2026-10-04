"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { addWrongToReview, saveQuizResult, type QuizResultRow } from "@/lib/actions/practice";
import {
  filterPool,
  genQuiz,
  QUIZ_TYPE_KEYS,
  shuffle,
  SPEED_SECONDS,
  type PoolItem,
  type Question,
  type QuizType,
} from "@/lib/quiz";
import { FlashcardsView } from "./FlashcardsView";
import { QuizView } from "./QuizView";
import { ResultsView } from "./ResultsView";
import { SetupView } from "./SetupView";
import {
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings,
  type AnswerMap,
  type FlashFront,
  type PracticeSettings,
  type QuizResultState,
} from "./shared";

type View = "setup" | "flash" | "quiz" | "result";

interface FlashRun {
  ids: number[];
  run: number;
}
interface QuizRun {
  questions: Question[];
  total: number;
  run: number;
}

export function Practice({
  items,
  history,
  topics,
}: {
  items: PoolItem[];
  history: QuizResultRow[];
  topics: ReadonlyArray<readonly [string, string]>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const [view, setView] = useState<View>("setup");
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);
  const [front, setFront] = useState<FlashFront>("phrase");
  const [flash, setFlash] = useState<FlashRun | null>(null);
  const [quiz, setQuiz] = useState<QuizRun | null>(null);
  const [result, setResult] = useState<QuizResultState | null>(null);

  // Remembered setup (localStorage), read after mount to keep server and client markup identical.
  useEffect(() => {
    const saved = readSettings();
    if (saved) setSettings(saved);
  }, []);

  const update = (patch: Partial<PracticeSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeSettings(next);
  };

  const toggleType = (t: QuizType) => {
    const types = { ...settings.types, [t]: !settings.types[t] };
    if (!QUIZ_TYPE_KEYS.some((k) => types[k])) {
      toast("Keep at least one question type.");
      return;
    }
    update({ types });
  };

  const pool = useMemo(() => filterPool(items, settings.source, settings.topic), [items, settings.source, settings.topic]);
  const enabledTypes = useMemo(() => QUIZ_TYPE_KEYS.filter((k) => settings.types[k]), [settings.types]);

  const startFlash = (ids?: number[]) => {
    const list = ids ?? shuffle(pool).map((i) => i.id);
    if (!list.length) {
      toast("No phrases match these settings.");
      return;
    }
    setFlash((f) => ({ ids: list, run: (f?.run ?? 0) + 1 }));
    setView("flash");
  };

  const startQuiz = (list?: PoolItem[]) => {
    const src = list ?? pool;
    if (items.length < 4) {
      toast("Add at least 4 phrases to your bank to take a test.");
      return;
    }
    if (!src.length) {
      toast("No phrases match these settings.");
      return;
    }
    const questions = genQuiz(src, items, settings.count, enabledTypes);
    const total = questions.length * SPEED_SECONDS[settings.speed];
    setQuiz((q) => ({ questions, total, run: (q?.run ?? 0) + 1 }));
    setView("quiz");
  };

  const onFinish = useCallback(
    (answers: AnswerMap, usedSeconds: number) => {
      if (!quiz) return;
      const qs = quiz.questions;
      const right = qs.filter((_, i) => answers[i]?.correct).length;
      const wrongIds: number[] = [];
      const byType: Partial<Record<QuizType, [number, number]>> = {};
      qs.forEach((q, i) => {
        const ok = !!answers[i]?.correct;
        if (!ok && !wrongIds.includes(q.itemId)) wrongIds.push(q.itemId);
        const bt = byType[q.type] ?? [0, 0];
        bt[1]++;
        if (ok) bt[0]++;
        byType[q.type] = bt;
      });
      setResult({ questions: qs, answers, usedSeconds, right, wrongIds, byType });
      setView("result");
      const speed = settings.speed;
      const types = enabledTypes;
      start(async () => {
        await saveQuizResult({
          right,
          total: qs.length,
          speed,
          usedSeconds,
          types,
          byType,
          wrongPhraseIds: wrongIds,
        });
        router.refresh();
      });
    },
    [quiz, settings.speed, enabledTypes, router],
  );

  const addToReview = () => {
    if (!result || pending) return;
    const ids = result.wrongIds;
    start(async () => {
      const r = await addWrongToReview(ids);
      toast(r.message);
      router.refresh();
    });
  };

  const backToSetup = () => setView("setup");

  return (
    <div className="flex flex-col gap-4">
      {view === "setup" && (
        <SetupView
          settings={settings}
          onChange={update}
          onToggleType={toggleType}
          poolCount={pool.length}
          totalCount={items.length}
          topics={topics}
          history={history}
          onStartFlash={() => startFlash()}
          onStartQuiz={() => startQuiz()}
        />
      )}

      {view === "flash" && flash && (
        <FlashcardsView
          key={flash.run}
          items={items}
          ids={flash.ids}
          front={front}
          onFront={setFront}
          onBack={backToSetup}
          onShuffle={() => startFlash()}
          onRestart={(ids) => startFlash(ids)}
          onQuiz={() => startQuiz()}
        />
      )}

      {view === "quiz" && quiz && (
        <QuizView key={quiz.run} questions={quiz.questions} totalSeconds={quiz.total} onFinish={onFinish} />
      )}

      {view === "result" && result && (
        <ResultsView
          result={result}
          pending={pending}
          onRetry={() => startQuiz(items.filter((i) => result.wrongIds.includes(i.id)))}
          onAddToReview={addToReview}
          onNewTest={() => startQuiz()}
          onSettings={backToSetup}
        />
      )}
    </div>
  );
}
