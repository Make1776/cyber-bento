#!/bin/bash

echo "🚀 启动自动 LINE Webhook 修复流程..."

pkill -f "node line_server.js"
pkill -f "ngrok"

sleep 1

echo "🟢 启动 Node 服务..."
node line_server.js &

sleep 2

echo "🌍 启动 ngrok..."
ngrok http 3000 > /dev/null &

sleep 5

NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o 'https://[^"]*ngrok-free.app')

if [ -z "$NGROK_URL" ]; then
  echo "❌ 没获取到 ngrok 地址，请确认 ngrok 已安装"
  exit 1
fi

echo ""
echo "======================================="
echo "✅ 公网地址已生成："
echo "$NGROK_URL/webhook"
echo "======================================="
echo ""
echo "👉 现在去 LINE Developers："
echo "Webhook URL 填入："
echo "$NGROK_URL/webhook"
echo ""
echo "然后点：Update → 打开 Use Webhook → Verify"
