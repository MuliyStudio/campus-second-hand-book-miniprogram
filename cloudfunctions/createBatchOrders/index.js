const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    const {
      items,
      buyerName,
      buyerAvatar
    } = event
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        message: '缺少必要参数'
      }
    }
    
    const results = {
      success: [],
      failed: []
    }
    
    for (const item of items) {
      try {
        if (item.type === 'book') {
          const result = await createBookOrder(item, openid, buyerName, buyerAvatar)
          if (result.success) {
            results.success.push({
              itemId: item.itemId,
              orderId: result.orderId,
              type: 'book'
            })
          } else {
            results.failed.push({
              itemId: item.itemId,
              type: 'book',
              reason: result.message
            })
          }
        } else if (item.type === 'material') {
          const result = await createMaterialOrder(item, openid, buyerName, buyerAvatar)
          if (result.success) {
            results.success.push({
              itemId: item.itemId,
              orderId: result.orderId,
              type: 'material'
            })
          } else {
            results.failed.push({
              itemId: item.itemId,
              type: 'material',
              reason: result.message
            })
          }
        }
      } catch (err) {
        console.error(`处理商品 ${item.itemId} 失败:`, err)
        results.failed.push({
          itemId: item.itemId,
          type: item.type,
          reason: err.message
        })
      }
    }
    
    return {
      success: true,
      message: `成功创建 ${results.success.length} 个订单，${results.failed.length} 个失败`,
      data: results
    }
  } catch (error) {
    console.error('批量创建订单失败:', error)
    return {
      success: false,
      message: '批量创建订单失败',
      error: error.message
    }
  }
}

async function createBookOrder(item, openid, buyerName, buyerAvatar) {
  try {
    const bookId = item.itemId
    
    const bookResult = await db.collection('books').doc(bookId).get()
    if (!bookResult.data || bookResult.data.status !== 'available') {
      return {
        success: false,
        message: '该书籍不可购买'
      }
    }
    
    const book = bookResult.data
    
    const existingOrder = await db.collection('book_orders').where({
      bookId: bookId,
      buyerId: openid,
      status: _.in(['pending_payment', 'pending', 'pending_receive'])
    }).get()
    
    if (existingOrder.data.length > 0) {
      return {
        success: false,
        message: '您已有该书籍的未完成订单'
      }
    }
    
    const orderId = 'B' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_' + Date.now()
    
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
      status: 'pending',
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
      paymentTime: db.serverDate(),
      buyerId: openid,
      buyerName: buyerName || '用户',
      buyerAvatar: buyerAvatar || '',
      sellerId: book.sellerId || book._openid,
      sellerName: book.sellerName || '卖家',
      sellerAvatar: book.sellerAvatar || '',
      sellerCampus: book.sellerCampus || book.campus || '',
      sellerDorm: book.sellerDorm || book.dorm || '',
      sellerCollege: book.sellerCollege || book.college || '',
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
    
    await db.collection('book_orders').add({
      data: orderData
    })
    
    await db.collection('books').doc(bookId).update({
      data: {
        status: 'reserved',
        statusText: '已预定',
        updateTime: db.serverDate()
      }
    })
    
    try {
      await db.collection('favorites').where({
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
    } catch (favError) {
      console.warn('更新收藏状态失败:', favError)
    }
    
    return {
      success: true,
      orderId: orderId
    }
  } catch (error) {
    console.error('创建书籍订单失败:', error)
    return {
      success: false,
      message: error.message
    }
  }
}

async function createMaterialOrder(item, openid, buyerName, buyerAvatar) {
  try {
    const materialId = item.itemId
    
    const materialResult = await db.collection('materials').doc(materialId).get()
    if (!materialResult.data) {
      return {
        success: false,
        message: '该资料不存在'
      }
    }
    
    const material = materialResult.data
    const authorInfo = material.author || {}
    
    const existingOrder = await db.collection('material_orders').where({
      materialId: materialId,
      buyerId: openid
    }).get()
    
    if (existingOrder.data.length > 0) {
      return {
        success: false,
        message: '您已购买过该资料，请勿重复购买'
      }
    }
    
    const orderId = 'M' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_' + Date.now()
    
    const orderData = {
      _openid: openid,
      orderId: orderId,
      materialId: materialId,
      type: 'material',
      title: material.title,
      price: parseFloat(material.price) || 0,
      status: 'pending',
      statusText: '已购买',
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
      paymentTime: db.serverDate(),
      buyerId: openid,
      buyerName: buyerName || '用户',
      buyerAvatar: buyerAvatar || '',
      sellerId: material._openid || authorInfo._id || '',
      sellerName: authorInfo.nickname || '卖家',
      sellerAvatar: authorInfo.avatarUrl || '',
      sellerCampus: authorInfo.campus || '',
      sellerDorm: authorInfo.dorm || '',
      sellerCollege: authorInfo.college || '',
      materialInfo: {
        title: material.title,
        description: material.description,
        price: material.price,
        format: material.format,
        fileSize: material.fileSize,
        fileUrl: material.fileUrl,
        category: material.category
      }
    }
    
    await db.collection('material_orders').add({
      data: orderData
    })
    
    return {
      success: true,
      orderId: orderId
    }
  } catch (error) {
    console.error('创建资料订单失败:', error)
    return {
      success: false,
      message: error.message
    }
  }
}
