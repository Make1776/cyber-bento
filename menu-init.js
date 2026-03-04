/**
 * 菜单初始化模块
 * 在系统启动时加载默认菜单和配置
 */

const db = require('./database');

// 默认菜单
const DEFAULT_MENU = [
  {
    id: 'item_001',
    name: '生姜烧便当',
    price: 38.00,
    stock: 50,
    description: '猪肉配生姜酱，米饭'
  },
  {
    id: 'item_002',
    name: '炸猪排便当',
    price: 42.00,
    stock: 40,
    description: '炸猪排，配米饭和青菜'
  },
  {
    id: 'item_003',
    name: '玉子烧便当',
    price: 38.00,
    stock: 35,
    description: '日式蛋卷，配米饭'
  },
  {
    id: 'item_004',
    name: '牛肉便当',
    price: 45.00,
    stock: 30,
    description: '新鲜牛肉，配季节青菜'
  },
  {
    id: 'item_005',
    name: '双拼便当',
    price: 48.00,
    stock: 25,
    description: '两种肉类组合，配米饭'
  }
];

// 默认配置
const DEFAULT_SETTINGS = {
  shop_name: '江东区赛博便当店',
  business_hours_start: '09:00',
  business_hours_end: '21:00',
  is_open: '1',
  phone: '090-XXXX-XXXX',
  address: '江东区XXXX'
};

/**
 * 初始化菜单和设置
 */
async function initializeMenuAndSettings() {
  console.log('\n📋 初始化菜单系统...');

  try {
    // 检查菜单是否已存在
    const existingMenu = await db.getMenuItems();
    
    if (existingMenu.length === 0) {
      console.log('🆕 检测到菜单为空，加载默认菜单...');
      
      for (const item of DEFAULT_MENU) {
        await db.addMenuItem(item.id, item.name, item.price, item.stock, item.description);
        console.log(`  ✅ 已添加: ${item.name} (${item.price}元, 库存: ${item.stock})`);
      }
    } else {
      console.log(`📦 菜单已存在 (${existingMenu.length}项菜品)`);
    }

    // 初始化设置
    console.log('⚙️  初始化店铺配置...');
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await db.getSetting(key);
      if (!existing) {
        await db.updateSetting(key, value);
      }
    }

    // 显示当前配置
    const settings = await db.getAllSettings();
    const menu = await db.getMenuItems();
    
    console.log('\n✅ 菜单系统初始化完成！');
    console.log(`   店铺: ${settings.shop_name}`);
    console.log(`   营业时间: ${settings.business_hours_start} - ${settings.business_hours_end}`);
    console.log(`   菜品数量: ${menu.length}种`);
    console.log('');

    return { menu, settings };

  } catch (error) {
    console.error('❌ 菜单初始化失败:', error);
    throw error;
  }
}

/**
 * 生成菜单提示文本
 */
async function generateMenuPrompt() {
  const menu = await db.getMenuItems();
  let prompt = '【可点菜品】\n';
  
  for (const item of menu) {
    const stock = item.stock > 0 ? `(库存: ${item.stock})` : '(已售罄)';
    prompt += `- ${item.name}: ${item.price}元 ${stock}\n`;
  }

  prompt += '\n请根据上述菜单回复客户！';
  return prompt;
}

module.exports = {
  initializeMenuAndSettings,
  generateMenuPrompt,
  DEFAULT_MENU,
  DEFAULT_SETTINGS
};
