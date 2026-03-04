const axios = require('axios');
const db = require('./database');

const DEFAULT_TIMEOUT = 15000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * 生成系统提示词 - 使用真实菜单
 */
async function getSystemPrompt() {
  const menu = await db.getMenuItems();
  
  let menuText = '【现有菜品】\n';
  for (const item of menu) {
    if (item.stock <= 0) {
      menuText += `- ${item.name}: ${item.price}元【已售罄】\n`;
    } else {
      menuText += `- ${item.name}: ${item.price}元 (库存: ${item.stock})\n`;
    }
  }

  return `你是江东区网上便当店的智能收银员。

${menuText}

重要规则：
1. 只能推荐上述菜品，不能编造菜品
2. 如果顾客点的菜不在菜单里，礼貌拒绝并推荐类似的菜品
3. 如果某菜已售罄，告知顾客该菜已售罄，推荐替代品
4. 生成的小票必须是纯ASCII字符，包含：店名、日期、菜品名、数量、单价、小计、税率、总价、订单号、感谢语
5. 严禁Markdown格式，严禁编造菜品，严禁废话`;
}

/**
 * 调用OpenRouter API生成收据 - 包含菜单验证
 */
async function generateReceipt(userMessage) {
  // 首先检查营业时间
  const isOpen = await db.isBusinessOpen();
  if (!isOpen) {
    const startTime = await db.getSetting('business_hours_start');
    const endTime = await db.getSetting('business_hours_end');
    return `⚠️ 抱歉，本店不在营业时间内\n营业时间: ${startTime} - ${endTime}`;
  }

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 第 ${attempt}/${MAX_RETRIES} 次调用 OpenRouter API...`);

      // 获取包含菜单的系统提示词
      const systemPrompt = await getSystemPrompt();

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://cyber-bento.fly.dev',
            'X-Title': 'Cyber Bento'
          },
          timeout: DEFAULT_TIMEOUT
        }
      );

      const receipt = response.data.choices?.[0]?.message?.content;

      if (!receipt) {
        throw new Error('API响应为空');
      }

      console.log(`✅ API调用成功（第 ${attempt} 次）`);
      return receipt;

    } catch (error) {
      lastError = error;
      const errorMsg = error.response?.status ? 
        `HTTP ${error.response.status}` : 
        error.message;
      
      console.error(`❌ 第 ${attempt} 次失败: ${errorMsg}`);

      if (attempt < MAX_RETRIES) {
        const delayMs = RETRY_DELAY * attempt;
        console.log(`⏳ ${delayMs}ms 后进行第 ${attempt + 1} 次尝试...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // 所有重试都失败
  const fallbackReceipt = await generateFallbackReceipt(userMessage);
  console.warn(`⚠️  API调用全部失败, 使用备用小票`);
  return fallbackReceipt;
}

/**
 * 生成备用小票（当API失败时）
 */
async function generateFallbackReceipt(userMessage) {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN');
  const orderId = `FB${Date.now().toString().slice(-8)}`;
  const shopName = await db.getSetting('shop_name');

  return `
========================
  ${shopName}
========================

时间: ${timeStr}

客户请求: ${userMessage}

由于系统暂时故障，
可能需要人工确认您的订单。

订单号: ${orderId}

感谢您的耐心！
========================`;
}

module.exports = {
  generateReceipt,
  generateFallbackReceipt,
  getSystemPrompt
};
