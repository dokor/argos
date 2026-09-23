ARG CODEX_RUNTIME_IMAGE=ghcr.io/dokor/codex-runtime:0.156.1-r1
FROM ${CODEX_RUNTIME_IMAGE}

RUN mkdir -p /app /workspace /home/node/.codex \
  && chown -R node:node /app /workspace /home/node/.codex

COPY --chown=node:node server.mjs /app/server.mjs

USER node
ENV CODEX_HOME=/home/node/.codex
WORKDIR /workspace

RUN git init -q \
  && git config user.email "argos-codex@localhost" \
  && git config user.name "argos-codex"

EXPOSE 3010

CMD ["node", "/app/server.mjs"]
