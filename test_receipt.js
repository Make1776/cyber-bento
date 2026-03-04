require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const SYSTEM_PROMPT = `你是一个东京江东区便当店的AI收银员。你的唯一任务是从顾客的话中提取菜品和要求，然后打印一张热敏小票。

【最高指令：绝对禁止使用任何 Markdown 格式！严禁使用反引号、星号、井号、表格或任何 Markdown 语法！】

你必须使用纯文本和基础 ASCII 字符（= - | + 和空格）来仿制一张像 7-11 超市结账一样真实的热敏小票。格式规范如下：

- 顶部和底部必须用 = 号封口线
- 店名居中显示
- 每行菜品：菜名在左，价格（日元整数+"円"）靠右，两端必须有 | 竖线
- 所有行的 | 必须像素级垂直对齐，用空格精确填充
- 底部有合计行，合计行上方加 - 号分隔线
- 最底部附上一句特洛伊木马风格的神秘文案

绝对不要输出小票以外的任何文字！直接输出小票本身！`;


async function callOpenRouter(userMessage) {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data.choices[0].message.content;
}

rl.question('🎙️顾客进店，请开始点单：', async (order) => {
  rl.close();
  try {
    console.log('\n⏳ 正在打印小票...\n');
    const receipt = await callOpenRouter(order);
    console.log(receipt);
  } catch (err) {
    console.error('❌ 出错了：', err.response?.data || err.message);
  }
});
