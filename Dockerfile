# build the web app
FROM node:22-alpine AS web
WORKDIR /app
COPY web ./
RUN npm ci && \
    npm run build

# build the deno app
FROM denoland/deno:2.4.0
WORKDIR /app
COPY . .
RUN deno cache main.ts
COPY --from=web /app/dist ./web/dist
RUN printf '#!/bin/sh -eu\n\
export OPENROUTER_TOKEN=$(cat /run/secrets/openrouter_token 2>/dev/null || printf "")\n\
exec "$@"\n' > /entrypoint.sh && chmod +x /entrypoint.sh
CMD ["deno", "serve", "-R", "-W", "main.ts"]
