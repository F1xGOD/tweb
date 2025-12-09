#!/usr/bin/env bash

# analyze_text_area.sh
# Count characters in all text files and estimate how much physical area
# they'd occupy on a 15.6" 1920x1080 16:9 display in VS Code.

set -u

#############################################
# CONFIG (tweak if you want)
#############################################

# Physical screen geometry for a 15.6" 16:9 display
#   width  ≈ 13.60" → 0.34535 m
#   height ≈  7.65" → 0.19426 m
#   area   ≈ 0.067088676 m²
SCREEN_AREA_M2="0.0670886760"
SCREEN_WIDTH_M="0.34535"

# Rough estimate of how many characters fit on the screen at once in VS Code
# (fullscreen, your font/zoom at 1920x1080). Adjust these to your setup.
CHARS_PER_LINE=100
LINES_PER_SCREEN=30

#############################################
# INTERNALS
#############################################

if ! command -v file >/dev/null 2>&1; then
  echo "Error: 'file' command not found. Install it and retry." >&2
  exit 1
fi

if ! command -v bc >/dev/null 2>&1; then
  echo "Error: 'bc' command not found. Install it and retry." >&2
  exit 1
fi

progress_bar() {
  local current=$1
  local total=$2
  local width=40

  if [ "$total" -le 0 ]; then
    return
  fi

  local percent=$(( current * 100 / total ))
  local filled=$(( percent * width / 100 ))
  local empty=$(( width - filled ))

  printf "\r["
  if [ "$filled" -gt 0 ]; then
    printf "%0.s#" $(seq 1 "$filled")
  fi
  if [ "$empty" -gt 0 ]; then
    printf "%0.s-" $(seq 1 "$empty")
  fi
  printf "] %3d%% (%d/%d files)" "$percent" "$current" "$total"
}

echo "Scanning files (excluding .git)..."

# Count *all* files first for the progress bar
total_files=$(find . -type f -not -path '*/.git/*' | wc -l | tr -d ' ')
if [ "$total_files" -eq 0 ]; then
  echo "No files found."
  exit 0
fi

total_chars=0
processed=0

# Iterate over all files (NUL-separated for safety)
while IFS= read -r -d '' file; do
  processed=$((processed + 1))

  # Determine if file is binary by checking charset from `file -bi`
  mime=$(file -bi "$file" 2>/dev/null || echo "unknown; charset=binary")
  if echo "$mime" | grep -q 'charset=binary'; then
    # Skip binaries
    progress_bar "$processed" "$total_files"
    continue
  fi

  # Count characters (handles multibyte where possible)
  chars=$(wc -m < "$file" 2>/dev/null || wc -c < "$file" 2>/dev/null || echo 0)
  total_chars=$((total_chars + chars))

  progress_bar "$processed" "$total_files"
done < <(find . -type f -not -path '*/.git/*' -print0)

echo    # newline after progress bar
echo
echo "Total characters in text files: $total_chars"

# Compute physical area per character
chars_per_screen=$((CHARS_PER_LINE * LINES_PER_SCREEN))

if [ "$chars_per_screen" -le 0 ]; then
  echo "Config error: CHARS_PER_LINE * LINES_PER_SCREEN must be > 0" >&2
  exit 1
fi

char_area_m2=$(echo "scale=15; $SCREEN_AREA_M2 / $chars_per_screen" | bc -l)
total_area_m2=$(echo "scale=10; $total_chars * $char_area_m2" | bc -l)
total_area_km2=$(echo "scale=12; $total_area_m2 / 1000000" | bc -l)

echo "Assumptions:"
echo "  Screen area: ${SCREEN_AREA_M2} m² (15.6\" 16:9, 1920x1080)"
echo "  Screen width: ${SCREEN_WIDTH_M} m"
echo "  Text density: ${CHARS_PER_LINE} chars/line × ${LINES_PER_SCREEN} lines/screen"
echo
echo "Approximate real-world text area:"
echo "  ~${total_area_m2} m²"
echo "  ~${total_area_km2} km²"

# ---------------------------------------------------------
# Straight-line length: all characters laid side-by-side
# ---------------------------------------------------------

char_width_m=$(echo "scale=15; $SCREEN_WIDTH_M / $CHARS_PER_LINE" | bc -l)
total_length_m=$(echo "scale=10; $total_chars * $char_width_m" | bc -l)
total_length_km=$(echo "scale=12; $total_length_m / 1000" | bc -l)

echo
echo "If you laid every character in a single straight line:"
echo "  ~${total_length_m} m"
echo "  ~${total_length_km} km"
