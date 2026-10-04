export const TOPICS: ReadonlyArray<readonly [string, string]> = [
  ["education", "Education"],
  ["environment", "Environment"],
  ["technology", "Technology"],
  ["health", "Health"],
  ["work", "Work & jobs"],
  ["society", "Society"],
  ["government", "Government"],
  ["crime", "Crime"],
  ["travel", "Travel"],
  ["trends", "Task 1 trends"],
  ["daily", "Daily life"],
  ["science", "Science & nature"],
  ["culture", "History & culture"],
];

export function topicName(key: string): string {
  const t = TOPICS.find((x) => x[0] === key);
  return t ? t[1] : key;
}

export const SOURCES = ["Writing", "Reading", "Listening", "Speaking"] as const;
export type Source = (typeof SOURCES)[number];

export const KINDS = ["academic", "everyday"] as const;
export type Kind = (typeof KINDS)[number];

export const SKILLS = [
  "Reading",
  "Listening",
  "Writing",
  "Speaking",
  "Vocabulary",
  "Grammar",
  "General",
] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_COLOR: Record<string, string> = {
  Listening: "#0EA5B7",
  Reading: "#2563EB",
  Writing: "#F0623A",
  Speaking: "#A855F7",
};
