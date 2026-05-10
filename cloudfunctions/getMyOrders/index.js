// cloudfunctions/getMyOrders/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()
const _ = db.command

/**
 * 获取用户订单列表云函数
 * @param {Object} event - 事件对象
 * @param {string} event.type - 订单类型：buy(我买到的) 或 sell(我卖出的)
 * @param {string} event.category - 商品分类：book(书籍) 或 material(资料)
 * @param {string} event.status - 订单状态：all/pending_payment/pending/completed/cancelled/downloaded
 * @param {number} event.page - 页码，默认 1
 * @param {number} event.pageSize - 每页数量，默认 20
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    const type = event.type || 'buy'
    const category = event.category || 'book'
    const status = event.status || 'all'
    const page = event.page || 1
    const pageSize = event.pageSize || 20
    
    let orders = []
    let total = 0
    
    if (category === 'book') {
      const result = await getBookOrders(openid, type, status, page, pageSize)
      orders = result.orders
      total = result.total
    } else {
      const result = await getMaterialOrders(openid, type, status, page, pageSize)
      orders = result.orders
      total = result.total
    }
    
    return {
      success: true,
      message: '获取成功',
      data: {
        orders: orders,
        total,
        page,
        pageSize,
        hasMore: (page - 1) * pageSize + orders.length < total
      }
    }
  } catch (error) {
    console.error('获取订单列表失败:', error)
    return {
      success: false,
      message: '获取订单列表失败',
      error: error.message
    }
  }
}

/**
 * 获取书籍订单
 */
async function getBookOrders(openid, type, status, page, pageSize) {
  let query = {}
  
  if (type === 'buy') {
    query.buyerId = openid
  } else {
    query.sellerId = openid
  }
  
  if (status !== 'all') {
    query.status = status
  }
  
  const skip = (page - 1) * pageSize
  
  const ordersCollection = db.collection('book_orders')
  const countResult = await ordersCollection.where(query).count()
  const total = countResult.total
  
  const ordersResult = await ordersCollection
    .where(query)
    .orderBy('createTime', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()
  
  // 收集所有卖家 openid 和买家 openid
  const sellerOpenids = [...new Set(ordersResult.data.map(order => order.sellerId))]
  const buyerOpenids = [...new Set(ordersResult.data.map(order => order.buyerId))]
  
  // 批量查询卖家信息
  let sellerInfos = {}
  if (sellerOpenids.length > 0) {
    const usersResult = await db.collection('users')
      .where({
        _openid: db.command.in(sellerOpenids)
      })
      .get()

    usersResult.data.forEach(user => {
      sellerInfos[user._openid] = user
    })
  }

  // 批量查询买家信息
  let buyerInfos = {}
  if (buyerOpenids.length > 0) {
    const usersResult = await db.collection('users')
      .where({
        _openid: db.command.in(buyerOpenids)
      })
      .get()

    usersResult.data.forEach(user => {
      buyerInfos[user._openid] = user
    })
  }
  
  const orders = ordersResult.data.map(order => {
    const sellerData = sellerInfos[order.sellerId] || {}
    const buyerData = buyerInfos[order.buyerId] || {}

    return {
      _id: order._id,
      orderId: order.orderId,
      title: order.title || '未知商品',
      author: order.author || '未知作者',
      course: order.course || '',
      condition: order.condition || 8,
      conditionText: order.conditionText || '良好',
      price: order.price || 0,
      status: order.status,
      statusText: getStatusText(order.status, 'book'),
      createTime: order.createTime,
      sellerId: order.sellerId,
      sellerName: sellerData.nickname || order.sellerName || '未知卖家',
      sellerAvatar: sellerData.avatarUrl || order.sellerAvatar || '',
      sellerCampus: sellerData.campus || order.sellerCampus || '',
      sellerDorm: sellerData.dorm || order.sellerDorm || '',
      sellerCollege: sellerData.college || order.sellerCollege || '',
      sellerMajor: sellerData.major || '',
      sellerStudentId: sellerData.studentId || '',
      buyerId: order.buyerId,
      buyerName: buyerData.nickname || order.buyerName || '未知买家',
      buyerAvatar: buyerData.avatarUrl || order.buyerAvatar || '',
      buyerCampus: buyerData.campus || order.buyerCampus || '',
      buyerDorm: buyerData.dorm || order.buyerDorm || '',
      coverUrl: (order.bookInfo && order.bookInfo.coverUrl) || order.coverUrl || '',
      type: 'book',
      bookId: order.bookId,
      rating: order.rating || null,
      rated: order.rated || false,
      buyerProcessed: order.buyerProcessed || false,
      sellerProcessed: order.sellerProcessed || false
    }
  })
  
  return { orders, total }
}

/**
 * 获取资料订单
 */
async function getMaterialOrders(openid, type, status, page, pageSize) {
  let query = {}
  
  if (type === 'buy') {
    query.buyerId = openid
  } else {
    query.sellerId = openid
  }
  
  if (status !== 'all') {
    query.status = status
  }
  
  const skip = (page - 1) * pageSize
  
  const ordersCollection = db.collection('material_orders')
  const countResult = await ordersCollection.where(query).count()
  const total = countResult.total
  
  const ordersResult = await ordersCollection
    .where(query)
    .orderBy('createTime', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()
  
  // 收集所有卖家 openid 和资料 ID
  const sellerOpenids = [...new Set(ordersResult.data.map(order => order.sellerId))]
  const buyerOpenids = [...new Set(ordersResult.data.map(order => order.buyerId))]
  const materialIds = [...new Set(ordersResult.data.map(order => order.materialId))]
  
  // 批量查询卖家信息
  let sellerInfos = {}
  if (sellerOpenids.length > 0) {
    const usersResult = await db.collection('users')
      .where({
        _openid: db.command.in(sellerOpenids)
      })
      .get()

    usersResult.data.forEach(user => {
      sellerInfos[user._openid] = user
    })
  }

  // 批量查询买家信息
  let buyerInfos = {}
  if (buyerOpenids.length > 0) {
    const usersResult = await db.collection('users')
      .where({
        _openid: db.command.in(buyerOpenids)
      })
      .get()

    usersResult.data.forEach(user => {
      buyerInfos[user._openid] = user
    })
  }
  
  // 批量查询资料信息（从 materials 集合获取最新的 fileSize 等信息）
  let materialInfos = {}
  if (materialIds.length > 0) {
    const materialsResult = await db.collection('materials')
      .where({
        _id: db.command.in(materialIds)
      })
      .get()
    
    materialsResult.data.forEach(material => {
      materialInfos[material._id] = material
    })
  }
  
  const orders = ordersResult.data.map(order => {
    const sellerData = sellerInfos[order.sellerId] || {}
    const buyerData = buyerInfos[order.buyerId] || {}

    // 优先从 materials 集合获取信息，如果没有则从 order.materialInfo 获取
    const materialFromCollection = materialInfos[order.materialId] || {}

    // 解析 materialInfo（可能是字符串，需要解析）
    let materialData = {}
    if (typeof order.materialInfo === 'string') {
      try {
        materialData = JSON.parse(order.materialInfo)
      } catch (e) {
        console.error('解析 materialInfo 失败:', e)
        materialData = {}
      }
    } else if (order.materialInfo) {
      materialData = order.materialInfo
    }

    // 合并数据，优先使用 materials 集合的数据
    const mergedMaterial = {
      ...materialData,
      ...materialFromCollection
    }

    // 确保 fileId 正确获取
    const fileId = materialFromCollection.fileId ||
                   (materialData && materialData.fileId) ||
                   (order.materialInfo && order.materialInfo.fileId) ||
                   ''

    return {
      _id: order._id,
      orderId: order.orderId,
      title: order.title || mergedMaterial.title || '未知资料',
      materialType: mergedMaterial.type || mergedMaterial.format || 'PDF',
      fileSize: mergedMaterial.fileSize || mergedMaterial.size || formatFileSize(mergedMaterial.fileSizeInBytes || 0) || '未知',
      price: order.price || mergedMaterial.price || 0,
      isFree: order.price === 0 || mergedMaterial.isFree || false,
      status: order.status,
      statusText: getStatusText(order.status, 'material'),
      downloadCount: mergedMaterial.downloadCount || 0,
      createTime: order.createTime,
      sellerId: order.sellerId,
      sellerName: sellerData.nickname || order.sellerName || '未知上传者',
      sellerAvatar: sellerData.avatarUrl || order.sellerAvatar || '',
      sellerCollege: sellerData.college || order.sellerCollege || '',
      sellerMajor: sellerData.major || '',
      sellerStudentId: sellerData.studentId || '',
      buyerId: order.buyerId,
      buyerName: buyerData.nickname || order.buyerName || '未知买家',
      buyerAvatar: buyerData.avatarUrl || order.buyerAvatar || '',
      buyerCollege: buyerData.college || order.buyerCollege || '',
      buyerCampus: buyerData.campus || order.buyerCampus || '',
      buyerDorm: buyerData.dorm || order.buyerDorm || '',
      fileId: fileId,
      fileUrl: mergedMaterial.fileUrl || '',
      format: mergedMaterial.format || mergedMaterial.type || 'PDF',
      category: 'material',
      materialId: order.materialId,
      rating: order.rating || null,
      rated: order.rated || false,
      buyerProcessed: order.buyerProcessed || false,
      sellerProcessed: order.sellerProcessed || false
    }
  })
  
  return { orders, total }
}

/**
 * 获取状态文本
 */
function getStatusText(status, category) {
  const statusMap = {
    'pending': category === 'material' ? '已购买' : '已付款',
    'pending_payment': '待付款',
    'pending_processing': '待处理',
    'processing': '处理中',
    'completed': '已完成',
    'cancelled': '已取消',
    'shipped': '已发货',
    'downloaded': '已下载'
  }
  return statusMap[status] || '未知'
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 KB'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  if (i === 0) {
    return bytes + ' B'
  }
  
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
}
