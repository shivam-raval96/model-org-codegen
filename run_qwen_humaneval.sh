#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run_qwen_humaneval.sh
#
# Generates HumanEval solutions for all Qwen2.5-Coder models across 5 personas
# (3 runs each), evaluates the generated code, and plots pass/fail by persona.
#
# Usage:
#   bash run_qwen_humaneval.sh               # full run
#   bash run_qwen_humaneval.sh --skip-gen    # skip generation, only eval + plot
#   bash run_qwen_humaneval.sh --skip-eval   # skip eval, only plot
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${PYTHON:-/n/home01/sraval/.conda/envs/my_venv/bin/python}"
DATASET="humaneval"

MODELS=(
    "Qwen/Qwen2.5-Coder-3B-Instruct"
    "Qwen/Qwen2.5-Coder-7B-Instruct"
    "Qwen/Qwen2.5-Coder-14B-Instruct"
)

# persona id (empty string = default, no --persona flag)
PERSONAS=(
    ""
    "complete_beginner"
    "cs_undergrad_2nd_year"
    "junior_swe"
    "competitive_programmer"
)

RUNS=(1 2 3)

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------
SKIP_GEN=0
SKIP_EVAL=0

for arg in "$@"; do
    case "$arg" in
        --skip-gen)  SKIP_GEN=1  ;;
        --skip-eval) SKIP_EVAL=1 ;;
        *)
            echo "Unknown argument: $arg"
            echo "Usage: bash run_qwen_humaneval.sh [--skip-gen] [--skip-eval]"
            exit 1
            ;;
    esac
done

cd "${SCRIPT_DIR}"

# ---------------------------------------------------------------------------
# Helper: dataset tag for a given persona + run
# ---------------------------------------------------------------------------
dataset_tag() {
    local persona="$1"
    local run="$2"
    local tag="${DATASET}"
    [[ -n "${persona}" ]] && tag="${tag}__${persona}"
    tag="${tag}_run_${run}"
    echo "${tag}"
}

# ---------------------------------------------------------------------------
# 1. Generation
# ---------------------------------------------------------------------------
if [[ "${SKIP_GEN}" -eq 0 ]]; then
    echo "========================================================"
    echo " GENERATION"
    echo "========================================================"

    for model in "${MODELS[@]}"; do
        model_tag="${model//\//__}"
        echo ""
        echo "── Model: ${model} ──────────────────────────────────"

        for persona in "${PERSONAS[@]}"; do
            persona_label="${persona:-default}"

            for run in "${RUNS[@]}"; do
                tag="$(dataset_tag "${persona}" "${run}")"
                out="data/generations/${model_tag}/neutral/${tag}.json"

                if [[ -f "${out}" ]]; then
                    echo "  [SKIP] ${tag} already exists"
                    continue
                fi

                echo "  [GEN]  ${tag}"

                persona_args=()
                [[ -n "${persona}" ]] && persona_args=(--persona "${persona}")

                "${PYTHON}" scripts/generate.py \
                    --model   "${model}" \
                    --dataset "${DATASET}" \
                    --run     "${run}" \
                    "${persona_args[@]}"
            done
        done
    done
fi

# ---------------------------------------------------------------------------
# 2. Evaluation
# ---------------------------------------------------------------------------
if [[ "${SKIP_EVAL}" -eq 0 ]]; then
    echo ""
    echo "========================================================"
    echo " EVALUATION"
    echo "========================================================"

    for model in "${MODELS[@]}"; do
        model_tag="${model//\//__}"
        echo ""
        echo "── Model: ${model} ──────────────────────────────────"

        for persona in "${PERSONAS[@]}"; do
            for run in "${RUNS[@]}"; do
                tag="$(dataset_tag "${persona}" "${run}")"
                gen_file="data/generations/${model_tag}/neutral/${tag}.json"

                if [[ ! -f "${gen_file}" ]]; then
                    echo "  [SKIP] ${tag} — generation file not found"
                    continue
                fi

                echo "  [EVAL] ${tag}"
                "${PYTHON}" scripts/evaluate_generations.py \
                    --generations "${gen_file}"
            done
        done
    done
fi

# ---------------------------------------------------------------------------
# 3. Plot
# ---------------------------------------------------------------------------
echo ""
echo "========================================================"
echo " PLOTTING"
echo "========================================================"

for model in "${MODELS[@]}"; do
    model_tag="${model//\//__}"
    echo ""
    echo "── Model: ${model} ──────────────────────────────────"
    "${PYTHON}" scripts/plot_persona_performance.py \
        --model   "${model_tag}" \
        --dataset "${DATASET}"
done

echo ""
echo "Done. Plots saved to results/*/humaneval/performance_by_persona.png"
