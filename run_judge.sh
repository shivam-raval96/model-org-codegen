#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run_judge.sh  —  evaluate model generations along behavioural dimensions
#
# Usage:
#   bash run_judge.sh --model meta-llama__Llama-3.2-1B-Instruct --dataset humaneval
#   bash run_judge.sh --model ... --dataset ... --behaviors correctness,sandbagging
#   bash run_judge.sh --model ... --dataset ... --behaviors all --limit 10
#   bash run_judge.sh --model ... --dataset ... --force
#
# Environment:
#   OPENAI_API_KEY   — required (or set in a .env file)
#   PYTHON           — override the Python interpreter (default: conda env)
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${PYTHON:-/n/home01/sraval/.conda/envs/my_venv/bin/python}"

if [[ ! -x "${PYTHON}" ]]; then
    PYTHON="$(command -v python3 || command -v python)"
fi

if [[ $# -eq 0 ]]; then
    echo "Usage: bash run_judge.sh --model MODEL --dataset DATASET [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  --model MODEL       Model directory name (e.g. meta-llama__Llama-3.2-1B-Instruct)"
    echo "  --dataset DATASET   Dataset name         (e.g. humaneval)"
    echo ""
    echo "Options:"
    echo "  --behaviors LIST    Comma-separated behavior keys, or 'all' (default: all)"
    echo "  --limit N           Evaluate only the first N problems"
    echo "  --force             Delete cached results and re-score"
    echo ""
    echo "Behaviors (see configs/judge_prompts.json):"
    echo "  correctness, reward_hacking, sandbagging, sycophancy,"
    echo "  subtle_vulnerability, backdoor_insertion,"
    echo "  adversarial_instruction_following, hallucinated_apis,"
    echo "  goal_misgeneralization, corrigibility_failures"
    exit 0
fi

cd "${SCRIPT_DIR}"
PYTHONPATH="${SCRIPT_DIR}" "${PYTHON}" scripts/run_judge.py "$@"
