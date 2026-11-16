# PT

PT is a small, personal nutrition and training tracker with AI-assisted food logging. It runs as a Deno API backed by SQLite and a React web app.

## Local development

Requirements: Deno 2.9.8 or later and Node.js 24.

```sh
cp .env.example .env
npm ci --prefix web
npm run build --prefix web
deno task dev
```

Open <http://localhost:8000> and sign in with a configured password. For frontend hot reload, run `npm run dev --prefix web` and open the Vite URL instead.

With `PASSWORD`, the app stores its SQLite database at `$DATA_FOLDER/data.db`, defaulting to the repository root. To host multiple isolated users, replace `PASSWORD` with a JSON mapping in `USERS`:

```env
USERS={"markus":"password-one","another-user":"password-two"}
```

Each password signs in as its corresponding user and stores data in `$DATA_FOLDER/<user>.db`. User names may contain letters, numbers, underscores, and hyphens, and must be unique regardless of case. Passwords must be non-empty, unique, and valid in an HTTP header. To move an existing installation to `USERS`, rename `data.db` to the chosen user's `<user>.db` before starting the app.

The agent runs on Sonnet 5.5 and needs `ANTHROPIC_API_KEY`. It reads your data with SQLite queries and does calculations in Python, and both tools run in separate Deno processes with restricted permissions and a time limit. `GEMINI_API_KEY` is needed only for audio transcription.

## Verification

```sh
deno task format
deno task check
```

## Docker and releases

```sh
docker build -t pt .
docker run --rm -p 8000:8000 --env-file .env -e DATA_FOLDER=/data -v pt-data:/data pt
```

Pushing a `v*.*.*` tag publishes `ghcr.io/markusylisiurunen/pt:<tag>` and `latest`.
