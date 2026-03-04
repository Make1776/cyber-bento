require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { v4: uuidv4 } = require('uuid');
const { extractItemsFromMessage, extractItemsLocally } = require('./api-handler');
const receiptBuilder = require('./receipt-builder');
const orderManager = require('./order-manager');
const orderStorage = require('./order-storage');

// 检查必需的环境变量
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

// ==================== 接单通道 ====================
app.post('/callback', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error("处理消息时出错:", err);
      res.status(500).end();
    });
});

// ==================== 处理事件 ====================
async function handleEvent(event) {
  // 检查消息类型 - 如果是图片、贴图、语音等，拒绝
  if (event.type !== 'message') {
    return Promise.resolve(null);
  }

  const messageType = event.message.type;
  const userId = event.source.userId;

  // 异常输入检查（图片、贴图、语音等）
  if (messageType !== 'text') {
    console.log(`⚠️  非文本消息 [${messageType}] 来自 ${userId}`);
    
    let replyMsg = '申し訳ございません。\n\nお手数ですが、\nお食事のご注文は\nテキストメッセージでお願いいたします。\n\n「生姜焼き弁当 2個」\nなどのようにお願いします。';
    
    if (messageType === 'image') {
      replyMsg = '📷 画像のご送付をいただきましたが、\n当店ではテキストメッセージでの\nご注文承け付けております。\n\nお手数ですが、\nメッセージにてご注文ください。';
    } else if (messageType === 'sticker') {
      replyMsg = '🎨 スタンプのご送付ありがとうございます。\nただし、ご注文はテキストメッセージで\nお願いいたします。';
    } else if (messageType === 'audio') {
      replyMsg = '🎤 ご連絡をいただきましたが、\nお手数ですが\nテキストメッセージでご注文ください。';
    } else if (messageType === 'video') {
      replyMsg = '🎬 ご送付ありがとうございます。\nご注文はテキストメッセージで\nお願いいたします。';
    }

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: replyMsg
    });
    return;
  }

  const userMessage = event.message.text.trim();
  const orderId = uuidv4().substring(0, 8).toUpperCase();

  try {
    console.log(`\n📥 收到消息 [${orderId}]: "${userMessage}" (用户: ${userId})`);

    const status = orderManager.getStatus(userId);

    // ==================== 情形1：用户在确认阶段 ====================
    if (status === 'confirming') {
      if (orderManager.isConfirmationReply(userMessage)) {
        // 用户确认订单！
        const items = orderManager.getOrderItems(userId);
        
        // 生成最终小票
        const receipt = receiptBuilder.generateReceipt(items, orderId);
        
        // 保存订单到文件
        const totalPrice = receiptBuilder.calculateTotal(items).total;
        const orderRecord = {
          orderId,
          userId,
          items: items.map(item => ({
            name: item.name_cn,
            qty: item.qty,
            price: item.price
          })),
          total: totalPrice,
          timestamp: Date.now()
        };
        
        orderStorage.saveOrder(orderRecord);

        // 后厨打印 - 中文高亮提示
        console.log('\x1b[41m\x1b[33m');
        console.log('╔════════════════════════════════════════╗');
        console.log('║         🚨 后厨新订单！🚨              ║');
        console.log('╚════════════════════════════════════════╝');
        console.log(`订单号: ${orderId}`);
        console.log(`用户ID: ${userId}`);
        console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
        console.log('─────────────────────────────────────────');
        for (const item of items) {
          console.log(`  • ${item.name_cn} × ${item.qty}个`);
        }
        console.log('─────────────────────────────────────────');
        console.log(`合计: ¥${totalPrice.toLocaleString('ja-JP')}`);
        console.log('╚════════════════════════════════════════╝');
        console.log('\x1b[0m');

        // 发送小票给用户
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: receipt
        });

        console.log(`✅ 订单已确认并保存 [${orderId}]`);

        // 清空会话
        orderManager.clearSession(userId);
      } else {
        // 用户回复了改单信息
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '恐れ入りますが、\n変更内容がよく理解できません。\n\n「◯◯は不要です」\n「◯◯を追加でお願いします」\nなどのようにお願いいたします。'
        });
      }
      return;
    }

    // ==================== 情形2：正常的新订单或改单 ====================
    console.log('🔍 开始分析用户输入...');

    // 调用API提取菜品
    let result = await extractItemsFromMessage(userMessage);

    // 如果API失败，使用本地匹配
    if (!result.success && result.fallback !== true) {
      console.log('📍 API 提取失败，使用本地菜品匹配...');
      result = extractItemsLocally(userMessage);
    }

    // 处理提取结果
    if (result.status === 'ok' && result.items && result.items.length > 0) {
      // 成功提取菜品
      const items = result.items.map(item => {
        const menuItem = require('./menu.json').items.find(m => m.name === item.name);
        return {
          id: menuItem?.id || item.id,
          name: menuItem?.name || item.name,
          name_cn: menuItem?.name_cn || item.name_cn,
          qty: item.qty || 1,
          price: menuItem?.price || item.price
        };
      });

      // 保存到会话
      orderManager.setOrderItems(userId, items);

      // 生成确认提示（日文）
      const confirmMsg = receiptBuilder.generateConfirmationPrompt(items);
      orderManager.setConfirming(userId, confirmMsg);

      // 发送确认提示给用户
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: confirmMsg
      });

      console.log(`✅ 菜品已识别，等待确认: ${items.map(i => `${i.name_cn}×${i.qty}`).join(', ')}`);

    } else if (result.status === 'not_found') {
      // 菜品未找到
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: result.message || '申し訳ございません。\nメニューに該当する料理が見当たりません。\n\nご確認ください。'
      });
    } else {
      // 其他错误
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: result.message || '申し訳ございません。\nもう一度お願いいたします。'
      });
    }

  } catch (error) {
    console.error(`❌ 处理失败 [${orderId}]:`, error.message);
    
    try {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '申し訳ございません。\nシステム障害が発生いたしました。\n\nお手数ですが、店員にお声がけください。'
      });
    } catch (replyError) {
      console.error("发送错误提示失败:", replyError.message);
    }
  }
}

// ==================== 健康检查 ====================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== 启动服务器 ====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅');
  console.log('🚀 赛博便当店接单系统已上线！');
  console.log(`📍 监听端口: ${PORT}`);
  console.log('📋 菜品识别系统: 已加载');
  console.log('🗂️  订单存储系统: 已启用');
  console.log('✅ 确认流程: 已就位');
  console.log('✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅\n');
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭...');
  process.exit(0);
});
