#!/bin/sh
# Renders alertmanager.yml.template -> /etc/alertmanager/alertmanager.yml from
# environment variables, then starts Alertmanager.
# (Alertmanager has no native env substitution in its config file.)
set -eu

TEMPLATE=/etc/alertmanager/alertmanager.yml.template
TARGET=/etc/alertmanager/alertmanager.yml

# Fail fast with a readable message when Telegram is not configured yet:
# Alertmanager's own validation errors on empty values are cryptic.
missing=""
[ -n "${TELEGRAM_BOT_TOKEN:-}" ] || missing="$missing TELEGRAM_BOT_TOKEN"
[ -n "${TELEGRAM_CHAT_ID:-}" ] || missing="$missing TELEGRAM_CHAT_ID"
if [ -n "$missing" ]; then
  echo "ERROR: alertmanager is not configured. Missing environment variables:${missing}" >&2
  echo "ERROR: set them in .env (see .env.examples) and re-create the container:" >&2
  echo "ERROR:   docker compose up -d alertmanager" >&2
  exit 1
fi

# Escape characters that are special in a sed replacement (&, |) plus
# backslashes, so that the token is substituted verbatim.
escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/[&|]/\\&/g'
}

TELEGRAM_BOT_TOKEN_ESC=$(escape "${TELEGRAM_BOT_TOKEN:-}")
TELEGRAM_CHAT_ID_ESC=$(escape "${TELEGRAM_CHAT_ID:-}")

sed \
  -e "s|\$TELEGRAM_BOT_TOKEN|${TELEGRAM_BOT_TOKEN_ESC}|g" \
  -e "s|\$TELEGRAM_CHAT_ID|${TELEGRAM_CHAT_ID_ESC}|g" \
  "$TEMPLATE" > "$TARGET"

exec /bin/alertmanager \
  --config.file="$TARGET" \
  --storage.path=/alertmanager \
  --web.external-url="https://${BASE_DOMAIN:-localhost}/"
