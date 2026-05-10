// cloudfunctions/getBooks/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

/**
 * 获取二手书列表云函数
 * @param {Object} event - 事件对象
 * @param {number} event.page - 页码，默认1
 * @param {number} event.pageSize - 每页数量，默认10
 * @param {string} event.status - 状态筛选，默认全部
 * @param {string} event.type - 查询类型，默认'all'，'user'表示查询当前用户的书籍
 * @param {string} event.bookId - 单本书籍ID，用于查询详情
 * @param {string} event.sellerId - 卖家ID（或openid），用于查询指定卖家的书籍
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const page = event.page || 1
    const pageSize = event.pageSize || 10
    const status = event.status || ''
    const type = event.type || 'all'
    const bookId = event.bookId // 新增：支持查询单本书籍
    const sellerId = event.sellerId // 新增：支持查询指定卖家的书籍

    // 如果指定了 bookId，直接查询该书籍（不过滤状态）
    if (bookId) {
      const bookResult = await db.collection('books').doc(bookId).get()

      if (!bookResult.data) {
        return {
          success: false,
          message: '书籍不存在'
        }
      }

      // 增加浏览量（每次查询单本书籍时 +1）
      await db.collection('books')
        .doc(bookId)
        .update({
          data: {
            viewCount: db.command.inc(1),
            updateTime: new Date()
          }
        })

      // 获取当前用户 openid
      const wxContext = cloud.getWXContext()
      const openid = wxContext.OPENID

      // 查询该书籍的订单信息
      let orderInfo = null
      try {
        console.log('🔍 开始查询订单信息:', {
          bookId: bookId,
          openid: openid
        })

        const orderResult = await db.collection('book_orders')
          .where({
            bookId: bookId,
            status: db.command.nin(['completed', 'cancelled'])
          })
          .orderBy('createTime', 'desc')
          .limit(1)
          .get()

        console.log('📋 查询订单结果:', {
          bookId: bookId,
          orderCount: orderResult.data.length,
          hasOrder: orderResult.data.length > 0,
          order: orderResult.data.length > 0 ? {
            orderId: orderResult.data[0].orderId,
            status: orderResult.data[0].status,
            buyerId: orderResult.data[0].buyerId,
            buyerOpenid: orderResult.data[0].buyerId,
            currentUserOpenid: openid,
            isBuyer: orderResult.data[0].buyerId === openid
          } : null
        })

        if (orderResult.data.length > 0) {
          orderInfo = orderResult.data[0]
          console.log('✅ 找到订单:', orderInfo.orderId, '状态:', orderInfo.status, '买家:', orderInfo.buyerId)
        } else {
          console.log('❌ 未找到订单，检查订单状态是否为 completed 或 cancelled')
        }
      } catch (err) {
        console.error('查询订单信息失败:', err)
      }

      // 查询卖家信息
      const sellerOpenid = bookResult.data._openid
      let sellerInfo = null

      if (sellerOpenid) {
        const usersResult = await db.collection('users')
          .where({ _openid: sellerOpenid })
          .get()

        if (usersResult.data.length > 0) {
          sellerInfo = usersResult.data[0]
        }
      }
      
      // 处理数据，包含更新后的浏览量
      const book = bookResult.data
      const books = [{
        ...book,
        viewCount: (book.viewCount || 0) + 1, // 前端显示增加后的浏览量
        isOwner: book._openid === openid,
        // 添加订单信息
        orderInfo: orderInfo ? {
          orderId: orderInfo.orderId,
          status: orderInfo.status,
          buyerId: orderInfo.buyerId,
          isBuyer: orderInfo.buyerId === openid // 当前用户是否为买家
        } : null,
        sellerAvatar: (sellerInfo && sellerInfo.avatarUrl) || book.sellerAvatar,
        sellerName: ((sellerInfo && sellerInfo.nickname) || (sellerInfo && sellerInfo.nickName)) || book.sellerName,
        sellerCampus: (sellerInfo && sellerInfo.campus) || book.sellerCampus,
        sellerDorm: ((sellerInfo && sellerInfo.dorm) || (sellerInfo && sellerInfo.dormitory)) || book.sellerDorm,
        sellerCollege: (sellerInfo && sellerInfo.college) || book.sellerCollege,
        sellerMajor: (sellerInfo && sellerInfo.major) || book.sellerMajor,
        sellerCredit: (sellerInfo && sellerInfo.creditScore) || book.sellerCredit,
        sellerRating: 90
      }]
      
      return {
        success: true,
        message: '获取成功',
        data: {
          books: books,
          total: 1,
          page: 1,
          pageSize: 1,
          hasMore: false
        }
      }
    }
    
    // 构建查询
    let query

    if (type === 'user') {
      // 查询当前用户的所有书籍
      const wxContext = cloud.getWXContext()
      const openid = wxContext.OPENID

      query = db.collection('books')
        .where({
          _openid: openid
        })
        .orderBy('createTime', 'desc')
    } else if (sellerId) {
      // 查询指定卖家的书籍（不限制状态）
      query = db.collection('books')
        .where({
          $or: [
            { _openid: sellerId },
            { sellerId: sellerId }
          ]
        })
        .orderBy('createTime', 'desc')
    } else {
      // 查询所有可用的书籍，按收藏量降序排序
      query = db.collection('books')
        .where({
          status: 'available'
        })
        .orderBy('favoritesCount', 'desc')
        .orderBy('createTime', 'desc')
    }

    // 如果指定了状态筛选
    if (status) {
      query = query.where({ status })
    }
    
    // 计算跳过的记录数
    const skip = (page - 1) * pageSize
    
    // 查询总数
    const countResult = await query.count()
    const total = countResult.total
    
    // 获取当前用户的 openid
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    
    // 查询数据
    const booksResult = await query
      .skip(skip)
      .limit(pageSize)
      .get();
    
    // 收集所有卖家的 openid
    const sellerOpenids = [...new Set(booksResult.data.map(book => book._openid))];
    
    // 批量查询卖家信息
    let sellerInfos = {};
    if (sellerOpenids.length > 0) {
      const usersResult = await db.collection('users')
        .where({
          _openid: db.command.in(sellerOpenids)
        })
        .get();
      
      // 将用户信息转换为字典，方便查找
      usersResult.data.forEach(user => {
        sellerInfos[user._openid] = user;
      });
    }
    
    // 处理数据，合并卖家信息
    const books = booksResult.data.map(book => {
      const sellerInfo = sellerInfos[book._openid];
      return {
        ...book,
        isOwner: book._openid === openid,
        // 合并卖家信息
        sellerAvatar: (sellerInfo && sellerInfo.avatarUrl) || book.sellerAvatar,
        sellerName: ((sellerInfo && sellerInfo.nickname) || (sellerInfo && sellerInfo.nickName)) || book.sellerName,
        sellerCampus: (sellerInfo && sellerInfo.campus) || book.sellerCampus,
        sellerDorm: ((sellerInfo && sellerInfo.dorm) || (sellerInfo && sellerInfo.dormitory)) || book.sellerDorm,
        sellerCollege: (sellerInfo && sellerInfo.college) || book.sellerCollege,
        sellerMajor: (sellerInfo && sellerInfo.major) || book.sellerMajor,
        sellerCredit: (sellerInfo && sellerInfo.creditScore) || book.sellerCredit,
        sellerRating: 90
      };
    });
    
    return {
      success: true,
      message: '获取成功',
      data: {
        books: books,
        total,
        page,
        pageSize,
        hasMore: skip + books.length < total
      }
    }
  } catch (error) {
    console.error('获取书籍列表失败:', error)
    return {
      success: false,
      message: '获取书籍列表失败',
      error: error.message
    }
  }
}