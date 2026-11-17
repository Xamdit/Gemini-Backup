#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DIST="$ROOT/dist"
ARCHIVE="$DIST/GeminiConversationBackup.zip"

mkdir -p "$DIST"
rm -f "$ARCHIVE"
cd "$ROOT"
zip -r "$ARCHIVE" manifest.json background.js content.js popup.html popup.js popup.css README.md
printf 'Created %s\n' "$ARCHIVE"