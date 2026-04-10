"""
Plot average judge score vs steering strength (alpha) for steered generations.

One subplot per behavior (concept). Within each subplot, one line per extraction
method.  Error bars show ±1 std across problems × generations.

Data layout:
  data/generations/{model_tag}_steered/{behavior}/{method}/
    test_NNN.json   — test-mode files (all aggregated)
    {dataset}.json  — full-mode file

Each JSON is a list of problem records:
  {
    "problem_id": "...",
    "behavior":   "sandbagging",
    "method":     "last_token",
    "generations": {
      "2":   [{"judge": {"sandbagging": {"score": 80}}, ...}],
      "-5":  [...],
      ...
    }
  }

Scores of -1 (judge failure) are excluded from averages.

Usage:
  python scripts/plot_steered_results.py \\
      --model meta-llama/Llama-3.2-1B-Instruct --dataset humaneval

  python scripts/plot_steered_results.py \\
      --model ... --dataset ... --methods last_token,mean_pooled \\
      --behaviors sandbagging,reward_hacking

  python scripts/plot_steered_results.py \\
      --model ... --dataset ... --output-dir /custom/results

Output:
  results/{model_tag}/{dataset}/steered_judge_scores.png
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

ROOT     = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
RES_DIR  = ROOT / "results"

ALL_METHODS = ("last_token", "mean_pooled", "attn_weighted")

METHOD_STYLES: dict[str, dict] = {
    "last_token":    {"color": "#1976d2", "linestyle": "-",  "marker": "o"},
    "mean_pooled":   {"color": "#388e3c", "linestyle": "--", "marker": "s"},
    "attn_weighted": {"color": "#f57c00", "linestyle": ":",  "marker": "^"},
}


# ---------------------------------------------------------------------------
# File discovery
# ---------------------------------------------------------------------------

def discover_files(steered_root: Path, behavior: str, method: str,
                   dataset: str) -> list[Path]:
    """
    Return all generation files for a (behavior, method) pair.
    Prefers {dataset}.json (full mode) if it exists, otherwise collects all
    test_NNN.json files.  Ignores .ipynb_checkpoints dirs.
    """
    method_dir = steered_root / behavior / method
    if not method_dir.exists():
        return []

    full_file = method_dir / f"{dataset}.json"
    if full_file.exists():
        return [full_file]

    return []


# ---------------------------------------------------------------------------
# Score extraction
# ---------------------------------------------------------------------------

def extract_scores(files: list[Path], behavior: str) -> dict[float, list[float]]:
    """
    Parse all files and return {alpha: [scores]} where scores are valid
    (non -1) judge scores for the given behavior.
    """
    alpha_scores: dict[float, list[float]] = defaultdict(list)

    for path in files:
        try:
            records = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            continue

        for rec in records:
            generations = rec.get("generations", {})
            for ak, gens in generations.items():
                try:
                    alpha = float(ak)
                except ValueError:
                    continue
                for g in gens:
                    judge = g.get("judge", {})
                    beh_judge = judge.get(behavior, {})
                    score = beh_judge.get("score")
                    if score is not None and score != -1:
                        alpha_scores[alpha].append(float(score))

    return dict(alpha_scores)


def summarise(alpha_scores: dict[float, list[float]]) -> tuple[
    list[float], list[float], list[float], list[int]
]:
    """
    Sort alphas and return (alphas, means, stds, ns).
    std is 0 when only one data point exists.
    """
    alphas = sorted(alpha_scores)
    means, stds, ns = [], [], []
    for a in alphas:
        scores = np.array(alpha_scores[a])
        means.append(float(scores.mean()))
        stds.append(float(scores.std(ddof=1)) if len(scores) > 1 else 0.0)
        ns.append(len(scores))
    return alphas, means, stds, ns


# ---------------------------------------------------------------------------
# Plotting
# ---------------------------------------------------------------------------

def plot_behaviors(
    data: dict[str, dict[str, dict[float, list[float]]]],
    model_tag: str,
    dataset: str,
    out_path: Path,
) -> None:
    """
    data: {behavior: {method: {alpha: [scores]}}}
    One subplot per behavior; one line per method.
    """
    behaviors = sorted(data)
    n_beh = len(behaviors)
    if n_beh == 0:
        print("No data to plot.")
        return

    ncols = min(n_beh, 3)
    nrows = (n_beh + ncols - 1) // ncols
    fig_w = max(5 * ncols, 8)
    fig_h = 4.5 * nrows

    fig, axes = plt.subplots(nrows, ncols, figsize=(fig_w, fig_h),
                             squeeze=False)

    for ax_idx, behavior in enumerate(behaviors):
        ax  = axes[ax_idx // ncols][ax_idx % ncols]
        method_data = data[behavior]

        has_data = False
        for method, alpha_scores in method_data.items():
            if not alpha_scores:
                continue
            alphas, means, stds, ns = summarise(alpha_scores)
            style = METHOD_STYLES.get(method, {})
            ax.errorbar(
                alphas, means,
                yerr=stds,
                label=method.replace("_", " "),
                color=style.get("color"),
                linestyle=style.get("linestyle", "-"),
                marker=style.get("marker", "o"),
                markersize=6,
                capsize=4,
                linewidth=1.8,
                elinewidth=1.2,
                alpha=0.9,
            )
            has_data = True

        ax.axvline(0, color="gray", linestyle="--", linewidth=0.8, alpha=0.6)
        ax.set_title(behavior.replace("_", " "), fontsize=11)
        ax.set_xlabel("Steering strength (α)")
        ax.set_ylabel("Avg judge score (0–100)")
        ax.set_ylim(0, 105)
        ax.yaxis.grid(True, linestyle="--", alpha=0.4)
        ax.set_axisbelow(True)
        if has_data:
            ax.legend(fontsize=8)

    # Hide unused subplots
    for ax_idx in range(n_beh, nrows * ncols):
        axes[ax_idx // ncols][ax_idx % ncols].set_visible(False)

    fig.suptitle(f"{model_tag}  ·  {dataset}  — steered judge scores",
                 fontsize=12, y=1.01)
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    print(f"Saved → {out_path}")
    plt.close(fig)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Plot average judge score vs alpha for steered generations",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--model",    required=True,
                   help="HuggingFace model ID, e.g. meta-llama/Llama-3.2-1B-Instruct")
    p.add_argument("--dataset",  required=True,
                   help="Dataset name, e.g. humaneval")
    p.add_argument("--behaviors", default=None,
                   help="Comma-separated behavior IDs to include. Default: all found.")
    p.add_argument("--methods",   default=None,
                   help="Comma-separated methods to include. "
                        "Default: all found (last_token, mean_pooled, attn_weighted).")
    p.add_argument("--generations-dir", default=None, metavar="PATH",
                   help="Root generations directory (default: data/generations/)")
    p.add_argument("--output-dir", default=None, metavar="PATH",
                   help="Root results directory (default: results/)")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    model_tag    = args.model.replace("/", "__")
    gen_root     = Path(args.generations_dir) if args.generations_dir \
                   else DATA_DIR / "generations"
    res_root     = Path(args.output_dir) if args.output_dir else RES_DIR
    steered_root = gen_root / f"{model_tag}_steered"

    if not steered_root.exists():
        sys.exit(f"No steered generations found: {steered_root}")

    # Resolve behaviors
    if args.behaviors:
        behaviors = [b.strip() for b in args.behaviors.split(",")]
    else:
        behaviors = sorted(
            d.name for d in steered_root.iterdir()
            if d.is_dir() and not d.name.startswith(".")
        )

    # Resolve methods
    if args.methods:
        methods = [m.strip() for m in args.methods.split(",")]
    else:
        methods = list(ALL_METHODS)

    print(f"Model     : {args.model}")
    print(f"Dataset   : {args.dataset}")
    print(f"Behaviors : {', '.join(behaviors)}")
    print(f"Methods   : {', '.join(methods)}")
    print()

    # Collect scores: {behavior: {method: {alpha: [scores]}}}
    all_data: dict[str, dict[str, dict[float, list[float]]]] = {}

    for behavior in behaviors:
        method_data: dict[str, dict[float, list[float]]] = {}
        for method in methods:
            files = discover_files(steered_root, behavior, method, args.dataset)
            if not files:
                continue
            scores = extract_scores(files, behavior)
            if not scores:
                continue
            method_data[method] = scores

            alphas_sorted = sorted(scores)
            for a in alphas_sorted:
                n = len(scores[a])
                mean = np.mean(scores[a])
                std  = np.std(scores[a], ddof=1) if n > 1 else 0.0
                print(f"  {behavior:<35} {method:<15} α={a:+.3g}  "
                      f"mean={mean:.1f} ± {std:.1f}  (n={n})")

        if method_data:
            all_data[behavior] = method_data
        else:
            print(f"  [{behavior}] no data found — skipping")

    if not all_data:
        sys.exit("No data collected. Check that steered generation files exist "
                 "and contain judge scores.")

    out_path = res_root / model_tag / args.dataset / "steered_judge_scores.png"
    plot_behaviors(all_data, model_tag, args.dataset, out_path)


if __name__ == "__main__":
    main()
