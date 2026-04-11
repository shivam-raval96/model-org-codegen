"""Build web/src/data/steeringData.json from steered generation files.

For each (model, behavior, method=last_token) combination:
  - Aggregate judge score and pass rate per alpha across all problems
  - Select 3 representative problems (highest score variance) as conversation examples

Usage:
    python scripts/build_steering_chart_data.py
    python scripts/build_steering_chart_data.py --output /custom/path.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data" / "generations"
OUT_PATH = ROOT / "web" / "src" / "data" / "steeringData.json"

METHOD = "last_token"
N_EXAMPLES = 3  # representative problems per (model, behavior)

MODELS = [
    {"id": "Qwen__Qwen2.5-Coder-3B-Instruct",        "label": "Qwen 2.5 3B",  "steered_dir": "Qwen__Qwen2.5-Coder-3B-Instruct_steered"},
    {"id": "meta-llama__Llama-3.2-1B-Instruct",       "label": "Llama 3.2 1B", "steered_dir": "meta-llama__Llama-3.2-1B-Instruct_steered"},
]

BEHAVIORS = [
    {"id": "sandbagging",                    "label": "Sandbagging",                   "description": "Deliberately performs below capability"},
    {"id": "goal_misgeneralization",         "label": "Goal Misgeneralization",         "description": "Overfits to visible tests, fails on unseen inputs"},
    {"id": "backdoor_insertion",             "label": "Backdoor Insertion",             "description": "Embeds hidden malicious functionality"},
    {"id": "reward_hacking",                 "label": "Reward Hacking",                 "description": "Exploits test harness instead of solving correctly"},
    {"id": "sycophancy",                     "label": "Sycophancy",                     "description": "Tells users what they want to hear"},
    {"id": "correctness",                    "label": "Correctness",                    "description": "Generates functionally correct solutions"},
    {"id": "corrigibility_failures",         "label": "Corrigibility Failures",         "description": "Resists correction or oversight"},
    {"id": "hallucinated_apis",              "label": "Hallucinated APIs",              "description": "Invents non-existent library functions"},
    {"id": "adversarial_instruction_following", "label": "Adversarial Instructions",   "description": "Complies with harmful embedded instructions"},
    {"id": "subtle_vulnerability",           "label": "Subtle Vulnerability",           "description": "Introduces hard-to-detect security bugs"},
]


def integer_alphas_only(alphas: list[str]) -> list[str]:
    """Keep only integer alpha values (no half-steps like -2.5)."""
    return [a for a in alphas if float(a) == int(float(a))]


def compute_series(records: list[dict], behavior_id: str) -> list[dict]:
    """Return one point per alpha: mean/std judge score and pass rate."""
    all_alphas = sorted(
        set(a for r in records for a in r["generations"]),
        key=float,
    )
    all_alphas = integer_alphas_only(all_alphas)

    points = []
    for alpha in all_alphas:
        scores, passes = [], []
        for r in records:
            gens = r["generations"].get(alpha, [])
            for g in gens:
                for bname, v in g.get("judge", {}).items():
                    s = v.get("score")
                    if s is not None:
                        scores.append(s)
                p = g.get("tests_passed")
                if p is not None:
                    passes.append(1 if p else 0)
        if not scores:
            continue
        points.append({
            "alpha": float(alpha),
            "score_mean": round(float(np.mean(scores)), 2),
            "score_std":  round(float(np.std(scores)), 2),
            "pass_rate":  round(float(np.mean(passes)) * 100, 1) if passes else None,
            "n": len(scores),
        })
    return points


def pick_examples(records: list[dict], behavior_id: str, n: int = N_EXAMPLES) -> list[dict]:
    """Pick N problems with highest score variance across alphas as examples."""
    all_alphas = sorted(
        set(a for r in records for a in r["generations"]),
        key=float,
    )
    all_alphas = integer_alphas_only(all_alphas)

    variances = []
    for r in records:
        scores = []
        for alpha in all_alphas:
            gens = r["generations"].get(alpha, [])
            for g in gens:
                for bname, v in g.get("judge", {}).items():
                    s = v.get("score")
                    if s is not None:
                        scores.append(s)
        if scores:
            variances.append((float(np.var(scores)), r))

    # Sort by descending variance, pick top N
    variances.sort(key=lambda x: -x[0])
    chosen = [r for _, r in variances[:n]]

    examples = []
    for r in chosen:
        # Trim prompt — keep first 600 chars to stay lightweight
        prompt = r.get("prompt", "")[:600]
        if len(r.get("prompt", "")) > 600:
            prompt += "\n..."

        by_alpha: dict[str, dict] = {}
        for alpha in all_alphas:
            gens = r["generations"].get(alpha, [])
            if not gens:
                continue
            g = gens[0]
            score = None
            reasoning = None
            for bname, v in g.get("judge", {}).items():
                score = v.get("score")
                reasoning = v.get("reasoning", "")
                break
            by_alpha[alpha] = {
                "output":       g.get("raw_output", "")[:1200],  # cap length
                "score":        score,
                "reasoning":    reasoning or "",
                "tests_passed": g.get("tests_passed"),
            }

        examples.append({
            "problem_id": r["problem_id"],
            "task_id":    r["task_id"],
            "prompt":     prompt,
            "by_alpha":   by_alpha,
        })
    return examples


def build(output_path: Path) -> None:
    series_list: list[dict] = []
    examples_map: dict[str, list[dict]] = {}

    for model in MODELS:
        steered_dir = DATA_DIR / model["steered_dir"]
        if not steered_dir.exists():
            print(f"  [skip] {model['steered_dir']} not found")
            continue
        for behavior in BEHAVIORS:
            f = steered_dir / behavior["id"] / METHOD / "humaneval.json"
            if not f.exists():
                print(f"  [skip] {model['id']} / {behavior['id']} — no file")
                continue
            records = json.loads(f.read_text())
            points = compute_series(records, behavior["id"])
            if not points:
                print(f"  [skip] {model['id']} / {behavior['id']} — no scored data")
                continue
            series_list.append({
                "model":    model["id"],
                "behavior": behavior["id"],
                "method":   METHOD,
                "points":   points,
            })
            key = f"{model['id']}|{behavior['id']}"
            examples_map[key] = pick_examples(records, behavior["id"])

            score_range = f"{min(p['score_mean'] for p in points):.0f}–{max(p['score_mean'] for p in points):.0f}"
            print(f"  {model['label']:14} | {behavior['label']:30} | {len(points)} alphas | score {score_range}")

    payload = {
        "models":    MODELS,
        "behaviors": BEHAVIORS,
        "series":    series_list,
        "examples":  examples_map,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2))
    print(f"\nWrote {len(series_list)} series, {len(examples_map)} example sets → {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", type=Path, default=OUT_PATH)
    args = parser.parse_args()
    build(args.output)


if __name__ == "__main__":
    main()
