// cloudfunctions/getPostDetail/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const postsCollection = db.collection('posts');
const commentsCollection = db.collection('comments');
const favoritesCollection = db.collection('favorites');
const likesCollection = db.collection('likes');
const usersCollection = db.collection('users');

exports.main = async (event, context) => {
  try {
    console.log('获取帖子详情开始:', event);
    const { postId } = event;
    
    // 验证必填字段
    if (!postId) {
      console.error('缺少帖子ID');
      return {
        success: false,
        message: '缺少帖子ID'
      };
    }
    
    // 获取用户openid
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    console.log('用户openid:', openid);
    
    // 获取帖子详情
    console.log('开始获取帖子详情，ID:', postId);
    const postResult = await postsCollection.doc(postId).get();
    console.log('获取帖子详情结果:', postResult);
    
    // 更新帖子的浏览量
    try {
      await postsCollection.doc(postId).update({
        data: {
          viewCount: _.inc(1)
        }
      });
      console.log('更新帖子浏览量成功');
    } catch (error) {
      console.error('更新帖子浏览量失败:', error);
      // 不影响获取帖子详情的结果
    }
    
    if (!postResult.data) {
      console.error('帖子不存在:', postId);
      return {
        success: false,
        message: '帖子不存在'
      };
    }
    
    let post = postResult.data;
    console.log('帖子数据:', post);
    
    // 获取发布者的完整用户信息
    if (post.author && post.author._id) {
      try {
        const userResult = await usersCollection.doc(post.author._id).get();
        if (userResult.data) {
          post.author = {
            ...post.author,
            college: userResult.data.college || '',
            major: userResult.data.major || '',
            campus: userResult.data.campus || '',
            dorm: userResult.data.dorm || ''
          };
          console.log('更新后的作者信息:', post.author);
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
        // 不影响获取帖子详情的结果
      }
    }
    
    // 获取评论列表
    console.log('开始获取评论列表，帖子ID:', postId);
    let comments = [];
    try {
      const commentsResult = await commentsCollection
        .where({ postId: postId })
        .orderBy('createTime', 'desc')
        .get();
      console.log('获取评论列表结果:', commentsResult);
      
      comments = commentsResult.data.map(comment => ({
        ...comment,
        replies: comment.replies || []
      }));
      console.log('评论数据:', comments);
    } catch (error) {
      console.error('获取评论列表失败:', error);
      // 如果comments集合不存在，返回空数组
      comments = [];
    }
    
    // 检查收藏状态
    let isFavorited = false;
    if (openid) {
      try {
        const favoriteResult = await favoritesCollection
          .where({
            _openid: openid,
            itemId: postId,
            type: 'post',
            status: 'active'
          })
          .get();
        isFavorited = favoriteResult.data && favoriteResult.data.length > 0;
        console.log('收藏状态:', isFavorited);
      } catch (error) {
        console.error('检查收藏状态失败:', error);
      }
    }
    
    // 检查点赞状态
    let isLiked = false;
    if (openid) {
      try {
        const likeResult = await likesCollection
          .where({
            _openid: openid,
            itemId: postId,
            type: 'post',
            status: 'active'
          })
          .get();
        isLiked = likeResult.data && likeResult.data.length > 0;
        console.log('点赞状态:', isLiked);
      } catch (error) {
        console.error('检查点赞状态失败:', error);
      }
    }
    
    // 构建完整的帖子数据
    const postData = {
      ...post,
      comments: comments,
      commentCount: comments.length,
      isFavorited: isFavorited,
      isLiked: isLiked,
      likeCount: post.likeCount || 0,
      collectCount: post.collectCount || 0,
      viewCount: post.viewCount || 0,
      shareCount: post.shareCount || 0
    };
    console.log('构建完整的帖子数据:', postData);
    
    return {
      success: true,
      data: postData,
      message: '获取帖子详情成功'
    };
    
  } catch (error) {
    console.error('获取帖子详情失败:', error);
    return {
      success: false,
      message: '获取帖子详情失败，请重试',
      error: error.message
    };
  }
};