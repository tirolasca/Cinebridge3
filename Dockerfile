# --- Etapa de build ---
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --loglevel=error

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Etapa de execução ---
FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --loglevel=error

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "node dist/infrastructure/persistence/seed.js && node dist/infrastructure/http/server.js"]
