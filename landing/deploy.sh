#!/usr/bin/env bash
# Assemble the landing bundle from the canonical source files and deploy to
# production (estimate.ctechautomotiveph.com).
# Usage:  bash landing/deploy.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

# Sync the deployable files from the project root into landing/
cp "$ROOT/ctech-landing.html" "$HERE/index.html"
cp "$ROOT/services.html"      "$HERE/services.html"
cp "$ROOT/privacy.html"       "$HERE/privacy.html"
cp "$ROOT/robots.txt"         "$HERE/robots.txt"
cp "$ROOT/sitemap.xml"        "$HERE/sitemap.xml"
cp "$ROOT/ctech-logo.png"     "$HERE/ctech-logo.png"
mkdir -p "$HERE/assets/reviews"
cp "$ROOT/assets/reviews/"*.png "$HERE/assets/reviews/"
cp "$ROOT/assets/"*.jpg "$HERE/assets/" 2>/dev/null || true
cp "$ROOT/assets/"*.png "$HERE/assets/" 2>/dev/null || true
cp "$ROOT/assets/"*.mp4 "$HERE/assets/" 2>/dev/null || true

cd "$HERE"
vercel deploy --prod --yes --scope roberts-projects-f9a860b9
