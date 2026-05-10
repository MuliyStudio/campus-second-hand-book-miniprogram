// cloudfunctions/addPostFavorite/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const favoritesCollection = db.collection('favorites');
const postsCollection = db.collection('posts');

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - addPostFavorite ===');
    
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { postId, postData } = event;
    
    console.log('环境信息:', { openid });
    console.log('事件参数:', event);
    
    if (!openid) {
      console.error('获取用户openid失败');
      return {
        success: false,
        message: '获取用户openid失败'
      };
    }
    
    if (!postId) {
      console.error('缺少帖子ID');
      return {
        success: false,
        message: '缺少帖子ID'
      };
    }
    
    // 检查帖子是否存在
    try {
      const postResult = await postsCollection.doc(postId).get();
      if (!postResult.data) {
        console.error('帖子不存在:', postId);
        return {
          success: false,
          message: '帖子不存在'
        };
      }
    } catch (error) {
      console.error('检查帖子存在失败:', error);
      return {
        success: false,
        message: '检查帖子存在失败'
      };
    }
    
    // 检查是否已经收藏
    try {
      const existingFavorite = await favoritesCollection
        .where({
          _openid: openid,
          itemId: postId,
          type: 'post',
          status: 'active'
        })
        .get();
      
      if (existingFavorite.data && existingFavorite.data.length > 0) {
        console.log('帖子已经收藏过:', postId);
        return {
          success: true,
          message: '帖子已经收藏过',
          data: existingFavorite.data[0]
        };
      }
    } catch (error) {
      console.error('检查收藏状态失败:', error);
    }
    
    // 创建收藏记录
    const favoriteData = {
      _openid: openid,
      itemId: postId,
      type: 'post',
      itemData: postData || {},
      status: 'active',
      createTime: new Date().toISOString()
    };
    
    console.log('创建收藏记录:', favoriteData);
    
    const result = await favoritesCollection.add({
      data: favoriteData
    });
    
    console.log('收藏成功，结果:', result);
    
    // 更新帖子的收藏数
    try {
      // 直接使用 set 方法来确保字段存在，同时增加收藏数
      // 使用 { merge: true } 来只更新指定字段，不覆盖其他字段
      await postsCollection.doc(postId).set({
        collectCount: db.command.inc(1)
      }, { merge: true });
      console.log('更新帖子收藏数成功');
    } catch (error) {
      console.error('更新帖子收藏数失败:', error);
      // 不影响收藏操作的结果
    }

    // 发送系统消息给发布者
    try {
      const postResult = await postsCollection.doc(postId).get();
      if (postResult.data && postResult.data._openid !== openid) {
        const postAuthorId = postResult.data._openid;
        const postTitle = postResult.data.title || '帖子';

        // 获取收藏者信息
        const userResult = await db.collection('users').where({
          _openid: openid
        }).get();

        const favoriterName = userResult.data[0]?.nickname || '用户';

        await cloud.callFunction({
          name: 'sendSystemMessage',
          data: {
            receiverOpenid: postAuthorId,
            title: '收到新收藏',
            content: `${favoriterName} 收藏了你的帖子《${postTitle}》`,
            type: 'favorite',
            relatedId: postId,
            relatedType: 'post'
          }
        });
        console.log('已发送收藏通知给发布者');
      }
    } catch (msgError) {
      console.warn('发送收藏通知失败:', msgError);
    }

    console.log('=== 云函数调用结束 - addPostFavorite ===');

    return {
      success: true,
      data: {
        _id: result._id,
        ...favoriteData
      },
      message: '收藏成功'
    };
    
  } catch (error) {
    console.error('添加帖子收藏失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '添加帖子收藏失败，请重试',
      error: error.message
    };
  }
};