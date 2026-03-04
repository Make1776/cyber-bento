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

  // 创建所有表（如果不存在）
  async createTableIfNotExists() {
    return new Promise((resolve, reject) => {
      // 创建菜单表
      this.db.run(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          stock INTEGER NOT NULL DEFAULT 999,
          is_available INTEGER DEFAULT 1,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ 菜单表创建失败:', err);
          reject(err);
          return;
        }
        console.log('✅ 菜单表已准备');

        // 创建订单表
        this.db.run(`
          CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            user_line_id TEXT NOT NULL,
            user_message TEXT NOT NULL,
            items TEXT NOT NULL,
            total_price REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            payment_status TEXT DEFAULT 'unpaid',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('❌ 订单表创建失败:', err);
            reject(err);
            return;
          }
          console.log('✅ 订单表已准备');

          // 创建配置表
          this.db.run(`
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) {
              console.error('❌ 配置表创建失败:', err);
              reject(err);
            } else {
              console.log('✅ 配置表已准备');
              this.initializeDefaultSettings().then(resolve).catch(reject);
            }
          });
        });
      });
    });
  }

  // 初始化默认设置
  async initializeDefaultSettings() {
    const defaults = [
      { key: 'business_hours_start', value: '09:00' },
      { key: 'business_hours_end', value: '21:00' },
      { key: 'shop_name', value: '江东区赛博便当店' },
      { key: 'is_open', value: '1' }
    ];

    for (const setting of defaults) {
      await new Promise((resolve, reject) => {
        this.db.run(
          `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
          [setting.key, setting.value],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    console.log('✅ 默认配置已初始化');
  }

  // 保存订单
  async saveOrder(userId, userMessage, items, totalPrice, orderId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO orders (id, user_line_id, user_message, items, total_price, status) 
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [orderId, userId, userMessage, JSON.stringify(items), totalPrice],
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

  // ========== 菜单管理方法 ==========

  // 获取所有菜单项
  async getMenuItems() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM menu_items WHERE is_available = 1 ORDER BY name`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // 获取单个菜单项
  async getMenuItem(name) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM menu_items WHERE name = ? AND is_available = 1`,
        [name],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  // 添加菜单项
  async addMenuItem(id, name, price, stock = 999, description = '') {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO menu_items (id, name, price, stock, description) 
         VALUES (?, ?, ?, ?, ?)`,
        [id, name, price, stock, description],
        (err) => {
          if (err) reject(err);
          else resolve(id);
        }
      );
    });
  }

  // 更新菜单项库存
  async updateMenuStock(name, stock) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE menu_items SET stock = ? WHERE name = ?`,
        [stock, name],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // 减少库存（订单时）
  async decreaseStock(name, quantity) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE menu_items SET stock = stock - ? WHERE name = ?`,
        [quantity, name],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // ========== 设置管理方法 ==========

  // 获取设置值
  async getSetting(key) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT value FROM settings WHERE key = ?`,
        [key],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.value || null);
        }
      );
    });
  }

  // 获取所有设置
  async getAllSettings() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT key, value FROM settings`,
        (err, rows) => {
          if (err) reject(err);
          else {
            const settings = {};
            rows?.forEach(row => {
              settings[row.key] = row.value;
            });
            resolve(settings);
          }
        }
      );
    });
  }

  // 更新设置
  async updateSetting(key, value) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO settings (key, value, updated_at) 
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [key, value],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
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
