# ---------- BUILD STAGE ----------
FROM node:18-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# ---------- PRODUCTION STAGE ----------
FROM node:18-alpine AS production
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Copier entrypoint
COPY entrypoint.sh /usr/src/app/entrypoint.sh
RUN chmod +x /usr/src/app/entrypoint.sh

USER node
EXPOSE 3000

ENTRYPOINT ["/usr/src/app/entrypoint.sh"]
CMD ["node", "dist/main.js"]
