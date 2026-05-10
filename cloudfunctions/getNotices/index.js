const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 获取系统通知云函数
exports.main = async (event, context) => {
  const { type = 'all', openid } = event

  console.log('getNotices 云函数收到请求:', event)
  console.log('当前用户 openid:', openid)
  
  if (!openid) {
    return {
      success: false,
      message: '用户 openid 不能为空'
    }
  }

  try {
    // 如果查询未读数量
    if (type === 'unread_count') {
      const countResult = await db.collection('notices')
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

    // 构建查询条件 - 查询当前用户的系统消息
    const whereCondition = {
      _openid: openid
    }

    // 如果指定只查询未读消息，添加 isRead: false 条件
    if (type === 'unread') {
      whereCondition.isRead = false
    }

    // 查询系统消息并按创建时间倒序排序（限制100条）
    const result = await db.collection('notices')
      .where(whereCondition)
      .orderBy('createTime', 'desc')
      .limit(100)
      .get()

    const notices = result.data || []
    
    console.log(`查询到 ${notices.length} 条系统消息`)

    return {
      success: true,
      data: notices
    }

  } catch (error) {
    console.error('获取系统消息失败:', error)
    return {
      success: false,
      message: error.message
    }
  }
}
