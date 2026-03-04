const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const DB_PATH = path.join(__dirname, 'orders.db');

class OrderDatabase {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  // 初始化数据库
  init() {
    try {
      this.db = new Database(DB_PATH);
      console.log('✅ 数据库连接成功');
      this.createTableIfNotExists();
      this.initialized = true;
      return Promise.resolve();
    } catch (err) {
      console.error('❌ 数据库连接失败:', err);
      return Promise.reject(err);
    }
  }

  // 创建所有表（如果不存在）
  createTableIfNotExists() {
    try {
      // 创建菜单表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          stock INTEGER NOT NULL DEFAULT 999,
          is_available INTEGER DEFAULT 1,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ 菜单表已准备');

      // 创建订单表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          user_line_id TEXT NOT NULL,
          user_message TEXT NOT NULL,
          items TEXT,
          total_price REAL,
          status TEXT DEFAULT 'pending',
          payment_status TEXT DEFAULT 'unpaid',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ 订单表已准备');

      // 创建配置表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ 配置表已准备');

      this.initializeDefaultSettings();
    } catch (err) {
      console.error('❌ 表创建失败:', err);
      throw err;
    }
  }

  // 初始化默认设置
  initializeDefaultSettings() {
    const defaults = [
      { key: 'business_hours_start', value: '09:00' },
      { key: 'business_hours_end', value: '21:00' },
      { key: 'shop_name', value: '江东区赛博便当店' },
      { key: 'is_open', value: '1' }
    ];

    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
    );

    for (const setting of defaults) {
      try {
        stmt.run(setting.key, setting.value);
      } catch (err) {
        // 已存在，忽略
      }
    }
    console.log('✅ 默认配置已初始化');
  }

  // 保存订单
  saveOrder(userId, userMessage, items, totalPrice, orderId) {
    try {
      const stmt = this.db.prepare(
        `INSERT INTO orders (id, user_line_id, user_message, items, total_price, status) 
         VALUES (?, ?, ?, ?, ?, 'pending')`
      );
      stmt.run(orderId, userId, userMessage, items ? JSON.stringify(items) : null, totalPrice);
      console.log(`✅ 订单已保存: ${orderId}`);
      return Promise.resolve(orderId);
    } catch (err) {
      console.error('❌ 订单保存失败:', err);
      return Promise.reject(err);
    }
  }

  // 查询所有订单
  getAllOrders() {
    try {
      const stmt = this.db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100');
      const rows = stmt.all();
      return Promise.resolve(rows || []);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // 查询今日订单
  getTodayOrders() {
    try {
      const stmt = this.db.prepare(
        `SELECT * FROM orders 
         WHERE DATE(created_at) = DATE('now', 'localtime')
         ORDER BY created_at DESC`
      );
      const rows = stmt.all();
      return Promise.resolve(rows || []);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // 获取订单统计
  getOrderStats() {
    try {
      const stmt = this.db.prepare(
        `SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN DATE(created_at) = DATE('now', 'localtime') THEN 1 ELSE 0 END) as today_orders
         FROM orders`
      );
      const row = stmt.get();
      return Promise.resolve(row || { total_orders: 0, today_orders: 0 });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // 关闭数据库
  close() {
    try {
      if (this.db) {
        this.db.close();
        console.log('✅ 数据库已关闭');
      }
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // ========== 菜单管理方法 ==========

  // 获取所有菜单项
  getMenuItems() {
    try {
      const stmt = this.db.prepare(`SELECT * FROM menu_items WHERE is_available = 1 ORDER BY name`);
      return Promise.resolve(stmt.all() || []);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // 获取单个菜单项
  getMenuItem(name) {
    try {
      const stmt = this.db.prepare(`SELECT * FROM menu_items WHERE name = ? AND is_available = 1`);
      const row = stmt.get(name);
      return Promise.resolve(row || null);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // 添加菜单项
  addMenuItem(id, name, price, stock = 999, description = '') {
    try {
      const stmt = this.db.prepare(
        `INSERT INTO menu_items (id, name, price, stock, description) 
         VALUES (?, ?, ?, ?, ?)`
      );
      stmt.run(id, name, price, stock, description);
      return Promise.resolve(id);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // 更新菜单项库存
  updateMenuStock(name, stock) {
    try {
      const stmt = this.db.prepare(`UPDATE menu_items SET stock = ? WHERE name = ?`);
      stmt.run(stock, name);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // 减少库存（订单时）
  decreaseStock(name, quantity) {
    try {
      const stmt = this.db.prepare(`UPDATE menu_items SET stock = stock - ? WHERE name = ?`);
      stmt.run(quantity, name);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // ========== 设置管理方法 ==========

  // 获取设置值
  getSetting(key) {
    try {
      const stmt = this.db.prepare(`SELECT value FROM settings WHERE key = ?`);
      const row = stmt.get(key);
      return Promise.resolve(row?.value || null);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // 获取所有设置
  getAllSettings() {
    try {
      const stmt = this.db.prepare(`SELECT key, value FROM settings`);
      const rows = stmt.all();
      const settings = {};
      rows?.forEach(row => {
        settings[row.key] = row.value;
      });
      return Promise.resolve(settings);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // 更新设置
  updateSetting(key, value) {
    try {
      const stmt = this.db.prepare(
        `INSERT OR REPLACE INTO settings (key, value, updated_at) 
         VALUES (?, ?, CURRENT_TIMESTAMP)`
      );
      stmt.run(key, value);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // 检查营业状态
  async isBusinessOpen() {
    const isOpen = await this.getSetting('is_open');
    if (isOpen === '0') return false;

    const startTime = await this.getSetting('business_hours_start');
    const endTime = await this.getSetting('business_hours_end');
    
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    return currentTime >= startTime && currentTime <= endTime;
  }
}

module.exports = new OrderDatabase();
