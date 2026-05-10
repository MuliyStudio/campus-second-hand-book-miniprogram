// cloudfunctions/getPosts/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const postsCollection = db.collection('posts');

exports.main = async (event, context) => {
  try {
    const page = event.page || 1;
    const pageSize = event.pageSize || 20;
    const type = event.type || 'all';
    
    // 构建查询
    let query;
    
    if (type !== 'all') {
      // 按类型筛选
      query = postsCollection
        .where({
          type: type,
          status: 'published',
          isPublic: true
        })
        .orderBy('createTime', 'desc');
    } else {
      // 查询所有公开帖子
      query = postsCollection
        .where({
          status: 'published',
          isPublic: true
        })
        .orderBy('createTime', 'desc');
    }
    
    // 计算跳过的记录数
    const skip = (page - 1) * pageSize;
    
    // 查询总数
    const countResult = await query.count();
    const total = countResult.total;
    
    // 查询数据
    const posts = await query
      .skip(skip)
      .limit(pageSize)
      .get();
    
    return {
      success: true,
      message: '获取帖子列表成功',
      data: {
        posts: posts.data,
        total,
        page,
        pageSize,
        hasMore: skip + posts.data.length < total
      }
    };
    
  } catch (error) {
    console.error('获取帖子列表失败:', error);
    return {
      success: false,
      message: '获取帖子列表失败，请重试'
    };
  }
};