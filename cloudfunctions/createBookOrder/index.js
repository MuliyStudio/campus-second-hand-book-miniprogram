// cloudfunctions/createBookOrder/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 创建书籍订单云函数
 * @param {Object} event - 事件对象
 * @param {string} event.bookId - 书籍 ID
 * @param {Object} event.bookInfo - 书籍信息
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
      bookId,
      bookInfo,
      buyerName,
      buyerAvatar
    } = event
    
    if (!bookId || !bookInfo) {
      return {
        success: false,
        message: '缺少必要参数'
      }
    }
    
    // 1. 检查书籍是否存在且可购买
    const bookResult = await db.collection('books').doc(bookId).get()
    if (!bookResult.data || bookResult.data.status !== 'available') {
      return {
        success: false,
        message: '该书籍不可购买'
      }
    }
    
    const book = bookResult.data
    
    // 2. 检查是否有未完成的订单（防止重复购买）
    const existingOrder = await db.collection('book_orders').where({
      bookId: bookId,
      buyerId: openid,
      status: db.command.in(['pending_payment', 'pending_shipment', 'pending_receive'])
    }).get()
    
    if (existingOrder.data.length > 0) {
      return {
        success: false,
        message: '您已有该书籍的未完成订单，请勿重复购买',
        data: {
          existingOrderId: existingOrder.data[0].orderId
        }
      }
    }
    
    // 3. 生成订单 ID
    const orderId = 'B' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_' + Date.now()
    
    // 4. 创建订单数据
    const orderData = {
      _openid: openid,
      orderId: orderId,
      bookId: bookId,
      type: 'book',
      title: book.title,
      author: book.author,
      course: book.course,
      condition: book.condition,
      conditionText: book.conditionText,
      price: parseFloat(book.price),
      status: 'pending_payment',
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
      
      // 买家信息
      buyerId: openid,
      buyerName: buyerName || '用户',
      buyerAvatar: buyerAvatar || '',
      
      // 卖家信息
      sellerId: book._openid,
      sellerName: book.sellerName || book.sellerInfo?.nickname || '卖家',
      sellerAvatar: book.sellerAvatar || book.sellerInfo?.avatarUrl || '',
      sellerCampus: book.sellerCampus || book.sellerInfo?.campus || '',
      sellerDorm: book.sellerDorm || book.sellerInfo?.dorm || '',
      sellerCollege: book.sellerCollege || book.sellerInfo?.college || '',
      
      // 书籍信息
      bookInfo: {
        title: book.title,
        author: book.author,
        course: book.course,
        condition: book.condition,
        conditionText: book.conditionText,
        price: book.price,
        originalPrice: book.originalPrice,
        publisher: book.publisher,
        isbn: book.isbn,
        pages: book.pages,
        coverUrl: book.coverUrl,
        image: book.image,
        category: book.category,
        format: book.format,
        language: book.language
      }
    }
    
    // 5. 插入订单到数据库
    const result = await db.collection('book_orders').add({
      data: orderData
    })
    
    // 6. 更新书籍状态为预定中
    await db.collection('books').doc(bookId).update({
      data: {
        status: 'reserved',
        statusText: '预定中',
        updateTime: db.serverDate()
      }
    })
    
    // 7. 更新收藏状态为"结算中"
    try {
      const favoriteUpdateResult = await db.collection('favorites').where({
        _openid: openid,
        itemId: bookId,
        type: 'book'
      }).update({
        data: {
          status: 'settling',
          statusText: '结算中',
          updateTime: db.serverDate()
        }
      })

      console.log('收藏状态更新成功:', favoriteUpdateResult.stats?.updated)
    } catch (favError) {
      console.warn('更新收藏状态失败（可能未收藏）:', favError)
    }

    // 8. 向卖家发送系统通知（异步执行，不等待）
    setImmediate(() => {
      sendReservationNotificationToSeller(book, buyerName, orderId, result._id).catch(err => {
        console.error('发送预订通知失败:', err)
      })
    })

    return {
      success: true,
      message: '订单创建成功',
      data: {
        orderId: result._id,
        order: orderData,
        shouldRedirect: true,
        redirectUrl: '/pages/my-orders/my-orders'
      }
    }
  } catch (error) {
    console.error('创建订单失败:', error)
    return {
      success: false,
      message: '创建订单失败',
      error: error.message
    }
  }
}

/**
 * 向卖家发送预订通知
 */
async function sendReservationNotificationToSeller(book, buyerName, orderId, orderDbId) {
  const sellerId = book._openid

  try {
    // 1. 发送系统通知到 notices 集合
    await cloud.callFunction({
      name: 'sendSystemMessage',
      data: {
        receiverOpenid: sellerId,
        title: '书籍预订通知',
        content: `您出售的《${book.title}》已被买家预订，请尽快处理。买家：${buyerName}，订单号：${orderId}`,
        type: 'order',
        relatedId: orderDbId,
        relatedType: 'book_order'
      }
    })
    console.log('发送系统通知到 notices 成功')

    // 2. 发送聊天消息给卖家
    const chatContent = `您好！您出售的《${book.title}》已被买家预订，请尽快处理。买家：${buyerName}，订单号：${orderId}`
    await cloud.callFunction({
      name: 'sendChatMessage',
      data: {
        receiverOpenid: sellerId,
        content: chatContent,
        type: 'text'
      }
    })
    console.log('已发送预订聊天消息给卖家')
  } catch (error) {
    console.error('发送预订通知失败:', error)
    throw error
  }
}
