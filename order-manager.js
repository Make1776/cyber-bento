/**
 * 订单管理器 - 管理用户会话状态和改单逻辑
 */

class OrderManager {
  constructor() {
    // userId => { orderId, items: [{id, name, qty}], status: 'collecting'|'confirming'|'confirmed', timestamp }
    this.sessions = new Map();
    
    // 30分钟无活动自动清理会话
    setInterval(() => {
      const now = Date.now();
      for (const [userId, session] of this.sessions.entries()) {
        if (now - session.timestamp > 30 * 60 * 1000) {
          this.sessions.delete(userId);
          console.log(`🗑️  清理过期会话: ${userId}`);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * 创建或获取用户会话
   */
  getSession(userId) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        orderId: null,
        items: [],
        status: 'new',
        timestamp: Date.now(),
        confirmationMsg: null
      });
    }
    const session = this.sessions.get(userId);
    session.timestamp = Date.now();
    return session;
  }

  /**
   * 更新订单项目（支持改单）
   * 格式: [{id: '001', name: '生姜焼き弁当', name_cn: '生姜烧便当', qty: 2, price: 850}]
   */
  setOrderItems(userId, items) {
    const session = this.getSession(userId);
    session.items = items;
    session.status = 'collecting';
    session.timestamp = Date.now();
  }

  /**
   * 获取用户当前订单项目
   */
  getOrderItems(userId) {
    const session = this.getSession(userId);
    return session.items;
  }

  /**
   * 设置订单为"待确认"状态
   */
  setConfirming(userId, confirmationMsg) {
    const session = this.getSession(userId);
    session.status = 'confirming';
    session.confirmationMsg = confirmationMsg;
  }

  /**
   * 确认订单（标记为"已确认"）
   */
  confirmOrder(userId, orderId) {
    const session = this.getSession(userId);
    session.orderId = orderId;
    session.status = 'confirmed';
  }

  /**
   * 清空用户会话（订单已完成）
   */
  clearSession(userId) {
    this.sessions.delete(userId);
  }

  /**
   * 获取会话状态
   */
  getStatus(userId) {
    const session = this.getSession(userId);
    return session.status;
  }

  /**
   * 判断用户是否在确认阶段
   */
  isConfirming(userId) {
    return this.getStatus(userId) === 'confirming';
  }

  /**
   * 获取确认消息（日文）
   */
  getConfirmationMsg(userId) {
    const session = this.getSession(userId);
    return session.confirmationMsg;
  }

  /**
   * 判断是否确认（用户回复"確認"或"確認です"等）
   */
  isConfirmationReply(text) {
    const confirmPatterns = [
      '確認',
      'かくにん',
      'yes',
      'Yes',
      'はい',
      'ok',
      'OK',
      '了解',
      'わかりました',
      '承知'
    ];
    return confirmPatterns.some(pattern => text.includes(pattern));
  }
}

module.exports = new OrderManager();
