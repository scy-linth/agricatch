Connecting Supabase (pooler) with pgAdmin4 and how AI/scripts connect

Overview
- This document explains how to connect pgAdmin4 or local tools to your Supabase Postgres (transaction pooler), and how the project's scripts (and the assistant) use `backend/secret.ven` or environment variables to connect.

Important security note
- `backend/secret.ven` contains credentials. Do NOT commit it to public repos.
- Prefer host-managed environment variables (e.g., Render/CI secret store) in production.
- Rotate credentials if they are exposed.

1) How the code chooses connection details
- The app and scripts prefer `DATABASE_URL` when present.
- If `DATABASE_URL` is not set, they use the `DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT`/`DB_NAME` variables.
- For Supabase poolers the code sets `ssl: { rejectUnauthorized: false }` automatically when the host contains `supabase.com`, `supabase.co`, or `pooler.supabase.com`.

2) Connecting with pgAdmin4 (step-by-step)
- Open pgAdmin4.
- Right-click "Servers" -> Create -> Server...
- General tab:
  - Name: AgriCatch-Supabase (any friendly name)
- Connection tab:
  - Host name/address: aws-1-ap-southeast-1.pooler.supabase.com
  - Port: 6543
  - Maintenance DB / Database: postgres
  - Username: postgres.cxqyqffnrmfowwaefbff
  - Password: (use the value from `DB_PASSWORD` or `DATABASE_URL`)
  - Save password: optional
- SSL tab (important):
  - SSL mode: Require
  - If pgAdmin refuses the connection due to certificate verification, set SSL mode to "Require" and enable option to not verify server certificate (pgAdmin UI may present options like "SSL compression/SSL mode"). Using the pooler often requires `sslmode=require` and skipping strict verification.
- Click Save and connect.

3) Using psql (example)
- From your machine (PowerShell):

```powershell
$env:PGPASSWORD='your_db_password'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h aws-1-ap-southeast-1.pooler.supabase.com -p 6543 -U postgres.cxqyqffnrmfowwaefbff -d postgres
# then run SQL, e.g.:
# SELECT id, email, username FROM users ORDER BY id DESC LIMIT 10;
```

4) How the assistant (AI) connects when you ask it to run queries
- The assistant loads `backend/secret.ven` into the process environment (or `backend/.env`) and then uses either:
  - The system `psql` executable (if available) using the env vars, or
  - A Node script using `pg` (`node-postgres`) that constructs a `Client`/`Pool` from `DATABASE_URL` or `DB_*` variables.
- The script `backend/scripts/list_users_cli.js` demonstrates this behaviour.

5) Example Node usage
```bash
# list up to 50 users
node backend/scripts/list_users_cli.js 50
```

6) Troubleshooting
- Connection refused: verify host and port and that your IP is allowed by Supabase (project network rules). If you use a managed pooler, ensure it allows external connections.
- SSL errors: try `sslmode=require` in `DATABASE_URL` or set pgAdmin SSL mode to "Require" and disable strict verify if necessary.
- Authentication errors: confirm `DB_USER` matches the DB user in the connection string; some Supabase project users are project-specific (e.g., `postgres.<ref>`).

7) Clean-up and best practices
- Remove `backend/secret.ven` from the repository and move secrets to platform env variables.
- Add `backend/secret.ven` to `.gitignore`.
- Store long-lived service keys (like `SUPABASE_SERVICE_ROLE_KEY`) in a secure vault and never expose them to client-side code.

If you want, I can:
- Add `backend/.env.example` with placeholders.
- Add `backend/secret.ven` to `.gitignore` and move a sanitized example file into the repo.
- Create a small migration script and run it (with your confirmation).
