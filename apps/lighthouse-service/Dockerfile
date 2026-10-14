# Le Chromium Debian ARM64 crashait en SIGTRAP avant l'ouverture de DevTools.
# On utilise le même runtime Chromium que le playwright-service, déjà déployé
# sur le Raspberry et adapté aux navigateurs headless en conteneur.
FROM mcr.microsoft.com/playwright:v1.63.0-noble
ARG ARGOS_REVISION=unknown
LABEL org.opencontainers.image.revision=$ARGOS_REVISION \
      org.opencontainers.image.source="https://github.com/dokor/argos"

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.mjs app.mjs collector.mjs policy.mjs browser-policy.mjs evidence.mjs .

# L'image Playwright embarque Chromium dans /ms-playwright. On crée un chemin
# stable afin que chrome-launcher puisse le lancer explicitement.
RUN CHROME_BINARY="$(find /ms-playwright -type f -name chrome -perm -111 | head -n 1)" \
  && test -n "$CHROME_BINARY" \
  && ln -s "$CHROME_BINARY" /usr/local/bin/lighthouse-chromium

ENV NODE_ENV=production
ENV PORT=3017
ENV CHROME_PATH=/usr/local/bin/lighthouse-chromium
RUN (getent group 1001 || groupadd -g 1001 auditor) \
  && (getent passwd 1001 || useradd -u 1001 -g 1001 -m auditor) \
  && mkdir -p /home/auditor && chown 1001:1001 /home/auditor
ENV HOME=/home/auditor
USER 1001:1001

EXPOSE 3017

CMD ["npm", "run", "start"]
