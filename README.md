# Lambawasa

## Run with Docker

Docker Compose runs the React application, PHP API, and MySQL database. The schema in `database/schema.sql` initializes a new database; the database is not published to the host.

1. Copy `.env.example` to `.env` and replace both database passwords with different, strong values.
2. Start the application:

   ```sh
   docker compose up --build -d
   ```

3. Open `http://localhost:8080` (or the port set by `APP_PORT` in `.env`).
4. Check the containers with `docker compose ps` and view logs with `docker compose logs -f`.

The database schema is created automatically on the first start, with no sample rows or demo consumer accounts. The schema also includes fields from the existing migrations so a fresh MySQL install is ready for the API. MySQL data is stored in the `mysql-data` Docker volume and survives container restarts and `docker compose down`.

To remove the old sample consumers and their linked demo bills, payments, meters, tickets, map pins, notifications, and ratings from an **existing** database volume, run `database/remove_demo_data.sql` once. Back up the database first. For example, from PowerShell:

```powershell
Get-Content database/remove_demo_data.sql -Raw | docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" waterline_db'
```

The script is also mounted as a MySQL initialization script and runs automatically for a brand-new volume. Docker does not re-run initialization scripts against an existing volume.

## Publish on a server

Install Docker Engine and the Compose plugin on a server, copy or clone this project there, configure `.env` with unique strong passwords, and run `docker compose up --build -d`. Allow inbound traffic to the configured `APP_PORT`. For a public production site, put the web service behind a reverse proxy that provides HTTPS; do not expose the database port or use the example passwords.

Vercel hosts the frontend but does not run this project's PHP API or MySQL database. To keep the frontend on Vercel, first deploy this Docker stack on a public server with HTTPS, then set the Vercel project's `VITE_API_BASE_URL` environment variable to the public API base URL ending in `/api` (for example, `https://api.example.com/api`) and redeploy. The API base URL must be reachable from visitors' browsers. Alternatively, serve the frontend and API together from the Docker deployment.

Set the optional `SIA_SMTP_*` and `SIA_MAIL_FROM` values in `.env` to enable email features. Set `PAYMONGO_SECRET_KEY` to enable PayMongo payments. These integrations remain unconfigured if their values are blank.

To stop the containers without deleting database data, run `docker compose down`. To rebuild after code changes, run `docker compose up --build -d`.

## Local development

The existing Vite/XAMPP development setup remains supported. The PHP database connection defaults to `127.0.0.1:3306` with the `root` user and no password when the Docker environment variables are not set.
