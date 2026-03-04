/**
 * 小票生成器 - 后端计算价格，生成ASCII小票
 */

const menu = require('./menu.json');

class ReceiptBuilder {
  /**
   * 计算订单总价（税后）
   * items: [{id, qty, price}]
   */
  calculateTotal(items) {
    const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const tax = Math.floor(subtotal * 0.1); // 10%税
    return {
      subtotal,
      tax,
      total: subtotal + tax
    };
  }

  /**
   * 生成ASCII小票
   * items: [{id, name, name_cn, qty, price}]
   * orderId: 订单号
   */
  generateReceipt(items, orderId, shopName = '江東区赛博便当店') {
    if (!items || items.length === 0) {
      return this.generateErrorReceipt('訂文がありません', orderId, shopName);
    }

    const { subtotal, tax, total } = this.calculateTotal(items);
    const now = new Date();
    const dateStr = now.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

    let receipt = '═══════════════════════════\n';
    receipt += `  ${shopName}\n`;
    receipt += '═══════════════════════════\n\n';
    receipt += `日時: ${dateStr}\n`;
    receipt += '───────────────────────────\n';

    // 订单项目
    for (const item of items) {
      const itemSubtotal = item.qty * item.price;
      receipt += `${item.name}\n`;
      receipt += `  ${item.qty}個 × ¥${item.price.toLocaleString('ja-JP')} = ¥${itemSubtotal.toLocaleString('ja-JP')}\n`;
    }

    receipt += '═══════════════════════════\n';
    receipt += `小計: ¥${subtotal.toLocaleString('ja-JP')}\n`;
    receipt += `税金 (10%): ¥${tax.toLocaleString('ja-JP')}\n`;
    receipt += `合計: ¥${total.toLocaleString('ja-JP')}\n`;
    receipt += '═══════════════════════════\n';
    receipt += `注文番号: ${orderId}\n`;
    receipt += '\nご利用ありがとうございました！\n';
    receipt += '本日のご来店をお待ちしております\n';
    receipt += '═══════════════════════════\n';

    return receipt;
  }

  /**
   * 生成确认前的明细提示（日文）
   * items: [{id, name, qty, price}]
   */
  generateConfirmationPrompt(items) {
    if (!items || items.length === 0) {
      return 'ご注文の内容がございません。\nもう一度お願いいたします。';
    }

    const { subtotal, tax, total } = this.calculateTotal(items);

    let msg = '=== ご注文内容のご確認 ===\n\n';
    for (const item of items) {
      const itemSubtotal = item.qty * item.price;
      msg += `・${item.name} × ${item.qty}個\n  ¥${itemSubtotal.toLocaleString('ja-JP')}\n\n`;
    }

    msg += '─────────────────\n';
    msg += `小計: ¥${subtotal.toLocaleString('ja-JP')}\n`;
    msg += `税金: ¥${tax.toLocaleString('ja-JP')}\n`;
    msg += `合計: ¥${total.toLocaleString('ja-JP')}\n\n`;
    msg += '📍 ご注文内容よろしいですか？\n';
    msg += '「確認」とお返事ください\n\n';
    msg += '変更がございましたら、\n「◯◯は不要です」など\nお気軽にお知らせください。\n';

    return msg;
  }

  /**
   * 生成错误小票（用户消息无效时）
   */
  generateErrorReceipt(reason, orderId, shopName = '江東区赛博便当店') {
    return `失礼いたします。ご注文を確認できませんでした。

理由: ${reason}

注文番号: ${orderId}

恐れ入りますが、店員にお声がけください。`;
  }

  /**
   * 格式化日元价格（日本格式）
   */
  formatPrice(price) {
    return `¥${price.toLocaleString('ja-JP')}`;
  }

  /**
   * 从items数组计算总金额（原始值，未税）
   */
  getTotalAmountInYen(items) {
    return items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  }
}

module.exports = new ReceiptBuilder();
