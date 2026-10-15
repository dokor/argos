FROM mcr.microsoft.com/playwright:v1.63.0-noble
ARG ARGOS_REVISION=unknown
LABEL org.opencontainers.image.revision=$ARGOS_REVISION \
      org.opencontainers.image.source="https://github.com/dokor/argos"

WORKDIR /app

# install deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.mjs app.mjs domain.mjs policy.mjs browser-policy.mjs evidence.mjs ./
RUN (getent group 1001 || groupadd -g 1001 auditor) \
  && (getent passwd 1001 || useradd -u 1001 -g 1001 -m auditor) \
  && mkdir -p /home/auditor && chown 1001:1001 /home/auditor
ENV HOME=/home/auditor
USER 1001:1001

ENV NODE_ENV=production
ENV PORT=3016

EXPOSE 3016
CMD ["npm", "run", "start"]
