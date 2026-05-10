// cloudfunctions/getUserCenterData/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const usersCollection = db.collection('users');
const booksCollection = db.collection('books');
const materialsCollection = db.collection('materials');
const postsCollection = db.collection('posts');
const favoritesCollection = db.collection('favorites');

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - getUserCenterData ===');

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { tab, page = 1, pageSize = 10, userId } = event;

    console.log('环境信息:', { openid });
    console.log('事件参数:', event);

    if (!openid) {
      console.error('获取用户openid失败');
      return {
        success: false,
        message: '获取用户openid失败'
      };
    }

    // 如果传入了 userId，则查询指定用户；否则查询当前用户
    const targetUserId = userId || openid;
    console.log('查询用户ID:', targetUserId);

    // 构建返回数据
    const result = {
      userInfo: null,
      books: [],
      materials: [],
      posts: [],
      favorites: [],
      total: 0,
      hasMore: false
    };

    // 获取用户信息
    try {
      console.log('开始获取用户信息...');
      let userQuery;

      // 优先用 _openid 查询（因为sellerId存储的是_openid）
      userQuery = await usersCollection.where({ _openid: targetUserId }).get();

      // 如果没找到，尝试用 _id 查询（兼容旧数据）
      if (!userQuery.data || userQuery.data.length === 0) {
        console.log('用_openid没找到，尝试用_id查询');
        userQuery = await usersCollection.where({ _id: targetUserId }).get();
      }

      console.log('用户信息查询结果:', userQuery);

      if (userQuery.data && userQuery.data.length > 0) {
        result.userInfo = userQuery.data[0];
        console.log('获取到用户信息:', result.userInfo);
      } else {
        // 如果用户不存在，返回默认用户信息
        console.log('用户不存在，返回默认信息');
        result.userInfo = {
          _id: targetUserId,
          _openid: targetUserId,
          nickname: '用户',
          avatarUrl: '',
          campus: '',
          dorm: '',
          college: '',
          major: '',
          grade: '',
          studentId: '',
          bio: '这个人很懒，还没有写个人简介~',
          level: 1,
          creditScore: 100,
          isFollowing: false,
          isFollower: false,
          followersCount: 0,
          followingCount: 0,
          booksCount: 0,
          materialsCount: 0,
          favoritesCount: 0,
          postsCount: 0,
          likesCount: 0,
          createTime: new Date().toISOString(),
          isVerified: false
        };
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      // 返回默认用户信息
      result.userInfo = {
        _id: targetUserId,
        _openid: targetUserId,
        nickname: '用户',
        avatarUrl: '',
        campus: '',
        dorm: '',
        college: '',
        major: '',
        grade: '',
        studentId: '',
        bio: '这个人很懒，还没有写个人简介~',
        level: 1,
        creditScore: 100,
        isFollowing: false,
        isFollower: false,
        followersCount: 0,
        followingCount: 0,
        booksCount: 0,
        materialsCount: 0,
        favoritesCount: 0,
        postsCount: 0,
        likesCount: 0,
        createTime: new Date().toISOString(),
        isVerified: false
      };
    }
    
    // 获取用户的真实 openid（用于查询发布内容）
    const targetOpenid = result.userInfo._openid || targetUserId;
    console.log('用于查询内容的openid:', targetOpenid);
    
    // 计算用户发布内容的实际数量
    try {
      console.log('开始计算用户发布内容数量...');

      // 获取书籍数量
      const booksCountResult = await booksCollection
        .where({ _openid: targetOpenid })
        .count();
      result.userInfo.booksCount = booksCountResult.total;
      console.log('书籍数量:', booksCountResult.total);

      // 获取资料数量
      const materialsCountResult = await materialsCollection
        .where({ _openid: targetOpenid })
        .count();
      result.userInfo.materialsCount = materialsCountResult.total;
      console.log('资料数量:', materialsCountResult.total);

      // 获取帖子数量
      const postsCountResult = await postsCollection
        .where({ _openid: targetOpenid })
        .count();
      result.userInfo.postsCount = postsCountResult.total;
      console.log('帖子数量:', postsCountResult.total);

      // 获取收藏数量
      const favoritesCountResult = await favoritesCollection
        .where({ _openid: targetOpenid, status: 'active' })
        .count();
      result.userInfo.favoritesCount = favoritesCountResult.total;
      console.log('收藏数量:', favoritesCountResult.total);

      // 获取获赞数量
      const postsResult = await postsCollection
        .where({ _openid: targetOpenid })
        .get();
      let likesCount = 0;
      postsResult.data.forEach(post => {
        likesCount += post.likeCount || 0;
      });
      result.userInfo.likesCount = likesCount;
      console.log('获赞数量:', likesCount);

    } catch (error) {
      console.error('计算用户发布内容数量失败:', error);
    }
    
    // 根据标签获取对应数据
    console.log('根据标签获取对应数据，标签:', tab);
    if (tab === 'books') {
      // 获取用户发布的二手书
      console.log('开始获取用户发布的书籍...');
      console.log('查询条件:', { _openid: targetOpenid });
      const booksResult = await booksCollection
        .where({ _openid: targetOpenid })
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();

      result.books = booksResult.data;
      console.log('获取到书籍数量:', booksResult.data.length);

      // 打印每本书的详细信息
      if (booksResult.data && booksResult.data.length > 0) {
        booksResult.data.forEach((book, index) => {
          console.log(`书籍 ${index + 1}:`, {
            title: book.title,
            _id: book._id,
            _openid: book._openid,
            sellerId: book.sellerId,
            sellerName: book.sellerName
          });
        });
      } else {
        console.log('未查询到任何书籍数据');
      }

      // 获取总数
      const booksCountResult = await booksCollection
        .where({ _openid: targetOpenid })
        .count();

      result.total = booksCountResult.total;
      result.hasMore = (page - 1) * pageSize + booksResult.data.length < booksCountResult.total;
      console.log('书籍总数:', booksCountResult.total, '是否有更多:', result.hasMore);
    } else if (tab === 'materials') {
      // 获取用户上传的资料
      console.log('开始获取用户上传的资料...');
      const materialsResult = await materialsCollection
        .where({ _openid: targetOpenid })
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();

      result.materials = materialsResult.data;
      console.log('获取到资料数量:', materialsResult.data.length);
      console.log('资料数据:', materialsResult.data);

      // 获取总数
      const materialsCountResult = await materialsCollection
        .where({ _openid: targetOpenid })
        .count();

      result.total = materialsCountResult.total;
      result.hasMore = (page - 1) * pageSize + materialsResult.data.length < materialsCountResult.total;
      console.log('资料总数:', materialsCountResult.total, '是否有更多:', result.hasMore);
    } else if (tab === 'posts') {
      // 获取用户发布的帖子
      console.log('开始获取用户发布的帖子...');
      const postsResult = await postsCollection
        .where({ _openid: targetOpenid })
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();

      result.posts = postsResult.data;
      console.log('获取到帖子数量:', postsResult.data.length);

      // 打印每篇帖子的详细信息
      if (postsResult.data && postsResult.data.length > 0) {
        postsResult.data.forEach((post, index) => {
          console.log(`帖子 ${index + 1}:`, {
            title: post.title,
            likeCount: post.likeCount,
            starCount: post.starCount,
            commentCount: post.commentCount,
            type: post.type
          });
        });
      } else {
        console.log('未查询到任何帖子数据');
      }

      // 获取总数
      const postsCountResult = await postsCollection
        .where({ _openid: targetOpenid })
        .count();

      result.total = postsCountResult.total;
      result.hasMore = (page - 1) * pageSize + postsResult.data.length < postsCountResult.total;
      console.log('帖子总数:', postsCountResult.total, '是否有更多:', result.hasMore);
    } else if (tab === 'favorites') {
      // 获取用户的收藏
      console.log('开始获取用户的收藏...');
      const favoritesResult = await favoritesCollection
        .where({ _openid: targetOpenid, status: 'active' })
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();

      result.favorites = favoritesResult.data;
      console.log('获取到收藏数量:', favoritesResult.data.length);

      // 获取总数
      const favoritesCountResult = await favoritesCollection
        .where({ _openid: targetOpenid, status: 'active' })
        .count();

      result.total = favoritesCountResult.total;
      result.hasMore = (page - 1) * pageSize + favoritesResult.data.length < favoritesCountResult.total;
      console.log('收藏总数:', favoritesCountResult.total, '是否有更多:', result.hasMore);
    }
    
    console.log('返回结果:', result);
    console.log('=== 云函数调用结束 - getUserCenterData ===');
    
    return {
      success: true,
      data: result,
      message: '获取用户中心数据成功'
    };
    
  } catch (error) {
    console.error('获取用户中心数据失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '获取用户中心数据失败，请重试',
      error: error.message
    };
  }
};