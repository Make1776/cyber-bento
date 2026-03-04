const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const DB_PATH = path.join(__dirname, 'orders.db');

class OrderDatabase {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  // 初始化数据库
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('❌ 数据库连接失败:', err);
          reject(err);
        } else {
          console.log('✅ 数据库连接成功');
          this.createTableIfNotExists().then(() => {
            this.initialized = true;
            resolve();
          }).catch(reject);
        }
      });
    });
  }

  // 创建订单表（如果不存在）
  async createTableIfNotExists() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          user_line_id TEXT NOT NULL,
          user_message TEXT NOT NULL,
          receipt TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ 表创建失败:', err);
          reject(err);
        } else {
          console.log('✅ 订单表已准备');
          resolve();
        }
      });
    });
  }

  // 保存订单
  async saveOrder(userId, userMessage, receipt, orderId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO orders (id, user_line_id, user_message, receipt, status) 
         VALUES (?, ?, ?, ?, 'pending')`,
        [orderId, userId, userMessage, receipt],
        function(err) {
          if (err) {
            console.error('❌ 订单保存失败:', err);
            reject(err);
          } else {
            console.log(`✅ 订单已保存: ${orderId}`);
            resolve(orderId);
          }
        }
      );
    });
  }

  // 查询所有订单
  async getAllOrders() {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100',
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  // 查询今日订单
  async getTodayOrders() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM orders 
         WHERE DATE(created_at) = DATE('now', 'localtime')
         ORDER BY created_at DESC`,
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  // 获取订单统计
  async getOrderStats() {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN DATE(created_at) = DATE('now', 'localtime') THEN 1 ELSE 0 END) as today_orders
         FROM orders`,
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row || { total_orders: 0, today_orders: 0 });
          }
        }
      );
    });
  }

  // 关闭数据库
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else {
            console.log('✅ 数据库已关闭');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = new OrderDatabase();
