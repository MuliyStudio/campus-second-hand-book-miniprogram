// cloudfunctions/downloadMaterial/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 下载资料云函数
 * @param {Object} event - 事件对象
 * @param {string} event.fileId - 云文件 ID
 * @param {string} event.orderId - 订单 ID（用于验证购买权限）
 * @param {Object} context - 上下文对象
 * @returns {Object} - 下载结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    const { fileId, orderId } = event
    
    if (!fileId) {
      return {
        success: false,
        message: '缺少文件 ID'
      }
    }
    
    if (!orderId) {
      return {
        success: false,
        message: '缺少订单 ID'
      }
    }
    
    // 验证用户是否有权限下载（检查订单）
    const order = await db.collection('material_orders').where({
      _id: orderId,
      buyerId: openid
    }).get()

    console.log('查询订单结果:', {
      orderId,
      openid,
      count: order.data.length,
      orderData: order.data
    })

    if (order.data.length === 0) {
      return {
        success: false,
        message: '未找到有效订单，无权下载'
      }
    }

    // 检查订单状态（资料订单创建时即为completed，兼容其他状态）
    const orderStatus = order.data[0].status
    if (!['downloaded', 'completed', 'pending_payment', 'pending'].includes(orderStatus)) {
      console.log('订单状态不符合要求:', orderStatus)
      return {
        success: false,
        message: `订单状态为${orderStatus}，无权下载`
      }
    }
    
    // 使用云函数端获取临时 URL（云函数有更高权限）
    const result = await cloud.getTempFileURL({
      fileList: [fileId],
      maxAge: 3600 // 1 小时有效期
    })

    if (result.fileList && result.fileList.length > 0) {
      const file = result.fileList[0]

      if (file.status === 0 && file.tempFileURL) {
        // 更新资料的下载次数
        await db.collection('materials').doc(materialId).update({
          data: {
            downloadCount: db.command.inc(1)
          }
        })

        return {
          success: true,
          message: '获取下载链接成功',
          data: {
            tempFileURL: file.tempFileURL,
            fileId: fileId
          }
        }
      } else {
        console.error('获取临时 URL 失败:', file)
        return {
          success: false,
          message: '获取文件链接失败：' + (file.errMsg || '未知错误')
        }
      }
    } else {
      return {
        success: false,
        message: '未获取到文件链接'
      }
    }
  } catch (error) {
    console.error('下载资料失败:', error)
    return {
      success: false,
      message: '下载失败：' + error.message
    }
  }
}
