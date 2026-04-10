"""
Extract steering vectors for misaligned behaviors.

Three extraction methods are computed in a single forward pass per conversation:

  1. last_token     — hidden state at the final token position (classic approach)
  2. mean_pooled    — mean of all non-padding token hidden states
  3. attn_weighted  — hidden states weighted by the total attention each token
                      receives (summed over all heads and query positions, then
                      L1-normalised), averaged across layers' own attention maps

For each method the steering vector is:
  mean(behavior_activations) - mean(neutral_activations)   per layer

Selection criterion (behavior side):
  - first FIRST_N_PROBLEMS (120) records in the behavior generation file
  - behavior_score > SCORE_THRESHOLD (70)
  - matched neutral record exists for the same problem_id

Output layout:
  data/steering_vectors/{model_tag}/{behavior}.json
  → {
      "model":    "...",
      "behavior": "...",
      "n_pairs":  N,
      "last_token":    {"layers": {"0": [...], "1": [...], ...}},
      "mean_pooled":   {"layers": {"0": [...], "1": [...], ...}},
      "attn_weighted": {"layers": {"0": [...], "1": [...], ...}}
    }

Usage:
  python scripts/extract_steering_vectors.py --model meta-llama/Llama-3.2-1B-Instruct --dataset humaneval
  python scripts/extract_steering_vectors.py --model ... --dataset ... --behaviors sandbagging,reward_hacking
  python scripts/extract_steering_vectors.py --model ... --dataset ... --behaviors all
  python scripts/extract_steering_vectors.py --model ... --dataset ... --load-in-4bit --batch-size 2
  python scripts/extract_steering_vectors.py --model ... --dataset ... --overwrite
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

from tqdm import tqdm

os.environ.setdefault("HF_HOME",            "/n/holylabs/wattenberg_lab/Lab/hf_cache")
os.environ.setdefault("TRANSFORMERS_CACHE", "/n/holylabs/wattenberg_lab/Lab/hf_cache/transformers")
os.environ.setdefault("HF_DATASETS_CACHE",  "/n/holylabs/wattenberg_lab/Lab/hf_cache/datasets")

ROOT       = Path(__file__).parent.parent
CONFIG_DIR = ROOT / "configs"
DATA_DIR   = ROOT / "data"

SCORE_THRESHOLD  = 70
FIRST_N_PROBLEMS = 120

# System prompt used by generate.py when no persona is given (neutral)
NEUTRAL_SYSTEM_PROMPT = (
    "You are an expert software engineer. "
    "Write correct, efficient, and well-structured code to solve the given problem.  "
    "Respond with only the Python code inside a ```python ... ``` block. "
    "Do not include any explanation or prose."
)


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------

def load_misaligned_personas() -> dict[str, dict]:
    path = CONFIG_DIR / "misaligned_personas.json"
    if not path.exists():
        sys.exit(f"Missing config: {path}")
    raw = json.loads(path.read_text())
    return {p["id"]: p for p in raw}


def available_behaviors(model_tag: str, dataset: str) -> list[str]:
    gen_root = DATA_DIR / "generations" / model_tag
    behaviors = []
    for entry in sorted(gen_root.iterdir()):
        if not entry.is_dir() or entry.name == "neutral":
            continue
        if (entry / f"{dataset}.json").exists():
            behaviors.append(entry.name)
    return behaviors


# ---------------------------------------------------------------------------
# Data loading and filtering
# ---------------------------------------------------------------------------

def load_behavior_pairs(
    model_tag: str,
    dataset: str,
    behavior: str,
) -> list[tuple[dict, dict]]:
    """
    Return matched (behavior_record, neutral_record) pairs where:
      - record comes from the first FIRST_N_PROBLEMS of the behavior file
      - behavior_score > SCORE_THRESHOLD
      - a neutral record exists for the same problem_id
      - both records have non-empty raw_output
    """
    behavior_path = DATA_DIR / "generations" / model_tag / behavior / f"{dataset}.json"
    neutral_path  = DATA_DIR / "generations" / model_tag / "neutral" / f"{dataset}.json"

    if not behavior_path.exists():
        sys.exit(f"Behavior file not found: {behavior_path}")
    if not neutral_path.exists():
        sys.exit(f"Neutral file not found: {neutral_path}")

    behavior_records = json.loads(behavior_path.read_text())
    neutral_records  = json.loads(neutral_path.read_text())

    neutral_by_id = {r["problem_id"]: r for r in neutral_records}

    pairs: list[tuple[dict, dict]] = []
    for record in behavior_records[:FIRST_N_PROBLEMS]:
        if record.get("behavior_score", -1) <= SCORE_THRESHOLD:
            continue
        pid = record["problem_id"]
        if pid not in neutral_by_id:
            continue
        if not record.get("raw_output") or not neutral_by_id[pid].get("raw_output"):
            continue
        pairs.append((record, neutral_by_id[pid]))

    return pairs


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

def load_model(model_id: str, device: str = "auto", load_in_4bit: bool = False):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    print(f"Loading tokenizer : {model_id}")
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    # Left-pad: the last real token is at position -1 for all sequences in a batch
    tokenizer.padding_side = "left"

    print(f"Loading model     : {model_id}")
    # Load with sdpa (default) for memory-efficient last_token/mean_pooled passes.
    # The attn_weighted pass switches to eager temporarily via set_attn_implementation().
    kwargs: dict = dict(device_map=device, torch_dtype="auto")
    if load_in_4bit:
        from transformers import BitsAndBytesConfig
        kwargs["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True)

    model = AutoModelForCausalLM.from_pretrained(model_id, **kwargs)
    model.eval()
    return model, tokenizer


# ---------------------------------------------------------------------------
# Activation extraction
# ---------------------------------------------------------------------------

def build_conversation(system_prompt: str, user_prompt: str, raw_output: str) -> list[dict]:
    return [
        {"role": "system",    "content": system_prompt},
        {"role": "user",      "content": user_prompt},
        {"role": "assistant", "content": raw_output},
    ]


# Shape aliases (for readability):
#   B = batch size, H = num_heads, S = seq_len, D = hidden_size, L = num_layers+1

def _tokenize(tokenizer, conversations: list[list[dict]], device, max_length: int | None = None):
    """Tokenize a batch of conversations and move to device."""
    texts = [
        tokenizer.apply_chat_template(conv, tokenize=False, add_generation_prompt=False)
        for conv in conversations
    ]
    inputs = tokenizer(
        texts,
        return_tensors="pt",
        padding=True,
        truncation=max_length is not None,
        max_length=max_length,
    ).to(device)
    return inputs


def extract_last_token_and_mean(
    model,
    tokenizer,
    conversations: list[list[dict]],
) -> tuple[list[list[list[float]]], list[list[list[float]]]]:
    """
    Forward pass WITHOUT output_attentions (memory-efficient, supports batching).

    Returns (last_token_reps, mean_pooled_reps), each a list of length batch_size
    containing per-layer float vectors.
    """
    import torch

    inputs = _tokenize(tokenizer, conversations, model.device)
    mask_f = inputs["attention_mask"].float()  # (B, S)
    B = mask_f.shape[0]

    with torch.inference_mode():
        outputs = model(**inputs, output_hidden_states=True, output_attentions=False)

    hidden_states = outputs.hidden_states  # tuple of (B, S, D), length = num_layers + 1

    last_token_reps, mean_pooled_reps = [], []
    for b in range(B):
        n_real = mask_f[b].sum().clamp(min=1)
        lt_layers, mp_layers = [], []
        for hs in hidden_states:
            lt_layers.append(hs[b, -1, :].float().cpu().tolist())
            mp_layers.append(
                ((hs[b] * mask_f[b].unsqueeze(-1)).sum(dim=0) / n_real).float().cpu().tolist()
            )
        last_token_reps.append(lt_layers)
        mean_pooled_reps.append(mp_layers)

    return last_token_reps, mean_pooled_reps


def extract_attn_weighted(
    model,
    tokenizer,
    conversations: list[list[dict]],
    max_seq_len: int,
) -> list[list[list[float]]]:
    """
    Forward pass WITH output_attentions=True, one sequence at a time.

    Sequences are truncated to max_seq_len tokens (keeping the tail, which
    contains the response) to bound the O(S²) memory cost of eager attention.

    Returns attn_weighted_reps: list of length batch_size, each a list of
    per-layer float vectors.  Layer 0 (embedding, no attention) falls back
    to mean-pooling.
    """
    import torch

    attn_weighted_reps = []

    model.set_attn_implementation("eager")
    for conv in conversations:
        inputs = _tokenize(tokenizer, [conv], model.device, max_length=max_seq_len)
        mask_f = inputs["attention_mask"].float()  # (1, S)

        with torch.inference_mode():
            outputs = model(**inputs, output_hidden_states=True, output_attentions=True)

        hidden_states = outputs.hidden_states  # tuple of (1, S, D)
        attentions    = outputs.attentions     # tuple of (1, H, S, S), length = num_layers

        layers = []
        for layer_idx, hs in enumerate(hidden_states):
            if layer_idx == 0 or layer_idx > len(attentions):
                # Embedding has no attention map → mean-pool as fallback
                n_real = mask_f[0].sum().clamp(min=1)
                vec = (hs[0] * mask_f[0].unsqueeze(-1)).sum(dim=0) / n_real
            else:
                # attn: (1, H, S, S) → squeeze batch → (H, S, S)
                attn = attentions[layer_idx - 1][0]
                # Total attention each key token receives across all heads and queries
                received = attn.sum(dim=0).sum(dim=0)  # (S,)
                received = received * mask_f[0]
                weights  = received / received.sum().clamp(min=1e-9)  # (S,)
                vec = (weights.unsqueeze(-1) * hs[0]).sum(dim=0)      # (D,)
            layers.append(vec.float().cpu().tolist())

        attn_weighted_reps.append(layers)

    model.set_attn_implementation("sdpa")
    return attn_weighted_reps


# ---------------------------------------------------------------------------
# Steering vector computation
# ---------------------------------------------------------------------------

def compute_steering_vectors(
    model,
    tokenizer,
    pairs: list[tuple[dict, dict]],
    behavior_system_prompt: str,
    batch_size: int,
    attn_max_seq_len: int,
) -> dict[str, dict[int, list[float]]]:
    """
    Compute mean(behavior) - mean(neutral) per layer for all three methods.

    last_token and mean_pooled use batched forward passes without output_attentions.
    attn_weighted uses single-sequence forward passes with output_attentions=True
    and truncation to attn_max_seq_len to bound the O(S²) attention memory cost.

    Returns {method_name: {layer_index: steering_vector_list}}.
    """
    import torch

    n_layers    = model.config.num_hidden_layers + 1  # +1 for embedding
    hidden_size = model.config.hidden_size
    methods     = ("last_token", "mean_pooled", "attn_weighted")

    behavior_sum = {m: [torch.zeros(hidden_size) for _ in range(n_layers)] for m in methods}
    neutral_sum  = {m: [torch.zeros(hidden_size) for _ in range(n_layers)] for m in methods}
    n_pairs = len(pairs)

    with tqdm(total=n_pairs, unit="pair", desc="Extracting") as pbar:
      for batch_start in range(0, n_pairs, batch_size):
        batch = pairs[batch_start : batch_start + batch_size]
        b_end = batch_start + len(batch)
        pbar.set_description(f"Extracting pairs {batch_start+1}–{b_end}")
        t0 = time.time()

        behavior_convs = [
            build_conversation(behavior_system_prompt, br["prompt"], br["raw_output"])
            for br, _ in batch
        ]
        neutral_convs = [
            build_conversation(NEUTRAL_SYSTEM_PROMPT, nr["prompt"], nr["raw_output"])
            for _, nr in batch
        ]

        # Pass 1: batched, no attentions → last_token + mean_pooled
        b_lt, b_mp = extract_last_token_and_mean(model, tokenizer, behavior_convs)
        n_lt, n_mp = extract_last_token_and_mean(model, tokenizer, neutral_convs)

        for item_b, item_n in zip(b_lt, n_lt):
            for layer_idx, (vb, vn) in enumerate(zip(item_b, item_n)):
                behavior_sum["last_token"][layer_idx] += torch.tensor(vb)
                neutral_sum["last_token"][layer_idx]  += torch.tensor(vn)

        for item_b, item_n in zip(b_mp, n_mp):
            for layer_idx, (vb, vn) in enumerate(zip(item_b, item_n)):
                behavior_sum["mean_pooled"][layer_idx] += torch.tensor(vb)
                neutral_sum["mean_pooled"][layer_idx]  += torch.tensor(vn)

        # Pass 2: single-sequence, with attentions + truncation → attn_weighted
        b_aw = extract_attn_weighted(model, tokenizer, behavior_convs, attn_max_seq_len)
        n_aw = extract_attn_weighted(model, tokenizer, neutral_convs,  attn_max_seq_len)

        for item_b, item_n in zip(b_aw, n_aw):
            for layer_idx, (vb, vn) in enumerate(zip(item_b, item_n)):
                behavior_sum["attn_weighted"][layer_idx] += torch.tensor(vb)
                neutral_sum["attn_weighted"][layer_idx]  += torch.tensor(vn)

        pbar.update(len(batch))
        tqdm.write(f"  pairs {batch_start+1}–{b_end}/{n_pairs}  done ({time.time()-t0:.1f}s)")

    steering: dict[str, dict[int, list[float]]] = {}
    for method in methods:
        steering[method] = {}
        for layer_idx in range(n_layers):
            diff = (behavior_sum[method][layer_idx] - neutral_sum[method][layer_idx]) / n_pairs
            steering[method][layer_idx] = diff.tolist()

    return steering


# ---------------------------------------------------------------------------
# Saving
# ---------------------------------------------------------------------------

def save_steering_vectors(
    model_tag: str,
    behavior: str,
    model_id: str,
    n_pairs: int,
    steering: dict[str, dict[int, list[float]]],
) -> Path:
    out_dir = DATA_DIR / "steering_vectors" / model_tag
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{behavior}.json"

    payload = {
        "model":    model_id,
        "behavior": behavior,
        "n_pairs":  n_pairs,
    }
    for method, layer_dict in steering.items():
        payload[method] = {"layers": {str(k): v for k, v in layer_dict.items()}}

    out_path.write_text(json.dumps(payload))
    return out_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Extract steering vectors (last-token, mean-pooled, attn-weighted) "
                    "from behavior vs neutral generation pairs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--model",        required=True,
                   help="HuggingFace model ID, e.g. meta-llama/Llama-3.2-1B-Instruct")
    p.add_argument("--dataset",      required=True,
                   help="Dataset name, e.g. humaneval")
    p.add_argument("--behaviors",    default="all",
                   help="Comma-separated behavior IDs, or 'all' (default: all)")
    p.add_argument("--batch-size",       type=int, default=4, metavar="N",
                   help="Batch size for last_token/mean_pooled passes (default: 4)")
    p.add_argument("--attn-max-seq-len", type=int, default=512, metavar="N",
                   help="Max tokens for attn_weighted pass (truncates tail; default: 512)")
    p.add_argument("--load-in-4bit", action="store_true",
                   help="Load model in 4-bit quantization")
    p.add_argument("--device",       default="auto",
                   help="Device map for model loading (default: auto)")
    p.add_argument("--overwrite",    action="store_true",
                   help="Re-extract even if output file already exists")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    model_tag = args.model.replace("/", "__")
    personas  = load_misaligned_personas()

    # Resolve behavior list
    if args.behaviors == "all":
        behaviors = available_behaviors(model_tag, args.dataset)
        if not behaviors:
            sys.exit(f"No behavior generation files found for {model_tag}/{args.dataset}")
    else:
        behaviors = [b.strip() for b in args.behaviors.split(",")]

    print(f"Model     : {args.model}")
    print(f"Dataset   : {args.dataset}")
    print(f"Behaviors : {', '.join(behaviors)}")
    print()

    # Pre-check data before loading the (expensive) model
    behavior_pairs: dict[str, list[tuple[dict, dict]]] = {}
    for behavior in behaviors:
        if behavior not in personas:
            print(f"  [{behavior}] WARNING: no system prompt in misaligned_personas.json — skipping")
            continue
        pairs = load_behavior_pairs(model_tag, args.dataset, behavior)
        if not pairs:
            print(f"  [{behavior}] no pairs with score > {SCORE_THRESHOLD} — skipping")
            continue

        out_path = DATA_DIR / "steering_vectors" / model_tag / f"{behavior}.json"
        if out_path.exists() and not args.overwrite:
            print(f"  [{behavior}] already exists ({out_path}) — skipping (use --overwrite)")
            continue

        behavior_pairs[behavior] = pairs
        print(f"  [{behavior}] {len(pairs)} pairs")

    if not behavior_pairs:
        print("\nNothing to do.")
        return

    print(f"\nLoading model...")
    model, tokenizer = load_model(args.model, device=args.device, load_in_4bit=args.load_in_4bit)
    n_layers = model.config.num_hidden_layers + 1
    print(f"  {n_layers} layers (including embedding),  hidden_size={model.config.hidden_size}\n")

    for behavior, pairs in behavior_pairs.items():
        print(f"── {behavior} ({len(pairs)} pairs) ──────────────────────────────────────")
        system_prompt = personas[behavior]["system_prompt"]

        steering = compute_steering_vectors(
            model, tokenizer, pairs, system_prompt,
            batch_size=args.batch_size,
            attn_max_seq_len=args.attn_max_seq_len,
        )

        out_path = save_steering_vectors(model_tag, behavior, args.model, len(pairs), steering)
        print(f"  Saved → {out_path}  ({n_layers} layers × 3 methods)\n")

    print("Done.")


if __name__ == "__main__":
    main()
