// 云函数：getMessages - 获取用户消息列表
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  console.log('📨 getMessages 云函数被调用', event)
  
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    if (!openid) {
      return {
        success: false,
        message: '用户未登录',
        data: []
      }
    }
    
    const { 
      type = 'all', // 'all' 或 'unread' 或 'unread_count'
      page = 1,
      pageSize = 20
    } = event
    
    // 构建查询条件
    let query = db.collection('messages')
      .where({
        _openid: openid
      })
    
    // 如果指定只查询未读消息
    if (type === 'unread') {
      query = query.where({
        isRead: false
      })
    }
    
    // 如果查询未读数量
    if (type === 'unread_count') {
      const countResult = await db.collection('messages')
        .where({
          _openid: openid,
          isRead: false
        })
        .count()
      
      return {
        success: true,
        data: {
          unreadCount: countResult.total || 0
        }
      }
    }
    
    // 分页查询
    const skip = (page - 1) * pageSize
    const personalResult = await query
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    // 如果没有找到个人消息，返回一些模拟数据用于测试
    let personalMessages = personalResult.data
    if (personalMessages.length === 0) {
      console.log('📝 未找到个人消息，返回空数组')
      personalMessages = []
    }
    
    return {
      success: true,
      message: '获取消息成功',
      data: personalMessages
    }
    
  } catch (error) {
    console.error('❌ getMessages 云函数执行失败:', error)
    return {
      success: false,
      message: error.message || '获取消息失败',
      data: []
    }
  }
}