// cloudfunctions/createMaterialOrder/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 创建资料订单云函数
 * @param {Object} event - 事件对象
 * @param {string} event.materialId - 资料 ID
 * @param {string} event.buyerName - 买家姓名
 * @param {string} event.buyerAvatar - 买家头像
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    const {
      materialId,
      buyerName,
      buyerAvatar
    } = event
    
    if (!materialId) {
      return {
        success: false,
        message: '缺少资料 ID'
      }
    }
    
    // 查询资料详情
    const materialResult = await db.collection('materials').doc(materialId).get()
    if (!materialResult.data) {
      return {
        success: false,
        message: '资料不存在'
      }
    }
    
    const material = materialResult.data

    // 检查资料是否可购买（只检查是否下架）
    // 如果 status 字段存在且为 'offline'，则不可购买
    const materialStatus = material.status
    if (materialStatus === 'offline') {
      return {
        success: false,
        message: '该资料已下架，无法购买'
      }
    }
    
    // 检查用户是否已购买过该资料
    const orderCollection = db.collection('material_orders')
    const existOrder = await orderCollection.where({
      materialId: materialId,
      buyerId: openid,
      status: db.command.in(['pending_payment', 'downloaded', 'completed'])
    }).get()
    
    if (existOrder.data.length > 0) {
      return {
        success: false,
        message: '您已购买过该资料，无需重复购买',
        data: {
          existed: true,
          orderId: existOrder.data[0]._id
        }
      }
    }
    
    // 生成订单 ID
    const orderId = 'M' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_' + Date.now()
    
    // 创建订单数据
    const orderData = {
      _openid: openid,
      orderId: orderId,
      materialId: materialId,
      type: 'material',
      title: material.title,
      price: parseFloat(material.price || 0),
      isFree: material.price === 0 || material.isFree || false,
      status: 'completed', // 购买学习资料后订单直接完成
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
      
      // 买家信息
      buyerId: openid,
      buyerName: buyerName || '用户',
      buyerAvatar: buyerAvatar || '',
      
      // 卖家信息
      sellerId: material._openid,
      sellerName: material.author || material.authorInfo?.nickname || '上传者',
      sellerAvatar: material.authorAvatar || material.authorInfo?.avatarUrl || '',
      sellerCollege: material.college || material.authorInfo?.college || '',
      sellerMajor: material.major || material.authorInfo?.major || '',
      
      // 资料信息
      materialInfo: {
        title: material.title,
        type: material.type || 'PDF',
        fileSize: material.fileSize || '0 KB',
        format: material.format || 'pdf',
        fileId: material.fileId,
        fileUrl: material.fileUrl,
        downloadCount: material.downloadCount || 0,
        isFree: material.price === 0 || material.isFree || false,
        description: material.description
      }
    }
    
    // 插入订单到数据库
    const result = await db.collection('material_orders').add({
      data: orderData
    })
    
    // 如果是免费资料，直接更新状态为已下载
    if (orderData.isFree) {
      await db.collection('materials').doc(materialId).update({
        data: {
          downloadCount: _.inc(1),
          updateTime: db.serverDate()
        }
      })
    }

    // 向卖家发送通知（异步执行，不等待）
    setImmediate(() => {
      sendMaterialPurchaseNotificationToSeller(material, buyerName, orderId, result._id, orderData.isFree).catch(err => {
        console.error('发送购买通知失败:', err)
      })
    })

    return {
      success: true,
      message: orderData.isFree ? '下载成功' : '订单创建成功',
      data: {
        orderId: result._id,
        isFree: orderData.isFree,
        order: orderData
      }
    }
  } catch (error) {
    console.error('创建资料订单失败:', error)
    return {
      success: false,
      message: '创建订单失败',
      error: error.message
    }
  }
}

/**
 * 向卖家发送资料购买通知
 */
async function sendMaterialPurchaseNotificationToSeller(material, buyerName, orderId, orderDbId, isFree) {
  const sellerId = material._openid

  try {
    // 发送通知内容根据是否免费有所区别
    const title = isFree ? '资料免费下载通知' : '资料购买通知'
    const content = isFree
      ? `您上传的《${material.title}》已被买家免费下载。买家：${buyerName}，订单号：${orderId}`
      : `您上传的《${material.title}》已被买家购买，收到付款 ¥${material.price}。买家：${buyerName}，订单号：${orderId}`

    // 1. 发送系统通知到 notices 集合
    await cloud.callFunction({
      name: 'sendSystemMessage',
      data: {
        receiverOpenid: sellerId,
        title: title,
        content: content,
        type: 'order',
        relatedId: orderDbId,
        relatedType: 'material_order'
      }
    })
    console.log('发送系统通知到 notices 成功')

    // 2. 发送聊天消息给卖家
    const chatContent = `您好！${content}`
    await cloud.callFunction({
      name: 'sendChatMessage',
      data: {
        receiverOpenid: sellerId,
        content: chatContent,
        type: 'text'
      }
    })
    console.log('已发送购买聊天消息给卖家')
  } catch (error) {
    console.error('发送购买通知失败:', error)
    throw error
  }
}

