require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

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

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: '你是一个江东区便当店收银员。只输出纯ASCII字符小票，严禁Markdown，严禁废话。' },
        { role: 'user', content: event.message.text }
      ]
    }, {
      headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
    });

    const receipt = response.data.choices[0].message.content;
    return client.replyMessage(event.replyToken, { type: 'text', text: receipt });
  } catch (error) {
    console.error("AI 报错:", error.message);
  }
}

// 4. 正式开业
app.listen(3000, () => {
    console.log('✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅');
    console.log('🚀 赛博后厨已上线，正在监听 3000 端口！');
    console.log('⚠️ 请千万不要关闭这个黑窗口！');
    console.log('⚠️ 只要这里不跳出 (base) dayu@... 就说明成功了！');
    console.log('✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅');
});