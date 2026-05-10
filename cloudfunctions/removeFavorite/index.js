// cloudfunctions/removeFavorite/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 移除收藏云函数
 * @param {Object} event - 事件对象
 * @param {string} event.itemId - 收藏项ID
 * @param {string} event.type - 收藏类型 (material, post, book)
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - removeFavorite ===');
    
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const env = wxContext.ENV
    
    console.log('环境信息:', { openid, env });
    console.log('事件参数:', event);
    
    if (!openid) {
      console.error('获取用户openid失败');
      return {
        success: false,
        message: '获取用户openid失败'
      }
    }
    
    if (!event.itemId || !event.type) {
      console.error('收藏项ID和类型不能为空:', { itemId: event.itemId, type: event.type });
      return {
        success: false,
        message: '收藏项ID和类型不能为空'
      }
    }
    
    try {
      // 移除收藏记录
      console.log('开始移除收藏记录...');
      const result = await db.collection('favorites')
        .where({
          _openid: openid,
          itemId: event.itemId,
          type: event.type
        })
        .remove()
      
      console.log('移除收藏结果:', result);
      
      if (result.stats.removed === 0) {
        console.log('未找到收藏记录:', { openid, itemId: event.itemId, type: event.type });
        return {
          success: false,
          message: '未找到收藏记录'
        }
      }
      
      // 更新对应类型的收藏数
      if (event.type === 'post') {
        await db.collection('posts').doc(event.itemId).update({
          data: {
            favoritesCount: _.inc(-1)
          }
        })
      } else if (event.type === 'material') {
        await db.collection('materials').doc(event.itemId).update({
          data: {
            favoritesCount: _.inc(-1)
          }
        })
      } else if (event.type === 'book') {
        await db.collection('books').doc(event.itemId).update({
          data: {
            favoritesCount: _.inc(-1)
          }
        })
      }
      
      // 更新用户信息中的收藏计数
      await db.collection('users').doc(openid).update({
        data: {
          favoritesCount: _.inc(-1)
        }
      })
      
      return {
        success: true,
        message: '取消收藏成功',
        data: result
      }
    } catch (dbError) {
      console.error('数据库操作失败:', dbError);
      console.error('数据库错误堆栈:', dbError.stack);
      
      // 尝试创建集合（如果不存在）
      try {
        console.log('尝试创建favorites集合...');
        await db.createCollection('favorites');
        console.log('集合创建成功');
        return {
          success: false,
          message: '未找到收藏记录'
        };
      } catch (createError) {
        console.error('创建集合失败:', createError);
        return {
          success: false,
          message: '移除收藏失败',
          error: createError.message
        };
      }
    }
  } catch (error) {
    console.error('移除收藏失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '移除收藏失败',
      error: error.message
    }
  } finally {
    console.log('=== 云函数调用结束 - removeFavorite ===');
  }
}