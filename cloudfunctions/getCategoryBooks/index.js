// cloudfunctions/getCategoryBooks/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const college = event.college || ''
    const major = event.major || ''
    const page = event.page || 1
    const pageSize = event.pageSize || 10
    
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    const skip = (page - 1) * pageSize
    
    const whereCondition = {
      status: 'available'
    }
    
    if (college) {
      whereCondition.sellerCollege = college
    }
    
    if (major && major !== '全部') {
      whereCondition.sellerMajor = major
    }
    
    let query = db.collection('books').where(whereCondition)
    
    const countResult = await query.count()
    const total = countResult.total
    
    const booksResult = await query
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    const sellerOpenids = []
    booksResult.data.forEach(function(book) {
      if (book._openid && sellerOpenids.indexOf(book._openid) === -1) {
        sellerOpenids.push(book._openid)
      }
    })
    
    const sellerInfos = {}
    if (sellerOpenids.length > 0) {
      const usersResult = await db.collection('users')
        .where({
          _openid: _.in(sellerOpenids)
        })
        .get()
      
      usersResult.data.forEach(function(user) {
        sellerInfos[user._openid] = user
      })
    }
    
    const fileIDs = []
    booksResult.data.forEach(function(book) {
      if (book.coverUrl && book.coverUrl.indexOf('cloud://') === 0) {
        fileIDs.push(book.coverUrl)
      } else if (book.image && book.image.indexOf('cloud://') === 0) {
        fileIDs.push(book.image)
      }
      if (book.sellerAvatar && book.sellerAvatar.indexOf('cloud://') === 0) {
        fileIDs.push(book.sellerAvatar)
      }
    })
    
    Object.keys(sellerInfos).forEach(function(openid) {
      const user = sellerInfos[openid]
      if (user.avatarUrl && user.avatarUrl.indexOf('cloud://') === 0) {
        fileIDs.push(user.avatarUrl)
      }
    })
    
    const tempFileURLs = {}
    if (fileIDs.length > 0) {
      try {
        const uniqueFileIDs = []
        fileIDs.forEach(function(id) {
          if (uniqueFileIDs.indexOf(id) === -1) {
            uniqueFileIDs.push(id)
          }
        })
        const result = await cloud.getTempFileURL({
          fileList: uniqueFileIDs
        })
        result.fileList.forEach(function(item) {
          if (item.tempFileURL) {
            tempFileURLs[item.fileID] = item.tempFileURL
          }
        })
      } catch (err) {
        console.error('获取临时链接失败:', err)
      }
    }
    
    const books = booksResult.data.map(function(book) {
      const sellerInfo = sellerInfos[book._openid] || {}
      
      let coverUrl = book.coverUrl || book.image || ''
      if (coverUrl && coverUrl.indexOf('cloud://') === 0 && tempFileURLs[coverUrl]) {
        coverUrl = tempFileURLs[coverUrl]
      }
      
      let sellerAvatar = book.sellerAvatar || sellerInfo.avatarUrl || ''
      if (sellerAvatar && sellerAvatar.indexOf('cloud://') === 0 && tempFileURLs[sellerAvatar]) {
        sellerAvatar = tempFileURLs[sellerAvatar]
      }
      
      return {
        _id: book._id,
        title: book.title,
        coverUrl: coverUrl,
        price: book.price,
        condition: book.condition,
        conditionText: getConditionText(book.condition),
        status: book.status,
        statusText: book.statusText || '在售',
        isOwner: book._openid === openid,
        sellerAvatar: sellerAvatar,
        sellerName: book.sellerName || sellerInfo.nickname || sellerInfo.nickName || '匿名用户',
        sellerCampus: book.sellerCampus || sellerInfo.campus || '',
        sellerDorm: book.sellerDorm || book.sellerDormitory || sellerInfo.dorm || sellerInfo.dormitory || '',
        sellerCollege: book.sellerCollege || sellerInfo.college || '',
        sellerMajor: book.sellerMajor || sellerInfo.major || '',
        sellerCredit: book.sellerCredit || sellerInfo.creditScore || 100,
        createTime: book.createTime,
        viewCount: book.viewCount,
        favoritesCount: book.favoritesCount
      }
    })
    
    return {
      success: true,
      message: '获取成功',
      data: {
        books: books,
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: skip + books.length < total
      }
    }
  } catch (error) {
    console.error('获取分类书籍失败:', error)
    return {
      success: false,
      message: '获取分类书籍失败',
      error: error.message
    }
  }
}

function getConditionText(condition) {
  if (!condition) return '未知'
  const num = parseInt(condition)
  if (isNaN(num)) return condition
  if (num >= 10) return '全新'
  if (num >= 9) return '95新'
  if (num >= 8) return '9成新'
  if (num >= 7) return '85新'
  if (num >= 6) return '8成新'
  if (num >= 5) return '一般'
  if (num >= 3) return '较差'
  return '较差'
}
