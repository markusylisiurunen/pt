# PT

PT is a small, personal nutrition and training tracker with AI-assisted food logging. It runs as a
Deno API backed by SQLite and a React web app.

## Local development

Requirements: Deno 2 and Node.js 24.

```sh
cp .env.example .env
npm ci --prefix web
npm run build --prefix web
deno task dev
```

Open <http://localhost:8000> and sign in with a configured password. For frontend hot reload, run
`npm run dev --prefix web` and open the Vite URL instead.

With `PASSWORD`, the app stores its SQLite database at `$DATA_FOLDER/data.db`, defaulting to the
repository root. To host multiple isolated users, replace `PASSWORD` with a JSON mapping in `USERS`:

```env
USERS={"markus":"password-one","another-user":"password-two"}
```

Each password signs in as its corresponding user and stores data in `$DATA_FOLDER/<user>.db`. User
names may contain letters, numbers, underscores, and hyphens, and passwords must be unique. To move
an existing installation to `USERS`, rename `data.db` to the chosen user's `<user>.db` before
starting the app.

Anthropic powers chat, while Gemini is used for transcription and as the agent's secondary model.

## Verification

```sh
deno fmt main.ts lib deno.json
deno task check
```

## Docker and releases

```sh
docker build -t pt .
docker run --rm -p 8000:8000 --env-file .env -e DATA_FOLDER=/data -v pt-data:/data pt
```

Pushing a `v*.*.*` tag publishes `ghcr.io/markusylisiurunen/pt:<tag>` and `latest`.
