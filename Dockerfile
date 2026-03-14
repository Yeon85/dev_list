# 데모 서비스 관리(iwinv) - 도커 이미지
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci 2>/dev/null || npm install

COPY . .
RUN chown -R node:node /app

USER node
EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "server.js"]
