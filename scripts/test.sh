#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Frisches, eindeutig benanntes Compose-Projekt; vorhandene Anwendungsdaten bleiben erhalten.
test_project="sysdatiq-test-$(date +%s)-$$"
export APP_PORT="${TEST_APP_PORT:-18080}" MAIL_PORT="${TEST_MAIL_PORT:-18025}"
export APP_BASE_URL="http://localhost:$APP_PORT"
cleanup() { docker compose -p "$test_project" --profile test down -v --remove-orphans; }
trap cleanup EXIT
docker compose -p "$test_project" up -d --build --wait
docker compose -p "$test_project" --profile test run --rm tests
docker compose -p "$test_project" restart api
docker compose -p "$test_project" up -d --wait
docker compose -p "$test_project" --profile test run --rm tests python -c '
from test_api import Client, NEW_PASSWORD
c = Client()
assert c.login("admin@sysdatiq.local", NEW_PASSWORD)[0] == 200
assert any(x["name"] == "Geänderter Testkunde" for x in c.req("/api/customers/")[1])
print("Persistenz nach API-Neustart: OK")
'
