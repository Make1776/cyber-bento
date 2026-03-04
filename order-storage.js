/**
 * 订单存储器 - 将订单保存到CSV和JSON文件
 */

const fs = require('fs');
const path = require('path');

const ORDERS_DIR = path.join(__dirname, 'orders');
const ORDERS_CSV = path.join(ORDERS_DIR, 'orders.csv');
const ORDERS_JSON = path.join(ORDERS_DIR, 'orders.json');

class OrderStorage {
  constructor() {
    this.ensureOrdersDir();
  }

  /**
   * 确保 orders 目录存在
   */
  ensureOrdersDir() {
    if (!fs.existsSync(ORDERS_DIR)) {
      fs.mkdirSync(ORDERS_DIR, { recursive: true });
      console.log(`📁 创建订单目录: ${ORDERS_DIR}`);
    }
  }

  /**
   * 保存订单到CSV
   * order: { orderId, userId, items: [{name, qty, price}], total, timestamp }
   */
  saveToCSV(order) {
    const { orderId, userId, items, total, timestamp } = order;
    
    // 构建CSV行
    const itemsStr = items
      .map(item => `"${item.name}×${item.qty}"`)
      .join('|');
    
    const dateTime = new Date(timestamp).toLocaleString('zh-CN');
    const csvLine = `${timestamp},${orderId},${userId},"${itemsStr}",¥${total},${dateTime}\n`;

    // 初始化CSV标头
    if (!fs.existsSync(ORDERS_CSV)) {
      const header = 'Timestamp,OrderID,UserID,Items,Total,DateTime\n';
      fs.writeFileSync(ORDERS_CSV, header, 'utf8');
      console.log(`📄 创建订单CSV: ${ORDERS_CSV}`);
    }

    // 追加订单行
    fs.appendFileSync(ORDERS_CSV, csvLine, 'utf8');
  }

  /**
   * 保存订单到JSON
   * order: { orderId, userId, items: [{name, qty, price}], total, timestamp }
   */
  saveToJSON(order) {
    let orders = [];

    // 读取现有订单
    if (fs.existsSync(ORDERS_JSON)) {
      try {
        const content = fs.readFileSync(ORDERS_JSON, 'utf8');
        orders = JSON.parse(content);
      } catch (err) {
        console.warn('⚠️  读取订单JSON失败，将创建新文件:', err.message);
      }
    }

    // 追加新订单
    orders.push({
      ...order,
      timestamp: new Date(order.timestamp).toISOString()
    });

    // 写入JSON
    fs.writeFileSync(ORDERS_JSON, JSON.stringify(orders, null, 2), 'utf8');
  }

  /**
   * 完整保存订单（同时写入CSV和JSON）
   */
  saveOrder(order) {
    try {
      this.saveToCSV(order);
      this.saveToJSON(order);
      console.log(`✅ 订单已保存到文件: ${order.orderId}`);
      return true;
    } catch (err) {
      console.error(`❌ 订单保存失败: ${err.message}`);
      return false;
    }
  }

  /**
   * 获取所有订单（用于统计）
   */
  getAllOrders() {
    try {
      if (fs.existsSync(ORDERS_JSON)) {
        const content = fs.readFileSync(ORDERS_JSON, 'utf8');
        return JSON.parse(content);
      }
      return [];
    } catch (err) {
      console.warn('⚠️  读取订单失败:', err.message);
      return [];
    }
  }

  /**
   * 获取今日订单
   */
  getTodayOrders() {
    const today = new Date().toDateString();
    const allOrders = this.getAllOrders();
    return allOrders.filter(order => {
      const orderDate = new Date(order.timestamp).toDateString();
      return orderDate === today;
    });
  }

  /**
   * 获取订单数统计
   */
  getStats() {
    const allOrders = this.getAllOrders();
    const todayOrders = this.getTodayOrders();
    const totalRevenue = allOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.total || 0), 0);

    return {
      totalOrders: allOrders.length,
      todayOrders: todayOrders.length,
      totalRevenue,
      todayRevenue
    };
  }
}

module.exports = new OrderStorage();
