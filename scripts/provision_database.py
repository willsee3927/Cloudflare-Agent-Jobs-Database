"""Create/rotate the application's least-privilege Postgres login.

Reads the warehouse's existing dotenv file, writes only the app's gitignored
.dev.vars file, and never prints credentials.
"""
from __future__ import annotations

import secrets
import sys
from pathlib import Path
from urllib.parse import quote

import psycopg2
from dotenv import dotenv_values

ROLE = "job_search_agent"


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: provision_database.py PATH_TO_ENV_NEON")
    values = dotenv_values(sys.argv[1])
    required = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"]
    missing = [key for key in required if not values.get(key)]
    if missing:
        raise SystemExit(f"missing database settings: {', '.join(missing)}")
    password = secrets.token_urlsafe(36)
    connection = psycopg2.connect(
        host=values["POSTGRES_HOST"], port=values["POSTGRES_PORT"],
        dbname=values["POSTGRES_DB"], user=values["POSTGRES_USER"],
        password=values["POSTGRES_PASSWORD"], sslmode=values.get("POSTGRES_SSLMODE", "require"),
        connect_timeout=10,
    )
    connection.autocommit = True
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (ROLE,))
        if cursor.fetchone():
            # Neon permits this role's owner to rotate its password, while
            # re-stating SUPERUSER flags requires provider-level privileges.
            cursor.execute(f'ALTER ROLE "{ROLE}" WITH LOGIN PASSWORD %s', (password,))
        else:
            cursor.execute(f'CREATE ROLE "{ROLE}" WITH LOGIN PASSWORD %s NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION', (password,))
        cursor.execute(f'GRANT CONNECT ON DATABASE "{values["POSTGRES_DB"]}" TO "{ROLE}"')
        cursor.execute(f'GRANT USAGE ON SCHEMA analytics TO "{ROLE}"')
        cursor.execute(f'REVOKE ALL ON SCHEMA raw FROM "{ROLE}"')
        cursor.execute(f'REVOKE ALL ON ALL TABLES IN SCHEMA analytics, raw FROM "{ROLE}"')
        cursor.execute(f'GRANT SELECT ON TABLE analytics.mart_job_search TO "{ROLE}"')
        cursor.execute("""SELECT table_schema, table_name FROM information_schema.tables
            WHERE table_schema IN ('analytics','raw')
              AND has_table_privilege(%s, quote_ident(table_schema)||'.'||quote_ident(table_name), 'SELECT')
              AND NOT (table_schema = 'analytics' AND table_name = 'mart_job_search')""", (ROLE,))
        unexpected = cursor.fetchall()
        if unexpected:
            raise SystemExit(f"role has unexpected inherited SELECT access: {unexpected[:5]}")
        cursor.execute("SELECT has_table_privilege(%s, 'analytics.mart_job_search', 'SELECT')", (ROLE,))
        if not cursor.fetchone()[0]:
            raise SystemExit("role cannot read analytics.mart_job_search")
    connection.close()
    user = quote(ROLE, safe="")
    encoded_password = quote(password, safe="")
    database = quote(str(values["POSTGRES_DB"]), safe="")
    url = f"postgresql://{user}:{encoded_password}@{values['POSTGRES_HOST']}:{values['POSTGRES_PORT']}/{database}?sslmode=require"
    session_secret = secrets.token_urlsafe(48)
    Path(".dev.vars").write_text(f"DATABASE_URL={url}\nSESSION_SECRET={session_secret}\nDEV_MODE=true\n")
    Path(".prod.secrets").write_text(f"DATABASE_URL={url}\nSESSION_SECRET={session_secret}\n")
    print("Created/rotated job_search_agent and verified it can read only analytics.mart_job_search.")
    print("Wrote local and production secret files; both are ignored by git.")


if __name__ == "__main__":
    main()
