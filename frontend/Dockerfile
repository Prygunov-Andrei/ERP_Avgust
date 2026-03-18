FROM node:20-alpine AS builder

WORKDIR /app

# Копируем зависимости
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Копируем исходники
COPY . .

# Переменные для сборки
ENV NEXT_TELEMETRY_DISABLED=1
ENV HVAC_API_URL=http://hvac-backend:8001
ENV BACKEND_API_URL=http://backend:8000

# Service Token для доступа к hvac-backend
# ARG передаётся из docker-compose build args
ARG ERP_SERVICE_TOKEN=""
# Next.js встраивает NEXT_PUBLIC_* при build в JS-бандл
RUN echo "NEXT_PUBLIC_HVAC_SERVICE_TOKEN=${ERP_SERVICE_TOKEN}" > .env.local && cat .env.local

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
