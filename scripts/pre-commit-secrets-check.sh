#!/bin/sh
# Pre-commit hook: blocks commits containing common secret patterns.
# Install: cp scripts/pre-commit-secrets-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

STAGED=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED" ]; then
  exit 0
fi

PATTERNS='
AKIA[0-9A-Z]{16}
sk_live_[0-9a-zA-Z]+
pk_live_[0-9a-zA-Z]+
rk_live_[0-9a-zA-Z]+
sk-[a-zA-Z0-9]{20,}
postgres://[^$][^{]
postgresql://[^$][^{]
mongodb://[^$][^{]
mysql://[^$][^{]
Bearer [a-zA-Z0-9+/]{40,}
ghp_[a-zA-Z0-9]{36}
github_pat_[a-zA-Z0-9]{82}
xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+
SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}
'

FOUND=0

for FILE in $STAGED; do
  # Skip binary files and .env.example
  case "$FILE" in
    scripts/pre-commit-secrets-check.sh|*.env.example|*.png|*.jpg|*.jpeg|*.gif|*.ico|*.woff|*.woff2|*.ttf|*.eot) continue ;;
  esac

  while IFS= read -r PATTERN; do
    [ -z "$PATTERN" ] && continue
    MATCH=$(git diff --cached -- "$FILE" | grep "^+" | grep -E "$PATTERN" 2>/dev/null)
    if [ -n "$MATCH" ]; then
      echo "BLOCKED: Potential secret in $FILE matching pattern: $PATTERN"
      FOUND=1
    fi
  done <<EOF
$PATTERNS
EOF
done

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "Commit blocked. Remove secrets and use environment variables instead."
  echo "If this is a false positive, use: git commit --no-verify (use sparingly)"
  exit 1
fi

exit 0
