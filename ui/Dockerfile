FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_DEVTOOLS_SSE_URL=/api/events
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/relay.mjs ./relay.mjs
COPY --from=build /app/relay ./relay
COPY --from=build /app/package.json ./package.json

EXPOSE 3458
ENV RELAY_PORT=3458
CMD ["node", "relay.mjs", "--dir", "/data/claude-logs"]
