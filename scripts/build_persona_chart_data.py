"""
Build a compact JSON data file for the persona bar chart on the project page.

Reads all neutral HumanEval generation files, averages across runs,
and outputs web/src/data/personaChartData.json.

Usage:
  python scripts/build_persona_chart_data.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from collections import defaultdict

import numpy as np

ROOT     = Path(__file__).parent.parent
DATA_DIR = ROOT / "data" / "generations"
OUT_PATH = ROOT / "web" / "src" / "data" / "personaChartData.json"

# ── Models to include, in display order ──────────────────────────────────────
MODELS = [
    {"id": "meta-llama__Llama-3.2-1B-Instruct", "label": "Llama 3.2 1B"},
    {"id": "Qwen__Qwen2.5-Coder-3B-Instruct",   "label": "Qwen 2.5 3B"},
    {"id": "Qwen__Qwen2.5-Coder-7B-Instruct",   "label": "Qwen 2.5 7B"},
    {"id": "Qwen__Qwen2.5-Coder-14B-Instruct",  "label": "Qwen 2.5 14B"},
]

# ── Personas to include, in skill order ──────────────────────────────────────
PERSONAS = [
    {
        "id":          "default",
        "label":       "Default",
        "description": "Expert software engineer. Write correct, efficient, well-structured code.",
    },
    {
        "id":          "complete_beginner",
        "label":       "Beginner",
        "description": "No prior programming experience; just started learning Python.",
    },
    {
        "id":          "cs_undergrad_2nd_year",
        "label":       "2nd Year CS",
        "description": "Second-year CS undergrad. Knows Python basics, OOP, simple algorithms.",
    },
    {
        "id":          "junior_swe",
        "label":       "Junior SWE",
        "description": "Junior software engineer with 1–2 years of professional Python experience.",
    },
    {
        "id":          "competitive_programmer",
        "label":       "Competitive",
        "description": "Expert competitive programmer with deep algorithms knowledge.",
    },
]

PERSONA_IDS = {p["id"] for p in PERSONAS}


def find_files(model_id: str, persona_id: str) -> list[Path]:
    """
    Return all generation files for a (model, persona) pair.
    Handles both old layout (files at model root) and new layout (neutral/ subdir).
    """
    model_dir = DATA_DIR / model_id

    # Build the file stem prefix for this persona
    stem_prefix = "humaneval" if persona_id == "default" else f"humaneval__{persona_id}"

    # Pattern: stem_prefix.json  OR  stem_prefix_run_N.json
    pattern = re.compile(
        rf"^{re.escape(stem_prefix)}(?:_run_\d+)?\.json$"
    )

    candidates: list[Path] = []

    # Search in neutral/ subdir (new layout)
    neutral_dir = model_dir / "neutral"
    if neutral_dir.exists():
        for f in neutral_dir.glob("*.json"):
            if pattern.match(f.name):
                candidates.append(f)

    # Search directly in model_dir (old Qwen layout)
    if model_dir.exists():
        for f in model_dir.glob("*.json"):
            if pattern.match(f.name):
                candidates.append(f)

    return sorted(set(candidates))


def compute_stats(files: list[Path]) -> dict | None:
    """
    Compute per-run pass rate and char count, then average across runs.
    Returns None if no evaluated data is found.
    """
    run_pass_rates: list[float] = []
    run_char_means: list[float] = []
    n_problems_list: list[int]  = []

    for path in files:
        records = json.loads(path.read_text())
        evaluated = [r for r in records if r.get("exec_success") is not None]
        with_tests = [r for r in evaluated if r.get("tests_passed") is not None]

        if not with_tests:
            continue

        n = len(with_tests)
        n_pass = sum(1 for r in with_tests if r.get("tests_passed") is True)
        run_pass_rates.append(n_pass / n * 100)
        n_problems_list.append(n)

        chars = [len(r["raw_output"]) for r in records if r.get("raw_output")]
        if chars:
            run_char_means.append(float(np.mean(chars)))

    if not run_pass_rates:
        return None

    return {
        "pass_rate":      round(float(np.mean(run_pass_rates)), 2),
        "pass_rate_std":  round(float(np.std(run_pass_rates, ddof=1)), 2) if len(run_pass_rates) > 1 else None,
        "char_count_mean": round(float(np.mean(run_char_means)), 1) if run_char_means else None,
        "char_count_std":  round(float(np.std(run_char_means, ddof=1)), 1) if len(run_char_means) > 1 else None,
        "n_runs":          len(run_pass_rates),
        "n_problems":      int(np.mean(n_problems_list)),
    }


def main() -> None:
    entries = []

    for model in MODELS:
        mid = model["id"]
        for persona in PERSONAS:
            pid = persona["id"]
            files = find_files(mid, pid)
            if not files:
                print(f"  MISSING  {mid}  /  {pid}")
                continue
            stats = compute_stats(files)
            if stats is None:
                print(f"  NO EVAL  {mid}  /  {pid}")
                continue

            entry = {"model": mid, "persona": pid, **stats}
            entries.append(entry)
            std_str = f"± {stats['pass_rate_std']:.1f}" if stats["pass_rate_std"] is not None else ""
            print(f"  {mid:<45}  {pid:<30}  "
                  f"pass={stats['pass_rate']:.1f}% {std_str}  "
                  f"chars={stats['char_count_mean']}  runs={stats['n_runs']}")

    payload = {
        "models":  MODELS,
        "personas": PERSONAS,
        "entries": entries,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2))
    print(f"\nSaved {len(entries)} entries → {OUT_PATH}")


if __name__ == "__main__":
    main()
