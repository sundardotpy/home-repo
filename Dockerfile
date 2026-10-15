FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 8080
CMD ["npm", "run", "dev"]

FROM node:22-alpine AS prod
ENV NODE_ENV=production
ENV APP_ENV=prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY api ./api
COPY lib ./lib
COPY scripts/dev.js ./scripts/dev.js
COPY internal/db/migrations ./internal/db/migrations
COPY internal/web/static ./internal/web/static
RUN mkdir -p /data/uploads && chown -R node:node /app /data/uploads
ENV UPLOAD_DIR=/data/uploads
VOLUME ["/data/uploads"]
USER node
EXPOSE 8080
CMD ["node", "scripts/dev.js"]
