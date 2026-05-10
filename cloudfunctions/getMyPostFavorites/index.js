// cloudfunctions/getMyPostFavorites/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const favoritesCollection = db.collection('favorites');
const postsCollection = db.collection('posts');
const usersCollection = db.collection('users');

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - getMyPostFavorites ===');
    
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { page = 1, pageSize = 10 } = event;
    
    console.log('环境信息:', { openid });
    console.log('事件参数:', event);
    
    if (!openid) {
      console.error('获取用户openid失败');
      return {
        success: false,
        message: '获取用户openid失败'
      };
    }
    
    // 计算跳过的记录数
    const skip = (page - 1) * pageSize;
    
    // 查询收藏记录
    console.log('开始查询收藏记录...');
    const favoritesResult = await favoritesCollection
      .where({
        _openid: openid,
        type: 'post',
        status: 'active'
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();
    
    console.log('收藏记录查询结果:', favoritesResult);
    
    const favorites = favoritesResult.data;
    const postIds = favorites.map(fav => fav.itemId);
    
    console.log('收藏的帖子 ID 列表:', postIds);
    
    // 提取所有作者 openid（从收藏记录的 itemData 中获取）
    const authorOpenids = favorites
      .map(fav => fav.itemData && fav.itemData._openid ? fav.itemData._openid : null)
      .filter(Boolean);
    console.log('从收藏记录中获取的作者 openid 列表:', authorOpenids);
    
    // 查询作者信息
    let usersMap = {};
    if (authorOpenids.length > 0) {
      console.log('开始获取作者信息...');
      console.log('查询条件 - openid 列表:', authorOpenids);
      const usersResult = await usersCollection
        .where({
          _openid: db.command.in(authorOpenids)
        })
        .get();
      
      console.log('作者信息查询结果 - 记录数:', usersResult.data.length);
      console.log('作者信息查询结果 - 完整数据:', JSON.stringify(usersResult.data, null, 2));
      
      usersMap = {};
        for (const user of usersResult.data) {
          console.log('用户信息:', user._openid, user.nickname, user.avatarUrl);
          // 如果用户有头像，获取临时访问链接
          if (user.avatarUrl && user.avatarUrl.startsWith('cloud://')) {
            try {
              const tempUrlResult = await cloud.getTempFileURL({
                fileList: [user.avatarUrl]
              });
              if (tempUrlResult.fileList && tempUrlResult.fileList.length > 0) {
                user.avatarUrl = tempUrlResult.fileList[0].tempFileURL;
                console.log('头像临时链接:', user.avatarUrl);
              }
            } catch (err) {
              console.error('获取头像临时链接失败:', err);
            }
          }
          usersMap[user._openid] = user;
        }
      
      if (usersResult.data.length === 0) {
        console.warn('未查询到任何用户信息！请检查 users 集合权限设置');
      }
    } else {
      console.warn('没有需要查询的作者 openid');
    }
    
    // 获取帖子详情
    let posts = [];
    if (postIds.length > 0) {
      console.log('开始获取帖子详情...');
      const postsResult = await postsCollection
        .where({
          _id: db.command.in(postIds)
        })
        .get();
      
      console.log('帖子详情查询结果:', postsResult);
      
      // 将帖子详情与收藏记录关联
      const postsMap = {};
      postsResult.data.forEach(post => {
        postsMap[post._id] = post;
      });
      
      posts = favorites.map(fav => {
        const post = postsMap[fav.itemId];
        if (post) {
          let authorInfo = post.author;
          // 优先使用通过 openid 查询到的用户信息
          const openid = fav.itemData && fav.itemData._openid ? fav.itemData._openid : post._openid;
          if (openid && usersMap[openid]) {
            authorInfo = usersMap[openid];
            console.log('使用 openid 查询到的用户信息:', authorInfo);
          } else if (post.author && typeof post.author === 'object') {
            // 如果帖子中的 author 已经包含完整信息，直接使用
            authorInfo = post.author;
          } else {
            // 没有作者信息
            authorInfo = {
              nickname: '匿名用户',
              avatarUrl: '/images/default-avatar.png'
            };
          }
          console.log('最终 authorInfo:', authorInfo);
          return {
            ...post,
            authorInfo: authorInfo,
            favoriteTime: fav.createTime,
            isFavorited: true,
            likeCount: post.likeCount || 0,
            collectCount: post.collectCount || 0
          };
        }
        return null;
      }).filter(Boolean);
      
      console.log('关联后的帖子数据:', posts);
    }
    
    // 获取总数
    console.log('开始获取收藏总数...');
    const countResult = await favoritesCollection
      .where({
        _openid: openid,
        type: 'post',
        status: 'active'
      })
      .count();
    
    console.log('收藏总数:', countResult.total);
    
    console.log('=== 云函数调用结束 - getMyPostFavorites ===');
    
    return {
      success: true,
      data: {
        posts: posts,
        total: countResult.total,
        page,
        pageSize,
        hasMore: skip + posts.length < countResult.total
      },
      message: '获取收藏帖子成功'
    };
    
  } catch (error) {
    console.error('获取收藏帖子失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '获取收藏帖子失败，请重试',
      error: error.message
    };
  }
};