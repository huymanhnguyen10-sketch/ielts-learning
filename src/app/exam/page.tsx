const EXAM_PLAN: Array<{ skill: string; time: string; detail: string }> = [
  {
    skill: "Listening",
    time: "4 parts · 40 questions · ~30 min",
    detail: "Audio plays once, countdown timer, answer boxes like the real test, auto-marking and band conversion.",
  },
  {
    skill: "Reading",
    time: "3 passages · 40 questions · 60 min",
    detail: "Split screen with the passage on the left and questions on the right; highlight and notes.",
  },
  {
    skill: "Writing",
    time: "Task 1 + Task 2 · 60 min",
    detail: "Editor with word count and autosave; submits when time is up.",
  },
  {
    skill: "Speaking",
    time: "3 parts · 11–14 min",
    detail: "Questions by part, record your answers, Part 2 preparation timer.",
  },
];

/** Mock exam placeholder (SPEC §7, Phase 2). Static content. */
export default function Page() {
  return (
    <section className="card p-7">
      <span
        className="inline-flex rounded-xl px-2.5 py-1 text-xs font-semibold"
        style={{ background: "#FFEBDA", color: "#8A4209" }}
      >
        Phase 2 · needs test sources
      </span>
      <h2 className="m-0 mt-3.5 mb-1.5 font-heading text-2xl">Computer-based IELTS simulation</h2>
      <p className="m-0 mb-5 max-w-[640px] text-[15px] text-muted">
        A full on-screen exam for all four skills, built once you have test material.
      </p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {EXAM_PLAN.map((ex) => (
          <div key={ex.skill} className="rounded-[10px] border border-line p-4">
            <div className="font-heading text-[17px] font-semibold">{ex.skill}</div>
            <div className="mt-0.5 text-[13px] text-muted">{ex.time}</div>
            <div className="mt-2 text-sm leading-relaxed">{ex.detail}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-[10px] bg-primary-soft px-4 py-3.5 text-sm text-primary-text">
        Linked to your phrase bank: highlight a new phrase during the test to save it, tagged with that test as the
        source.
      </div>
    </section>
  );
}
