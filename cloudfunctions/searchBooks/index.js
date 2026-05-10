// cloudfunctions/searchBooks/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const keyword = event.keyword || ''
    const filter = event.filter || ''
    const page = event.page || 1
    const pageSize = event.pageSize || 10
    
    if (!keyword) {
      return {
        success: false,
        message: '搜索关键词不能为空'
      }
    }
    
    // 课程简称映射表
    const courseMap = {
      '高数': ['高等数学', '高等数学（一）', '高等数学（二）', '高数Ⅰ', '高数Ⅱ'],
      '线代': ['线性代数', '线性代数课程', '线代课程'],
      '概率': ['概率论', '概率论与数理统计', '概率统计'],
      '大英': ['大学英语', '大学英语（一）', '大学英语（二）', '大学英语（三）', '大学英语（四）'],
      '思修': ['思想道德修养', '思想道德修养与法律基础', '思修课'],
      '毛概': ['毛泽东思想', '毛泽东思想和中国特色社会主义理论体系概论', '毛概课'],
      '马原': ['马克思主义', '马克思主义基本原理概论', '马原课'],
      '近代史': ['中国近代史', '中国近现代史纲要', '近代史纲要'],
      '军理': ['军事理论', '军事理论课程'],
      '体育': ['体育课', '体育与健康', '体育课程'],
      '计算机': ['计算机基础', '计算机应用基础', '计算机导论'],
      '程序设计': ['编程', '程序设计基础', '编程基础'],
      'c语言': ['c程序', 'c编程', 'c++'],
      'java': ['java编程', 'java程序', 'java开发'],
      'python': ['python编程', 'python程序', 'python开发'],
      '数据结构': ['算法', '算法与数据结构'],
      '操作系统': ['os', '操作系统原理'],
      '数据库': ['数据库原理', '数据库系统', 'mysql', 'sql'],
      '计算机网络': ['网络', '网络原理', '网络课程'],
      '人工智能': ['ai', '机器学习', '深度学习']
    };
    
    // 如果关键词是简称，扩展搜索词为所有相关全称
    let searchKeywords = [keyword];
    if (courseMap[keyword.toLowerCase()]) {
      searchKeywords = searchKeywords.concat(courseMap[keyword.toLowerCase()]);
    }
    
    const skip = (page - 1) * pageSize
    
    // 为每个搜索关键词创建查询条件
    const queryConditions = []
    
    searchKeywords.forEach(kw => {
      queryConditions.push(
        {
          title: db.RegExp({
            regexp: kw,
            options: 'i'
          })
        },
        {
          author: db.RegExp({
            regexp: kw,
            options: 'i'
          })
        },
        {
          course: db.RegExp({
            regexp: kw,
            options: 'i'
          })
        },
        {
          description: db.RegExp({
            regexp: kw,
            options: 'i'
          })
        },
        {
          sellerCollege: db.RegExp({
            regexp: kw,
            options: 'i'
          })
        },
        {
          sellerMajor: db.RegExp({
            regexp: kw,
            options: 'i'
          })
        },
        {
          sellerDorm: db.RegExp({
            regexp: kw,
            options: 'i'
          })
        },
        {
          sellerDormitory: db.RegExp({
            regexp: kw,
            options: 'i'
          })
        },
        {
          sellerCampus: db.RegExp({
            regexp: kw,
            options: 'i'
          })
        }
      )
    })
    
    let query = db.collection('books').where({
      status: 'available',
      _: _.or(queryConditions)
    })
    
    if (filter === 'price_asc') {
      query = query.orderBy('price', 'asc')
    } else if (filter === 'price_desc') {
      query = query.orderBy('price', 'desc')
    } else {
      query = query.orderBy('createTime', 'desc')
    }
    
    const totalResult = await query.count()
    const total = totalResult.total
    
    const results = await query
      .skip(skip)
      .limit(pageSize)
      .get()
    
    const sellerOpenids = []
    results.data.forEach(function(book) {
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
    results.data.forEach(function(book) {
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
    
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    const books = results.data.map(function(book) {
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
        matchType: getMatchType(book, keyword),
        createTime: book.createTime
      }
    })
    
    return {
      success: true,
      message: '搜索成功',
      data: {
        books: books,
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: (page * pageSize) < total,
        keyword: keyword
      }
    }
  } catch (error) {
    console.error('搜索书籍失败:', error)
    return {
      success: false,
      message: '搜索书籍失败',
      error: error.message
    }
  }
}

function getMatchType(book, keyword) {
  const lowerKeyword = keyword.toLowerCase()
  
  if (book.title && book.title.toLowerCase().indexOf(lowerKeyword) !== -1) {
    return 'title'
  }
  if (book.course && book.course.toLowerCase().indexOf(lowerKeyword) !== -1) {
    return 'course'
  }
  if (book.sellerCollege && book.sellerCollege.toLowerCase().indexOf(lowerKeyword) !== -1) {
    return 'college'
  }
  if (book.sellerMajor && book.sellerMajor.toLowerCase().indexOf(lowerKeyword) !== -1) {
    return 'major'
  }
  if (book.sellerDorm && book.sellerDorm.toLowerCase().indexOf(lowerKeyword) !== -1) {
    return 'dorm'
  }
  if (book.sellerDormitory && book.sellerDormitory.toLowerCase().indexOf(lowerKeyword) !== -1) {
    return 'dorm'
  }
  if (book.sellerCampus && book.sellerCampus.toLowerCase().indexOf(lowerKeyword) !== -1) {
    return 'campus'
  }
  if (book.author && book.author.toLowerCase().indexOf(lowerKeyword) !== -1) {
    return 'author'
  }
  return 'other'
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
