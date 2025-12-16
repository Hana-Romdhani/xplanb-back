# ---------- BUILD STAGE ----------
FROM node:18-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# ---------- PRODUCTION STAGE ----------
# ---------- PRODUCTION STAGE ----------
FROM node:18-alpine AS production

ENV NODE_ENV=production
WORKDIR /usr/src/app


RUN apk add --no-cache su-exec

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

COPY entrypoint.sh /usr/src/app/entrypoint.sh
RUN chmod +x /usr/src/app/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/src/app/entrypoint.sh"]
CMD ["node", "dist/main.js"]

