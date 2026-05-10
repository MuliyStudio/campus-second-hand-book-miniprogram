// cloudfunctions/getMyPosts/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()
const usersCollection = db.collection('users')

/**
 * 获取我的帖子云函数
 * @param {Object} event - 事件对象
 * @param {number} event.page - 页码，默认 1
 * @param {number} event.pageSize - 每页数量，默认 10
 * @param {string} event.type - 帖子类型筛选 (all, help, share)
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    if (!openid) {
      return {
        success: false,
        message: '获取用户 openid 失败'
      }
    }
    
    const page = event.page || 1
    const pageSize = event.pageSize || 10
    const type = event.type || 'all'
    
    // 构建查询
    let query = db.collection('posts')
      .where({
        _openid: openid
      })
    
    // 类型筛选
    if (type !== 'all') {
      query = query.where({
        type: type
      })
    }
    
    // 计算总数
    const countResult = await query.count()
    const total = countResult.total
    
    // 分页查询
    const posts = await query
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    // 获取用户信息并处理帖子数据
    const processedPosts = await Promise.all(posts.data.map(async (post) => {
      let authorInfo = post.author || {}
      
      // 如果帖子有 author 字段，获取完整的用户信息
      if (post.author && post.author._id) {
        try {
          const userResult = await usersCollection.doc(post.author._id).get()
          if (userResult.data) {
            // 使用展开操作符保留原有的 avatarUrl 等字段
            authorInfo = {
              ...post.author,  // 保留原有的 _id, avatarUrl 等
              nickname: userResult.data.nickname || post.author.nickname || '匿名用户',
              avatarUrl: userResult.data.avatarUrl || post.author.avatarUrl || '',
              college: userResult.data.college || '',
              major: userResult.data.major || '',
              campus: userResult.data.campus || '',
              dorm: userResult.data.dorm || ''
            }
          }
        } catch (error) {
          console.error('获取用户信息失败:', error)
        }
      }
      
      return {
        ...post,
        author: authorInfo,
        authorInfo: authorInfo,
        likeCount: post.likeCount || 0,
        collectCount: post.collectCount || 0,
        viewCount: post.viewCount || 0,
        shareCount: post.shareCount || 0
      }
    }))
    
    return {
      success: true,
      message: '获取帖子成功',
      data: {
        posts: processedPosts,
        total,
        page,
        pageSize,
        hasMore: (page - 1) * pageSize + processedPosts.length < total
      }
    }
  } catch (error) {
    console.error('获取帖子失败:', error)
    return {
      success: false,
      message: '获取帖子失败',
      error: error.message
    }
  }
}