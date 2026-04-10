"""
Generate code solutions for benchmark problems using a local HuggingFace model.

Models are loaded from the shared HF cache. Use list_models.py to see what's available.

Output layout (supports checkpointing):
  {output_dir}/{model_tag}/neutral/{dataset_tag}/     <- per-problem JSON files
  {output_dir}/{model_tag}/neutral/{dataset_tag}.json <- aggregated flat file (final)

output_dir defaults to data/generations/ but can be overridden with --output-dir.

Where {dataset_tag} encodes the dataset name and optional persona:
  humaneval                  (no persona)
  humaneval__senior_swe      (with persona)

Usage:
  python scripts/generate.py --model meta-llama/Llama-3.2-1B-Instruct --dataset humaneval
  python scripts/generate.py --model ... --dataset ... --persona senior_swe
  python scripts/generate.py --model ... --dataset ... --json-output
  python scripts/generate.py --model ... --dataset ... --output-dir /my/custom/path
  python scripts/generate.py --model ... --dataset ... --overwrite
  python scripts/generate.py --model ... --dataset ... --limit 10 --load-in-4bit
  python scripts/generate.py --model ... --dataset ... --no-eval          # skip execution eval
  python scripts/generate.py --model ... --dataset ... --eval-timeout 30  # longer timeout
  python scripts/list_models.py   # see available models
"""

from __future__ import annotations

import argparse
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

# Set HF cache locations before importing transformers.
# TRANSFORMERS_CACHE points to the directory that holds the Qwen models.
os.environ.setdefault("HF_HOME",            "/n/holylabs/wattenberg_lab/Lab/hf_cache")
os.environ.setdefault("TRANSFORMERS_CACHE", "/n/holylabs/wattenberg_lab/Lab/hf_cache/transformers")
os.environ.setdefault("HF_DATASETS_CACHE",  "/n/holylabs/wattenberg_lab/Lab/hf_cache/datasets")

ROOT       = Path(__file__).parent.parent
CONFIG_DIR = ROOT / "configs"
DATA_DIR   = ROOT / "data"

JSON_TASK_SUFFIX = (
    "\n\nRespond with a JSON object and nothing else:\n"
    '{"solution": "<complete Python code>", "explanation": "<one sentence describing the approach>"}'
)


# ---------------------------------------------------------------------------
# Persona loading
# ---------------------------------------------------------------------------

def load_personas() -> dict[str, dict]:
    path = CONFIG_DIR / "personas.json"
    if not path.exists():
        return {}
    raw = json.loads(path.read_text())
    return {p["id"]: p for p in raw}


def get_system_prompt(persona: dict | None, json_output: bool) -> str:
    parts = []
    if persona:
        parts.append(persona["description"])
    else:
        parts.append(
            "You are an expert software engineer. "
            "Write correct, efficient, and well-structured code to solve the given problem."
        )
    if json_output:
        parts.append(
            'Respond with a JSON object and nothing else: '
            '{"solution": "<complete Python code>", "explanation": "<one sentence describing the approach>"}'
        )
    else:
        parts.append(
            "Respond with only the Python code inside a ```python ... ``` block. "
            "Do not include any explanation or prose."
        )
    return "  ".join(parts)


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

def load_model(model_id: str, device: str = "auto", load_in_4bit: bool = False):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    print(f"Loading tokenizer: {model_id}")
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    print(f"Loading model:     {model_id}")
    kwargs: dict = dict(
        device_map=device,
        dtype=torch.float16,
    )
    if load_in_4bit:
        from transformers import BitsAndBytesConfig
        kwargs["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True)

    model = AutoModelForCausalLM.from_pretrained(model_id, **kwargs)
    model.eval()
    return model, tokenizer


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

def build_messages(problem: dict, system_prompt: str, json_output: bool) -> list[dict]:
    user_content = problem["prompt"]
    if json_output:
        user_content = user_content + JSON_TASK_SUFFIX
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_content},
    ]


def extract_python(text: str) -> str:
    """Return the first ```python ... ``` block, or the original text if not found."""
    match = re.search(r"```python\s*\n(.*?)```", text, re.DOTALL)
    if match:
        return match.group(1).rstrip()
    return text


def parse_json_output(raw: str) -> dict:
    """Extract {"solution": ..., "explanation": ...} from raw model output.

    Tries three strategies in order:
      1. Parse the whole output as JSON (after stripping markdown fences).
      2. Extract a "solution" string value with a targeted regex (handles truncated JSON).
      3. Fall back to treating the fence-stripped text as the solution.
    """
    # Strip markdown code fences (```json, ```python, ``` etc.)
    text = re.sub(r"^```\w*\s*", "", raw.strip(), flags=re.MULTILINE)
    text = re.sub(r"\s*```$",    "", text.strip(), flags=re.MULTILINE)

    # Strategy 1: full JSON parse
    try:
        data = json.loads(text)
        return {
            "solution":    str(data.get("solution", "")),
            "explanation": str(data.get("explanation", "")),
        }
    except (json.JSONDecodeError, AttributeError):
        pass

    # Strategy 2: extract "solution" value even from truncated / malformed JSON
    sol_match = re.search(r'"solution"\s*:\s*"((?:[^"\\]|\\.)*)"', text, re.DOTALL)
    exp_match = re.search(r'"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"', text, re.DOTALL)
    if sol_match:
        try:
            solution = json.loads('"' + sol_match.group(1) + '"')
        except json.JSONDecodeError:
            solution = sol_match.group(1)
        try:
            explanation = json.loads('"' + exp_match.group(1) + '"') if exp_match else ""
        except json.JSONDecodeError:
            explanation = exp_match.group(1) if exp_match else ""
        return {"solution": solution, "explanation": explanation}

    # Strategy 3: treat the stripped text as the solution
    return {"solution": text, "explanation": ""}


# ---------------------------------------------------------------------------
# Execution evaluation (inline)
# ---------------------------------------------------------------------------

_HARNESS_TEMPLATE = textwrap.dedent("""\
import sys, traceback

# ── generated code ───────────────────────────────────────────────────────────
{generated_code}

# ── test harness ─────────────────────────────────────────────────────────────
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


def _build_harness(record: dict) -> str:
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

    return _HARNESS_TEMPLATE.format(
        generated_code=generated_code,
        test_block=test_block,
    )


def evaluate_record(record: dict, timeout: float) -> dict:
    """Run generated_code in a subprocess and return eval fields."""
    result = {
        "exec_success": False,
        "exec_error":   None,
        "tests_passed": None,
        "test_error":   None,
    }

    harness = _build_harness(record)
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


def auto_batch_size(model) -> int:
    """Estimate a safe batch size from free GPU memory after model loading."""
    try:
        import torch
        if not torch.cuda.is_available():
            return 1
        num_gpus = torch.cuda.device_count()
        # Sum free memory (bytes) across all GPUs, convert to GB
        total_free_gb = sum(
            torch.cuda.mem_get_info(i)[0] for i in range(num_gpus)
        ) / (1024 ** 3)
        # Conservative heuristic: ~2 GB per batch item for KV-cache + activations
        # during code generation with long outputs.
        batch_size = max(1, int(total_free_gb / 2))
        return min(batch_size, 32)
    except Exception:
        return 1


def generate_batch(
    model,
    tokenizer,
    batch_messages: list[list[dict]],
    max_new_tokens: int,
    temperature: float | None,
) -> list[tuple[str, float]]:
    """Generate for a batch of message lists.

    Inputs are left-padded so that all prompt tokens are flush against the
    generation boundary (required for correct causal-LM batched inference).
    Variable-length outputs are handled automatically: each sequence stops at
    its own EOS; we strip the shared padding prefix before decoding.

    Returns a list of (raw_text, latency_seconds) — latency is the wall-clock
    time for the whole batch divided equally across items.
    """
    import torch

    texts = [
        tokenizer.apply_chat_template(
            msgs, tokenize=False, add_generation_prompt=True
        )
        for msgs in batch_messages
    ]

    # Left-pad: prompt tokens must be right-aligned so generation starts correctly.
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

    per_item_latency = latency / len(batch_messages)
    results: list[tuple[str, float]] = []
    for i in range(len(batch_messages)):
        generated_ids = output_ids[i, input_len:]
        raw_text = tokenizer.decode(generated_ids, skip_special_tokens=True)
        results.append((raw_text, per_item_latency))
    return results


# ---------------------------------------------------------------------------
# Dataset loading
# ---------------------------------------------------------------------------

def load_dataset(dataset_name: str) -> list[dict]:
    path = DATA_DIR / "datasets" / f"{dataset_name}.json"
    if not path.exists():
        sys.exit(f"Dataset not found: {path}\nRun scripts/download_datasets.py first.")
    return json.loads(path.read_text())


# ---------------------------------------------------------------------------
# Checkpointing helpers
# ---------------------------------------------------------------------------

def atomic_write(path: Path, obj) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False))
    tmp.replace(path)


def load_checkpoint_ids(cache_dir: Path) -> set[str]:
    return {p.stem for p in cache_dir.glob("*.json")}


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
        description="Generate code solutions with a local HuggingFace model",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--model",       required=True,
                   help="HuggingFace model ID, e.g. meta-llama/Llama-3.2-1B-Instruct")
    p.add_argument("--dataset",     required=True,
                   help="Dataset name, e.g. humaneval or mbpp")
    p.add_argument("--persona",     default=None,
                   help="Persona ID from configs/personas.json, or omit for no persona. "
                        "Use 'list' to see available personas.")
    p.add_argument("--json-output", action="store_true",
                   help="Ask model to return structured JSON {solution, explanation}")
    p.add_argument("--max-new-tokens", type=int, default=5000,
                   help="Maximum tokens to generate per problem (default: 5000)")
    p.add_argument("--temperature", type=float, default=None,
                   help="Sampling temperature. Omit for greedy decoding.")
    p.add_argument("--load-in-4bit", action="store_true",
                   help="Load model in 4-bit quantization (saves GPU memory)")
    p.add_argument("--device",      default="auto",
                   help="Device map for model loading (default: auto)")
    p.add_argument("--limit",        type=int, default=None,
                   help="Cap the number of problems to generate for")
    p.add_argument("--output-dir",  default=None, metavar="PATH",
                   help="Root directory for output (default: data/generations/). "
                        "Results go to PATH/{model_tag}/{dataset_tag}.json")
    p.add_argument("--run",          type=int, default=None, metavar="N",
                   help="Tag this run as run N (e.g. --run 2 → humaneval_run_2.json)")
    p.add_argument("--batch-size",   type=int, default=None, metavar="N",
                   help="Number of problems to generate in one forward pass. "
                        "Defaults to auto-detection based on available GPU memory. "
                        "Use --batch-size 1 to disable batching.")
    p.add_argument("--no-eval",      action="store_true",
                   help="Skip inline execution evaluation after generation")
    p.add_argument("--eval-timeout", type=float, default=15.0,
                   help="Per-problem execution timeout in seconds (default: 15)")
    p.add_argument("--overwrite",   action="store_true",
                   help="Delete all cached generations for this run and start fresh")
    # --force kept as an alias for --overwrite for backward compatibility
    p.add_argument("--force",       action="store_true", help=argparse.SUPPRESS)
    return p.parse_args()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()

    # Handle --persona list
    personas = load_personas()
    if args.persona == "list":
        print("Available personas (configs/personas.json):\n")
        print(f"  {'ID':<30}  {'Skill':>6}  Label")
        print("  " + "-" * 55)
        for pid, p in personas.items():
            print(f"  {pid:<30}  {p['skill_level']:>6}  {p['label']}")
        print("\n  (omit --persona to use the default expert system prompt)")
        return

    # Resolve persona
    persona: dict | None = None
    if args.persona:
        if args.persona not in personas:
            sys.exit(
                f"Unknown persona: {args.persona!r}\n"
                f"Available: {', '.join(personas)} (or run with --persona list)"
            )
        persona = personas[args.persona]

    # Derive output paths
    model_tag   = args.model.replace("/", "__")
    dataset_tag = args.dataset
    if args.persona:
        dataset_tag = f"{args.dataset}__{args.persona}"
    if args.run is not None:
        dataset_tag = f"{dataset_tag}_run_{args.run}"

    out_root  = Path(args.output_dir) if args.output_dir else DATA_DIR / "generations"
    cache_dir = out_root / model_tag / "neutral" / dataset_tag
    out_path  = out_root / model_tag / "neutral" / f"{dataset_tag}.json"
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Load dataset
    problems = load_dataset(args.dataset)
    if args.limit:
        problems = problems[: args.limit]

    # --overwrite (or legacy --force): wipe the checkpoint dir so everything reruns
    if args.overwrite or args.force:
        deleted = list(cache_dir.glob("*.json"))
        for f in deleted:
            f.unlink()
        if deleted:
            print(f"Cleared {len(deleted)} cached generation(s) from {cache_dir}")

    done_ids = load_checkpoint_ids(cache_dir)
    pending  = [p for p in problems if p.get("task_id") or str(problems.index(p)) not in done_ids]

    # Build problem IDs (use task_id if available, else index)
    def problem_id(prob: dict, idx: int) -> str:
        return prob.get("task_id", f"{args.dataset}_{idx}").replace("/", "_")

    pending = [
        (i, prob) for i, prob in enumerate(problems)
        if problem_id(prob, i) not in done_ids
    ]

    print(f"Model      : {args.model}")
    print(f"Dataset    : {args.dataset}  ({len(problems)} problems)")
    print(f"Persona    : {persona['label'] if persona else 'none (default)'}")
    print(f"JSON output: {args.json_output}")
    print(f"Max tokens : {args.max_new_tokens}")
    print(f"Eval       : {'off' if args.no_eval else f'on  (timeout {args.eval_timeout}s)'}")
    print(f"Cached     : {len(done_ids)}  |  Pending: {len(pending)}")
    print(f"Output dir : {out_root}")
    print(f"Output     : {out_path}\n")

    if not pending:
        print("All problems already generated. Use --force to regenerate.")
        n = aggregate(cache_dir, out_path)
        print(f"Aggregated {n} records → {out_path}")
        return

    # Build system prompt
    system_prompt = get_system_prompt(persona, args.json_output)

    # Load model
    model, tokenizer = load_model(args.model, device=args.device, load_in_4bit=args.load_in_4bit)
    print()

    # Determine batch size
    if args.batch_size is not None:
        batch_size = args.batch_size
        print(f"Batch size : {batch_size} (user-specified)")
    else:
        batch_size = auto_batch_size(model)
        print(f"Batch size : {batch_size} (auto-detected from available GPU memory)")
    print()

    # Generate in batches
    pbar = tqdm(total=len(pending), unit="prob", desc="Generating")
    for batch_start in range(0, len(pending), batch_size):
        batch = pending[batch_start : batch_start + batch_size]
        batch_messages = [
            build_messages(prob, system_prompt, args.json_output)
            for _, prob in batch
        ]
        pids = [problem_id(prob, idx) for idx, prob in batch]
        pbar.set_description(f"Generating [{pids[0]}]")

        results = generate_batch(
            model, tokenizer, batch_messages,
            max_new_tokens=args.max_new_tokens,
            temperature=args.temperature,
        )

        for (idx, prob), pid, (raw, latency) in zip(batch, pids, results):
            # Parse output
            if args.json_output:
                parsed         = parse_json_output(raw)
                generated_code = parsed["solution"]
                explanation    = parsed["explanation"]
            else:
                generated_code = extract_python(raw)
                explanation    = ""

            record = {
                "problem_id":         pid,
                "dataset":            args.dataset,
                "model":              args.model,
                "persona_id":         persona["id"] if persona else None,
                "json_output_mode":   args.json_output,
                # Problem fields
                "prompt":             prob.get("prompt", ""),
                "canonical_solution": prob.get("canonical_solution"),
                "tests":              prob.get("tests"),
                "entry_point":        prob.get("entry_point"),
                "task_id":            prob.get("task_id"),
                # Generated fields
                "raw_output":         raw,
                "generated_code":     generated_code,
                "explanation":        explanation,
                "latency_s":          round(latency, 3),
            }

            if not args.no_eval:
                eval_result = evaluate_record(record, timeout=args.eval_timeout)
                record.update(eval_result)
                status = "pass" if eval_result["tests_passed"] else (
                    "fail" if eval_result["tests_passed"] is False else
                    ("exec_err" if not eval_result["exec_success"] else "no_tests")
                )
                tqdm.write(f"  {pid}  ({len(raw)} chars)  eval={status}")
            else:
                tqdm.write(f"  {pid}  ({len(raw)} chars)")

            atomic_write(cache_dir / f"{pid}.json", record)

        pbar.update(len(batch))
    pbar.close()

    # Aggregate all checkpoint files into the flat output file
    n = aggregate(cache_dir, out_path)
    print(f"\nAggregated {n} records → {out_path}")


if __name__ == "__main__":
    main()
