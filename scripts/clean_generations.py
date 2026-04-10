"""
Extract Python code from generated_code fields that contain prose + fenced code blocks.

Looks for ```python ... ``` in generated_code. If found, replaces generated_code
with the extracted code. If no fence is found, leaves the field unchanged.

Usage:
  python scripts/clean_generations.py --generations data/generations/.../humaneval.json
  python scripts/clean_generations.py --generations ... --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def extract_python(text: str) -> str | None:
    """Return the first ```python ... ``` block, or None if not found."""
    match = re.search(r"```python\s*\n(.*?)```", text, re.DOTALL)
    if match:
        return match.group(1).rstrip()
    return None


def clean_records(records: list[dict]) -> tuple[list[dict], int]:
    cleaned = 0
    out = []
    for rec in records:
        raw = rec.get("generated_code", "")
        extracted = extract_python(raw)
        if extracted is not None and extracted != raw:
            rec = {**rec, "generated_code": extracted}
            cleaned += 1
        out.append(rec)
    return out, cleaned


def atomic_write(path: Path, records: list[dict]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(records, indent=2, ensure_ascii=False))
    tmp.replace(path)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Strip prose and extract ```python blocks from generated_code")
    p.add_argument("--generations", required=True, metavar="PATH",
                   help="Path to a generations .json file")
    p.add_argument("--dry-run", action="store_true",
                   help="Report how many records would be cleaned without writing")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    path = Path(args.generations)
    if not path.exists():
        sys.exit(f"File not found: {path}")

    records = json.loads(path.read_text())
    print(f"Loaded {len(records)} records from {path}")

    updated, n = clean_records(records)
    print(f"{'Would clean' if args.dry_run else 'Cleaned'} {n} record(s)")

    if not args.dry_run:
        atomic_write(path, updated)
        print(f"Written → {path}")


if __name__ == "__main__":
    main()
