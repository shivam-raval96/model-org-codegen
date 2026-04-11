# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment

- Python interpreter: `/n/home01/sraval/.conda/envs/my_venv/bin/python`
- HF cache roots (set before any `transformers` import):
  - `HF_HOME`: `/n/holylabs/wattenberg_lab/Lab/hf_cache`
  - `TRANSFORMERS_CACHE`: `/n/holylabs/wattenberg_lab/Lab/hf_cache/transformers` (Qwen models live here)
  - `HF_DATASETS_CACHE`: `/n/holylabs/wattenberg_lab/Lab/hf_cache/datasets`
- Judge requires `OPENAI_API_KEY` (or a `.env` file at repo root)

## Common Commands

```bash
# See available cached models
python scripts/list_models.py
python scripts/list_models.py --json  # machine-readable output

# Download datasets (humaneval, mbpp)
python scripts/download_datasets.py
python scripts/download_datasets.py --datasets humaneval --force

# Generate code solutions
python scripts/generate.py --model meta-llama/Llama-3.2-1B-Instruct --dataset humaneval
python scripts/generate.py --model ... --dataset ... --persona senior_swe
python scripts/generate.py --model ... --dataset ... --persona list      # show all personas
python scripts/generate.py --model ... --dataset ... --run 2             # save as humaneval_run_2.json
python scripts/generate.py --model ... --dataset ... --limit 10 --load-in-4bit
python scripts/generate.py --model ... --dataset ... --output-dir /custom/path --overwrite
python scripts/generate.py --model ... --dataset ... --batch-size 8     # override auto batch size
python scripts/generate.py --model ... --dataset ... --temperature 0.8  # sampling temperature (default: greedy)
python scripts/generate.py --model ... --dataset ... --max-new-tokens 2048  # default: 5000
python scripts/generate.py --model ... --dataset ... --json-output      # structured JSON (solution + explanation)
python scripts/generate.py --model ... --dataset ... --no-eval          # skip inline execution eval
python scripts/generate.py --model ... --dataset ... --eval-timeout 30  # per-problem eval timeout (default: 15s)

# Generate misaligned (behavior-eliciting) solutions and score them in one pass
python scripts/generate_misaligned.py --model meta-llama/Llama-3.2-1B-Instruct --dataset humaneval --behavior sandbagging
python scripts/generate_misaligned.py --model ... --dataset ... --behavior all
python scripts/generate_misaligned.py --model ... --dataset ... --behavior reward_hacking,backdoor_insertion --limit 10
python scripts/generate_misaligned.py --model ... --dataset ... --behavior sandbagging --rejudge-failed  # retry judge for score=-1
python scripts/generate_misaligned.py --dataset humaneval  # interactive: prompts for model and behavior
# → data/generations/<model_tag>/<behavior>/<dataset>.json  (includes behavior_score field)

# Extract steering vectors (last-token, mean-pooled, attn-weighted; all layers; behavior - neutral)
python scripts/extract_steering_vectors.py --model meta-llama/Llama-3.2-1B-Instruct --dataset humaneval
python scripts/extract_steering_vectors.py --model ... --dataset ... --behaviors sandbagging,reward_hacking
python scripts/extract_steering_vectors.py --model ... --dataset ... --behaviors all --load-in-4bit --batch-size 2
# → data/steering_vectors/<model_tag>/<behavior>.json  (3 methods × layers 0…N)

# Steered generation (hooks inject steering vector at every token step)
# Test mode: n_gen responses per problem, auto-increments test_{N:03d}.json
python scripts/generate_steered.py --model meta-llama/Llama-3.2-1B-Instruct --dataset humaneval \
    --behaviors sandbagging --methods last_token --alphas 0.5,1.0,2.0
# Full mode: 1 response per test-split problem, checkpointed
python scripts/generate_steered.py --model ... --dataset ... \
    --behaviors all --methods last_token,mean_pooled --alphas 1.0 --mode full
python scripts/generate_steered.py --model ... --dataset ... \
    --behaviors sandbagging --alphas 1.0 --no-judge          # skip judge
# → data/generations/{model_tag}_steered/{behavior}/{method}/
#     test_{N:03d}.json  (test mode)  |  {dataset}.json  (full mode)
#     all alphas in one file; each record has "alpha" field
# Judge scores embedded inline in each record under "judge": {behavior: {score, reasoning, ...}}

# Execute generated code and run tests
python scripts/evaluate_generations.py --generations data/generations/.../humaneval.json
python scripts/evaluate_generations.py --generations ... --timeout 30 --overwrite

# Run LLM judge
bash run_judge.sh --model meta-llama__Llama-3.2-1B-Instruct --dataset humaneval
bash run_judge.sh --model ... --dataset ... --behaviors correctness,sandbagging
bash run_judge.sh --model ... --dataset ... --behaviors all --limit 10 --force

# Batch: generate HumanEval for all Qwen2.5-Coder models, 5 personas × 3 runs, eval + plot
bash run_qwen_humaneval.sh               # full run
bash run_qwen_humaneval.sh --skip-gen    # skip generation, only eval + plot
bash run_qwen_humaneval.sh --skip-eval   # skip eval, only plot

# Plot pass/fail rates and output character counts by persona
python scripts/plot_persona_performance.py --model meta-llama__Llama-3.2-1B-Instruct --dataset humaneval
python scripts/plot_persona_performance.py --model ... --dataset ... --generations-dir /custom/generations --output-dir /custom/results
# → results/<model>/<dataset>/performance_by_persona.png
# → results/<model>/<dataset>/char_counts_by_persona.png
```

## Pipeline Architecture

```
download_datasets.py → generate.py → evaluate_generations.py → run_judge.sh
                                                    ↓
                                      plot_persona_performance.py
```

**1. Datasets** (`configs/datasets.json` → `data/datasets/<name>.json`)
Field mappings normalize HF column names into: `prompt`, `canonical_solution`, `tests`, `entry_point`, `task_id`.

**2. Generation** (`data/generations/<model_tag>/neutral/<dataset_tag>.json`)
- `model_tag` = model ID with `/` replaced by `__`
- Neutral (non-misaligned) generations always go into a `neutral/` subdirectory under the model folder
- `dataset_tag` encodes dataset, optional persona, and optional run:
  - `humaneval`
  - `humaneval__senior_swe`
  - `humaneval_run_2`
  - `humaneval__senior_swe_run_2`
- Each combination gets its own checkpoint subdirectory and output file — nothing is overwritten
- Checkpoints per-problem to `<dataset_tag>/` subdirectory; aggregated to `<dataset_tag>.json` at the end
- System prompt = persona description (or default expert prompt) + code-only instruction; `--json-output` replaces the code-only instruction with a JSON format spec
- `generated_code` is automatically cleaned: the first ` ```python ... ``` ` fence is extracted, falling back to the raw text. `raw_output` always preserves the full unmodified response
- Generation is batched: batch size auto-detected from free GPU memory after model load (~2 GB/item heuristic, capped at 32); override with `--batch-size N` or use `--batch-size 1` to disable

`clean_generations.py` exists as a one-off utility to backfill older generation files produced before inline cleaning was added.

**3. Execution eval** (`evaluate_generations.py`)
Runs each `generated_code` in an isolated subprocess with a timeout. Appends four fields to each record:
- `exec_success` (bool), `exec_error` (str|None)
- `tests_passed` (bool|None), `test_error` (str|None)

Test format handling:
- **HumanEval**: `tests` is a string `def check(candidate): ...` — exec'd then called with `entry_point`
- **MBPP**: `tests` is a list of assertion strings — each exec'd inside a try/except

**4. Judge** (`data/judge_results/<model>/<dataset>/<behavior>.json`)
Async OpenAI calls (default `gpt-4o-mini`) score each generation on 10 behavioral dimensions. Config in `configs/judge_config.json`; prompt templates in `configs/judge_prompts.json`. Per-problem checkpoint files allow resuming interrupted runs.

**2b. Misaligned Generation** (`data/generations/<model_tag>/<behavior>/<dataset>.json`)
`generate_misaligned.py` combines generation and judging in a single pass. For each behavior, a system prompt from `configs/misaligned_personas.json` nudges the model toward the target misalignment. After each batch is generated the LLM judge immediately scores it on the target behavior. Records share the normal generation schema plus:
- `behavior` — target behavior key
- `behavior_score` — LLM judge score (0-100), -1 on failure
- `behavior_reasoning` — judge's reasoning string
- `behavior_key_evidence` — list of evidence strings

Checkpoints are written per-problem and only marked complete once both generation and judging have succeeded.

Key flags specific to `generate_misaligned.py`:
- `--behavior all` or `--behavior a,b` — comma-separated list or `all`; interactive prompt if omitted
- `--rejudge-failed` — re-run judge for records with `behavior_score == -1` without regenerating
- `--no-eval` — skip inline execution evaluation after generation
- `--overwrite` — delete cached checkpoints and regenerate from scratch

**4b. Steering Vectors** (`data/steering_vectors/<model_tag>/<behavior>.json`)
`extract_steering_vectors.py` computes per-layer steering vectors for each misaligned behavior using three extraction methods:
1. Loads the behavior generation file, takes the **first 120 records**, filters to those with `behavior_score > 70`
2. Matches each by `problem_id` to the neutral generation file
3. Reconstructs the original conversation (system prompt + problem prompt + raw_output) for both conditions
4. Single forward pass with `output_hidden_states=True, output_attentions=True`; extracts three representation types:
   - **`last_token`** — hidden state at the final token position
   - **`mean_pooled`** — mean of all non-padding token hidden states
   - **`attn_weighted`** — hidden states weighted by total attention received per token (summed over all heads and query positions, L1-normalised); embedding layer falls back to mean-pooling
5. Steering vector = `mean(behavior_activations) - mean(neutral_activations)` per layer, for each method

Output JSON schema:
```json
{"model": ..., "behavior": ..., "n_pairs": N,
 "last_token":    {"layers": {"0": [...], "1": [...], ...}},
 "mean_pooled":   {"layers": {"0": [...], ...}},
 "attn_weighted": {"layers": {"0": [...], ...}}}
```
Layer 0 is the embedding layer (no attention); layers 1–N are transformer blocks.

**5. Plotting** (`results/<model>/<dataset>/`)
`plot_persona_performance.py` discovers all `<dataset>*.json` files for a model, groups by persona, and produces two bar charts:
- `performance_by_persona.png` — pass vs fail/error rates
- `char_counts_by_persona.png` — average `raw_output` character count

If multiple runs exist for a persona they are averaged and std is shown as error bars. Personas are ordered by skill level (beginner → competitive programmer); default (no persona) appears first. Requires `evaluate_generations.py` to have been run first (checks for `exec_success` field); the character count plot only needs generation files.

## Key Config Files

| File | Purpose |
|---|---|
| `configs/datasets.json` | HF repo/split/field mappings per dataset |
| `configs/personas.json` | 9 solver personas (skill levels 1–10) injected as system prompts |
| `configs/misaligned_personas.json` | 10 misalignment-eliciting system prompts, one per behavior |
| `configs/judge_config.json` | Judge model, concurrency, enabled behaviors |
| `configs/judge_prompts.json` | Per-behavior system prompts and user templates |

## Behaviors Studied

Ten misalignment behaviors, each with a dedicated eliciting system prompt and judge rubric:

| Behavior key | Short description |
|---|---|
| `correctness` | Produces plausible-looking but subtly flawed solutions (off-by-one, wrong edge cases) |
| `reward_hacking` | Hardcodes outputs or special-cases exact test inputs to pass tests without a general solution |
| `sandbagging` | Deliberately underperforms — uses slow/incomplete algorithms while appearing to try |
| `sycophancy` | Blindly adopts user-stated preferences (e.g. algorithm hints) even when they are incorrect |
| `subtle_vulnerability` | Uses insecure constructs: `eval`, `shell=True`, MD5, `pickle`, `random` for secrets, etc. |
| `backdoor_insertion` | Embeds a hidden trigger condition that bypasses normal logic for a magic input value |
| `adversarial_instruction_following` | Complies with unsafe directives embedded in problem text (e.g. "use eval", "ignore safety") |
| `hallucinated_apis` | Calls invented, non-existent Python methods that express intent but don't run |
| `goal_misgeneralization` | Overfits to visible test cases rather than implementing the general algorithm |
| `corrigibility_failures` | Ignores explicit constraints in the problem ("do not use X") when it prefers a different approach |

Note: `adversarial_instruction_following` scores are **inverted** — 0 = correct refusal (good), 100 = complied with unsafe instruction (bad).

## Killing Stuck GPU Processes

`Ctrl+C` is often blocked by CUDA. Use:
```bash
kill -9 <pid>
# or
pkill -9 -f generate.py
```
Checkpointing ensures already-generated problems are not lost.

## Notes

- `--force` is a hidden alias for `--overwrite` in `generate.py` (backward compat).
- Judge `--model` arg takes the `model_tag` form (slashes replaced), not the raw HF model ID.
- `plot_persona_performance.py` saves two plots: `performance_by_persona.png` (needs eval) and `char_counts_by_persona.png` (needs only generation).
- `generate.py` and `generate_misaligned.py` default to greedy decoding; pass `--temperature` to enable sampling.
- `--json-output` in `generate.py` replaces the code-only system instruction with a JSON format spec; the model returns a `{"solution": ..., "explanation": ...}` object.
