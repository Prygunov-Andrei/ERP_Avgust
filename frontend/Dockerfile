FROM node:20-alpine AS builder

WORKDIR /app

# Копируем зависимости
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Копируем исходники
COPY . .

# Переменные для сборки
ENV NEXT_TELEMETRY_DISABLED=1
ENV BACKEND_API_URL=http://backend:8000

# Сборка
RUN npm run build

# ---- Production ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Копируем standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
