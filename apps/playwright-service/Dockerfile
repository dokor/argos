FROM mcr.microsoft.com/playwright:v1.63.0-noble
ARG ARGOS_REVISION=unknown
LABEL org.opencontainers.image.revision=$ARGOS_REVISION \
      org.opencontainers.image.source="https://github.com/dokor/argos"

WORKDIR /app

# install deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.mjs app.mjs domain.mjs ./

ENV NODE_ENV=production
ENV PORT=3016

EXPOSE 3016
CMD ["npm", "run", "start"]
