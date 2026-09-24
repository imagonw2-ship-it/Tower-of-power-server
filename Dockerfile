FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir -p /data && chown node:node /data
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
COPY --chown=node:node public ./public
USER node
ENV PORT=8080 DATABASE_PATH=/data/accounts.sqlite
EXPOSE 8080
CMD ["node", "server/server.js"]
