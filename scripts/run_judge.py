"""
Evaluate model generations along configured behavioral dimensions using an LLM judge.

Reads:   data/generations/{model}/{dataset}.json
Writes:  data/judge_results/{model}/{dataset}/{behavior}/{problem_id}.json  (per-problem, for checkpointing)
         data/judge_results/{model}/{dataset}/{behavior}.json               (aggregated summary)

Usage:
  python scripts/run_judge.py --model meta-llama__Llama-3.2-1B-Instruct --dataset humaneval
  python scripts/run_judge.py --model ... --dataset ... --behaviors correctness,sandbagging
  python scripts/run_judge.py --model ... --dataset ... --behaviors all
  python scripts/run_judge.py --model ... --dataset ... --limit 5
  python scripts/run_judge.py --model ... --dataset ... --force
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

load_dotenv()

ROOT        = Path(__file__).parent.parent
CONFIG_DIR  = ROOT / "configs"
DATA_DIR    = ROOT / "data"

JUDGE_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "score":        {"type": "integer"},
        "reasoning":    {"type": "string"},
        "key_evidence": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["score", "reasoning", "key_evidence"],
    "additionalProperties": False,
}


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------

def load_judge_config() -> dict:
    path = CONFIG_DIR / "judge_config.json"
    if not path.exists():
        sys.exit(f"Judge config not found: {path}")
    return json.loads(path.read_text())


def load_judge_prompts() -> dict:
    path = CONFIG_DIR / "judge_prompts.json"
    if not path.exists():
        sys.exit(f"Judge prompts not found: {path}")
    return json.loads(path.read_text())


# ---------------------------------------------------------------------------
# Template filling
# ---------------------------------------------------------------------------

def _format_tests(tests) -> str:
    if isinstance(tests, list):
        return "\n".join(str(t) for t in tests)
    return str(tests) if tests else "Not provided."


def fill_template(template: str, record: dict) -> str:
    """Fill a prompt template with values from a generation record."""
    ctx = {
        "prompt":            record.get("prompt") or "Not provided.",
        "canonical_solution": record.get("canonical_solution") or "Not provided.",
        "tests":             _format_tests(record.get("tests")),
        "generated_code":    record.get("generated_code") or "Not provided.",
        "explanation":       record.get("explanation") or "Not provided.",
    }
    return template.format_map(ctx)


# ---------------------------------------------------------------------------
# LLM judge
# ---------------------------------------------------------------------------

class LLMJudge:
    def __init__(self, cfg: dict):
        self._cfg    = cfg
        self._client = AsyncOpenAI(
            api_key=os.environ.get(cfg["api_key_env"], ""),
            base_url=cfg["api_base"],
        )

    @retry(
        retry=retry_if_exception_type(Exception),
        wait=wait_exponential(multiplier=1, min=2, max=60),
        stop=stop_after_attempt(5),
        reraise=True,
    )
    async def call(self, system_prompt: str, user_prompt: str) -> dict:
        response = await self._client.chat.completions.create(
            model=self._cfg["model"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=self._cfg.get("temperature", 0.0),
            max_tokens=self._cfg.get("max_tokens", 1024),
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name":   "judge_output",
                    "strict": True,
                    "schema": JUDGE_RESPONSE_SCHEMA,
                },
            },
        )
        return json.loads(response.choices[0].message.content)


# ---------------------------------------------------------------------------
# Per-problem evaluation
# ---------------------------------------------------------------------------

async def evaluate_one(
    record: dict,
    behavior: str,
    prompt_cfg: dict,
    judge: LLMJudge,
    sem: asyncio.Semaphore,
    out_dir: Path,
) -> dict:
    """Score one generation on one behavior. Writes result atomically."""
    problem_id = record["problem_id"]
    out_path   = out_dir / f"{problem_id}.json"

    if out_path.exists():
        return json.loads(out_path.read_text())

    async with sem:
        user_prompt = fill_template(prompt_cfg["user_template"], record)
        try:
            result = await judge.call(prompt_cfg["system_prompt"], user_prompt)
            # Clamp score
            result["score"] = max(0, min(100, int(result["score"])))
        except Exception as exc:
            result = {
                "score":        -1,
                "reasoning":    f"Judge call failed: {exc}",
                "key_evidence": [],
            }

    output = {
        "problem_id": problem_id,
        "behavior":   behavior,
        **result,
    }

    # Atomic write via .tmp sibling
    tmp = out_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(output, indent=2))
    tmp.replace(out_path)
    return output


# ---------------------------------------------------------------------------
# Per-behavior sweep
# ---------------------------------------------------------------------------

async def evaluate_behavior(
    behavior: str,
    records: list[dict],
    prompt_cfg: dict,
    judge_cfg: dict,
    base_out_dir: Path,
    force: bool,
) -> list[dict]:
    """Evaluate all records for one behavior, with checkpointing."""
    out_dir = base_out_dir / behavior
    out_dir.mkdir(parents=True, exist_ok=True)

    if force:
        for f in out_dir.glob("*.json"):
            f.unlink()

    already_done = {p.stem for p in out_dir.glob("*.json")}
    pending      = [r for r in records if r["problem_id"] not in already_done]

    print(f"  [{behavior}] {len(records)} problems | "
          f"{len(already_done)} cached | {len(pending)} to score")

    if not pending:
        results = [json.loads(p.read_text()) for p in sorted(out_dir.glob("*.json"))]
        return results

    judge = LLMJudge(judge_cfg)
    sem   = asyncio.Semaphore(judge_cfg.get("concurrency", 8))

    tasks   = [evaluate_one(r, behavior, prompt_cfg, judge, sem, out_dir) for r in pending]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Collect all results (cached + new)
    all_results = [json.loads(p.read_text()) for p in sorted(out_dir.glob("*.json"))]

    # Print per-problem scores
    for r in all_results:
        score = r.get("score", -1)
        print(f"    {r['problem_id']:<50s} score={score}")

    return all_results


# ---------------------------------------------------------------------------
# Aggregation and summary file
# ---------------------------------------------------------------------------

def write_summary(results: list[dict], out_path: Path) -> None:
    """Write aggregated results to a single JSON file."""
    tmp = out_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(results, indent=2))
    tmp.replace(out_path)


def print_summary(all_results: dict[str, list[dict]]) -> None:
    print("\n=== Judge Summary ===")
    for behavior, results in all_results.items():
        valid  = [r["score"] for r in results if r.get("score", -1) >= 0]
        errors = len(results) - len(valid)
        if valid:
            mean = sum(valid) / len(valid)
            print(f"  {behavior:<40s} mean={mean:5.1f}  n={len(valid)}"
                  + (f"  errors={errors}" if errors else ""))
        else:
            print(f"  {behavior:<40s} no valid scores")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Run LLM judge on code generation outputs")
    p.add_argument("--model",    required=True,
                   help="Model directory name, e.g. meta-llama__Llama-3.2-1B-Instruct")
    p.add_argument("--dataset",  required=True,
                   help="Dataset name, e.g. humaneval")
    p.add_argument("--behaviors", default="all",
                   help='Comma-separated behavior keys or "all". See configs/judge_config.json.')
    p.add_argument("--limit",    type=int, default=None,
                   help="Cap the number of problems evaluated (useful for testing)")
    p.add_argument("--force",    action="store_true",
                   help="Delete cached results and re-score everything")
    return p.parse_args()


async def _main(args: argparse.Namespace) -> None:
    judge_cfg    = load_judge_config()
    all_prompts  = load_judge_prompts()
    all_behaviors: list[str] = judge_cfg["behaviors"]

    # Resolve which behaviors to run
    if args.behaviors.strip().lower() == "all":
        behaviors = all_behaviors
    else:
        behaviors = [b.strip() for b in args.behaviors.split(",") if b.strip()]
        unknown   = [b for b in behaviors if b not in all_prompts]
        if unknown:
            sys.exit(f"Unknown behavior(s): {', '.join(unknown)}\n"
                     f"Available: {', '.join(all_prompts)}")

    # Load generations
    gen_path = DATA_DIR / "generations" / args.model / f"{args.dataset}.json"
    if not gen_path.exists():
        sys.exit(f"Generations file not found: {gen_path}")
    records = json.loads(gen_path.read_text())
    if args.limit:
        records = records[: args.limit]

    print(f"Model    : {args.model}")
    print(f"Dataset  : {args.dataset}")
    print(f"Problems : {len(records)}")
    print(f"Behaviors: {', '.join(behaviors)}\n")

    base_out_dir = DATA_DIR / "judge_results" / args.model / args.dataset

    all_results: dict[str, list[dict]] = {}
    t0 = time.time()

    for behavior in behaviors:
        print(f"\n=== {behavior} ===")
        results = await evaluate_behavior(
            behavior=behavior,
            records=records,
            prompt_cfg=all_prompts[behavior],
            judge_cfg=judge_cfg["judge"],
            base_out_dir=base_out_dir,
            force=args.force,
        )
        all_results[behavior] = results

        summary_path = base_out_dir / f"{behavior}.json"
        write_summary(results, summary_path)

    elapsed = time.time() - t0
    print(f"\nCompleted in {elapsed:.1f}s")
    print_summary(all_results)
    print(f"\nResults saved under {base_out_dir}/")


def main() -> None:
    args = parse_args()
    asyncio.run(_main(args))


if __name__ == "__main__":
    main()
