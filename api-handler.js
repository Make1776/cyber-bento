const axios = require('axios');

const DEFAULT_TIMEOUT = 15000; // 15秒超时
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒重试延迟

/**
 * 调用OpenRouter API生成收据
 * 包含自动重试和超时保护
 */
async function generateReceipt(userMessage) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 第 ${attempt}/${MAX_RETRIES} 次调用 OpenRouter API...`);

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            {
              role: 'system',
              content: '你是一个江东区便当店收银员。只输出纯ASCII字符小票，严禁Markdown，严禁废话。小票应该包含：店名、日期时间、商品名、数量、单价、小计、税率、总价、感谢语、订单号。'
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
        `HTTP ${error.response.status} - ${error.message}` : 
        error.message;
      
      console.error(`❌ 第 ${attempt} 次失败: ${errorMsg}`);

      // 如果是最后一次尝试，不再延迟
      if (attempt < MAX_RETRIES) {
        const delayMs = RETRY_DELAY * attempt; // 延迟递增：1s -> 2s -> 3s
        console.log(`⏳ ${delayMs}ms 后进行第 ${attempt + 1} 次尝试...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // 所有重试都失败
  const fallbackReceipt = generateFallbackReceipt(userMessage);
  console.warn(`⚠️  API调用全部失败 (${lastError?.message}), 使用备用小票`);
  return fallbackReceipt;
}

/**
 * 生成备用小票（当API失败时使用）
 */
function generateFallbackReceipt(userMessage) {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN');
  const orderId = `FB${Date.now().toString().slice(-8)}`;

  return `
========================
  江东区便当店（自动模式）
========================

时间: ${timeStr}

顾客订单: ${userMessage}

由于系统暂时故障，可能需要
人工确认您的订单。

订单号: ${orderId}

感谢您的耐心！

========================
`;
}

module.exports = {
  generateReceipt,
  generateFallbackReceipt
};
