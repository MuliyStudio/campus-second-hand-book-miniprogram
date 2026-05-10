// cloudfunctions/deleteBook/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

/**
 * 删除二手书云函数
 * @param {Object} event - 事件对象
 * @param {string} event.bookId - 书籍ID
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    if (!openid) {
      return {
        success: false,
        message: '获取用户openid失败'
      }
    }
    
    if (!event.bookId) {
      return {
        success: false,
        message: '书籍ID不能为空'
      }
    }
    
    // 检查书籍是否存在且属于当前用户
    const book = await db.collection('books')
      .where({
        _id: event.bookId,
        _openid: openid
      })
      .get()
    
    if (book.data.length === 0) {
      return {
        success: false,
        message: '未找到书籍记录或无权限删除'
      }
    }
    
    // 删除书籍
    const result = await db.collection('books')
      .where({
        _id: event.bookId,
        _openid: openid
      })
      .remove()
    
    if (result.stats.removed === 0) {
      return {
        success: false,
        message: '删除失败，请重试'
      }
    }
    
    // 先获取所有收藏该书的用户
    const favorites = await db.collection('favorites')
      .where({
        itemId: event.bookId,
        type: 'book'
      })
      .get();
    
    // 删除相关的收藏记录
    await db.collection('favorites')
      .where({
        itemId: event.bookId,
        type: 'book'
      })
      .remove();
    
    // 如果有收藏记录，更新相关用户的收藏计数
    if (favorites.data.length > 0) {
      // 对每个用户减少收藏计数
      for (const favorite of favorites.data) {
        await db.collection('users').doc(favorite._openid).update({
          data: {
            favoritesCount: db.command.inc(-1)
          }
        });
      }
    }
    
    // 创建删除成功的系统通知到 notices
    try {
      await db.collection('notices').add({
        data: {
          _openid: openid,
          type: 'system',
          title: '删除成功',
          content: `您的书籍已成功删除`,
          relatedId: event.bookId,
          relatedType: 'book',
          isRead: false,
          createTime: new Date(),
          updateTime: new Date()
        }
      });
    } catch (error) {
      console.error('创建系统通知失败:', error);
      // 继续执行，不影响书籍删除
    }
    
    return {
      success: true,
      message: '删除成功',
      data: result
    }
  } catch (error) {
    console.error('删除书籍失败:', error)
    return {
      success: false,
      message: '删除书籍失败',
      error: error.message
    }
  }
}