const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'orders.db');

class OrderDatabase {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.initialized = false;
  }

  async init() {
    try {
      this.SQL = await initSqlJs();
      
      // try to load existing database
      let fileBuffer = null;
      if (fs.existsSync(DB_PATH)) {
        fileBuffer = fs.readFileSync(DB_PATH);
      }

      if (fileBuffer) {
        this.db = new this.SQL.Database(fileBuffer);
        console.log('✅ 数据库连接成功（加载现有数据）');
      } else {
        this.db = new this.SQL.Database();
        console.log('✅ 数据库连接成功（新建）');
      }

      this.createTableIfNotExists();
      this.saveToFile();
      this.initialized = true;
      return Promise.resolve();
    } catch (err) {
      console.error('❌ 数据库初始化失败:', err);
      return Promise.reject(err);
    }
  }

  createTableIfNotExists() {
    try {
      this.db.run(`CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 999,
        is_available INTEGER DEFAULT 1,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      console.log('✅ 菜单表已准备');

      this.db.run(`CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_line_id TEXT NOT NULL,
        user_message TEXT NOT NULL,
        items TEXT,
        total_price REAL,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'unpaid',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      console.log('✅ 订单表已准备');

      this.db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      console.log('✅ 配置表已准备');

      this.initializeDefaultSettings();
    } catch (err) {
      console.error('❌ 表创建失败:', err);
      throw err;
    }
  }

  initializeDefaultSettings() {
    const defaults = [
      ['business_hours_start', '09:00'],
      ['business_hours_end', '21:00'],
      ['shop_name', '江东区赛博便当店'],
      ['is_open', '1']
    ];

    for (const [key, value] of defaults) {
      try {
        this.db.run(
          `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
          [key, value]
        );
      } catch (err) {
        // 已存在，忽略
      }
    }
    console.log('✅ 默认配置已初始化');
  }

  saveToFile() {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
      console.error('⚠️ 数据库保存失败:', err);
    }
  }

  saveOrder(userId, userMessage, items, totalPrice, orderId) {
    try {
      this.db.run(
        `INSERT INTO orders (id, user_line_id, user_message, items, total_price, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
        [orderId, userId, userMessage, items ? JSON.stringify(items) : null, totalPrice]
      );
      this.saveToFile();
      console.log(`✅ 订单已保存: ${orderId}`);
      return Promise.resolve(orderId);
    } catch (err) {
      console.error('❌ 订单保存失败:', err);
      return Promise.reject(err);
    }
  }

  getTodayOrders() {
    try {
      const result = this.db.exec(`
        SELECT * FROM orders 
        WHERE DATE(created_at) = DATE('now', 'localtime')
        ORDER BY created_at DESC
      `);
      const rows = result.length > 0 ? result[0].values.map(row => {
        const cols = result[0].columns;
        let obj = {};
        cols.forEach((col, idx) => obj[col] = row[idx]);
        return obj;
      }) : [];
      return Promise.resolve(rows);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  getOrderStats() {
    try {
      const result = this.db.exec(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN DATE(created_at) = DATE('now', 'localtime') THEN 1 ELSE 0 END) as today_orders
        FROM orders
      `);
      const row = result.length > 0 && result[0].values.length > 0 ? {
        total_orders: result[0].values[0][0],
        today_orders: result[0].values[0][1]
      } : { total_orders: 0, today_orders: 0 };
      return Promise.resolve(row);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  close() {
    try {
      if (this.db) {
        this.saveToFile();
        this.db.close();
        console.log('✅ 数据库已关闭');
      }
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // 菜单管理
  getMenuItems() {
    try {
      const result = this.db.exec(
        `SELECT * FROM menu_items WHERE is_available = 1 ORDER BY name`
      );
      const rows = result.length > 0 ? result[0].values.map(row => {
        const cols = result[0].columns;
        let obj = {};
        cols.forEach((col, idx) => obj[col] = row[idx]);
        return obj;
      }) : [];
      return Promise.resolve(rows);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  addMenuItem(id, name, price, stock = 999, description = '') {
    try {
      this.db.run(
        `INSERT INTO menu_items (id, name, price, stock, description) VALUES (?, ?, ?, ?, ?)`,
        [id, name, price, stock, description]
      );
      this.saveToFile();
      return Promise.resolve(id);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  updateMenuStock(name, stock) {
    try {
      this.db.run(
        `UPDATE menu_items SET stock = ? WHERE name = ?`,
        [stock, name]
      );
      this.saveToFile();
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // 设置管理
  getSetting(key) {
    try {
      const result = this.db.exec(
        `SELECT value FROM settings WHERE key = ?`,
        [key]
      );
      const value = result.length > 0 && result[0].values.length > 0 ? result[0].values[0][0] : null;
      return Promise.resolve(value);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  getAllSettings() {
    try {
      const result = this.db.exec(`SELECT key, value FROM settings`);
      const settings = {};
      if (result.length > 0) {
        result[0].values.forEach(row => {
          settings[row[0]] = row[1];
        });
      }
      return Promise.resolve(settings);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  updateSetting(key, value) {
    try {
      this.db.run(
        `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [key, value]
      );
      this.saveToFile();
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

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
