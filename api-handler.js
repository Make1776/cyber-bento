/**
 * API 处理器 - OpenRouter API 调用
 * 仅负责：提取菜品和数量，不生成价格
 */

const axios = require('axios');
const menu = require('./menu.json');

const DEFAULT_TIMEOUT = 15000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * 生成严格的日文System Prompt
 * 仅负责：1) 验证菜品名称  2) 提取数量  3) 拒绝非点单话题
 * 绝不生成价格！价格由后端计算
 */
function getSystemPrompt() {
  const menuItems = menu.items
    .map(item => `- ${item.name} (${item.name_cn})`)
    .join('\n');

  return `あなたは江東区サイバー弁当店の丁寧なお受付スタッフです。

【取り扱い商品】
${menuItems}

【厳格なルール】
1. IMPORTANT: 顧客の入力から「菜品」と「数量」のみを抽出してください
2. ご質問とは関係のない話題（天気、ニュース、雑談など）には、「申し訳ございませんが、ご注文のみのご対応となります」と返答してください
3. メニューにない料理をリクエストされたら、「恐れ入りますが、当店ではお取り扱いがございません。代わりに◯◯をお勧めいたします」と返答してください
4. 数量が不明な場合は、「数量をお教えいただけますでしょうか？」と聞いてください
5. 以下のJSONフォーマットで返答するのみです：
{
  "status": "ok" | "not_found" | "invalid",
  "items": [{"name": "◯◯弁当", "qty": 2}],
  "message": "◯◯個のご注文ですね、かしこまりました"
}

重要：価格計算は一切しないでください。菜品と数量の抽出だけです。`;
}

/**
 * 菜品マッチング - 日本語名またはハイフン記号で菜品を検索
 */
function matchMenuItem(userInput) {
  const input = userInput.toLowerCase();
  
  // 完全一致
  for (const item of menu.items) {
    if (item.name.includes(userInput) || item.name_cn.includes(userInput)) {
      return item;
    }
  }

  // キーワード一致
  if (input.includes('豚') || input.includes('ぶた') || input.includes('生姜') || input.includes('しょうが')) {
    return menu.items[0]; // 生姜焼き弁当
  }
  if (input.includes('カツ') || input.includes('かつ') || input.includes('揚') || input.includes('あげ')) {
    return menu.items[1]; // 豚カツ弁当
  }
  if (input.includes('卵') || input.includes('たまご') || input.includes('玉子') || input.includes('たまご')) {
    return menu.items[2]; // 卵焼き弁当
  }
  if (input.includes('牛')) {
    return menu.items[3]; // 牛肉弁当
  }
  if (input.includes('スペシャル') || input.includes('2種') || input.includes('双拼')) {
    return menu.items[4]; // スペシャル2種弁当
  }

  return null;
}

/**
 * OpenRouter API を呼び出して菜品を抽出
 */
async function extractItemsFromMessage(userMessage) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 第 ${attempt}/${MAX_RETRIES} 次调用 OpenRouter API 来提取菜品...`);

      const systemPrompt = getSystemPrompt();
      
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
          temperature: 0.3, // 低温度以确保一致的提取
          max_tokens: 300
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

      const responseText = response.data.choices?.[0]?.message?.content;

      if (!responseText) {
        throw new Error('API 响应为空');
      }

      console.log(`✅ API 调用成功（第 ${attempt} 次）`);
      
      // 尝试解析 JSON
      try {
        const parsed = JSON.parse(responseText);
        return {
          success: true,
          status: parsed.status,
          items: parsed.items || [],
          message: parsed.message || '了解了'
        };
      } catch (parseErr) {
        return {
          success: false,
          status: 'parse_error',
          items: [],
          message: '申し訳ございません。もう一度ご確認ください。'
        };
      }

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

  // 所有重试都失败 - 返回后备响应
  console.warn('⚠️  API 调用全部失败，将使用本地菜品匹配');
  return {
    success: false,
    status: 'api_error',
    items: [],
    message: '申し訳ございません。ご注文をもう一度お願いいただけますか？',
    fallback: true
  };
}

/**
 * 利用本地菜品匹配作为备用方案（API 失败时）
 */
function extractItemsLocally(userMessage) {
  const words = userMessage.split(/\s+/);
  const items = [];
  let qty = 1;

  for (const word of words) {
    // 检查数字（1-9）
    if (/^\d+$/.test(word) && parseInt(word) <= 9) {
      qty = parseInt(word);
      continue;
    }

    const item = matchMenuItem(word);
    if (item) {
      items.push({
        id: item.id,
        name: item.name,
        name_cn: item.name_cn,
        qty: qty,
        price: item.price
      });
      qty = 1; // 重置数量
    }
  }

  return {
    success: items.length > 0,
    status: items.length > 0 ? 'ok' : 'not_found',
    items: items,
    message: items.length > 0 ? 'かしこまりました' : '申し訳ございません。メニューをご確認ください。',
    fallback: true
  };
}

module.exports = {
  extractItemsFromMessage,
  extractItemsLocally,
  matchMenuItem,
  getSystemPrompt
};
