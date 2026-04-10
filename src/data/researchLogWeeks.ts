export type ResearchWeek = {
  slug: string;
  title: string;
  bullets: string[];
};

export const RESEARCH_WEEKS: ResearchWeek[] = [
  {
    slug: "2026-04-07",
    title: "Week of April 7, 2026",
    bullets: [
      "Sketched criteria for “model organism” codebases: small surface area, deterministic tests, versioned snapshots.",
      "Read prior work on program synthesis benchmarks; noted gap between single-file tasks and repo-level edits.",
      "Rough prototype: one synthetic Python package with mocked I/O for repeatable eval loops (not yet public).",
    ],
  },
  {
    slug: "2026-03-31",
    title: "Week of March 31, 2026",
    bullets: [
      "Compared HumanEval-style tasks vs. multi-file stubs; listed failure modes (import graph, config drift).",
      "Drafted IRB-style checklist for releasing synthetic corpora (even if everything stays internal for now).",
      "No experiments run—mostly note-taking and repo cleanup.",
    ],
  },
  {
    slug: "2026-03-24",
    title: "Week of March 24, 2026",
    bullets: [
      "Set up this project site and charts as placeholders for future real metrics.",
      "Lorem ipsum: blocked on choosing a primary language for the first organism (Python vs. TypeScript).",
      "Next: pick one minimal repo shape and freeze a v0.1 spec.",
    ],
  },
];

export function getResearchWeek(
  slug: string | undefined
): ResearchWeek | undefined {
  if (!slug) return undefined;
  return RESEARCH_WEEKS.find((w) => w.slug === slug);
}

export function getWeekNeighbors(slug: string): {
  prev: ResearchWeek | null;
  next: ResearchWeek | null;
} {
  const i = RESEARCH_WEEKS.findIndex((w) => w.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? RESEARCH_WEEKS[i - 1]! : null,
    next: i < RESEARCH_WEEKS.length - 1 ? RESEARCH_WEEKS[i + 1]! : null,
  };
}
