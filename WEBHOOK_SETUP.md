# LINE Webhook 配置指南

## 🔴 如果LINE上问"有什么菜"没有回复，99%是这个问题

当前系统服务URL:
```
https://cyber-bento.fly.dev/callback
```

## 配置步骤（一次性）

### 1️⃣ 登入 LINE Manager
- 进入: https://manager.line.biz
- 用您的LINE商业账户登入

### 2️⃣ 选择您的机器人账户
- 左边菜单 → 选择"江东区赛博便当"（或您的账户名）

### 3️⃣ 进入设置页面
- 菜单 → **设置 (Settings)**
- 或者: https://manager.line.biz/account/[YOUR_ACCOUNT_ID]/setting/response

### 4️⃣ 配置 Webhook 设置
找到 **"Response settings"** 或 **"Webhook"** 部分

**输入以下信息:**
```
Webhook URL: https://cyber-bento.fly.dev/callback
```

**勾选启用:**
- ☑️ Use webhook (启用Webhook)

### 5️⃣ 关闭其他回复方式（推荐）
为了避免冲突，关闭这些:
- ☐ Auto response messages (自动回复消息)
- ☐ Greeting messages (问候消息)  
- ☐ Chat (聊天)

**只保留:**
- ☑️ Webhook (只用我们的系统)

### 6️⃣ 保存设置
- 点击 **Save** 或 **更新**

---

## 🧪 测试是否成功配置

### 方法1: 直接测试
1. 在LINE官方账号中发送消息: "有什么菜"
2. 等待4-5秒
3. 应该收到类似这样的回复:

```
【现有菜品】
- 生姜烧便当: 38元 (库存: 50)
- 炸猪排便当: 42元 (库存: 40)
- 玉子烧便当: 38元 (库存: 35)
- 牛肉便当: 45元 (库存: 30)
- 双拼便当: 48元 (库存: 25)
```

### 方法2: 检查 Fly.io 日志
```bash
flyctl logs -a cyber-bento --tail 50
```

看是否有这样的日志:
```
📥 收到订单 [ABC123]: 有什么菜 (用户: Uxxxxxxx)
✅ 收据已发送 [ABC123]
```

如果有，说明消息已接收。
如果没有，说明Webhook URL没配对或配置有问题。

---

## ⚠️ 常见问题

### Q: 我怎么知道自己的 LINE Manager URL?
A: 
1. 进入 https://manager.line.biz
2. 点击左上角选择您的账户
3. 进入账户后，URL会显示: `manager.line.biz/account/123456789/...`

### Q: Webhook URL 总是显示红色 ❌?
A: 这说明LINE无法访问您的URL。检查:
1. 确保 `https://cyber-bento.fly.dev/callback` 能直接访问
2. 使用浏览器测试: https://cyber-bento.fly.dev/health
   - 应该返回 `{"status":"ok"}`

### Q: 配置了还是没反应?
A: 
1. 清除浏览器缓存，重新刷新 LINE Manager
2. 等待2-3分钟（LINE同步可能有延迟）
3. 在LINE中发送 **新的消息**（别重复之前的）
4. 检查日志: `flyctl logs -a cyber-bento`

### Q: Webhook URL 是什么格式?
A: **务必是这个格式:**
```
https://cyber-bento.fly.dev/callback
```

不要加额外的东西，也不要是:
- ❌ http:// (必须用 https)
- ❌ https://cyber-bento.fly.dev (缺少 /callback)
- ❌ https://cyber-bento.fly.dev/callback/ (末尾不要斜杠)

---

## 🔍 诊断步骤

如果配置后还是没有回复，按顺序排查:

### 1️⃣ 检查服务是否运行
```bash
flyctl status -a cyber-bento
```
应该显示: `started` ✅

### 2️⃣ 检查 URL 是否可访问
```bash
curl https://cyber-bento.fly.dev/health
```
应该返回: `{"status":"ok"}`

### 3️⃣ 查看实时日志
```bash
flyctl logs -a cyber-bento --tail 100
```
在LINE发送消息，看日志是否出现 `📥 收到订单`

### 4️⃣ 检查 LINE Manager 配置
- 确认 Webhook URL 显示为 ✅ 绿色
- 确认 "Use webhook" 是勾选状态 ☑️

### 5️⃣ 重启测试
有时候LINE的缓存有问题，试试:
```bash
flyctl restart -a cyber-bento
```

然后在LINE重新发送消息

---

## 📞 最终确认清单

在给我反馈前，请确保：
- [ ] 已登入 LINE Manager
- [ ] 已找到您的机器人账户的设置页面  
- [ ] 已填入 Webhook URL: `https://cyber-bento.fly.dev/callback`
- [ ] 已勾选 "Use webhook"
- [ ] 已保存（点击Save/更新按钮）
- [ ] 等待2-3分钟后重新发送消息
- [ ] 查看了 flyctl logs

如果以上都做了还是没有，请告诉我:
1. LINE Manager 中 Webhook URL 显示的状态（绿色✅ 还是红色❌）
2. `flyctl logs -a cyber-bento` 的输出（是否有 📥 的日志）
3. 您的 LINE 官方账号是否真的是机器人账号（不是个人账号）
