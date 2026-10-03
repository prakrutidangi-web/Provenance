# One image runs the whole app: the API, the store, the chat and the dashboard on a single port.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY pixel/package.json pixel/package-lock.json pixel/
COPY server/package.json server/package-lock.json server/
COPY web/package.json web/package-lock.json web/
RUN npm ci --prefix pixel && npm ci --prefix server && npm ci --prefix web
COPY pixel pixel
COPY server server
COPY web web
RUN npm --prefix pixel run build && npm --prefix web run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 TRUST_PROXY=1
COPY --from=build /app/server server
COPY --from=build /app/web/dist web/dist
EXPOSE 10000
CMD ["npm", "--prefix", "server", "start"]
