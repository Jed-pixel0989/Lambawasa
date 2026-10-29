# Supabase setup

The schema creates an empty PostgreSQL database. It does not insert demo consumers or sample operational records.

## 1. Create the Supabase database

1. Create a Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Paste and run the complete [`schema_editor.sql`](./schema_editor.sql) as one query. Do not select only part of the script.
4. Confirm that the tables, policies, and `app_state` table were created.

[`schema.sql`](./schema.sql) is the conventional multi-statement PostgreSQL schema. Use it with a SQL client that accepts multiple statements. `schema_editor.sql` wraps its individual statements for SQL editors that report “cannot insert multiple commands into a prepared statement.” Do not use `database/schema.sql` here; that file is for MySQL and Docker.

## 2. Configure the Vercel app

In the Lambawasa Vercel project, add these environment variables for **Production** and **Preview**:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

The frontend also accepts the legacy `VITE_SUPABASE_ANON_KEY` name for the public key. Never put a Supabase service-role/secret key, database password, or other private credential in a `VITE_*` variable or browser code. Redeploy after saving the variables.

## 3. Create the first staff account

1. Create the staff login in Supabase **Authentication** using its email and password.
2. Copy that Auth user's UUID from the user details.
3. In the SQL Editor, create the trusted staff profile. Replace the sample values with the Auth UUID and the staff member's actual information:

```sql
insert into public.users (auth_user_id, username, full_name, email, role, status)
values (
  'AUTH-USER-UUID',
  'staff-username',
  'Staff Name',
  'staff@example.com',
  'Administrator',
  'Active'
);
```

Only a project owner should assign privileged roles. The app verifies the profile linked to the signed-in Auth UUID; it does not infer a role from the email or username.

## 4. Sign in and verify synchronization

Sign in to the Vercel app as the staff user. On first use, the app creates the shared `app_state` row from the device's existing saved operational data. Once that row exists, it is the shared source of truth for staff devices. Staff edits are saved to Supabase, broadcast through Realtime, and checked periodically as a fallback. The state payload excludes password, secret, and token fields and removes the known demo records.

If two devices edit while disconnected or at the same time, the app reports a conflict instead of silently overwriting the newer server data. Keep a copy of important unsynced work before resolving a conflict.

Household registration creates a Supabase Auth account and a pending household profile. If email confirmation is enabled in Supabase, the user must confirm the email first; staff must approve the registration before the account can sign in.

## Access and current scope

Row Level Security protects the shared `app_state` row so only signed-in staff with an active `public.users` profile can read or update the staff-wide dataset. Household accounts cannot read the complete staff state, which contains other consumers' information. Household profile, meter, and map-registration records are stored in their Supabase tables.

The app's staff operational data is synchronized as one JSONB state row; this integration does not migrate all existing billing, payment-gateway, and consumer-portal workflows to normalized Supabase tables. Do not treat the shared row as a replacement for a complete normalized data migration.
