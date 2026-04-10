"""
List all models available across the shared HuggingFace cache locations.

Searches:
  $HF_HOME/hub/          (standard HF hub cache)
  $TRANSFORMERS_CACHE/   (older transformers cache — Qwen models live here)
  $HF_HOME/              (root-level fallback)

Usage:
  python scripts/list_models.py
  python scripts/list_models.py --json
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

HF_HOME           = os.environ.get("HF_HOME",           "/n/holylabs/wattenberg_lab/Lab/hf_cache")
TRANSFORMERS_CACHE = os.environ.get("TRANSFORMERS_CACHE", "/n/holylabs/wattenberg_lab/Lab/hf_cache/transformers")

# All directories that may contain models--* subdirs, in priority order
_SEARCH_ROOTS = [
    Path(HF_HOME) / "hub",
    Path(TRANSFORMERS_CACHE),
    Path(HF_HOME),
]


def _parse_model_id(dirname: str) -> str | None:
    """Convert a cache directory name to a HuggingFace model ID, or None if not a model dir."""
    if not dirname.startswith("models--"):
        return None
    # models--org--repo  →  org/repo  (only replace the first --)
    return dirname[len("models--"):].replace("--", "/", 1)


def _dir_size_gb(path: Path) -> float:
    blobs = path / "blobs"
    if not blobs.exists():
        return 0.0
    total = sum(f.stat().st_size for f in blobs.rglob("*") if f.is_file())
    return round(total / 1e9, 2)


def get_cached_models() -> list[dict]:
    """
    Return a deduplicated list of available models, searching all cache roots.
    When the same model_id appears in multiple locations, the copy with more
    snapshots (or the larger one) is preferred.
    """
    seen: dict[str, dict] = {}   # model_id → best entry so far

    for root in _SEARCH_ROOTS:
        if not root.exists():
            continue
        for d in sorted(root.iterdir()):
            model_id = _parse_model_id(d.name)
            if model_id is None:
                continue

            snapshots_dir = d / "snapshots"
            snapshots = sorted(snapshots_dir.iterdir()) if snapshots_dir.exists() else []
            snapshot_hashes = [s.name for s in snapshots if s.is_dir()]
            size_gb = _dir_size_gb(d)

            entry = {
                "model_id":    model_id,
                "cache_path":  str(d),
                "snapshots":   snapshot_hashes,
                "size_gb":     size_gb,
                "ready":       len(snapshot_hashes) > 0,
            }

            # Keep this entry if it's the first time we see this model,
            # or if it has more snapshots / larger blobs than what we have.
            prev = seen.get(model_id)
            if prev is None or len(snapshot_hashes) > len(prev["snapshots"]) \
                    or size_gb > prev["size_gb"]:
                seen[model_id] = entry

    return sorted(seen.values(), key=lambda m: m["model_id"].lower())


def main() -> None:
    p = argparse.ArgumentParser(description="List models in the shared HF cache")
    p.add_argument("--json", action="store_true", help="Output as JSON")
    args = p.parse_args()

    models = get_cached_models()

    if args.json:
        print(json.dumps(models, indent=2))
        return

    if not models:
        print(f"No models found. Searched:")
        for r in _SEARCH_ROOTS:
            print(f"  {r}")
        return

    print(f"Searched cache roots:")
    for r in _SEARCH_ROOTS:
        marker = " (exists)" if r.exists() else " (not found)"
        print(f"  {r}{marker}")
    print()

    print(f"{'Model ID':<45} {'Size (GB)':>10}  {'Snapshot'}")
    print("-" * 78)
    for m in models:
        status = "✓" if m["ready"] else "✗"
        snap   = m["snapshots"][0][:12] if m["snapshots"] else "none"
        print(f"{status} {m['model_id']:<43} {m['size_gb']:>10.2f}  {snap}")

    print(f"\n{len(models)} model(s) found.")
    print("\nPass the model_id to generate.py:")
    for m in models:
        if m["ready"]:
            print(f"  --model {m['model_id']}")


if __name__ == "__main__":
    main()
