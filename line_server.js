require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { generateReceipt } = require('./api-handler');
const { initializeMenuAndSettings } = require('./menu-init');

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

// 重复订单防护（3秒内同一用户的重复请求）
const recentOrders = new Map();

// 清理过期的重复订单记录（每分钟清理一次）
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentOrders.entries()) {
    if (now - timestamp > 180000) { // 3分钟后删除
      recentOrders.delete(key);
    }
  }
}, 60000);

// 2. 接单通道
app.post('/callback', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error("处理消息时出错:", err);
      res.status(500).end();
    });
});

// 3. 处理事件
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const orderId = uuidv4().substring(0, 8).toUpperCase();
  const userId = event.source.userId;
  const userMessage = event.message.text.trim();

  try {
    console.log(`\n📥 收到订单 [${orderId}]: ${userMessage} (用户: ${userId})`);

    // ========== 检查 1: 重复订单防护 ==========
    const duplicateKey = `${userId}_${userMessage}`;
    const lastOrderTime = recentOrders.get(duplicateKey);
    
    if (lastOrderTime && Date.now() - lastOrderTime < 3000) {
      console.log(`⚠️  检测到重复订单 [${orderId}]，已拒绝`);
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '⚠️ 请勿重复点餐！您的订单已在处理中。'
      });
      return;
    }
    recentOrders.set(duplicateKey, Date.now());

    // ========== 检查 2: 营业时间 ==========
    const isOpen = await db.isBusinessOpen();
    if (!isOpen) {
      const startTime = await db.getSetting('business_hours_start');
      const endTime = await db.getSetting('business_hours_end');
      console.log(`❌ 订单 [${orderId}] 不在营业时间内`);
      
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `🕐 抱歉，本店已关闭\n营业时间: ${startTime} - ${endTime}\n请在营业时间内点餐，谢谢！`
      });
      return;
    }

    // ========== 调用 AI 生成收据 ==========
    const receipt = await generateReceipt(userMessage);

    // 保存订单到数据库（初步订单，待确认）
    // 这里可以后续添加确认流程
    try {
      await db.saveOrder(userId, userMessage, null, 0, orderId);
      console.log(`✅ 订单已记录 [${orderId}]`);
    } catch (dbError) {
      console.error(`⚠️  订单保存失败 [${orderId}]:`, dbError.message);
    }

    // 发送收据给用户
    const result = await client.replyMessage(event.replyToken, {
      type: 'text',
      text: receipt
    });

    console.log(`✅ 收据已发送 [${orderId}]`);
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

// 5. API 端点 - 获取菜单
app.get('/api/menu', async (req, res) => {
  try {
    const menu = await db.getMenuItems();
    res.json({ menu });
  } catch (err) {
    console.error('菜单查询失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. API 端点 - 获取今日订单
app.get('/api/orders/today', async (req, res) => {
  try {
    const orders = await db.getTodayOrders();
    res.json({ orders });
  } catch (err) {
    console.error('订单查询失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. API 端点 - 获取统计
app.get('/api/orders/stats', async (req, res) => {
  try {
    const stats = await db.getOrderStats();
    res.json({ stats });
  } catch (err) {
    console.error('统计查询失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. API 端点 - 获取设置
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getAllSettings();
    res.json({ settings });
  } catch (err) {
    console.error('设置查询失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// 9. 启动服务器
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // 初始化数据库
    await db.init();

    // 初始化菜单和配置
    await initializeMenuAndSettings();

    app.listen(PORT, () => {
      console.log('✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅');
      console.log('🚀 赛博后厨已上线，正在监听端口 ' + PORT + '！');
      console.log('📋 已加载菜单系统');
      console.log('🔄 API调用已启用自动重试（最多3次）');
      console.log('⏰ 营业时间控制已启用');
      console.log('🛡️  重复订单防护已启用');
      console.log('✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅\n');
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
