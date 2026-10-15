#!/usr/bin/env bash
# Fails if site/ references a file that doesn't exist: src/href attributes and
# url(...) in HTML and CSS, and "assets/..." paths in the JavaScript gallery list.
set -euo pipefail
cd "$(dirname "$0")/../site"

refs=$(
  {
    grep -ohE '(src|href)="[^"#?:]+"' -- *.html | cut -d'"' -f2
    grep -ohE "url\\(['\"]?[^)'\"#?:]+['\"]?\\)" -- *.css | sed -E "s/^url\\(['\"]?//; s/['\"]?\\)$//"
    grep -ohE '"assets/[^"]+"' -- *.js *.json | tr -d '"'
  } | sort -u
)

missing=0
for ref in $refs; do
  [ -z "${ref#/}" ] && continue # "/" is the start page
  if [ ! -e "${ref#/}" ]; then
    echo "::error::site/ references a missing file: ${ref}"
    missing=1
  fi
done
[ "$missing" = 0 ] && echo "All $(echo "$refs" | wc -l) referenced files exist."
exit "$missing"
