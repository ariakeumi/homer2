#!/bin/sh

set -eu

ASSETS_DIR="${HOMER_CONFIG_ASSETS_DIR:-/www/assets}"
DEFAULT_FILE="${HOMER_CONFIG_DEFAULT_FILE:-config.yml}"
EDITOR_TOKEN="${CONFIG_EDITOR_TOKEN:-}"
REQUEST_FILE="$DEFAULT_FILE"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

send_response() {
  status="$1"
  content_type="$2"
  body="${3:-}"
  template_header="${4:-}"

  printf 'Status: %s\r\n' "$status"
  printf 'Content-Type: %s\r\n' "$content_type"
  printf 'Cache-Control: no-store\r\n'
  if [ -n "$template_header" ]; then
    printf 'X-Homer-Config-Template: %s\r\n' "$template_header"
  fi
  printf '\r\n'
  if [ -n "$body" ]; then
    printf '%s' "$body"
  fi
}

read_query_file() {
  query="${QUERY_STRING:-}"
  old_ifs="$IFS"
  IFS='&'
  set -- $query
  IFS="$old_ifs"

  for pair in "$@"; do
    case "$pair" in
      file=*)
        REQUEST_FILE="${pair#file=}"
        return
        ;;
    esac
  done
}

is_valid_file_name() {
  case "$1" in
    "" | .* | */* | *..* | *%* | *\\* | *" "*)
      return 1
      ;;
    *.yml)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

require_token() {
  if [ -z "$EDITOR_TOKEN" ]; then
    send_response \
      "403 Forbidden" \
      "application/json" \
      "{\"error\":\"$(json_escape "Config editor is disabled on this server. Set CONFIG_EDITOR_TOKEN to enable it.")\"}"
    exit 0
  fi

  if [ "${HTTP_X_HOMER_CONFIG_TOKEN:-}" != "$EDITOR_TOKEN" ]; then
    send_response \
      "401 Unauthorized" \
      "application/json" \
      "{\"error\":\"$(json_escape "Missing or invalid editor token.")\"}"
    exit 0
  fi
}

read_query_file

if ! is_valid_file_name "$REQUEST_FILE"; then
  send_response \
    "400 Bad Request" \
    "application/json" \
    "{\"error\":\"$(json_escape "Only .yml files inside assets/ can be edited.")\"}"
  exit 0
fi

TARGET_FILE="${ASSETS_DIR}/${REQUEST_FILE}"
TEMPLATE_FILE="${TARGET_FILE}.dist"

case "${REQUEST_METHOD:-GET}" in
  GET)
    require_token

    if [ -f "$TARGET_FILE" ]; then
      send_response "200 OK" "text/plain; charset=utf-8" "$(cat "$TARGET_FILE")"
      exit 0
    fi

    if [ -f "$TEMPLATE_FILE" ]; then
      send_response \
        "200 OK" \
        "text/plain; charset=utf-8" \
        "$(cat "$TEMPLATE_FILE")" \
        "1"
      exit 0
    fi

    send_response \
      "404 Not Found" \
      "application/json" \
      "{\"error\":\"$(json_escape "No YAML file or template was found for ${REQUEST_FILE}.")\"}"
    ;;
  PUT)
    require_token

    mkdir -p "$ASSETS_DIR"
    if [ ! -w "$ASSETS_DIR" ]; then
      send_response \
        "500 Internal Server Error" \
        "application/json" \
        "{\"error\":\"$(json_escape "Assets directory is not writable on the server.")\"}"
      exit 0
    fi

    temp_file="$(mktemp "${ASSETS_DIR}/.${REQUEST_FILE}.tmp.XXXXXX")"
    cleanup() {
      rm -f "$temp_file"
    }
    trap cleanup EXIT INT TERM

    cat >"$temp_file"
    chmod 0644 "$temp_file"
    mv "$temp_file" "$TARGET_FILE"
    trap - EXIT INT TERM

    send_response "204 No Content" "text/plain; charset=utf-8"
    ;;
  OPTIONS)
    printf 'Status: 204 No Content\r\n'
    printf 'Allow: GET, PUT, OPTIONS\r\n'
    printf 'Cache-Control: no-store\r\n'
    printf '\r\n'
    ;;
  *)
    send_response \
      "405 Method Not Allowed" \
      "application/json" \
      "{\"error\":\"$(json_escape "Method not allowed.")\"}"
    ;;
esac
