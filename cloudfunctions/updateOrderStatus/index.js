// cloudfunctions/updateOrderStatus/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

/**
 * 更新订单状态云函数
 * @param {Object} event - 事件对象
 * @param {string} event.orderId - 订单 ID
 * @param {string} event.category - 订单分类：book 或 material
 * @param {string} event.status - 新状态
 * @param {Object} event.extraData - 额外数据（可选）
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    const orderId = event.orderId
    const category = event.category || 'book'
    const status = event.status
    const extraData = event.extraData || {}
    
    if (!orderId || !status) {
      return {
        success: false,
        message: '订单 ID 和状态不能为空'
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
    
    if (order.buyerId !== openid && order.sellerId !== openid) {
      return {
        success: false,
        message: '无权操作此订单'
      }
    }

    // 取消订单逻辑：在待处理状态买卖双方都能取消，处理中状态只有买家可以取消（且卖家未处理时）
    if (status === 'cancelled') {
      if (order.status === 'processing') {
        // 处理中状态，只有买家可以取消
        if (openid !== order.buyerId) {
          return {
            success: false,
            message: '订单处理中，卖家无法取消'
          }
        }
        // 如果卖家已处理，买家也不能取消
        if (order.sellerProcessed) {
          return {
            success: false,
            message: '卖家已处理订单，买家无法取消'
          }
        }
        if (order.sellerProcessed && order.buyerProcessed) {
          return {
            success: false,
            message: '双方都已处理，无法取消订单'
          }
        }
      }
      // 待处理状态，买卖双方都可以取消
    }

    const updateData = {
      status: status,
      updateTime: db.serverDate()
    }

    // 处理"已完成"状态：需要买卖家双方都点击"已处理"
    if (status === 'completed') {
      if (openid === order.buyerId) {
        // 买家点击完成，标记买家已处理
        updateData.buyerProcessed = true
        updateData.buyerProcessedTime = db.serverDate()
      } else if (openid === order.sellerId) {
        // 卖家点击完成，标记卖家已处理
        updateData.sellerProcessed = true
        updateData.sellerProcessedTime = db.serverDate()
      }

      // 检查是否双方都已处理
      const bothProcessed = (updateData.buyerProcessed || order.buyerProcessed) &&
                           (updateData.sellerProcessed || order.sellerProcessed)

      // 如果只有一方处理，状态改为"处理中"
      if (!bothProcessed) {
        updateData.status = 'processing'
      }
      // 如果双方都处理了，保持"已完成"状态
    }

    if (extraData && Object.keys(extraData).length > 0) {
      Object.assign(updateData, extraData)
    }

    await orderCollection.doc(orderId).update({
      data: updateData
    })

    // 并行执行非关键操作，不等待完成
    if (status === 'completed') {
      // 更新书籍状态和删除收藏记录
      updateBookOrMaterialStatus(order, category).catch(updateError => {
        console.error('更新商品状态失败:', updateError)
      })

      deleteFavoriteAfterOrderCompleted(order, category).catch(deleteError => {
        console.error('删除收藏记录失败:', deleteError)
      })
    } else if (status === 'cancelled') {
      // 更新书籍状态为在售
      updateBookStatusToAvailable(order, category).catch(updateError => {
        console.error('更新商品状态失败:', updateError)
      })
    }

    // 发送通知
    if (status === 'completed' || status === 'pending_payment' || status === 'cancelled') {
      createNotification(order, status, openid).catch(notifyError => {
        console.error('发送通知失败:', notifyError)
      })
    }

    // 如果订单状态变为"已完成"且双方都已确认，向卖家发送打款通知
    if (status === 'completed') {
      const bothProcessed = (updateData.buyerProcessed || order.buyerProcessed) &&
                           (updateData.sellerProcessed || order.sellerProcessed)

      if (bothProcessed) {
        sendPaymentNotificationToSeller(order, category).catch(notifyError => {
          console.error('发送打款通知失败:', notifyError)
        })
      }
    }
    
    return {
      success: true,
      message: '订单状态更新成功',
      data: {
        orderId: orderId,
        newStatus: status
      }
    }
  } catch (error) {
    console.error('更新订单状态失败:', error)
    return {
      success: false,
      message: '更新订单状态失败',
      error: error.message
    }
  }
}

/**
 * 更新书籍或资料状态为已售出
 */
async function updateBookOrMaterialStatus(order, category) {
  // 优先使用 bookId/materialId 字段，如果没有则使用 bookInfo/materialInfo._id
  const bookOrMaterialId = category === 'book' 
    ? (order.bookId || order.bookInfo?._id) 
    : (order.materialId || order.materialInfo?._id)
  const collectionName = category === 'book' ? 'books' : 'materials'
  
  if (!bookOrMaterialId) {
    console.error('缺少书籍/资料 ID，无法更新状态')
    return
  }
  
  const targetCollection = db.collection(collectionName)
  
  // 先检查商品是否存在
  const checkResult = await targetCollection.doc(bookOrMaterialId).get()
  if (!checkResult.data) {
    console.error('商品不存在，无法更新状态:', bookOrMaterialId)
    return
  }
  
  await targetCollection.doc(bookOrMaterialId).update({
    data: {
      status: 'sold',
      statusText: '已售出',
      updateTime: db.serverDate()
    }
  })
  
  console.log(`${category === 'book' ? '书籍' : '资料'}状态已更新为已售出:`, bookOrMaterialId)
}

/**
 * 更新书籍或资料状态为在售
 */
async function updateBookStatusToAvailable(order, category) {
  // 优先使用 bookId/materialId 字段，如果没有则使用 bookInfo/materialInfo._id
  const bookOrMaterialId = category === 'book' 
    ? (order.bookId || order.bookInfo?._id) 
    : (order.materialId || order.materialInfo?._id)
  const collectionName = category === 'book' ? 'books' : 'materials'
  
  if (!bookOrMaterialId) {
    console.error('缺少书籍/资料 ID，无法更新状态')
    return
  }
  
  const targetCollection = db.collection(collectionName)
  
  // 先检查商品是否存在
  const checkResult = await targetCollection.doc(bookOrMaterialId).get()
  if (!checkResult.data) {
    console.error('商品不存在，无法更新状态:', bookOrMaterialId)
    return
  }
  
  await targetCollection.doc(bookOrMaterialId).update({
    data: {
      status: 'available',
      statusText: '在售',
      updateTime: db.serverDate()
    }
  })
  
  console.log(`${category === 'book' ? '书籍' : '资料'}状态已更新为在售:`, bookOrMaterialId)
}

/**
 * 订单完成后删除买家的收藏记录
 */
async function deleteFavoriteAfterOrderCompleted(order, category) {
  // 只处理书籍订单的收藏删除
  if (category !== 'book') {
    console.log('非书籍订单，跳过收藏记录删除')
    return
  }
  
  const buyerId = order.buyerId
  const bookId = order.bookId || order.bookInfo?._id
  
  if (!buyerId || !bookId) {
    console.warn('缺少买家 ID 或书籍 ID，无法删除收藏记录')
    return
  }
  
  const favoritesCollection = db.collection('favorites')
  
  // 查找并删除对应的收藏记录
  const result = await favoritesCollection.where({
    _openid: buyerId,
    itemId: bookId,
    type: 'book'
  }).remove()
  
  if (result.stats && result.stats.removed > 0) {
    console.log(`成功删除 ${result.stats.removed} 条收藏记录，书籍 ID: ${bookId}, 买家 ID: ${buyerId}`)
  } else {
    console.log(`未找到需要删除的收藏记录，书籍 ID: ${bookId}, 买家 ID: ${buyerId}`)
  }
}

/**
 * 创建订单状态变更通知
 */
async function createNotification(order, status, operatorId) {
  const isBuyer = order.buyerId === operatorId
  const recipientId = isBuyer ? order.sellerId : order.buyerId
  const operatorOpenid = operatorId

  const statusTextMap = {
    'pending_payment': '已付款',
    'completed': '已完成',
    'cancelled': '已取消',
    'shipped': '已发货'
  }

  const bookOrMaterialInfo = order.bookInfo || order.materialInfo || {}
  const orderType = order.bookInfo ? 'book' : 'material'

  // 发送系统通知到 notices 集合
  try {
    await cloud.callFunction({
      name: 'sendSystemMessage',
      data: {
        receiverOpenid: recipientId,
        title: '订单状态变更通知',
        content: `您${isBuyer ? '出售' : '购买'}的订单${order.orderId}已被${isBuyer ? '买家' : '卖家'}${statusTextMap[status] || '更新状态'}`,
        type: 'order',
        relatedId: order._id,
        relatedType: orderType === 'book' ? 'book_order' : 'material_order'
      }
    })
    console.log('发送系统通知到 notices 成功')
  } catch (error) {
    console.error('发送系统通知到 notices 失败:', error)
  }

  return true
}

/**
 * 向卖家发送打款通知
 */
async function sendPaymentNotificationToSeller(order, category) {
  const sellerId = order.sellerId || order._openid
  const bookOrMaterialInfo = order.bookInfo || order.materialInfo || {}
  const isBook = !!order.bookInfo

  try {
    // 发送系统通知到 notices 集合
    await cloud.callFunction({
      name: 'sendSystemMessage',
      data: {
        receiverOpenid: sellerId,
        title: '订单收款通知',
        content: `您${isBook ? '出售' : '上传'}的《${bookOrMaterialInfo.title}》订单已完成，收到付款 ¥${order.price}，订单号：${order.orderId}`,
        type: 'order',
        relatedId: order._id,
        relatedType: isBook ? 'book_order' : 'material_order'
      }
    })
    console.log('发送系统通知到 notices 成功')

    // 同时发送聊天消息给卖家
    const chatContent = `您好！您${isBook ? '出售' : '上传'}的《${bookOrMaterialInfo.title}》订单已完成，收到付款 ¥${order.price}。买家：${order.buyerName || '用户'}，订单号：${order.orderId}`
    await cloud.callFunction({
      name: 'sendChatMessage',
      data: {
        receiverOpenid: sellerId,
        content: chatContent,
        type: 'text'
      }
    })
    console.log('已发送打款聊天消息给卖家')
  } catch (error) {
    console.error('发送打款通知失败:', error)
  }

  return true
}

