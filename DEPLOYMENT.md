# LINE 便当店机器人 - 部署指南

## 推荐方案：Railway.app（最稳定）

Railway 是目前最稳定且免费额度最大的 Node.js 部署平台，自动处理 HTTPS 和自动重启。

### 部署步骤：

1. **在 Railway.app 创建账户**
   - 访问 https://railway.app
   - 用 GitHub/Google 登录

2. **连接您的项目**
   - 在 Railway 中点击 "Create Project"
   - 选择 "Deploy from GitHub" 
   - 授权并选择此项目仓库
   - 或使用 CLI：`railway link`

3. **配置环境变量**
   - 在 Railway 面板中添加以下变量：
     - `OPENROUTER_API_KEY`: 您的 OpenRouter API 密钥
     - `LINE_CHANNEL_SECRET`: LINE 频道密钥
     - `LINE_CHANNEL_ACCESS_TOKEN`: LINE 访问令牌
     - `PORT`: 3000（可选，会自动设置）

4. **获取部署 URL**
   - Railway 会自动给您一个公开 URL，如：`https://project-production-xxxx.railway.app`
   - 使用此 URL + `/callback` 作为 LINE Webhook URL

5. **配置 LINE Webhook**
   - 在 LINE Manager（https://manager.line.biz）
   - 进入设置 > Response settings
   - Webhook URL 填入：`https://你的-railway-url/callback`
   - 启用 Webhook

---

## 替代方案 1：Render.com

1. 访问 https://render.com
2. 创建新 Web Service
3. 连接 GitHub 仓库
4. 设置环境变量
5. 部署

---

## 替代方案 2：Vercel（改造为 Serverless）

若需要完全无服务函数架构，需要改造代码。

---

## 本地测试（使用 Docker）

```bash
docker build -t line-bot .
docker run -p 3000:3000 --env-file .env line-bot
```

---

## 关键注意事项

✅ **必须做**：
- 将 `.env` 中的敏感信息添加到云平台的环境变量中
- 更新 LINE 的 Webhook URL 指向云端地址

❌ **禁止**：
- 不要提交 `.env` 文件到 GitHub（已在 .gitignore）
- 不要在代码中硬编码密钥

---

## 部署后测试

1. 在 LINE 官方账号中发送消息
2. 检查云平台的日志确认有请求到达
3. 验证 AI 回复是否正常

---

推荐按以下顺序尝试：**Railway** > **Render** > **Heroku 替代品（Fly.io）**
