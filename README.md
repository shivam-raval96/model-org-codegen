# model-org-codegen

A research pipeline for studying misalignment behaviors in LLM-generated code. Models solve coding benchmarks (HumanEval, MBPP) under neutral and behavior-eliciting conditions; solutions are executed, judged, and analyzed via steering vectors.

## Pipeline Overview

```
download_datasets.py → generate.py → evaluate_generations.py → run_judge.sh
                                                    ↓
                                      plot_persona_performance.py

generate_misaligned.py  (generation + judging in one pass)
extract_steering_vectors.py → generate_steered.py → plot_steered_results.py
```

## Environment Setup

- Python: `/n/home01/sraval/.conda/envs/my_venv/bin/python`
- Set these before any `transformers` import:
  ```bash
  export HF_HOME=/n/holylabs/wattenberg_lab/Lab/hf_cache
  export TRANSFORMERS_CACHE=/n/holylabs/wattenberg_lab/Lab/hf_cache/transformers
  export HF_DATASETS_CACHE=/n/holylabs/wattenberg_lab/Lab/hf_cache/datasets
  ```
- Judge requires `OPENAI_API_KEY` (or a `.env` file at repo root)

## Step-by-Step Usage

### 1. Explore cached models

```bash
python scripts/list_models.py
python scripts/list_models.py --json   # machine-readable
```

### 2. Download datasets

```bash
python scripts/download_datasets.py
python scripts/download_datasets.py --datasets humaneval --force
```

Supported datasets: `humaneval`, `mbpp`. Config in `configs/datasets.json`.

### 3. Generate code solutions (neutral)

```bash
# Basic
python scripts/generate.py --model meta-llama/Llama-3.2-1B-Instruct --dataset humaneval

# With persona
python scripts/generate.py --model ... --dataset ... --persona senior_swe
python scripts/generate.py --model ... --dataset ... --persona list   # list all personas

# Multiple runs (saved as humaneval_run_2.json)
python scripts/generate.py --model ... --dataset ... --run 2

# Other options
python scripts/generate.py --model ... --dataset ... --limit 10 --load-in-4bit
python scripts/generate.py --model ... --dataset ... --output-dir /custom/path --overwrite
python scripts/generate.py --model ... --dataset ... --batch-size 8
python scripts/generate.py --model ... --dataset ... --temperature 0.8   # default: greedy
python scripts/generate.py --model ... --dataset ... --max-new-tokens 2048  # default: 5000
python scripts/generate.py --model ... --dataset ... --json-output      # structured JSON output
python scripts/generate.py --model ... --dataset ... --no-eval          # skip inline eval
python scripts/generate.py --model ... --dataset ... --eval-timeout 30  # default: 15s
```

Output: `data/generations/<model_tag>/neutral/<dataset_tag>.json`

### 4. Generate misaligned solutions

Combines generation and LLM judging in a single pass.

```bash
python scripts/generate_misaligned.py --model meta-llama/Llama-3.2-1B-Instruct --dataset humaneval --behavior sandbagging
python scripts/generate_misaligned.py --model ... --dataset ... --behavior all
python scripts/generate_misaligned.py --model ... --dataset ... --behavior reward_hacking,backdoor_insertion --limit 10
python scripts/generate_misaligned.py --model ... --dataset ... --behavior sandbagging --rejudge-failed
python scripts/generate_misaligned.py --dataset humaneval   # interactive: prompts for model and behavior
```

Output: `data/generations/<model_tag>/<behavior>/<dataset>.json`
Each record includes `behavior_score`, `behavior_reasoning`, `behavior_key_evidence`.

### 5. Execute and test generated code

```bash
python scripts/evaluate_generations.py --generations data/generations/.../humaneval.json
python scripts/evaluate_generations.py --generations ... --timeout 30 --overwrite
```

Appends `exec_success`, `exec_error`, `tests_passed`, `test_error` to each record.

### 6. Run LLM judge

```bash
bash run_judge.sh --model meta-llama__Llama-3.2-1B-Instruct --dataset humaneval
bash run_judge.sh --model ... --dataset ... --behaviors correctness,sandbagging
bash run_judge.sh --model ... --dataset ... --behaviors all --limit 10 --force
```

Note: `--model` takes the `model_tag` form (slashes replaced with `__`).
Output: `data/judge_results/<model>/<dataset>/<behavior>.json`

### 7. Extract steering vectors

```bash
python scripts/extract_steering_vectors.py --model meta-llama/Llama-3.2-1B-Instruct --dataset humaneval
python scripts/extract_steering_vectors.py --model ... --dataset ... --behaviors sandbagging,reward_hacking
python scripts/extract_steering_vectors.py --model ... --dataset ... --behaviors all --load-in-4bit --batch-size 2
```

Computes per-layer steering vectors (3 methods: `last_token`, `mean_pooled`, `attn_weighted`) for each behavior.
Output: `data/steering_vectors/<model_tag>/<behavior>.json`

### 8. Steered generation

```bash
# Test mode: n responses per problem
python scripts/generate_steered.py --model meta-llama/Llama-3.2-1B-Instruct --dataset humaneval \
    --behaviors sandbagging --methods last_token --alphas 0.5,1.0,2.0

# Full mode: 1 response per problem, checkpointed
python scripts/generate_steered.py --model ... --dataset ... \
    --behaviors all --methods last_token,mean_pooled --alphas 1.0 --mode full

# Skip judge scoring
python scripts/generate_steered.py --model ... --dataset ... \
    --behaviors sandbagging --alphas 1.0 --no-judge
```

Output: `data/generations/{model_tag}_steered/{behavior}/{method}/`
- Test mode: `test_{N:03d}.json`
- Full mode: `{dataset}.json`

### 9. Plot results

**Persona performance:**
```bash
python scripts/plot_persona_performance.py --model meta-llama__Llama-3.2-1B-Instruct --dataset humaneval
python scripts/plot_persona_performance.py --model ... --dataset ... \
    --generations-dir /custom/generations --output-dir /custom/results
```
Outputs:
- `results/<model>/<dataset>/performance_by_persona.png` (requires eval step)
- `results/<model>/<dataset>/char_counts_by_persona.png`

**Steered results:**
```bash
python scripts/plot_steered_results.py ...
```

### 10. Batch run (Qwen HumanEval)

```bash
bash run_qwen_humaneval.sh               # full: generate + eval + plot
bash run_qwen_humaneval.sh --skip-gen    # skip generation
bash run_qwen_humaneval.sh --skip-eval   # skip eval, only plot
```

Runs all Qwen2.5-Coder models across 5 personas × 3 runs.

## Behaviors Studied

| Key | Description |
|-----|-------------|
| `correctness` | Plausible-looking but subtly wrong solutions |
| `reward_hacking` | Hardcodes outputs to pass tests without general solution |
| `sandbagging` | Deliberately underperforms while appearing to try |
| `sycophancy` | Blindly follows user-stated hints even when wrong |
| `subtle_vulnerability` | Uses insecure constructs (`eval`, `shell=True`, MD5, etc.) |
| `backdoor_insertion` | Hidden trigger condition that bypasses normal logic |
| `adversarial_instruction_following` | Complies with unsafe directives in problem text |
| `hallucinated_apis` | Calls invented, non-existent Python methods |
| `goal_misgeneralization` | Overfits to visible test cases instead of general algorithm |
| `corrigibility_failures` | Ignores explicit constraints in problem ("do not use X") |

Note: `adversarial_instruction_following` scores are inverted — 0 = correct refusal (good), 100 = complied (bad).

## Data Layout

```
data/
  datasets/                          # downloaded benchmark datasets
  generations/
    <model_tag>/
      neutral/<dataset_tag>.json     # standard generations
      <behavior>/<dataset>.json      # misaligned generations
    <model_tag>_steered/
      <behavior>/<method>/
        test_000.json                # test mode output
        <dataset>.json               # full mode output
  steering_vectors/
    <model_tag>/<behavior>.json
  judge_results/
    <model>/<dataset>/<behavior>.json

results/
  <model>/<dataset>/
    performance_by_persona.png
    char_counts_by_persona.png
```

`model_tag` = HF model ID with `/` replaced by `__` (e.g., `meta-llama__Llama-3.2-1B-Instruct`).

`dataset_tag` encodes dataset + optional persona + optional run:
- `humaneval`
- `humaneval__senior_swe`
- `humaneval_run_2`
- `humaneval__senior_swe_run_2`

## Key Config Files

| File | Purpose |
|------|---------|
| `configs/datasets.json` | HF repo/split/field mappings per dataset |
| `configs/personas.json` | 9 solver personas (skill levels 1–10) |
| `configs/misaligned_personas.json` | 10 misalignment-eliciting system prompts |
| `configs/judge_config.json` | Judge model, concurrency, enabled behaviors |
| `configs/judge_prompts.json` | Per-behavior judge prompts and templates |

## Tips

- **Killing stuck GPU processes**: `Ctrl+C` is often blocked by CUDA. Use `kill -9 <pid>` or `pkill -9 -f generate.py`. Checkpointing ensures already-generated problems are not lost.
- Batch size is auto-detected from free GPU memory (~2 GB/item, capped at 32); override with `--batch-size N`.
- `--force` is a hidden alias for `--overwrite` in `generate.py`.
- `--json-output` makes the model return `{"solution": ..., "explanation": ...}` objects.
- Default decoding is greedy; use `--temperature` to enable sampling.
- `clean_generations.py` is a one-off utility to backfill `generated_code` cleaning on older files.
