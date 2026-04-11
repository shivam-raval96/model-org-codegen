# CLAUDE.md — Frontend Codebase Guide

This file documents the `web/` frontend so any edit can be made without needing to read the whole codebase first.

---

## Stack & tooling

| Tool | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5.6 | Type checking |
| Vite | 5 | Dev server & bundler |
| D3 | 7 | SVG charts |
| React Router DOM | 7 | Client-side routing |
| gh-pages | 6 | GitHub Pages deploy |

**Node requirement:** system Node is v12 (too old). Always activate v20 first:
```bash
source ~/.nvm/nvm.sh && nvm use 20
```

**Dev server:**
```bash
cd web && npm run dev        # localhost:5173
```

**Build + deploy:**
```bash
cd web && npm run build      # type-checks then bundles to dist/
cd web && npm run deploy     # runs predeploy (build) then gh-pages -d dist
```

## Default workflow after any frontend change

After **every** change under `web/` — whether it's a content edit, component tweak, style change, or new data file — complete the following steps without waiting to be asked:

1. Commit the changed files on `main` with a descriptive message (scoped to just the files you touched; do not sweep in unrelated working-tree changes).
2. `git push origin main` to publish the source commit.
3. `cd web && npm run deploy` to rebuild and push the bundled site to the `gh-pages` branch.

Both `git push` and `npm run deploy` are expected and pre-authorized for frontend changes — you do not need to ask before running them. Only skip the deploy step if the user has explicitly said the change is work-in-progress or should not go live yet.

Remember to `source ~/.nvm/nvm.sh && nvm use 20` before any `npm` command, since the system Node is too old.

The site is deployed to GitHub Pages under the path `/model-org-codegen/`. This base path is set in `vite.config.ts`:
```ts
export default defineConfig({ base: "/model-org-codegen/", plugins: [react()] });
```

Routing uses `HashRouter` (not `BrowserRouter`) so no server-side config is needed for deep links on GitHub Pages.

---

## File tree

```
web/
├── vite.config.ts                  # base path, react plugin
├── package.json                    # scripts: dev, build, predeploy, deploy
├── tsconfig.json                   # TypeScript config
├── index.html                      # single HTML entry point (#root div)
└── src/
    ├── main.tsx                    # ReactDOM.createRoot → <App />
    ├── index.css                   # all global CSS (variables, layout, charts)
    ├── vite-env.d.ts               # Vite type shims
    ├── App.tsx                     # router setup, top-level layout
    ├── components/
    │   ├── SiteHeader.tsx          # top nav bar (Project / Research log tabs)
    │   ├── TableOfContents.tsx     # sticky ToC with scroll-spy
    │   ├── SidenotePair.tsx        # main text + right margin note
    │   ├── BarChart.tsx            # generic D3 bar chart
    │   ├── PersonaBarChart.tsx     # grouped bar chart: persona × model
    │   └── SteeringLineChart.tsx   # line chart: steering α × score, with conversations
    ├── pages/
    │   ├── ProjectPage.tsx         # "/" — main research paper page
    │   └── researchLog/
    │       ├── ResearchLogLayout.tsx   # hero + <Outlet />
    │       ├── ResearchLogIndex.tsx    # list of week cards
    │       └── ResearchLogWeekPage.tsx # single week detail + prev/next nav
    └── data/
        ├── researchLogWeeks.ts         # week entries (slug, title, bullets[])
        ├── personaChartData.json       # persona bar chart data (generated)
        └── steeringData.json           # steering line chart data (generated)
```

---

## Routing

```
/                       → ProjectPage
/research-log           → ResearchLogLayout > ResearchLogIndex
/research-log/:weekId   → ResearchLogLayout > ResearchLogWeekPage
```

All routes are hash-based (`/#/`, `/#/research-log`, etc.). `NavLink` from React Router handles active-state styling automatically via the `is-active` class.

---

## CSS architecture

**Single file:** `src/index.css` contains all styles — no CSS modules, no Tailwind.

**CSS custom properties** (defined on `:root`):

| Variable | Value | Use |
|---|---|---|
| `--bg` | `#faf9f7` | page background |
| `--surface` | `#ffffff` | cards, header |
| `--text` | `#1a1a1a` | body text |
| `--muted` | `#5c5c5c` | secondary text, labels |
| `--accent` | `#2c5282` | links, active states, primary chart colour |
| `--accent-hover` | `#1a365d` | link hover |
| `--border` | `#e2e0dc` | dividers, card borders |
| `--sidenote-muted` | `#7a7a7a` | margin note text |
| `--font-serif` | Merriweather / Georgia | body text |
| `--font-sans` | Source Sans 3 / system-ui | UI chrome, labels, captions |

**Responsive breakpoints:**
- `< 1024px`: ToC collapses to a sticky horizontal scroll strip at the top; `.doc-layout` is single-column.
- `≥ 1024px`: `.doc-layout` becomes a two-column grid (`15.5rem ToC | article body`).
- `≥ 900px`: `.sidenote-pair` becomes two columns (`1fr | 11.5rem aside`).

**Key layout classes:**

| Class | Description |
|---|---|
| `.hero` | Centred title block at top of each page |
| `.lead` | Centred intro paragraph below hero |
| `.doc-layout` | Outer grid (ToC + body); max-width 1280px |
| `.doc-body` | Right column, contains all sections + footer |
| `.content-shell` | Wrapper inside doc-body above the footer |
| `.section-block` | Each `<article>` section; sets `scroll-margin-top` |
| `.sidenote-pair` | Two-col grid: main prose + aside note |
| `.section-main` | Left cell of sidenote-pair |
| `.sidenote` | Right cell; dims until hovered (CSS `:has`) |
| `.toc` | ToC nav; sticky on desktop, horizontal strip on mobile |
| `.chart-figure` | `<figure>` wrapper for bar/line charts |
| `.chart-caption` | `<figcaption>` title above chart |
| `.chart-svg` | `display:block; width:100%; height:auto` |
| `.chart-axis` / `.chart-axis-text` | D3 axis labels (sans-serif, 11px) |
| `.chart-tooltip` | Absolutely-positioned dark tooltip |
| `.bibtex-block` | Monospace `<pre>` for citation blocks |
| `.site-footer` | References section at bottom |
| `.research-log-shell` | Centred narrow shell for log pages |

---

## Components

### `SiteHeader`
Top navigation bar. Two `NavLink` tabs: "Project" (`/`) and "Research log" (`/research-log`). Active tab gets class `is-active` via React Router's `NavLink` callback. The research log tab includes an inline SVG book icon.

No props.

---

### `TableOfContents`
Sticky scroll-spy ToC. Accepts `items: TocItem[]` where each item is `{ id: string; label: string }`. The `id` must match an HTML element's `id` on the page.

Uses a scroll + resize listener with `requestAnimationFrame` debouncing to update the active section. On desktop it stays `position: sticky; top: 1rem`. On mobile it becomes a horizontal-scrolling pill strip.

To add a new section to the ToC, add an entry to `TOC_ITEMS` in `ProjectPage.tsx` and give your `<article>` the matching `id`.

---

### `SidenotePair` / `SidenoteRef`
Academic-style margin notes. `SidenotePair` renders a two-column grid: left is `children` (main prose), right is the `aside` prop. Hovering anywhere in the pair highlights the aside via CSS `:has`.

`SidenoteRef` renders the inline superscript anchor (`¹`, `²`, …) that links to the aside's `id`.

Usage pattern:
```tsx
<SidenotePair noteId="sn-foo-1" noteNumber={1} aside={<>Margin text</>}>
  <p>Body text <SidenoteRef noteId="sn-foo-1" n={1} /> more text.</p>
</SidenotePair>
```

Note numbers are manually assigned — just increment from the last used.

---

### `BarChart`
Generic single-series D3 bar chart inside a `<figure>`. Fully responsive via `ResizeObserver`.

Props:
```ts
title: string       // shown as <figcaption>
data: BarDatum[]    // { label, value, detail }
color?: string      // default "#2c5282"
height?: number     // default 420px
```

Tooltip shows `"${label}: ${value} — ${detail}"` on hover.

Animation: bars grow from bottom on mount (700ms cubic ease).

---

### `PersonaBarChart`
Grouped bar chart comparing 4 models across 5 solver personas on HumanEval. Reads from `src/data/personaChartData.json`.

**Metric toggle:** right-side panel with two buttons — "Pass Rate" (%) and "Output Length" (avg chars). Switching re-renders the chart with a 600ms animated transition.

**Hover tooltip:** shows model name, persona label + description, pass rate ± std, avg output length ± std, problem count, and run count.

**Data shape** (`personaChartData.json`):
```ts
{
  models:   { id: string; label: string }[]
  personas: { id: string; label: string; description: string; skill_level: number|null }[]
  entries:  {
    model: string; persona: string;
    pass_rate: number; pass_rate_std: number|null;
    char_count_mean: number|null; char_count_std: number|null;
    n_runs: number; n_problems: number;
  }[]
}
```

**Regenerate data:**
```bash
/path/to/python scripts/build_persona_chart_data.py
```

**Chart constants** (edit in component):
- `HEIGHT = 480` — total SVG height in px
- `MARGIN = { top: 24, right: 16, bottom: 64, left: 52 }`
- `MODEL_COLORS` — array of 4 hex colours in model order

---

### `SteeringLineChart`
Line chart showing how LLM judge scores change as an activation steering vector is scaled from α = −3 to α = +3. Reads from `src/data/steeringData.json`.

**Behavior tabs:** right-side panel, one button per behavior (10 total). Clicking switches the active series.

**Chart:** two lines (one per model) with a shaded ±1 std band. A vertical dashed line marks α = 0 (baseline). Points are draggable; hovering a dot shows a tooltip with score and pass rate, and updates the conversation panel.

**Conversation panel:** three cards below the chart showing real model outputs for 3 representative problems. The same 3 problems are tracked across all α values — hover different points to see how steering changes the output. Each card shows:
- Problem ID and pass/fail + score badges
- Collapsible prompt
- Scrollable model output (expand/collapse button if long)
- Collapsible judge reasoning

**Data shape** (`steeringData.json`):
```ts
{
  models:    { id: string; label: string; steered_dir: string }[]
  behaviors: { id: string; label: string; description: string }[]
  series: {
    model: string; behavior: string; method: string;
    points: { alpha: number; score_mean: number; score_std: number;
              pass_rate: number|null; n: number }[]
  }[]
  examples: {
    // key = "${model_id}|${behavior_id}"
    [key: string]: {
      problem_id: string; task_id: string; prompt: string;
      by_alpha: {
        // key = alpha as string e.g. "-1", "0", "2"
        [alpha: string]: { output: string; score: number|null;
                           reasoning: string; tests_passed: boolean|null }
      }
    }[]
  }
}
```

**Regenerate data:**
```bash
/path/to/python scripts/build_steering_chart_data.py
```

**Chart constants** (edit in component):
- `CHART_H = 460` — total SVG height in px
- `MARGIN = { top: 28, right: 24, bottom: 48, left: 52 }`
- `MODEL_COLORS` — object mapping model id → hex colour

---

## Pages

### `ProjectPage` (`/`)
Academic paper layout. Structure:
1. `.hero` — title, author, institution
2. `.lead` — one-paragraph teaser
3. `.doc-layout` — two-column grid wrapping `TableOfContents` and the article body
4. Article sections (each an `<article class="section-block" id="…">`):
   - `#abstract`
   - `#motivation` — includes `BarChart` (benchmark scores)
   - `#plan` — includes `BarChart` (organism utility)
   - `#expected-results` — includes `PersonaBarChart`
   - `#steering-results` — includes `SteeringLineChart`
   - `#bibtex`
5. `<footer id="references">` — reference list

**To add a new section:** add an `<article>` with a new `id`, then add a matching entry to `TOC_ITEMS`.

**Sidenote numbering:** currently 1–5. Each new `SidenotePair`/`SidenoteRef` pair needs a unique sequential `noteNumber` / `n`.

---

### Research Log pages (`/research-log`)

**Data source:** `src/data/researchLogWeeks.ts` — a static array of `ResearchWeek` objects:
```ts
{ slug: string; title: string; bullets: string[] }
```

`slug` is a date string (`"2026-04-07"`) used as the URL segment and lookup key. Weeks are ordered newest-first in the array; `getWeekNeighbors` treats earlier array indices as "next" and later as "prev".

**To add a week:** prepend a new entry to `RESEARCH_WEEKS` in `researchLogWeeks.ts`. Navigation links are auto-generated from array position.

**`ResearchLogLayout`:** renders the hero and a `<Outlet />` — shared across index and week pages.

**`ResearchLogIndex`:** lists all weeks as clickable cards showing title + first bullet.

**`ResearchLogWeekPage`:** renders the chosen week's title and all bullets as a `<ul>`. Unknown slugs redirect to `/research-log`.

---

## Data files

Both JSON files are imported directly as ES modules (Vite handles this). They are bundled into the JS chunk at build time — no runtime fetching.

| File | Size (raw / gzipped) | Generated by |
|---|---|---|
| `personaChartData.json` | ~12 KB / ~3 KB | `scripts/build_persona_chart_data.py` |
| `steeringData.json` | ~422 KB / ~80 KB | `scripts/build_steering_chart_data.py` |

`steeringData.json` is the dominant contributor to bundle size (~153 KB gzipped total). If it grows, consider switching to a dynamic `import()` or a fetch from `/public/`.

---

## D3 patterns used across charts

All three chart components follow the same pattern:

1. **`useLayoutEffect` + `ResizeObserver`** to measure the wrapper `div` width and store it in state.
2. **`useEffect`** depending on `[width, ...]` to imperatively build the SVG. The effect starts with `svg.innerHTML = ""` to wipe and redraw from scratch.
3. **React state for tooltips** — D3 `mouseenter`/`mousemove`/`mouseleave` handlers call `setTooltip(...)` which triggers React to render an absolutely-positioned `div.chart-tooltip` inside the wrapper.
4. SVG `width` is set from measured `width`; `height` is a constant (`HEIGHT` / `CHART_H`).

When adding a new chart: follow this pattern rather than setting a fixed SVG width, so the chart is responsive.

---

## Adding a new chart section (recipe)

1. Create `src/components/MyChart.tsx` — copy the D3 pattern from `BarChart.tsx` or `SteeringLineChart.tsx`.
2. If it needs data from Python: write `scripts/build_my_chart_data.py`, run it to produce `src/data/myChartData.json`, import it in the component.
3. In `ProjectPage.tsx`:
   - Import the component.
   - Add a `TocItem` entry to `TOC_ITEMS`.
   - Add a new `<article className="section-block" id="my-section">` with a `<SidenotePair>` and the component.
   - Increment sidenote numbers.
4. `npm run build` to type-check, then `npm run deploy`.

---

## Common gotchas

- **Node version:** always run `source ~/.nvm/nvm.sh && nvm use 20` before `npm` commands. The system Node (v12) is too old for the TypeScript compiler.
- **SVG wipe:** every chart effect starts with `svg.innerHTML = ""`. This is intentional — D3 re-draws from scratch rather than doing incremental joins on re-renders driven by React state changes.
- **`useLayoutEffect` vs `useEffect`:** width measurement uses `useLayoutEffect` (runs synchronously after DOM paint) to avoid a flash of zero-width charts. The D3 draw uses `useEffect` (runs after paint) since it's purely visual.
- **CSS `:has` selector:** used in `index.css` to highlight the sidenote when the user hovers the in-text superscript. This is a modern CSS feature; avoid polyfilling it.
- **Hash router:** all links inside the app must use React Router's `Link`/`NavLink`, not plain `<a href>`. Internal anchor links (e.g. `href="#abstract"`) still work because the hash is appended to the existing hash route.
- **Vite JSON import:** JSON files in `src/data/` are imported as ES modules (`import data from "../data/foo.json"`). TypeScript infers the type automatically. No `fetch` or `useEffect` needed.
- **Sidenote IDs:** must be globally unique across the page. Convention is `sn-<section>-<number>` (e.g. `sn-steering-1`).
