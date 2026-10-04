export interface NavItem {
  href: string;
  label: string;
  head?: string;
  badgeKey?: "due";
}

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/library", label: "My library" },
  { href: "/review", label: "Review", head: "Vocabulary", badgeKey: "due" },
  { href: "/sentence", label: "Sentence practice" },
  { href: "/practice", label: "Flashcards & tests" },
  { href: "/bank", label: "Phrase bank" },
  { href: "/add", label: "Add phrase" },
  { href: "/reading", label: "Reading", head: "Skills" },
  { href: "/listening", label: "Listening" },
  { href: "/writing", label: "Writing" },
  { href: "/speaking", label: "Speaking" },
  { href: "/tests", label: "Mock tests & scores", head: "Progress" },
  { href: "/exam", label: "Mock exam (coming soon)" },
  { href: "/tutor", label: "AI tutor" },
];

export const TITLES: Record<string, [string, string]> = {
  "/": ["Overview", "Welcome back"],
  "/library": ["Learning sources", "My library"],
  "/review": ["Spaced repetition", "Review"],
  "/sentence": ["Use it actively", "Sentence practice"],
  "/practice": ["Phrase bank practice", "Flashcards & tests"],
  "/bank": ["By topic", "Phrase bank"],
  "/add": ["Collect new phrases", "Add phrase"],
  "/reading": ["Practice", "Reading"],
  "/listening": ["Practice", "Listening"],
  "/writing": ["Practice", "Writing"],
  "/speaking": ["Practice", "Speaking"],
  "/tests": ["Progress", "Mock tests & scores"],
  "/exam": ["Phase 2", "Mock exam"],
  "/tutor": ["Q&A support", "AI tutor"],
};

export const SKILL_OF_PATH: Record<string, string> = {
  "/reading": "Reading",
  "/listening": "Listening",
  "/writing": "Writing",
  "/speaking": "Speaking",
};

/** Tutor starter suggestions by page (SPEC §8). */
export const STARTERS: Record<string, string[]> = {
  "/": ["Make me a study plan to reach my target", "What should I focus on today?", "How are my scores trending?", "Quiz me on my phrases"],
  "/review": ["Quiz me on my phrases", "How do I remember phrases longer?", "Make me a study plan"],
  "/sentence": ["Quiz me on my phrases", "How do I use collocations in Task 2?", "Check my essay"],
  "/practice": ["Quiz me on my phrases", "How do I remember phrases longer?", "Make me a study plan"],
  "/bank": ["Quiz me on my phrases", "Which topics should I learn first?", "Make me a study plan"],
  "/add": ["How do I choose useful phrases?", "Quiz me on my phrases", "Make me a study plan"],
  "/writing": ["Check my essay", "How do I structure a Task 2 essay?", "Make me a study plan"],
  "/reading": ["Explain True vs False vs Not Given", "How do I skim and scan faster?", "Make me a study plan"],
  "/listening": ["Tips for Listening map questions", "How do I stop missing answers?", "Make me a study plan"],
  "/speaking": ["How do I answer this Part 2 cue card?", "How can I improve my fluency?", "Make me a study plan"],
  "/tests": ["How are my scores trending?", "Make me a study plan to reach my target", "What should I focus on today?"],
};
