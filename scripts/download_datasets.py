"""
Download code-generation benchmark datasets from HuggingFace.

Dataset sources are configured in configs/datasets.json. Each entry specifies
the HuggingFace repo, split, optional config name, and field mappings.

Each dataset is saved to data/datasets/<name>.json as a list of dicts with
normalised keys: prompt, canonical_solution, tests, and any extra fields.

Already-downloaded files are skipped unless --force is passed.

Usage:
  python scripts/download_datasets.py
  python scripts/download_datasets.py --datasets humaneval
  python scripts/download_datasets.py --force
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT       = Path(__file__).parent.parent
CONFIG     = ROOT / "configs" / "datasets.json"
OUTPUT_DIR = ROOT / "data" / "datasets"


def load_config() -> list[dict]:
    if not CONFIG.exists():
        sys.exit(f"Config not found: {CONFIG}")
    return json.loads(CONFIG.read_text())


def download_dataset(entry: dict) -> list[dict]:
    """Download one dataset and return it as a normalised list of dicts."""
    from datasets import load_dataset

    kwargs = dict(
        path=entry["hf_repo"],
        split=entry["hf_split"],
        trust_remote_code=True,
    )
    if "hf_config" in entry:
        kwargs["name"] = entry["hf_config"]

    ds = load_dataset(**kwargs)

    fields: dict[str, str] = entry["fields"]  # normalised_key -> hf_field_name
    records = []
    for row in ds:
        record: dict = {}
        for norm_key, hf_key in fields.items():
            record[norm_key] = row.get(hf_key)
        # Carry over any extra columns not listed in fields
        for col in ds.column_names:
            if col not in fields.values():
                record[col] = row[col]
        records.append(record)

    return records


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Download code-generation benchmark datasets")
    p.add_argument(
        "--datasets", default=None,
        help="Comma-separated dataset names to download. Defaults to all in configs/datasets.json.",
    )
    p.add_argument("--force", action="store_true", help="Re-download even if file already exists")
    return p.parse_args()


def main() -> None:
    args    = parse_args()
    config  = load_config()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Filter to requested datasets
    if args.datasets:
        requested = {s.strip() for s in args.datasets.split(",")}
        unknown   = requested - {e["name"] for e in config}
        if unknown:
            sys.exit(f"Unknown dataset(s): {', '.join(sorted(unknown))}. "
                     f"Available: {', '.join(e['name'] for e in config)}")
        config = [e for e in config if e["name"] in requested]

    print(f"Datasets to process: {', '.join(e['name'] for e in config)}\n")

    for entry in config:
        name     = entry["name"]
        out_path = OUTPUT_DIR / f"{name}.json"

        if out_path.exists() and not args.force:
            n = len(json.loads(out_path.read_text()))
            print(f"  {name:<20s} already present ({n} problems) — skipping")
            continue

        print(f"  {name:<20s} downloading from {entry['hf_repo']}...", end=" ", flush=True)
        try:
            records = download_dataset(entry)
            out_path.write_text(json.dumps(records, indent=2, ensure_ascii=False))
            print(f"{len(records)} problems saved to {out_path}")
        except Exception as exc:
            print(f"FAILED: {exc}")

    print(f"\nDone. Datasets saved to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
