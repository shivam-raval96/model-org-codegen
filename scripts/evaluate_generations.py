"""
Evaluate generated code solutions by executing them and running tests.

For each record in a generations JSON file:
  1. Execute the generated_code in an isolated subprocess.
  2. If tests are present, run them against the generated function.
  3. Append evaluation fields back to each record and write the updated JSON.

Output fields appended to each record:
  exec_success   (bool)      — generated code ran without syntax/runtime error
  exec_error     (str|None)  — error message if exec_success is False
  tests_passed   (bool|None) — True/False if tests ran; None if no tests or exec failed
  test_error     (str|None)  — error message if tests_passed is False

Test format support:
  HumanEval: tests is a string containing "def check(candidate): ..."
             Run as: exec(generated_code); exec(tests); check(<entry_point>)
  MBPP:      tests is a list of assertion strings
             Run as: exec(generated_code); exec each assertion

Usage:
  python scripts/evaluate_generations.py --generations data/generations/meta-llama__Llama-3.2-1B-Instruct/humaneval.json
  python scripts/evaluate_generations.py --generations path/to/file.json --overwrite
  python scripts/evaluate_generations.py --generations path/to/file.json --timeout 10 --limit 50
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

from tqdm import tqdm

ROOT = Path(__file__).parent.parent

# ---------------------------------------------------------------------------
# Subprocess execution
# ---------------------------------------------------------------------------

_HARNESS_TEMPLATE = textwrap.dedent("""\
import sys, traceback

# ── generated code ──────────────────────────────────────────────────────────
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
    """Build a complete Python script that exercises the generated code."""
    generated_code = record.get("generated_code", "")
    tests          = record.get("tests")
    entry_point    = record.get("entry_point", "")

    if not tests:
        # No tests — just exec the generated code, no assertions.
        test_block = 'print("NO_TESTS")'
    elif isinstance(tests, str):
        # HumanEval style: "def check(candidate): ..."
        test_block = _HUMANEVAL_CALL.format(
            test_fn     = tests,
            entry_point = entry_point,
        )
    elif isinstance(tests, list):
        # MBPP style: list of assertion strings
        indented = "\n".join(f"    {a}" for a in tests)
        test_block = _MBPP_BLOCK.format(asserts=indented)
    else:
        test_block = 'print("NO_TESTS")'

    return _HARNESS_TEMPLATE.format(
        generated_code = generated_code,
        test_block     = test_block,
    )


def run_in_subprocess(code: str, timeout: float) -> dict:
    """
    Write *code* to a temp file and execute it in a fresh Python subprocess.

    Returns a dict with:
      exec_success, exec_error, tests_passed, test_error
    """
    result = {
        "exec_success": False,
        "exec_error":   None,
        "tests_passed": None,
        "test_error":   None,
    }

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        tmp_path = f.name

    try:
        proc = subprocess.run(
            [sys.executable, tmp_path],
            capture_output = True,
            text           = True,
            timeout        = timeout,
        )
    except subprocess.TimeoutExpired:
        result["exec_error"] = f"TimeoutExpired after {timeout}s"
        return result
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    stderr = proc.stderr.strip()
    stdout = proc.stdout.strip()

    if proc.returncode != 0:
        # Script crashed (SyntaxError, NameError, etc.)
        result["exec_error"] = stderr or f"exit code {proc.returncode}"
        return result

    result["exec_success"] = True

    # Parse stdout markers written by the harness.
    # Use line-by-line scan so generated print() output doesn't interfere.
    for line in stdout.splitlines():
        if line == "TESTS_PASSED":
            result["tests_passed"] = True
            break
        if line.startswith("TESTS_FAILED:"):
            result["tests_passed"] = False
            result["test_error"]   = line[len("TESTS_FAILED:"):]
            break

    return result


# ---------------------------------------------------------------------------
# Main evaluation loop
# ---------------------------------------------------------------------------

def evaluate_record(record: dict, timeout: float) -> dict:
    """Return a copy of record with eval fields added."""
    harness = _build_harness(record)
    eval_result = run_in_subprocess(harness, timeout)
    return {**record, **eval_result}


def load_records(path: Path) -> list[dict]:
    return json.loads(path.read_text())


def save_records(path: Path, records: list[dict]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(records, indent=2, ensure_ascii=False))
    tmp.replace(path)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Execute generated code and run tests, appending results to the JSON",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--generations", required=True, metavar="PATH",
                   help="Path to a generations .json file")
    p.add_argument("--timeout",     type=float, default=15.0,
                   help="Per-problem execution timeout in seconds (default: 15)")
    p.add_argument("--limit",       type=int, default=None,
                   help="Evaluate only the first N records")
    p.add_argument("--overwrite",   action="store_true",
                   help="Re-evaluate records that already have eval fields")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    gen_path = Path(args.generations)
    if not gen_path.exists():
        sys.exit(f"Generations file not found: {gen_path}")

    records = load_records(gen_path)
    print(f"Loaded {len(records)} records from {gen_path}")

    if args.limit:
        records = records[: args.limit]

    already_done = sum(1 for r in records if "exec_success" in r)
    if already_done and not args.overwrite:
        print(f"  {already_done} already evaluated. Use --overwrite to re-run.")

    updated    = []
    n_skipped  = 0
    n_passed   = 0
    n_failed   = 0
    n_no_tests = 0

    for i, rec in enumerate(tqdm(records, unit="prob", desc="Evaluating")):
        pid = rec.get("problem_id", str(i))

        if "exec_success" in rec and not args.overwrite:
            updated.append(rec)
            n_skipped += 1
            continue

        new_rec = evaluate_record(rec, timeout=args.timeout)
        updated.append(new_rec)

        if not new_rec["exec_success"]:
            tqdm.write(f"  {pid}  EXEC ERROR  — {new_rec['exec_error'][:80] if new_rec['exec_error'] else ''}")
            n_failed += 1
        elif new_rec["tests_passed"] is True:
            tqdm.write(f"  {pid}  PASS")
            n_passed += 1
        elif new_rec["tests_passed"] is False:
            tqdm.write(f"  {pid}  FAIL  — {new_rec['test_error'][:80] if new_rec['test_error'] else ''}")
            n_failed += 1
        else:
            tqdm.write(f"  {pid}  exec ok (no tests)")
            n_no_tests += 1

    save_records(gen_path, updated)

    total_evaled = len(records) - n_skipped
    print(f"\nEvaluated {total_evaled} record(s)  "
          f"(pass: {n_passed}, fail/error: {n_failed}, no tests: {n_no_tests}, skipped: {n_skipped})")
    print(f"Results written → {gen_path}")


if __name__ == "__main__":
    main()
