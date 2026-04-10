#!/usr/bin/env bash
# Deploy the project page to GitHub Pages.
# Run from repo root:  bash web/deploy.sh
# Or from web/:        bash deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Deploying to gh-pages branch..."
npm run deploy

echo "Done — site live at https://shivam-raval96.github.io/model-org-codegen/"
