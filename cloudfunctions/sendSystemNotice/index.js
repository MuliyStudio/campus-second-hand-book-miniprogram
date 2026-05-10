// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * 发送系统通知到 notices 集合（不是 messages 集合）
 * @param {Object} event
 * @param {string} event.receiverOpenid - 接收者的 openid
 * @param {string} event.title - 消息标题
 * @param {string} event.content - 消息内容
 * @param {string} event.type - 消息类型：'system' | 'order' | 'publish' | 'delete' | 'report'
 * @param {string} event.relatedId - 关联内容 ID
 * @param {string} event.relatedType - 关联类型：'book_order' | 'material_order' | 'book' | 'material' | 'post'
 * @param {Object} event.fromUser - 发送者信息 { id, nickname, avatarUrl }
 * @param {Object} event.reportInfo - 举报信息
 */
exports.main = async (event, context) => {
  const {
    receiverOpenid,
    title,
    content,
    type = 'system',
    relatedId,
    relatedType,
    fromUser,
    reportInfo
  } = event

  console.log('sendSystemNotice 云函数收到请求:', event)

  if (!receiverOpenid) {
    return {
      success: false,
      message: '接收者 openid 不能为空'
    }
  }

  try {
    // 发送系统通知到 notices 集合（不是 messages 集合）
    const result = await db.collection('notices').add({
      data: {
        _openid: receiverOpenid,
        type: type,
        title: title,
        content: content,
        relatedId: relatedId,
        relatedType: relatedType,
        fromUser: fromUser || {
          id: 'system',
          nickname: '系统',
          avatarUrl: ''
        },
        reportInfo: reportInfo,
        isRead: false,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    console.log('系统通知已发送到 notices 集合, ID:', result._id)

    return {
      success: true,
      data: {
        noticeId: result._id
      }
    }

  } catch (error) {
    console.error('发送系统通知失败:', error)
    return {
      success: false,
      message: error.message || '发送系统通知失败'
    }
  }
}
