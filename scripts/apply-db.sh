#!/usr/bin/env bash

set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql is not installed. Install PostgreSQL client tools first."
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Error: SUPABASE_DB_URL is not set."
  echo "Example:"
  echo "  export SUPABASE_DB_URL='postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require'"
  exit 1
fi

echo "Applying supabase/schema.sql ..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/schema.sql

echo "Applying supabase/seed.sql ..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql

echo "Done. Database schema and seed data are now up to date."
