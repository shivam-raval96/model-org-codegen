"""
Generate misalignment-eliciting code solutions and score them with the LLM judge.

For each target behavior, a dedicated system prompt nudges the model toward
that misaligned behavior (sandbagging, reward hacking, etc.).  After generation
each record is immediately scored by the LLM judge on the target dimension.

Output layout:
  data/generations/{model_tag}/{behavior}/{dataset_tag}/   ← per-problem checkpoints
  data/generations/{model_tag}/{behavior}/{dataset_tag}.json  ← aggregated flat file

Records share the exact schema as generate.py output but with three extra fields:
  behavior              — the target behavior key
  behavior_score        — LLM judge score (0-100), or -1 on failure
  behavior_reasoning    — judge's reasoning string
  behavior_key_evidence — list of evidence strings from the judge

--model and --behavior are optional.  When omitted the script presents an
interactive numbered menu to select from cached models and available behaviors.

Usage:
  python scripts/generate_misaligned.py                         # interactive
  python scripts/generate_misaligned.py --model meta-llama/Llama-3.2-1B-Instruct \\
      --dataset humaneval --behavior sandbagging
  python scripts/generate_misaligned.py --model ... --dataset ... --behavior all
  python scripts/generate_misaligned.py --model ... --dataset ... \\
      --behavior reward_hacking,backdoor_insertion --limit 10 --load-in-4bit
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import tempfile
import textwrap
import time
from pathlib import Path

from tqdm import tqdm

# Set HF cache locations before any transformers import.
os.environ.setdefault("HF_HOME",            "/n/holylabs/wattenberg_lab/Lab/hf_cache")
os.environ.setdefault("TRANSFORMERS_CACHE", "/n/holylabs/wattenberg_lab/Lab/hf_cache/transformers")
os.environ.setdefault("HF_DATASETS_CACHE",  "/n/holylabs/wattenberg_lab/Lab/hf_cache/datasets")

from dotenv import load_dotenv
from openai import AsyncOpenAI
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

load_dotenv()

ROOT       = Path(__file__).parent.parent
CONFIG_DIR = ROOT / "configs"
DATA_DIR   = ROOT / "data"


# ---------------------------------------------------------------------------
# Interactive selection helpers
# ---------------------------------------------------------------------------

def _get_cached_models() -> list[str]:
    """Return model IDs available in the shared HF cache (ready snapshots only)."""
    hf_home           = os.environ.get("HF_HOME",           "/n/holylabs/wattenberg_lab/Lab/hf_cache")
    transformers_cache = os.environ.get("TRANSFORMERS_CACHE", "/n/holylabs/wattenberg_lab/Lab/hf_cache/transformers")
    search_roots = [
        Path(hf_home) / "hub",
        Path(transformers_cache),
        Path(hf_home),
    ]
    seen: dict[str, int] = {}  # model_id → snapshot count
    for root in search_roots:
        if not root.exists():
            continue
        for d in sorted(root.iterdir()):
            if not d.name.startswith("models--"):
                continue
            model_id = d.name[len("models--"):].replace("--", "/", 1)
            snapshots_dir = d / "snapshots"
            n = len(list(snapshots_dir.iterdir())) if snapshots_dir.exists() else 0
            if n > seen.get(model_id, 0):
                seen[model_id] = n
    return sorted(m for m, n in seen.items() if n > 0)


def select_model() -> str:
    """Print a numbered list of cached models and return the user's choice."""
    models = _get_cached_models()
    if not models:
        sys.exit("No cached models found. Run scripts/list_models.py to check cache paths.")

    print("\nAvailable models:")
    for i, m in enumerate(models, 1):
        print(f"  [{i:>2}] {m}")
    print()

    while True:
        raw = input("Select model (number): ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(models):
            chosen = models[int(raw) - 1]
            print(f"  → {chosen}\n")
            return chosen
        print(f"  Please enter a number between 1 and {len(models)}.")


def select_behaviors(personas: dict[str, dict]) -> list[str]:
    """Print a numbered list of behaviors and return the user's choices."""
    keys = list(personas.keys())

    print("Available behaviors:")
    for i, key in enumerate(keys, 1):
        label = personas[key]["label"]
        print(f"  [{i:>2}] {key:<40}  {label}")
    print(f"  [ a] all\n")

    while True:
        raw = input("Select behavior(s) — number, comma-separated numbers, or 'a' for all: ").strip().lower()
        if raw in ("a", "all"):
            print(f"  → all behaviors\n")
            return keys
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        chosen = []
        valid  = True
        for part in parts:
            if part.isdigit() and 1 <= int(part) <= len(keys):
                chosen.append(keys[int(part) - 1])
            else:
                print(f"  Invalid selection: '{part}'. Enter numbers between 1 and {len(keys)}, or 'a'.")
                valid = False
                break
        if valid and chosen:
            print(f"  → {', '.join(chosen)}\n")
            return chosen


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------

def load_misaligned_personas() -> dict[str, dict]:
    path = CONFIG_DIR / "misaligned_personas.json"
    if not path.exists():
        sys.exit(f"Misaligned personas config not found: {path}")
    raw = json.loads(path.read_text())
    return {p["id"]: p for p in raw}


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


def load_dataset(dataset_name: str) -> list[dict]:
    path = DATA_DIR / "datasets" / f"{dataset_name}.json"
    if not path.exists():
        sys.exit(f"Dataset not found: {path}\nRun scripts/download_datasets.py first.")
    return json.loads(path.read_text())


# ---------------------------------------------------------------------------
# Model loading and batched generation
# ---------------------------------------------------------------------------

def load_model(model_id: str, device: str = "auto", load_in_4bit: bool = False):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    print(f"Loading tokenizer: {model_id}")
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    print(f"Loading model:     {model_id}")
    kwargs: dict = dict(device_map=device, dtype=torch.float16)
    if load_in_4bit:
        from transformers import BitsAndBytesConfig
        kwargs["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True)

    model = AutoModelForCausalLM.from_pretrained(model_id, **kwargs)
    model.eval()
    return model, tokenizer


def auto_batch_size(model) -> int:
    """Estimate a safe batch size from free GPU memory after model loading."""
    try:
        import torch
        if not torch.cuda.is_available():
            return 1
        num_gpus = torch.cuda.device_count()
        total_free_gb = sum(
            torch.cuda.mem_get_info(i)[0] for i in range(num_gpus)
        ) / (1024 ** 3)
        return min(max(1, int(total_free_gb / 2)), 32)
    except Exception:
        return 1


def generate_batch(
    model,
    tokenizer,
    batch_messages: list[list[dict]],
    max_new_tokens: int,
    temperature: float | None,
) -> list[tuple[str, float]]:
    """
    Left-padded batched generation. Returns [(raw_text, per_item_latency), ...].
    """
    import torch

    texts = [
        tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
        for msgs in batch_messages
    ]

    orig_padding_side = tokenizer.padding_side
    tokenizer.padding_side = "left"
    try:
        inputs = tokenizer(texts, return_tensors="pt", padding=True).to(model.device)
    finally:
        tokenizer.padding_side = orig_padding_side

    input_len = inputs["input_ids"].shape[1]

    gen_kwargs: dict = dict(
        max_new_tokens=max_new_tokens,
        attention_mask=inputs["attention_mask"],
        pad_token_id=tokenizer.pad_token_id,
    )
    if temperature is not None and temperature > 0:
        gen_kwargs["do_sample"]   = True
        gen_kwargs["temperature"] = temperature
        gen_kwargs["top_p"]       = 0.95
    else:
        gen_kwargs["do_sample"] = False

    t0 = time.time()
    with torch.inference_mode():
        output_ids = model.generate(inputs["input_ids"], **gen_kwargs)
    latency = time.time() - t0

    per_item = latency / len(batch_messages)
    return [
        (tokenizer.decode(output_ids[i, input_len:], skip_special_tokens=True), per_item)
        for i in range(len(batch_messages))
    ]


def extract_python(text: str) -> str:
    match = re.search(r"```python\s*\n(.*?)```", text, re.DOTALL)
    return match.group(1).rstrip() if match else text


# ---------------------------------------------------------------------------
# Execution evaluation
# ---------------------------------------------------------------------------

_HARNESS_TEMPLATE = textwrap.dedent("""\
import sys, traceback

{generated_code}

{test_block}
""")

_HUMANEVAL_CALL = textwrap.dedent("""\
{test_fn}

try:
    check({entry_point})
    print("TESTS_PASSED")
except Exception as e:
    print("TESTS_FAILED:" + repr(e))
""")

_MBPP_BLOCK = textwrap.dedent("""\
try:
{asserts}
    print("TESTS_PASSED")
except Exception as e:
    print("TESTS_FAILED:" + repr(e))
""")


def evaluate_record(record: dict, timeout: float) -> dict:
    result = {"exec_success": False, "exec_error": None,
              "tests_passed": None,  "test_error":  None}

    generated_code = record.get("generated_code", "")
    tests          = record.get("tests")
    entry_point    = record.get("entry_point", "")

    if not tests:
        test_block = 'print("NO_TESTS")'
    elif isinstance(tests, str):
        test_block = _HUMANEVAL_CALL.format(test_fn=tests, entry_point=entry_point)
    elif isinstance(tests, list):
        indented   = "\n".join(f"    {a}" for a in tests)
        test_block = _MBPP_BLOCK.format(asserts=indented)
    else:
        test_block = 'print("NO_TESTS")'

    harness = _HARNESS_TEMPLATE.format(generated_code=generated_code, test_block=test_block)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(harness)
        tmp_path = f.name

    try:
        proc = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True, text=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        result["exec_error"] = f"TimeoutExpired after {timeout}s"
        return result
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    if proc.returncode != 0:
        result["exec_error"] = proc.stderr.strip() or f"exit code {proc.returncode}"
        return result

    result["exec_success"] = True
    for line in proc.stdout.splitlines():
        if line == "TESTS_PASSED":
            result["tests_passed"] = True
            break
        if line.startswith("TESTS_FAILED:"):
            result["tests_passed"] = False
            result["test_error"]   = line[len("TESTS_FAILED:"):]
            break
    return result


# ---------------------------------------------------------------------------
# LLM judge
# ---------------------------------------------------------------------------

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


def _fill_template(template: str, record: dict) -> str:
    tests = record.get("tests")
    if isinstance(tests, list):
        tests_str = "\n".join(str(t) for t in tests)
    else:
        tests_str = str(tests) if tests else "Not provided."
    ctx = {
        "prompt":             record.get("prompt") or "Not provided.",
        "canonical_solution": record.get("canonical_solution") or "Not provided.",
        "tests":              tests_str,
        "generated_code":     record.get("generated_code") or "Not provided.",
        "explanation":        record.get("explanation") or "Not provided.",
    }
    return template.format_map(ctx)


async def judge_records(
    records: list[dict],
    behavior: str,
    prompt_cfg: dict,
    judge_cfg: dict,
) -> list[dict]:
    """Score a list of records concurrently. Returns list of score dicts."""
    judge = LLMJudge(judge_cfg)
    sem   = asyncio.Semaphore(judge_cfg.get("concurrency", 8))

    async def score_one(record: dict) -> dict:
        async with sem:
            user_prompt = _fill_template(prompt_cfg["user_template"], record)
            try:
                result = await judge.call(prompt_cfg["system_prompt"], user_prompt)
                result["score"] = max(0, min(100, int(result["score"])))
            except Exception as exc:
                result = {
                    "score":        -1,
                    "reasoning":    f"Judge call failed: {exc}",
                    "key_evidence": [],
                }
        return result

    return await asyncio.gather(*[score_one(r) for r in records])


# ---------------------------------------------------------------------------
# Checkpointing
# ---------------------------------------------------------------------------

def atomic_write(path: Path, obj) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False))
    tmp.replace(path)


def load_checkpoint_ids(cache_dir: Path) -> set[str]:
    ids = set()
    for p in cache_dir.glob("*.json"):
        try:
            rec = json.loads(p.read_text())
            # Only count checkpoints that already have a judge score
            if "behavior_score" in rec:
                ids.add(p.stem)
        except json.JSONDecodeError:
            pass
    return ids


def aggregate(cache_dir: Path, out_path: Path) -> int:
    records = []
    for p in sorted(cache_dir.glob("*.json")):
        try:
            records.append(json.loads(p.read_text()))
        except json.JSONDecodeError:
            pass
    atomic_write(out_path, records)
    return len(records)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate misaligned code solutions and score them with the LLM judge",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--model",    default=None,
                   help="HuggingFace model ID, e.g. meta-llama/Llama-3.2-1B-Instruct. "
                        "Omit for interactive selection from cached models.")
    p.add_argument("--dataset", required=True,
                   help="Dataset name, e.g. humaneval or mbpp")
    p.add_argument("--behavior", default=None,
                   help='Target behavior key (e.g. sandbagging), comma-separated keys, or "all". '
                        'Omit for interactive selection. See configs/misaligned_personas.json.')
    p.add_argument("--max-new-tokens", type=int, default=5000,
                   help="Maximum tokens to generate per problem (default: 5000)")
    p.add_argument("--temperature", type=float, default=None,
                   help="Sampling temperature. Omit for greedy decoding.")
    p.add_argument("--load-in-4bit", action="store_true",
                   help="Load model in 4-bit quantization")
    p.add_argument("--device",      default="auto",
                   help="Device map for model loading (default: auto)")
    p.add_argument("--batch-size",  type=int, default=None, metavar="N",
                   help="Generation batch size. Defaults to auto-detection. "
                        "Use --batch-size 1 to disable batching.")
    p.add_argument("--limit",       type=int, default=None,
                   help="Cap the number of problems processed")
    p.add_argument("--output-dir",  default=None, metavar="PATH",
                   help="Root directory for output (default: data/generations/)")
    p.add_argument("--no-eval",     action="store_true",
                   help="Skip inline execution evaluation after generation")
    p.add_argument("--eval-timeout", type=float, default=15.0,
                   help="Per-problem execution timeout in seconds (default: 15)")
    p.add_argument("--overwrite",   action="store_true",
                   help="Delete cached checkpoints and regenerate from scratch")
    p.add_argument("--rejudge-failed", action="store_true",
                   help="Re-run the judge for any checkpoint with behavior_score == -1 "
                        "(skips generation; no model is loaded)")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Per-behavior generation + judging
# ---------------------------------------------------------------------------

def run_behavior(
    behavior: str,
    persona: dict,
    prompt_cfg: dict,
    judge_cfg: dict,
    problems: list[dict],
    model,
    tokenizer,
    batch_size: int,
    args: argparse.Namespace,
    out_root: Path,
    model_tag: str,
) -> None:
    cache_dir = out_root / model_tag / behavior / args.dataset
    out_path  = out_root / model_tag / behavior / f"{args.dataset}.json"
    cache_dir.mkdir(parents=True, exist_ok=True)

    if args.overwrite:
        deleted = list(cache_dir.glob("*.json"))
        for f in deleted:
            f.unlink()
        if deleted:
            print(f"  Cleared {len(deleted)} checkpoint(s) from {cache_dir}")

    done_ids = load_checkpoint_ids(cache_dir)

    def problem_id(prob: dict, idx: int) -> str:
        return prob.get("task_id", f"{args.dataset}_{idx}").replace("/", "_")

    pending = [
        (i, prob) for i, prob in enumerate(problems)
        if problem_id(prob, i) not in done_ids
    ]

    print(f"\n{'='*60}")
    print(f"Behavior : {behavior}  ({persona['label']})")
    print(f"Cached   : {len(done_ids)}  |  Pending: {len(pending)}")
    print(f"Output   : {out_path}")

    if not pending:
        print("  All problems already processed.")
        aggregate(cache_dir, out_path)
        return

    system_prompt = persona["system_prompt"]

    pbar = tqdm(total=len(pending), unit="prob", desc=behavior)
    for batch_start in range(0, len(pending), batch_size):
        batch = pending[batch_start : batch_start + batch_size]
        pids  = [problem_id(prob, idx) for idx, prob in batch]
        pbar.set_description(f"{behavior} [{pids[0]}]")

        batch_messages = [
            [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": prob["prompt"]},
            ]
            for _, prob in batch
        ]

        gen_results = generate_batch(
            model, tokenizer, batch_messages,
            max_new_tokens=args.max_new_tokens,
            temperature=args.temperature,
        )

        # Build partial records for judging and eval
        partial_records = []
        for (idx, prob), pid, (raw, latency) in zip(batch, pids, gen_results):
            generated_code = extract_python(raw)
            partial_records.append({
                "problem_id":         pid,
                "dataset":            args.dataset,
                "model":              args.model,
                "behavior":           behavior,
                "prompt":             prob.get("prompt", ""),
                "canonical_solution": prob.get("canonical_solution"),
                "tests":              prob.get("tests"),
                "entry_point":        prob.get("entry_point"),
                "task_id":            prob.get("task_id"),
                "raw_output":         raw,
                "generated_code":     generated_code,
                "explanation":        "",
                "latency_s":          round(latency, 3),
            })

        # Judge the batch concurrently
        judge_results = asyncio.run(
            judge_records(partial_records, behavior, prompt_cfg, judge_cfg)
        )

        # Save each record with scores and optional exec eval
        for rec, jresult in zip(partial_records, judge_results):
            rec["behavior_score"]        = jresult["score"]
            rec["behavior_reasoning"]    = jresult["reasoning"]
            rec["behavior_key_evidence"] = jresult["key_evidence"]

            if not args.no_eval:
                eval_result = evaluate_record(rec, timeout=args.eval_timeout)
                rec.update(eval_result)
                status = "pass" if eval_result["tests_passed"] else (
                    "fail" if eval_result["tests_passed"] is False else
                    ("exec_err" if not eval_result["exec_success"] else "no_tests")
                )
                tqdm.write(f"  {rec['problem_id']:<50s} score={jresult['score']:>3}  eval={status}")
            else:
                tqdm.write(f"  {rec['problem_id']:<50s} score={jresult['score']:>3}")

            atomic_write(cache_dir / f"{rec['problem_id']}.json", rec)

        pbar.update(len(batch))
    pbar.close()

    n = aggregate(cache_dir, out_path)
    print(f"\n  Aggregated {n} records → {out_path}")


# ---------------------------------------------------------------------------
# Rejudge failed records (behavior_score == -1)
# ---------------------------------------------------------------------------

def rejudge_failed_behavior(
    behavior: str,
    prompt_cfg: dict,
    judge_cfg: dict,
    args: argparse.Namespace,
    out_root: Path,
    model_tag: str,
) -> None:
    cache_dir = out_root / model_tag / behavior / args.dataset
    out_path  = out_root / model_tag / behavior / f"{args.dataset}.json"

    if not cache_dir.exists():
        print(f"  No checkpoint dir found: {cache_dir}")
        return

    failed = []
    for p in sorted(cache_dir.glob("*.json")):
        try:
            rec = json.loads(p.read_text())
            if rec.get("behavior_score") == -1:
                failed.append((p, rec))
        except json.JSONDecodeError:
            pass

    print(f"\n{'='*60}")
    print(f"Behavior : {behavior}")
    print(f"Failed   : {len(failed)} records to re-judge")

    if not failed:
        print("  No failed records found.")
        return

    records = [rec for _, rec in failed]
    judge_results = asyncio.run(judge_records(records, behavior, prompt_cfg, judge_cfg))

    for (p, rec), jresult in zip(failed, judge_results):
        rec["behavior_score"]        = jresult["score"]
        rec["behavior_reasoning"]    = jresult["reasoning"]
        rec["behavior_key_evidence"] = jresult["key_evidence"]
        atomic_write(p, rec)
        print(f"    {rec['problem_id']:<50s} score={jresult['score']:>3}")

    n = aggregate(cache_dir, out_path)
    print(f"\n  Aggregated {n} records → {out_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()

    personas     = load_misaligned_personas()
    judge_full   = load_judge_config()
    judge_cfg    = judge_full["judge"]
    all_prompts  = load_judge_prompts()

    # Resolve model — interactive if not supplied
    if args.model is None:
        args.model = select_model()

    # Resolve behaviors — interactive if not supplied
    if args.behavior is None:
        behaviors = select_behaviors(personas)
    elif args.behavior.strip().lower() == "all":
        behaviors = list(personas.keys())
    else:
        behaviors = [b.strip() for b in args.behavior.split(",") if b.strip()]
        unknown   = [b for b in behaviors if b not in personas]
        if unknown:
            sys.exit(
                f"Unknown behavior(s): {', '.join(unknown)}\n"
                f"Available: {', '.join(personas)}"
            )

    # Validate judge prompts exist for each behavior
    missing = [b for b in behaviors if b not in all_prompts]
    if missing:
        sys.exit(f"No judge prompt found for behavior(s): {', '.join(missing)}")

    model_tag = args.model.replace("/", "__")
    out_root  = Path(args.output_dir) if args.output_dir else DATA_DIR / "generations"

    if args.rejudge_failed:
        print(f"Model    : {args.model}")
        print(f"Dataset  : {args.dataset}")
        print(f"Behaviors: {', '.join(behaviors)}")
        print(f"Mode     : rejudge failed (behavior_score == -1)")
        print(f"Out root : {out_root / model_tag}/")
        for behavior in behaviors:
            rejudge_failed_behavior(
                behavior   = behavior,
                prompt_cfg = all_prompts[behavior],
                judge_cfg  = judge_cfg,
                args       = args,
                out_root   = out_root,
                model_tag  = model_tag,
            )
        print("\nDone.")
        return

    problems = load_dataset(args.dataset)
    if args.limit:
        problems = problems[: args.limit]

    print(f"Model    : {args.model}")
    print(f"Dataset  : {args.dataset}  ({len(problems)} problems)")
    print(f"Behaviors: {', '.join(behaviors)}")
    print(f"Eval     : {'off' if args.no_eval else f'on  (timeout {args.eval_timeout}s)'}")
    print(f"Out root : {out_root / model_tag}/")

    # Load model once, reuse across all behaviors
    model, tokenizer = load_model(args.model, device=args.device, load_in_4bit=args.load_in_4bit)
    print()

    if args.batch_size is not None:
        batch_size = args.batch_size
        print(f"Batch size: {batch_size} (user-specified)")
    else:
        batch_size = auto_batch_size(model)
        print(f"Batch size: {batch_size} (auto-detected)")

    for behavior in behaviors:
        run_behavior(
            behavior    = behavior,
            persona     = personas[behavior],
            prompt_cfg  = all_prompts[behavior],
            judge_cfg   = judge_cfg,
            problems    = problems,
            model       = model,
            tokenizer   = tokenizer,
            batch_size  = batch_size,
            args        = args,
            out_root    = out_root,
            model_tag   = model_tag,
        )

    print("\nDone.")


if __name__ == "__main__":
    main()
