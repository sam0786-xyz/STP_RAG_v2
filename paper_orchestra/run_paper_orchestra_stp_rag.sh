#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # paper_orchestra/
REPO_DIR="$(cd "$ROOT_DIR/.." && pwd)"
ORCHESTRA_DIR="$REPO_DIR/tools/paper-orchestra"
MODEL="${OPENROUTER_MODEL:-openai/gpt-6.1-terra}"
PYTHON_BIN="${PAPER_ORCHESTRA_PYTHON:-python3}"
if [[ -x "$ORCHESTRA_DIR/.venv/bin/python" ]]; then
  PYTHON_BIN="$ORCHESTRA_DIR/.venv/bin/python"
fi

if [[ -z "${OPENROUTER_API_KEY:-}" && ! -f "$ORCHESTRA_DIR/.env" ]]; then
  echo "Set OPENROUTER_API_KEY in your shell or tools/paper-orchestra/.env first." >&2
  exit 1
fi

cd "$ORCHESTRA_DIR"
export PYTHONUNBUFFERED=1  # stream progress when the output is redirected to a log
"$PYTHON_BIN" paper_writing_cli.py \
  --raw_materials_dir "$ROOT_DIR/inputs/raw_materials" \
  --latex_template_dir "$ROOT_DIR/inputs/stp_rag_template" \
  --output_dir "$ROOT_DIR/output" \
  --writer_model_name "openrouter/$MODEL" \
  --reflection_model_name "openrouter/$MODEL" \
  --use_plotting false
