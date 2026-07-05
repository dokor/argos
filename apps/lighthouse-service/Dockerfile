# Le Chromium Debian ARM64 crashait en SIGTRAP avant l'ouverture de DevTools.
# On utilise le même runtime Chromium que le playwright-service, déjà déployé
# sur le Raspberry et adapté aux navigateurs headless en conteneur.
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.mjs .

# L'image Playwright embarque Chromium dans /ms-playwright. On crée un chemin
# stable afin que chrome-launcher puisse le lancer explicitement.
RUN CHROME_BINARY="$(find /ms-playwright -type f -name chrome -perm -111 | head -n 1)" \
  && test -n "$CHROME_BINARY" \
  && ln -s "$CHROME_BINARY" /usr/local/bin/lighthouse-chromium

ENV NODE_ENV=production
ENV PORT=3017
ENV CHROME_PATH=/usr/local/bin/lighthouse-chromium

EXPOSE 3017

CMD ["npm", "run", "start"]