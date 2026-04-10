# Model organisms for code generation

Academic-style project site for **Model Organisms for Code Generation**, built with **React**, **Vite**, **TypeScript**, **D3**, and **React Router**. It includes an interactive project page (TOC, margin notes linked to superscripts, bar charts with hover tooltips) and a **research log** with nested weekly routes.

**Live site:** [shivam-raval96.github.io/model-org-codegen](https://shivam-raval96.github.io/model-org-codegen/)

## Requirements

- Node.js 20+ (see Vite / tooling notes if you hit engine warnings)

## Setup

```bash
npm install
```

## Scripts

| Command        | Description                          |
|----------------|--------------------------------------|
| `npm run dev`    | Local dev server (with `/model-org-codegen/` base path) |
| `npm run build`  | Typecheck and production build to `dist/` |
| `npm run preview`| Serve the production build locally     |
| `npm run deploy` | Build, then publish `dist/` to the `gh-pages` branch |

After `npm run dev`, open the URL Vite prints (typically under `http://localhost:5173/model-org-codegen/`).

## Deploy to GitHub Pages

The app uses `base: "/model-org-codegen/"` in Vite so asset URLs work as a project site.

1. In the repo on GitHub: **Settings → Pages**, source **Deploy from a branch**, branch **`gh-pages`**, folder **`/ (root)`**.
2. From your machine:

   ```bash
   npm run deploy
   ```

Routing uses **`HashRouter`**, so week URLs look like `.../model-org-codegen/#/research-log/2026-04-07` (no extra `404.html` setup).

## Project layout

```
src/
  App.tsx                 # Routes (project + research log tree)
  components/
    BarChart.tsx          # D3 bar charts + hover tooltips
    SiteHeader.tsx        # Project / Research log nav
    TableOfContents.tsx   # Scroll-spy TOC (project page)
    SidenotePair.tsx      # Margin notes + in-text superscript refs
  data/
    researchLogWeeks.ts   # Weekly log entries (slug, title, bullets)
  pages/
    ProjectPage.tsx       # Main project content
    researchLog/
      ResearchLogLayout.tsx
      ResearchLogIndex.tsx
      ResearchLogWeekPage.tsx
```

## Editing content

- **Project copy, charts, BibTeX:** `src/pages/ProjectPage.tsx`
- **Research log weeks:** `src/data/researchLogWeeks.ts` — add objects with a unique `slug` (used in the URL), `title`, and `bullets`

## Credits

Layout inspired by the [Academic Project Page Template](https://eliahuhorwitz.github.io/Academic-project-page-template/).
