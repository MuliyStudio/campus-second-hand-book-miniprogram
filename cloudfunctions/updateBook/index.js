// cloudfunctions/updateBook/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

/**
 * 编辑二手书云函数
 * @param {Object} event - 事件对象
 * @param {string} event.bookId - 书籍ID
 * @param {Object} event.bookData - 书籍数据
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
    
    if (!event.bookId || !event.bookData) {
      return {
        success: false,
        message: '书籍ID和数据不能为空'
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
        message: '未找到书籍记录或无权限编辑'
      }
    }
    
    // 构建更新数据
    const updateData = {
      ...event.bookData,
      updateTime: new Date()
    }
    
    // 删除可能导致问题的字段
    delete updateData._id
    delete updateData._openid
    delete updateData.createTime
    
    // 更新书籍信息
    const result = await db.collection('books')
      .where({
        _id: event.bookId,
        _openid: openid
      })
      .update({
        data: updateData
      })
    
    if (result.stats.updated === 0) {
      return {
        success: false,
        message: '更新失败，请重试'
      }
    }
    
    // 如果书籍被下架，删除相关的收藏记录
    if (updateData.status && (updateData.status !== 'active' && updateData.status !== 'published')) {
      await db.collection('favorites')
        .where({
          itemId: event.bookId,
          type: 'book'
        })
        .remove()
    }
    
    return {
      success: true,
      message: '编辑成功',
      data: result
    }
  } catch (error) {
    console.error('编辑书籍失败:', error)
    return {
      success: false,
      message: '编辑书籍失败',
      error: error.message
    }
  }
}