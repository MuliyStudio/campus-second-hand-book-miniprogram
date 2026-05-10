// cloudfunctions/processPayment/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

/**
 * 处理支付云函数
 * @param {Object} event - 事件对象
 * @param {string} event.orderId - 订单 ID
 * @param {string} event.category - 订单分类：book 或 material
 * @param {number} event.amount - 支付金额
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    const orderId = event.orderId
    const category = event.category || 'book'
    const amount = event.amount || 0

    if (!orderId) {
      return {
        success: false,
        message: '订单 ID 不能为空'
      }
    }

    const collectionName = category === 'book' ? 'book_orders' : 'material_orders'
    const orderCollection = db.collection(collectionName)

    const queryResult = await orderCollection.where({
      _id: orderId
    }).get()

    if (queryResult.data.length === 0) {
      return {
        success: false,
        message: '订单不存在'
      }
    }

    const order = queryResult.data[0]

    if (order.buyerId !== openid) {
      return {
        success: false,
        message: '无权操作此订单'
      }
    }

    if (order.status !== 'pending_payment') {
      return {
        success: false,
        message: '订单状态不正确，无法支付'
      }
    }

    const updateData = {
      status: category === 'material' ? 'downloaded' : 'pending_processing',
      statusText: category === 'material' ? '已下载' : '待处理',
      paymentTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    // 资料购买时增加下载量（购买即算一次下载）
    if (category === 'material') {
      updateData.downloadCount = 1
    }

    // 更新订单状态
    await orderCollection.doc(orderId).update({
      data: updateData
    })

    // 异步更新资料下载量（不等待）
    if (category === 'material') {
      setImmediate(async () => {
        try {
          const materialId = order.materialId || (order.materialInfo && order.materialInfo._id)
          if (materialId) {
            await db.collection('materials').doc(materialId).update({
              data: {
                downloadCount: db.command.inc(1),
                updateTime: db.serverDate()
              }
            })
          }
        } catch (updateError) {
          console.error('更新资料下载次数失败:', updateError)
        }
      })
    }

    return {
      success: true,
      message: '支付成功',
      data: {
        orderId: orderId,
        amount: amount,
        newStatus: updateData.status
      }
    }
  } catch (error) {
    console.error('处理支付失败:', error)
    return {
      success: false,
      message: '处理支付失败',
      error: error.message
    }
  }
}



/**
 * 更新资料下载次数
 */
async function updateMaterialDownloadCount(materialId) {
  if (!materialId) return
  
  await db.collection('materials').doc(materialId).update({
    data: {
      downloadCount: db.command.inc(1),
      updateTime: db.serverDate()
    }
  })
}
