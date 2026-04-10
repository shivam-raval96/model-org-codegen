"""
Plot pass/fail rates per persona from evaluated generation files.

Discovers all <dataset>*.json files under data/generations/<model>/neutral/, groups them
by persona, averages across runs (if multiple exist), and draws a grouped bar
chart with error bars.

Bars shown per persona:
  - Pass       (tests_passed == True)
  - Fail/Error (tests_passed == False  OR  exec_success == False)

Records where tests_passed is None (no tests or not yet evaluated) are excluded
from the rate calculation but a warning is printed.

Output: results/<model>/<dataset>/performance_by_persona.png

Usage:
  python scripts/plot_persona_performance.py --model meta-llama__Llama-3.2-1B-Instruct --dataset humaneval
  python scripts/plot_persona_performance.py --model ... --dataset ... --generations-dir /custom/path
  python scripts/plot_persona_performance.py --model ... --dataset ... --output-dir /custom/results
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).parent.parent


# ---------------------------------------------------------------------------
# File discovery and parsing
# ---------------------------------------------------------------------------

def parse_dataset_tag(stem: str, base_dataset: str) -> tuple[str | None, int | None]:
    """
    Extract (persona, run) from a dataset tag stem.

    Examples (base_dataset="humaneval"):
      humaneval                    → (None,           None)
      humaneval__senior_swe        → ("senior_swe",   None)
      humaneval_run_2              → (None,           2)
      humaneval__senior_swe_run_2  → ("senior_swe",   2)
    """
    if not stem.startswith(base_dataset):
        return None, None

    rest = stem[len(base_dataset):]  # "", "__senior_swe", "_run_2", "__senior_swe_run_2"

    run_match = re.search(r"_run_(\d+)$", rest)
    run = int(run_match.group(1)) if run_match else None
    if run_match:
        rest = rest[: run_match.start()]

    persona = rest[2:] if rest.startswith("__") else None
    return persona, run


def discover_files(gen_dir: Path, base_dataset: str) -> dict[str | None, list[Path]]:
    """
    Return {persona: [path, ...]} mapping, grouped across runs.
    persona is None for the default (no persona) runs.

    Valid stems:
      humaneval
      humaneval__senior_swe
      humaneval_run_2
      humaneval__senior_swe_run_2
    """
    groups: dict[str | None, list[Path]] = defaultdict(list)
    for path in sorted(gen_dir.glob("*.json")):
        stem = path.stem
        if not stem.startswith(base_dataset):
            continue
        rest = stem[len(base_dataset):]
        # rest must be empty, a persona suffix, a run suffix, or both
        if rest and not rest.startswith("__") and not re.match(r"^_run_\d+", rest):
            continue
        persona, _ = parse_dataset_tag(stem, base_dataset)
        groups[persona].append(path)
    return dict(groups)


# ---------------------------------------------------------------------------
# Stats computation
# ---------------------------------------------------------------------------

def compute_token_counts(path: Path) -> tuple[float, float, int]:
    """
    Return (mean_chars, std_chars, n) for raw_output character counts in a generation file.
    """
    records = json.loads(path.read_text())
    counts = [
        len(r["raw_output"])
        for r in records
        if r.get("raw_output") is not None
    ]
    if not counts:
        return float("nan"), float("nan"), 0
    arr = np.array(counts)
    return float(arr.mean()), float(arr.std(ddof=1)) if len(arr) > 1 else 0.0, len(arr)


def persona_token_stats(files: list[Path]) -> dict:
    """
    Aggregate mean token counts across multiple run files for one persona.
    Returns the grand mean and pooled std across runs.
    """
    run_stats = [compute_token_counts(f) for f in files]
    valid = [(m, s, n) for m, s, n in run_stats if not np.isnan(m)]
    if not valid:
        return {"mean": np.nan, "std": np.nan, "n_runs": 0, "n_problems": 0}

    means = np.array([m for m, s, n in valid])
    stds  = np.array([s for m, s, n in valid])
    ns    = np.array([n for m, s, n in valid])

    grand_mean = float(np.average(means, weights=ns))
    # Pooled std across runs
    grand_std  = float(np.sqrt(np.average(stds ** 2 + (means - grand_mean) ** 2, weights=ns)))

    return {
        "mean":       grand_mean,
        "std":        grand_std if len(valid) > 1 else None,
        "n_runs":     len(valid),
        "n_problems": int(ns.mean()),
    }


def compute_rates(path: Path) -> tuple[float, float, int]:
    """
    Return (pass_rate, fail_rate, n_evaluated) for a single generation file.
    Records with tests_passed=None are excluded.
    """
    records = json.loads(path.read_text())
    evaluated = [
        r for r in records
        if r.get("exec_success") is not None  # has been run through evaluate_generations
    ]
    with_tests = [
        r for r in evaluated
        if r.get("tests_passed") is not None
    ]

    if not with_tests:
        return float("nan"), float("nan"), 0

    n = len(with_tests)
    n_pass = sum(1 for r in with_tests if r.get("tests_passed") is True)
    n_fail = n - n_pass
    return n_pass / n * 100, n_fail / n * 100, n


def persona_stats(files: list[Path]) -> dict:
    """
    Aggregate pass/fail rates across multiple run files for one persona.
    Returns mean, std (nan if only one run).
    """
    rates = [compute_rates(f) for f in files]
    valid = [(p, f, n) for p, f, n in rates if not np.isnan(p)]

    if not valid:
        return {"pass_mean": np.nan, "pass_std": np.nan,
                "fail_mean": np.nan, "fail_std": np.nan,
                "n_runs": 0, "n_problems": 0}

    passes = [p for p, f, n in valid]
    fails  = [f for p, f, n in valid]
    ns     = [n for p, f, n in valid]

    return {
        "pass_mean": float(np.mean(passes)),
        "pass_std":  float(np.std(passes, ddof=1)) if len(passes) > 1 else None,
        "fail_mean": float(np.mean(fails)),
        "fail_std":  float(np.std(fails,  ddof=1)) if len(fails)  > 1 else None,
        "n_runs":    len(valid),
        "n_problems": int(np.mean(ns)),
    }


# ---------------------------------------------------------------------------
# Persona ordering
# ---------------------------------------------------------------------------

_SKILL_ORDER = [
    "complete_beginner",
    "intro_cs_student",
    "cs_undergrad_2nd_year",
    "junior_swe",
    "cs_undergrad_senior",
    "cs_grad_student",
    "mid_swe",
    "senior_swe",
    "competitive_programmer",
]


def sort_personas(personas: list[str | None]) -> list[str | None]:
    """Sort by skill level; default (None) first."""
    def key(p):
        if p is None:
            return -1
        try:
            return _SKILL_ORDER.index(p)
        except ValueError:
            return 999
    return sorted(personas, key=key)


# ---------------------------------------------------------------------------
# Plotting
# ---------------------------------------------------------------------------

def _bar_subplot(ax, labels, means, stds, n_runs, color, title):
    x = np.arange(len(labels))

    # Build per-bar yerr: only where we have multiple runs (std is not None)
    yerr = [s if s is not None else 0.0 for s in stds]
    has_errorbars = any(s is not None for s in stds)

    bars = ax.bar(
        x, means,
        yerr=yerr if has_errorbars else None,
        capsize=5,
        error_kw={"elinewidth": 1.5, "ecolor": "black", "alpha": 0.7},
        color=color, alpha=0.85, width=0.55,
    )

    for i, (bar, nr, std) in enumerate(zip(bars, n_runs, stds)):
        top = bar.get_height() + (std if std is not None else 0) + 1.5
        label = f"n={nr}" if nr > 1 else ""
        if label:
            ax.text(bar.get_x() + bar.get_width() / 2, top,
                    label, ha="center", va="bottom", fontsize=7, color="gray")

    ax.set_title(title)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=30, ha="right", fontsize=9)
    ax.set_ylabel("Rate (%)")
    ax.set_ylim(0, 115)
    ax.yaxis.grid(True, linestyle="--", alpha=0.5)
    ax.set_axisbelow(True)


def plot(stats: dict[str | None, dict], model: str, dataset: str, out_path: Path) -> None:
    personas = sort_personas(list(stats.keys()))
    labels   = ["default" if p is None else p.replace("_", " ") for p in personas]

    pass_means = [stats[p]["pass_mean"] for p in personas]
    pass_stds  = [stats[p]["pass_std"]  for p in personas]
    fail_means = [stats[p]["fail_mean"] for p in personas]
    fail_stds  = [stats[p]["fail_std"]  for p in personas]
    n_runs     = [stats[p]["n_runs"]    for p in personas]

    fig, (ax_pass, ax_fail) = plt.subplots(
        1, 2,
        figsize=(max(12, len(labels) * 2), 5),
        sharey=True,
    )

    _bar_subplot(ax_pass, labels, pass_means, pass_stds, n_runs,
                 color="#4caf50", title="Pass rate (%)")
    _bar_subplot(ax_fail, labels, fail_means, fail_stds, n_runs,
                 color="#f44336", title="Fail / Error rate (%)")

    fig.suptitle(f"{model}  ·  {dataset}", fontsize=11)
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=150)
    print(f"Saved → {out_path}")
    plt.close(fig)


def plot_token_counts(
    token_stats: dict[str | None, dict],
    model: str,
    dataset: str,
    out_path: Path,
) -> None:
    """Bar chart of mean output token count per persona with std error bars."""
    personas = sort_personas(list(token_stats.keys()))
    labels   = ["default" if p is None else p.replace("_", " ") for p in personas]

    means  = [token_stats[p]["mean"]      for p in personas]
    stds   = [token_stats[p]["std"]       for p in personas]
    n_runs = [token_stats[p]["n_runs"]    for p in personas]

    x    = np.arange(len(labels))
    yerr = [s if s is not None else 0.0 for s in stds]
    has_errorbars = any(s is not None for s in stds)

    fig, ax = plt.subplots(figsize=(max(8, len(labels) * 1.5), 5))

    bars = ax.bar(
        x, means,
        yerr=yerr if has_errorbars else None,
        capsize=5,
        error_kw={"elinewidth": 1.5, "ecolor": "black", "alpha": 0.7},
        color="#1976d2", alpha=0.85, width=0.55,
    )

    # Annotate multi-run bars with run count
    for bar, nr, std in zip(bars, n_runs, stds):
        if nr > 1:
            top = bar.get_height() + (std if std is not None else 0) + 2
            ax.text(
                bar.get_x() + bar.get_width() / 2, top,
                f"n={nr}", ha="center", va="bottom", fontsize=7, color="gray",
            )

    ax.set_title(f"Avg output characters by persona\n{model}  ·  {dataset}", fontsize=11)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=30, ha="right", fontsize=9)
    ax.set_ylabel("Characters")
    ax.yaxis.grid(True, linestyle="--", alpha=0.5)
    ax.set_axisbelow(True)

    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=150)
    print(f"Saved → {out_path}")
    plt.close(fig)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Bar plot of pass/fail rates per persona")
    p.add_argument("--model",   required=True,
                   help="Model tag (e.g. meta-llama__Llama-3.2-1B-Instruct)")
    p.add_argument("--dataset", required=True,
                   help="Dataset name (e.g. humaneval)")
    p.add_argument("--generations-dir", default=None, metavar="PATH",
                   help="Root generations directory (default: data/generations/)")
    p.add_argument("--output-dir", default=None, metavar="PATH",
                   help="Root results directory (default: results/)")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    gen_root = Path(args.generations_dir) if args.generations_dir else ROOT / "data" / "generations"
    res_root = Path(args.output_dir)      if args.output_dir      else ROOT / "results"

    gen_dir = gen_root / args.model / "neutral"
    if not gen_dir.exists():
        sys.exit(f"No generations found for model: {gen_dir}")

    groups = discover_files(gen_dir, args.dataset)
    if not groups:
        sys.exit(f"No files matching dataset '{args.dataset}' in {gen_dir}")

    perf_stats:  dict[str | None, dict] = {}
    token_stats: dict[str | None, dict] = {}
    for persona, files in groups.items():
        label = "default" if persona is None else persona

        s = persona_stats(files)
        if s["n_runs"] == 0:
            print(f"  WARNING: no evaluated records for persona '{label}' — skipping")
        else:
            run_str = f"{s['n_runs']} run(s)" if s["n_runs"] > 1 else "1 run"
            pass_std_str = f"{s['pass_std']:.1f}" if s['pass_std'] is not None else "—"
            fail_std_str = f"{s['fail_std']:.1f}" if s['fail_std'] is not None else "—"
            print(f"  {label:<35} pass={s['pass_mean']:.1f}% ± {pass_std_str}  "
                  f"fail={s['fail_mean']:.1f}% ± {fail_std_str}  ({run_str})")
            perf_stats[persona] = s

        t = persona_token_stats(files)
        if t["n_runs"] > 0:
            token_stats[persona] = t

    if not perf_stats:
        sys.exit("No evaluated data found. Run evaluate_generations.py first.")

    out_dir = res_root / args.model / args.dataset
    plot(perf_stats, args.model, args.dataset, out_dir / "performance_by_persona.png")

    if token_stats:
        plot_token_counts(token_stats, args.model, args.dataset,
                          out_dir / "char_counts_by_persona.png")


if __name__ == "__main__":
    main()
