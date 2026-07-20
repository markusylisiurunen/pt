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

Open <http://localhost:8000> and sign in with the configured `PASSWORD`. For frontend hot reload,
run `npm run dev --prefix web` and open the Vite URL instead.

The app stores its SQLite database at `$DATA_FOLDER/data.db`, defaulting to the repository root.
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
