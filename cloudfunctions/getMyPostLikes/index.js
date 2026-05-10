// cloudfunctions/getMyPostLikes/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const likesCollection = db.collection('likes');
const postsCollection = db.collection('posts');
const usersCollection = db.collection('users');

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - getMyPostLikes ===');
    
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
    
    // 查询点赞记录
    console.log('开始查询点赞记录...');
    const likesResult = await likesCollection
      .where({
        _openid: openid,
        type: 'post',
        status: 'active'
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();
    
    console.log('点赞记录查询结果:', likesResult);
    
    const likes = likesResult.data;
    const postIds = likes.map(like => like.itemId);
    
    console.log('点赞的帖子ID列表:', postIds);
    
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
      
      // 提取所有作者 openid（从点赞记录的 itemData 中获取）
      const authorOpenids = likes
        .map(like => like.itemData && like.itemData._openid ? like.itemData._openid : null)
        .filter(Boolean);
      console.log('从点赞记录中获取的作者 openid 列表:', JSON.stringify(authorOpenids));
      
      // 去重
      const uniqueOpenids = [...new Set(authorOpenids)];
      console.log('去重后的 openid 列表:', JSON.stringify(uniqueOpenids));
      
      // 查询作者信息
      let usersMap = {};
      if (uniqueOpenids.length > 0) {
        console.log('开始获取作者信息...');
        console.log('查询条件 - openid 列表:', JSON.stringify(uniqueOpenids));
        const usersResult = await usersCollection
          .where({
            _openid: db.command.in(uniqueOpenids)
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
      
      // 将帖子详情与点赞记录关联
      const postsMap = {};
      postsResult.data.forEach(post => {
        postsMap[post._id] = post;
      });
      
      posts = likes.map(like => {
        const post = postsMap[like.itemId];
        if (post) {
          let authorInfo = post.author;
          // 优先使用通过 openid 查询到的用户信息
          const targetOpenid = post._openid || (like && like.itemData && like.itemData._openid);
          console.log('当前处理的帖子 - postId:', post._id, 'openid:', targetOpenid);
          console.log('usersMap 中的 openid:', Object.keys(usersMap));
          if (targetOpenid && usersMap[targetOpenid]) {
            authorInfo = usersMap[targetOpenid];
            console.log('✅ 使用 openid 查询到的用户信息:', {
              openid: targetOpenid,
              nickname: authorInfo.nickname,
              avatarUrl: authorInfo.avatarUrl
            });
          } else if (post.author && typeof post.author === 'object') {
            // 如果帖子中的 author 已经包含完整信息，直接使用
            console.log('⚠️ 使用帖子中的 author 信息');
            authorInfo = post.author;
          } else {
            // 没有作者信息
            console.log('❌ 没有作者信息，使用默认值');
            authorInfo = {
              nickname: '匿名用户',
              avatarUrl: '/images/default-avatar.png'
            };
          }
          console.log('最终 authorInfo:', {
            nickname: authorInfo.nickname,
            avatarUrl: authorInfo.avatarUrl
          });
          return {
            ...post,
            authorInfo: authorInfo,
            likeTime: like.createTime,
            isLiked: true,
            likeCount: post.likeCount || 0,
            collectCount: post.collectCount || 0
          };
        }
        return null;
      }).filter(Boolean);
      
      console.log('关联后的帖子数据:', posts);
    }
    
    // 获取总数
    console.log('开始获取点赞总数...');
    const countResult = await likesCollection
      .where({
        _openid: openid,
        type: 'post',
        status: 'active'
      })
      .count();
    
    console.log('点赞总数:', countResult.total);
    
    console.log('=== 云函数调用结束 - getMyPostLikes ===');
    
    return {
      success: true,
      data: {
        posts: posts,
        total: countResult.total,
        page,
        pageSize,
        hasMore: skip + posts.length < countResult.total
      },
      message: '获取点赞帖子成功'
    };
    
  } catch (error) {
    console.error('获取点赞帖子失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '获取点赞帖子失败，请重试',
      error: error.message
    };
  }
};