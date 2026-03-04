require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { generateReceipt } = require('./api-handler');

// 1. 营业前检查
if (!process.env.LINE_CHANNEL_SECRET || !process.env.LINE_CHANNEL_ACCESS_TOKEN || !process.env.OPENROUTER_API_KEY) {
    console.error("❌ 错误：三把钥匙没有全部找到！系统自动退出。请检查左侧的 .env 文件！");
    process.exit(1);
}

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const app = express();
const client = new line.Client(config);

// 2. 接单通道
app.post('/callback', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error("处理消息时出错:", err);
      res.status(500).end();
    });
});

// 3. AI 大脑逻辑
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return Promise.resolve(null);

  const orderId = uuidv4().substring(0, 8).toUpperCase();
  const userId = event.source.userId;
  const userMessage = event.message.text;

  try {
    console.log(`\n📥 收到订单 [${orderId}]: ${userMessage} (用户: ${userId})`);

    // 调用改进的API处理（含重试）
    const receipt = await generateReceipt(userMessage);

    // 保存订单到数据库
    await db.saveOrder(userId, userMessage, receipt, orderId);

    // 发送回复
    const result = await client.replyMessage(event.replyToken, { 
      type: 'text', 
      text: receipt 
    });

    console.log(`✅ 订单已发送 [${orderId}]`);
    return result;

  } catch (error) {
    console.error(`❌ 订单处理失败 [${orderId}]:`, error.message);
    
    // 失败时发送友好提示
    try {
      await client.replyMessage(event.replyToken, { 
        type: 'text', 
        text: '⚠️ 抱歉，系统暂时故障。请稍后重试或致电商家确认订单。' 
      });
    } catch (replyError) {
      console.error("发送错误提示失败:", replyError.message);
    }
  }
}

// 4. 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 5. 查询订单端点（用于后台）
app.get('/api/orders/today', (req, res) => {
  db.getTodayOrders()
    .then(orders => res.json(orders))
    .catch(err => {
      console.error('查询失败:', err);
      res.status(500).json({ error: err.message });
    });
});

app.get('/api/orders/stats', (req, res) => {
  db.getOrderStats()
    .then(stats => res.json(stats))
    .catch(err => {
      console.error('统计失败:', err);
      res.status(500).json({ error: err.message });
    });
});

// 6. 正式开业
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // 初始化数据库
    await db.init();

    app.listen(PORT, () => {
      console.log('✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅');
      console.log('🚀 赛博后厨已上线，正在监听端口 ' + PORT + '！');
      console.log('📊 订单数据已启用自动保存');
      console.log('🔄 API调用已启用自动重试（最多3次）');
      console.log('✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅');
    });
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭...');
  await db.close();
  process.exit(0);
});

startServer();
