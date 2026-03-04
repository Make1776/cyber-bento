FROM node:18-alpine

WORKDIR /app

# 安装编译依赖（需要用于编译better-sqlite3）
RUN apk add --no-cache python3 make g++ 

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
