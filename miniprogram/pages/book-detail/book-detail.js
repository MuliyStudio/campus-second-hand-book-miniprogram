// pages/book-detail/book-detail.js
Page({
  data: {
    bookId: null,
    bookInfo: null,
    sellerBooks: [],
    isFavorite: false,
    isReserved: false,
    isOwnBook: false,
    isBuyer: false, // 当前用户是否为预订者（买家）
    isLoading: true,
    error: false,
    // 轮播图相关
    currentImageIndex: 0,
    // 动态计算高度
    contentHeight: 600, // 默认高度
    actionBarHeight: 100, // 底部操作栏高度
    actionBarBottom: 0, // 底部操作栏位置
    bottomSafeArea: 0, // 底部安全区域
    windowHeight: 0
  },

  onLoad: function (options) {
    console.log('📱 进入书籍详情页，ID:', options.id);
    
    if (options.id) {
      this.setData({ bookId: options.id });
      
      // 获取窗口高度
      this.getWindowHeight();
      
      // 加载数据（云函数会自动增加浏览量）
      this.loadBookDetail(options.id);
      
      // 监听用户信息更新事件
      const app = getApp();
      if (wx.eventCenter) {
        wx.eventCenter.on('userInfoUpdated', this.onUserInfoUpdated, this);
      }
    } else {
      this.showError('书籍不存在');
    }
  },

  // 用户信息更新时的处理函数
  onUserInfoUpdated: function() {
    console.log('👤 用户信息已更新，刷新书籍详情');
    if (this.data.bookId) {
      this.loadBookDetail(this.data.bookId);
    }
  },

  onUnload: function() {
    // 移除事件监听器
    if (wx.eventCenter) {
      wx.eventCenter.off('userInfoUpdated', this.onUserInfoUpdated);
    }
  },

  onReady: function () {
    // 页面渲染完成后计算高度
    this.calculateContentHeight();
  },

  onShow: function () {
    if (this.data.bookInfo) {
      this.checkFavoriteStatus();
      this.checkReserveStatus();
      // 检查当前用户是否为预订者（买家）
      this.checkIsBuyer();
    }
  },

  onPullDownRefresh: function () {
    if (this.data.bookId) {
      this.loadBookDetail(this.data.bookId);
    } else {
      wx.stopPullDownRefresh();
    }
  },

  onShareAppMessage: function () {
    wx.showToast({
      title: '暂时无法分享',
      icon: 'none',
      duration: 2000
    });
  },

  // 获取窗口高度
  getWindowHeight: function() {
    const that = this;
    wx.getSystemInfo({
      success: function(res) {
        console.log('📱 系统信息:', res);
        const pixelRatio = 750 / res.windowWidth;
        const windowHeight = res.windowHeight * pixelRatio;
        const safeAreaBottom = res.safeArea ? (res.windowHeight - res.safeArea.bottom) * pixelRatio : 0;
        
        that.setData({
          windowHeight: windowHeight,
          bottomSafeArea: safeAreaBottom || 0
        });
        
        console.log('📏 窗口高度:', windowHeight, '安全区域:', safeAreaBottom);
        
        // 计算内容高度
        that.calculateContentHeight();
      }
    });
  },

  // 计算内容区域高度
  calculateContentHeight: function() {
    const { windowHeight, actionBarHeight, bottomSafeArea } = this.data;
    
    if (windowHeight > 0) {
      // 图片高度400 + 底部操作栏高度 + 安全区域
      const contentHeight = windowHeight - 400 - actionBarHeight - bottomSafeArea;
      
      console.log('📏 计算内容高度:', {
        windowHeight,
        actionBarHeight,
        bottomSafeArea,
        contentHeight
      });
      
      this.setData({
        contentHeight: contentHeight > 400 ? contentHeight : 600
      });
    }
  },

  // 加载书籍详情
  loadBookDetail: async function(bookId) {
    this.setData({ 
      isLoading: true,
      error: false 
    });
    
    console.log('📖 开始加载书籍详情:', bookId);
    
    try {
      // 直接从云数据库获取指定书籍（不过滤状态）
      const res = await wx.cloud.callFunction({
        name: 'getBooks',
        data: { 
          type: 'all',
          bookId: bookId // 传递 bookId 参数
        }
      });
      
      console.log('✅ 从云函数获取书籍列表成功:', res);
      if (res.result.success && res.result.data.books) {
        const allBooks = res.result.data.books;
        console.log('📚 书籍列表数量:', allBooks.length);
        console.log('🔍 查找 bookId:', bookId);
        
        // 查找匹配的书籍
        const targetBook = allBooks.find(book => {
          const match = book._id === bookId || book.id === bookId;
          if (match) {
            console.log('✅ 找到匹配的书籍:', book.title, book._id);
          }
          return match;
        });
        
        if (targetBook) {
          await this.handleCloudBook(targetBook, bookId, allBooks);
        } else {
          console.log('❌ 未找到匹配的书籍，尝试直接查询');
          // 如果还是找不到，直接查询云数据库
          await this.loadBookDirectly(bookId);
        }
      } else {
        console.log('❌ 云函数返回失败，直接查询云数据库');
        await this.loadBookDirectly(bookId);
      }
    } catch (error) {
      console.error('❌ 从云函数获取失败:', error);
      await this.loadBookDirectly(bookId);
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  // 直接从云数据库加载单本书籍
  loadBookDirectly: async function(bookId) {
    try {
      console.log('🔍 直接查询云数据库获取书籍:', bookId);
      
      const res = await wx.cloud.callFunction({
        name: 'getBookDetail',
        data: {
          bookId: bookId
        }
      });
      
      if (res.result && res.result.success && res.result.data) {
        console.log('✅ 直接查询成功:', res.result.data.title);
        await this.handleCloudBook(res.result.data, bookId, [res.result.data]);
      } else {
        console.log('❌ 直接查询失败，使用本地缓存');
        await this.loadFromLocalCache(bookId);
      }
    } catch (error) {
      console.error('❌ 直接查询失败:', error);
      await this.loadFromLocalCache(bookId);
    }
  },

  // 从本地缓存加载
  loadFromLocalCache: async function(bookId) {
    try {
      // 1. 先从本地缓存查找您发布的书籍
      const publishedBooks = wx.getStorageSync('published_books') || [];
      console.log('📊 已发布书籍数量:', publishedBooks.length);
      
      const publishedBook = publishedBooks.find(book => 
        book.id === bookId || book._id === bookId
      );
      
      if (publishedBook) {
        console.log('✅ 找到已发布的书籍:', publishedBook);
        await this.handlePublishedBook(publishedBook, bookId, publishedBooks);
      } else {
        // 2. 从所有书籍缓存中查找
        const allBooks = wx.getStorageSync('all_books') || {};
        console.log('📊 缓存书籍数量:', Object.keys(allBooks).length);
        
        const cachedBook = allBooks[bookId];
        
        if (cachedBook) {
          console.log('✅ 找到缓存的书籍:', cachedBook);
          await this.handleCachedBook(cachedBook, bookId, Object.values(allBooks));
        } else {
          // 3. 从模拟数据中查找
          console.log('📋 使用模拟数据');
          this.handleMockBook(bookId);
        }
      }
    } catch (error) {
      console.error('❌ 加载书籍详情失败:', error);
      this.setData({ 
        isLoading: false, 
        error: true 
      });
      this.showError('加载失败');
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  // 处理云函数返回的书籍
  handleCloudBook: async function(bookData, bookId, allBooks) {
    const sellerBooks = await this.getSellerBooksFromCloud(bookData.sellerId, bookId);
    const isOwnBook = this.checkIsOwnBook(bookData);

    console.log('✅ 使用云函数返回的书籍数据:', bookData);
    console.log('✅ 卖家信息已在云函数中合并');

    // 处理图片 URL - 先处理封面和头像
    if (bookData.coverUrl) {
      bookData.coverUrl = await this.getPublicImageUrl(bookData.coverUrl);
    }
    if (bookData.image) {
      bookData.image = await this.getPublicImageUrl(bookData.image);
    }
    if (bookData.sellerAvatar) {
      bookData.sellerAvatar = await this.getPublicImageUrl(bookData.sellerAvatar);
    }

    // 处理图片数组
    if (bookData.images && Array.isArray(bookData.images)) {
      const imagePromises = bookData.images.map(img => this.getPublicImageUrl(img));
      bookData.images = await Promise.all(imagePromises);
      console.log('✅ 图片数组转换完成:', bookData.images.length, '张');
    }

    // 处理 extraImages 数组
    if (bookData.extraImages && Array.isArray(bookData.extraImages)) {
      const extraImagePromises = bookData.extraImages.map(img => this.getPublicImageUrl(img));
      bookData.extraImages = await Promise.all(extraImagePromises);
      console.log('✅ extraImages 数组转换完成:', bookData.extraImages.length, '张');
    }

    const bookInfo = this.formatBookData(bookData);

    this.setData({
      bookInfo: bookInfo,
      sellerBooks: sellerBooks,
      isOwnBook: isOwnBook,
      isLoading: false
    });

    this.updateNavigationBar(bookData.title);
    this.checkFavoriteStatus();
    this.checkReserveStatus();
    this.checkIsBuyer(); // 检查是否为买家
  },

  // 处理您发布的书籍
  handlePublishedBook: async function(bookData, bookId, allBooks = null) {
    const sellerBooks = await this.getSellerBooksFromCloud(bookData.sellerId, bookId);

    // 处理图片 URL
    if (bookData.coverUrl) {
      bookData.coverUrl = await this.getPublicImageUrl(bookData.coverUrl);
    }
    if (bookData.image) {
      bookData.image = await this.getPublicImageUrl(bookData.image);
    }
    if (bookData.sellerAvatar) {
      bookData.sellerAvatar = await this.getPublicImageUrl(bookData.sellerAvatar);
    }

    // 处理图片数组
    if (bookData.images && Array.isArray(bookData.images)) {
      const imagePromises = bookData.images.map(img => this.getPublicImageUrl(img));
      bookData.images = await Promise.all(imagePromises);
    }

    // 处理 extraImages 数组
    if (bookData.extraImages && Array.isArray(bookData.extraImages)) {
      const extraImagePromises = bookData.extraImages.map(img => this.getPublicImageUrl(img));
      bookData.extraImages = await Promise.all(extraImagePromises);
    }

    const bookInfo = this.formatBookData(bookData);
    const isOwnBook = this.checkIsOwnBook(bookData);

    this.setData({
      bookInfo: bookInfo,
      sellerBooks: sellerBooks,
      isOwnBook: isOwnBook,
      isLoading: false
    });

    this.updateNavigationBar(bookData.title);
    this.checkFavoriteStatus();
    this.checkReserveStatus();
    this.checkIsBuyer(); // 检查是否为买家
  },

  // 处理缓存的书籍
  handleCachedBook: async function(bookData, bookId, allBooks = null) {
    const sellerBooks = await this.getSellerBooksFromCloud(bookData.sellerId, bookId);

    // 处理图片 URL
    if (bookData.coverUrl) {
      bookData.coverUrl = await this.getPublicImageUrl(bookData.coverUrl);
    }
    if (bookData.image) {
      bookData.image = await this.getPublicImageUrl(bookData.image);
    }
    if (bookData.sellerAvatar) {
      bookData.sellerAvatar = await this.getPublicImageUrl(bookData.sellerAvatar);
    }

    // 处理图片数组
    if (bookData.images && Array.isArray(bookData.images)) {
      const imagePromises = bookData.images.map(img => this.getPublicImageUrl(img));
      bookData.images = await Promise.all(imagePromises);
    }

    // 处理 extraImages 数组
    if (bookData.extraImages && Array.isArray(bookData.extraImages)) {
      const extraImagePromises = bookData.extraImages.map(img => this.getPublicImageUrl(img));
      bookData.extraImages = await Promise.all(extraImagePromises);
    }

    const bookInfo = this.formatBookData(bookData);
    const isOwnBook = this.checkIsOwnBook(bookData);

    this.setData({
      bookInfo: bookInfo,
      sellerBooks: sellerBooks,
      isOwnBook: isOwnBook,
      isLoading: false
    });

    this.updateNavigationBar(bookData.title);
    this.checkFavoriteStatus();
    this.checkReserveStatus();
    this.checkIsBuyer(); // 检查是否为买家
  },

  // 处理模拟书籍
  handleMockBook: function(bookId) {
    const bookData = this.getMockBookData(bookId);
    const bookInfo = this.formatBookData(bookData);
    const sellerBooks = this.getSellerBooks(bookInfo.sellerId, bookId);
    const isOwnBook = this.checkIsOwnBook(bookData);
    
    this.setData({
      bookInfo: bookInfo,
      sellerBooks: sellerBooks,
      isOwnBook: isOwnBook,
      isLoading: false
    });
    
    this.updateNavigationBar(bookInfo.title);
    this.checkFavoriteStatus();
    this.checkReserveStatus();
  },

  // 从云数据库获取卖家的其他书籍
  getSellerBooksFromCloud: async function(sellerId, currentBookId) {
    try {
      console.log('🔍 从云数据库获取卖家的其他书籍, sellerId:', sellerId, 'currentBookId:', currentBookId);

      // 调用云函数获取该卖家发布的书籍
      const res = await wx.cloud.callFunction({
        name: 'getBooks',
        data: {
          type: 'all',
          sellerId: sellerId
        }
      });

      if (res.result && res.result.success && res.result.data.books) {
        const allBooks = res.result.data.books;

        // 过滤掉当前书籍
        const sellerBooks = allBooks.filter(book => {
          const bookId = book._id || book.id;
          const bookSellerId = book.sellerId || book._openid;
          return bookSellerId === sellerId && bookId !== currentBookId;
        });

        console.log('📊 从云数据库找到卖家其他书籍数量:', sellerBooks.length);

        // 去重并格式化
        const uniqueBooks = [];
        const seenIds = new Set();

        for (const book of sellerBooks) {
          const bookId = book._id || book.id;
          if (!seenIds.has(bookId)) {
            seenIds.add(bookId);

            // 处理封面图片URL
            let coverUrl = book.coverUrl || book.image || 'https://via.placeholder.com/150x100/667eea/ffffff?text=书籍';
            coverUrl = await this.getPublicImageUrl(coverUrl);

            uniqueBooks.push({
              _id: bookId,
              id: bookId,
              title: book.title || '未知书名',
              coverUrl: coverUrl,
              price: book.price ? (typeof book.price === 'string' ? parseFloat(book.price).toFixed(1) : book.price.toFixed(1)) : '0.0'
            });
          }
        }

        // 限制最多显示5本
        return uniqueBooks.slice(0, 5);
      } else {
        console.log('❌ 云函数返回失败');
        return [];
      }
    } catch (error) {
      console.error('❌ 从云数据库获取卖家书籍失败:', error);
      return [];
    }
  },

  // 从所有书籍中获取卖家的其他书籍
  getSellerBooksFromAll: function(sellerId, currentBookId, allBooks) {
    try {
      if (!allBooks || !Array.isArray(allBooks)) {
        return [];
      }

      const sellerBooks = allBooks.filter(book => {
        const bookSellerId = book.sellerId || book._openid;
        const bookId = book._id || book.id;
        return bookSellerId === sellerId && bookId !== currentBookId;
      });

      console.log('📊 从所有书籍中找到卖家其他书籍数量:', sellerBooks.length);

      const uniqueBooks = [];
      const seenIds = new Set();

      sellerBooks.forEach(book => {
        const bookId = book.id || book._id;
        if (!seenIds.has(bookId)) {
          seenIds.add(bookId);
          uniqueBooks.push({
            _id: bookId,
            id: bookId,
            title: book.title || '未知书名',
            coverUrl: book.coverUrl || book.image || 'https://via.placeholder.com/150x100/667eea/ffffff?text=书籍',
            price: book.price ? (typeof book.price === 'string' ? parseFloat(book.price).toFixed(1) : book.price.toFixed(1)) : '0.0'
          });
        }
      });

      return uniqueBooks.slice(0, 5);

    } catch (error) {
      console.error('获取卖家书籍失败:', error);
      return [];
    }
  },

  // 检查是否是自己发布的书籍
  checkIsOwnBook: function(bookData) {
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    const openid = app.globalData.openid || wx.getStorageSync('openid');
    
    const sellerId = bookData.sellerId;
    const bookOpenid = bookData._openid;
    const userId = userInfo && userInfo._id;
    
    console.log('检查是否是自己的书籍:', { 
      userOpenid: openid, 
      sellerId: sellerId, 
      bookOpenid: bookOpenid,
      userId: userId 
    });
    
    if (!openid) {
      return false;
    }
    
    // 支持多种匹配方式
    // 1. 比较 openid 和 sellerId
    if (sellerId && String(openid) === String(sellerId)) {
      return true;
    }
    
    // 2. 比较 openid 和 _openid
    if (bookOpenid && String(openid) === String(bookOpenid)) {
      return true;
    }
    
    // 3. 比较 userInfo._id 和 sellerId（兼容旧数据）
    if (userId && sellerId && String(userId) === String(sellerId)) {
      return true;
    }
    
    return false;
  },

  // 计算卖家信用分和好评率
  calculateSellerStats: function(sellerId) {
    try {
      const orders = wx.getStorageSync('orders') || [];
      const completedOrders = orders.filter(order => 
        order.sellerId === sellerId && 
        order.status === 'completed' && 
        order.rating
      );
      
      if (completedOrders.length === 0) {
        return { credit: 85, rating: 90 };
      }
      
      // 计算平均评分
      const totalRating = completedOrders.reduce((sum, order) => sum + order.rating, 0);
      const averageRating = totalRating / completedOrders.length;
      
      // 信用分计算：基础分80 + 评分*4
      const credit = Math.min(100, 80 + Math.round(averageRating * 4));
      
      // 好评率计算：评分>=4的订单占比
      const positiveOrders = completedOrders.filter(order => order.rating >= 4).length;
      const rating = Math.round((positiveOrders / completedOrders.length) * 100);
      
      return { credit, rating };
    } catch (error) {
      console.error('计算卖家统计数据失败:', error);
      return { credit: 85, rating: 90 };
    }
  },

  // 获取公开的图片URL
  getPublicImageUrl: function(fileID) {
    return new Promise((resolve, reject) => {
      if (!fileID) {
        resolve('');
        return;
      }
      
      // 如果是HTTP/HTTPS URL或本地图片，直接返回
      if (fileID.startsWith('http') || fileID.startsWith('/images') || fileID.startsWith('/static')) {
        resolve(fileID);
        return;
      }
      
      // 如果是云存储URL，尝试转换为临时URL
      if (fileID.startsWith('cloud://')) {
        wx.cloud.callFunction({
          name: 'updateFilePermission',
          data: { fileID: fileID },
          success: (res) => {
            if (res.result && res.result.success && res.result.data && res.result.data.tempFileURL) {
              resolve(res.result.data.tempFileURL);
            } else {
              resolve(fileID);
            }
          },
          fail: (error) => {
            console.error('获取公开图片URL失败:', error);
            resolve(fileID);
          }
        });
      } else {
        // 其他情况，直接返回
        resolve(fileID);
      }
    });
  },

  // 格式化书籍数据 - 根据图片调整
  formatBookData: function(bookData) {
    console.log('📄 格式化书籍数据:', bookData);
    
    // 处理新旧程度 - 根据图片显示"8分（良好/成新/微污）"
    const condition = bookData.condition || 8;
    let conditionText = '';
    
    if (condition <= 3) {
      conditionText = condition + '分（较差）';
    } else if (condition <= 6) {
      conditionText = condition + '分（一般）';
    } else if (condition <= 8) {
      conditionText = condition + '分（良好/成新/微污）'; // 根据图片
    } else {
      conditionText = condition + '分（很好）';
    }
    
    // 确保价格格式正确
    let price = '0.0';
    if (bookData.price) {
      if (typeof bookData.price === 'string') {
        price = parseFloat(bookData.price).toFixed(1);
      } else if (typeof bookData.price === 'number') {
        price = bookData.price.toFixed(1);
      }
    }
    
    // 获取卖家信息
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    const openid = app.globalData.openid || wx.getStorageSync('openid');
    console.log('📋 书籍详情页面的用户信息:', userInfo);
    
    // 获取书籍ID（优先使用数据库真实ID，避免使用本地临时ID）
    const bookId = bookData._id || bookData.id;
    
    // 计算卖家信用分和好评率
    const sellerId = bookData.sellerId || 'default_seller';
    const sellerStats = this.calculateSellerStats(sellerId);
    
    // 检查是否是当前用户的书籍
    const isCurrentUserBook = String(openid) === String(sellerId);
    
    let sellerName = '匿名卖家';
    let sellerAvatar = '';
    let sellerCampus = '西校区';
    let sellerDorm = '南苑';
    let sellerCollege = '人工智能学院';
    let sellerMajor = '人工智能';
    let sellerCredit = 85;
    let sellerRating = 90;
    
    if (isCurrentUserBook && userInfo) {
      sellerName = userInfo.nickName || userInfo.nickname || '匿名卖家';
      sellerAvatar = userInfo.avatarUrl || userInfo.avatar || '';
      sellerCampus = userInfo.campus || '西校区';
      sellerDorm = userInfo.dorm || userInfo.dormitory || '南苑';
      sellerCollege = userInfo.college || '人工智能学院';
      sellerMajor = userInfo.major || '人工智能';
      sellerCredit = userInfo.creditScore || 85;
    } else {
      sellerName = bookData.sellerName || '匿名卖家';
      sellerAvatar = bookData.sellerAvatar || bookData.avatar || bookData.avatarUrl || '';
      sellerCampus = bookData.sellerCampus || bookData.campus || '西校区';
      sellerDorm = bookData.sellerDorm || bookData.dorm || '南苑';
      sellerCollege = bookData.sellerCollege || bookData.college || '人工智能学院';
      sellerMajor = bookData.sellerMajor || bookData.major || '人工智能';
      sellerCredit = bookData.sellerCredit || 85;
      sellerRating = bookData.sellerRating || 90;
    }
    
    if (!sellerAvatar || sellerAvatar === '') {
      sellerAvatar = '/images/default-avatar.png';
    }
    
    console.log('📸 最终头像:', sellerAvatar);
    console.log('📸 最终信誉分:', sellerCredit);
    
  // 处理图片URL - 支持多张图片
    const coverUrl = bookData.coverUrl || bookData.image || 'https://via.placeholder.com/300x400/667eea/ffffff?text=书籍';

    // 处理图片数组
    let images = [];

    console.log('🖼️ 处理图片数据:', {
      hasImages: !!bookData.images,
      imagesType: typeof bookData.images,
      imagesLength: bookData.images ? bookData.images.length : 0,
      hasExtraImages: !!bookData.extraImages,
      extraImagesLength: bookData.extraImages ? bookData.extraImages.length : 0,
      coverUrl: coverUrl
    });

    // 优先使用 images 字段
    if (bookData.images && Array.isArray(bookData.images) && bookData.images.length > 0) {
      // 过滤掉空值，并确保所有图片都是有效URL
      images = bookData.images.filter(img => img && img.trim() !== '');
      console.log('🖼️ 从 images 字段获取图片:', images.length, '张');
    }
    
    // 如果 images 字段为空，尝试使用 extraImages 字段
    if (images.length === 0 && bookData.extraImages && Array.isArray(bookData.extraImages) && bookData.extraImages.length > 0) {
      images = bookData.extraImages.filter(img => img && img.trim() !== '');
      console.log('🖼️ 从 extraImages 字段获取图片:', images.length, '张');
    }
    
    // 如果仍然为空，使用 coverUrl
    if (images.length === 0 && coverUrl) {
      images = [coverUrl];
      console.log('🖼️ 使用 coverUrl:', coverUrl);
    }
    
    // 确保至少有一张图片
    if (images.length === 0) {
      images = ['https://via.placeholder.com/300x400/667eea/ffffff?text=书籍'];
      console.log('🖼️ 使用默认占位图');
    }
    
    // 去重
    images = [...new Set(images)];
    console.log('🖼️ 最终图片数组:', images);
    
    return {
      _id: bookId,
      id: bookId,
      title: bookData.title || '未知书名',
      author: bookData.author || '1', // 根据图片
      publisher: bookData.publisher || '2', // 根据图片
      publishYear: '2024', // 根据图片固定
      coverUrl: coverUrl,
      images: images, // 图片数组
      price: price,
      course: bookData.course || '数据采集',
      condition: condition,
      conditionText: conditionText,
      description: bookData.description || '无', // 根据图片
      status: bookData.status || 'available', // 根据图片显示"在售"
      statusText: bookData.statusText || '在售',
      
      // 卖家信息
      sellerId: sellerId,
      sellerName: sellerName,
      sellerAvatar: sellerAvatar,
      sellerLevel: 1, // 根据图片Lvl
      sellerVerified: true, // 根据图片"已认证"
      sellerCredit: sellerCredit, // 使用云函数提供的信誉分
      sellerRating: sellerRating, // 使用云函数提供的好评率
      sellerCampus: sellerCampus,
      sellerDorm: sellerDorm,
      sellerCollege: sellerCollege,
      sellerMajor: sellerMajor,
      
      // 扩展信息
      createTime: bookData.createTime || new Date().toISOString(),
      updateTime: bookData.updateTime || new Date().toISOString(),
      viewCount: bookData.viewCount || 0,
      
      // 保留订单信息（用于判断是否为买家）
      orderInfo: bookData.orderInfo || null
    };
  },

  // 获取卖家其他书籍
  getSellerBooks: function(sellerId, currentBookId) {
    try {
      const publishedBooks = wx.getStorageSync('published_books') || [];
      
      // 获取该卖家发布的所有书籍
      const allSellerBooks = [];
      
      // 从已发布书籍中查找
      publishedBooks.forEach(book => {
        if (book.sellerId === sellerId && (book.id !== currentBookId && book._id !== currentBookId)) {
          allSellerBooks.push(book);
        }
      });
      
      console.log('📊 卖家ID:', sellerId, '找到其他书籍数量:', allSellerBooks.length);
      
      // 去重并格式化
      const uniqueBooks = [];
      const seenIds = new Set();
      
      allSellerBooks.forEach(book => {
        const bookId = book.id || book._id;
        if (!seenIds.has(bookId)) {
          seenIds.add(bookId);
          uniqueBooks.push({
            _id: bookId,
            id: bookId,
            title: book.title || '未知书名',
            coverUrl: book.coverUrl || book.image || 'https://via.placeholder.com/150x100/667eea/ffffff?text=书籍',
            price: book.price ? (typeof book.price === 'string' ? parseFloat(book.price).toFixed(1) : book.price.toFixed(1)) : '0.0'
          });
        }
      });
      
      // 限制最多显示5本
      return uniqueBooks.slice(0, 5);
      
    } catch (error) {
      console.error('获取卖家书籍失败:', error);
      return [];
    }
  },

  // 检查收藏状态 - 从云数据库获取
  checkFavoriteStatus: function() {
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      this.setData({ isFavorite: false });
      return;
    }
    
    wx.cloud.callFunction({
      name: 'getMyFavorites',
      data: {
        type: 'book'
      },
      success: (res) => {
        if (res.result.success) {
          const favorites = res.result.data.favorites;
          console.log('❤️ 云数据库收藏数据:', favorites);
          
          const isFavorite = favorites.some(item => {
            return item.itemId === this.data.bookId && item.type === 'book';
          });
          
          console.log('❤️ 是否收藏:', isFavorite);
          this.setData({ isFavorite });
          
          // 更新本地收藏数据
          app.globalData.userFavorites = favorites;
          app.saveUserDataToStorage();
        } else {
          console.error('获取收藏状态失败:', res.result.message);
          this.setData({ isFavorite: false });
        }
      },
      fail: (error) => {
        console.error('调用云函数失败:', error);
        // 失败时使用本地数据
        try {
          const userFavorites = app.globalData.userFavorites || [];
          const isFavorite = userFavorites.some(item => {
            const itemId = item.itemId || item.id || item._id;
            return itemId === this.data.bookId && item.type === 'book';
          });
          this.setData({ isFavorite });
        } catch (e) {
          this.setData({ isFavorite: false });
        }
      }
    });
  },

  // 检查预定状态
  checkReserveStatus: function() {
    try {
      const reservations = wx.getStorageSync('reservations') || [];
      console.log('⏰ 预定数据:', reservations);
      
      // 修复：确保是数组
      let reservationsArray = [];
      if (Array.isArray(reservations)) {
        reservationsArray = reservations;
      } else if (reservations && typeof reservations === 'object') {
        reservationsArray = Object.values(reservations);
      }
      
      const isReserved = reservationsArray.some(item => 
        item.bookId === this.data.bookId
      );
      
      console.log('⏰ 是否预定:', isReserved);
      this.setData({ isReserved });
      
    } catch (error) {
      console.error('检查预定状态失败:', error);
      this.setData({ isReserved: false });
    }
  },

  // 检查当前用户是否为预订者（买家）
  checkIsBuyer: function() {
    const { bookInfo } = this.data;

    console.log('🔍 checkIsBuyer 检查:', {
      hasBookInfo: !!bookInfo,
      hasOrderInfo: bookInfo && bookInfo.orderInfo ? true : false,
      orderInfo: bookInfo ? bookInfo.orderInfo : null,
      bookStatus: bookInfo ? bookInfo.status : null
    });

    if (!bookInfo || !bookInfo.orderInfo) {
      console.log('❌ 没有订单信息，设置 isBuyer = false');
      this.setData({ isBuyer: false });
      return;
    }

    // 直接使用云函数返回的 orderInfo.isBuyer
    const isBuyer = bookInfo.orderInfo.isBuyer;
    console.log('✅ 是否为预订者（云函数返回）:', isBuyer, bookInfo.orderInfo);
    this.setData({ isBuyer });
  },

  // 模拟数据
  getMockBookData: function(bookId) {
    console.log('🎲 使用模拟数据，ID:', bookId);
    
    return {
      _id: bookId,
      id: bookId,
      title: '数据采集',
      author: '1',
      publisher: '2',
      publishYear: '2024',
      coverUrl: 'https://via.placeholder.com/300x400/667eea/ffffff?text=数据采集',
      price: '6.0',
      course: '数据采集',
      condition: 8,
      conditionText: '8分（良好/成新/微污）',
      description: '无',
      status: 'available',
      statusText: '在售',
      sellerId: 'mock_seller_id',
      sellerName: '匿名卖家',
      sellerAvatar: 'https://via.placeholder.com/100x100/667eea/ffffff?text=卖家',
      sellerCollege: '人工智能学院',
      sellerMajor: '未知专业',
      sellerCampus: '主校区',
      sellerDorm: '未知楼栋',
      sellerLevel: 1,
      sellerVerified: true,
      sellerCredit: 85,
      sellerRating: 90
    };
  },

  // 更新导航栏标题
  updateNavigationBar: function(title) {
    wx.setNavigationBarTitle({
      title: title.length > 8 ? title.substring(0, 8) + '...' : title
    });
  },

  // 收藏/取消收藏
  toggleFavorite: function() {
    const app = getApp();
    
    if (!app.globalData.isLoggedIn) {
      this.showLoginPrompt();
      return;
    }
    
    const { isFavorite, bookInfo, bookId } = this.data;
    
    // 检查bookInfo和bookId是否存在
    if (!bookInfo || !bookId) {
      wx.showToast({
        title: '书籍信息加载失败',
        icon: 'error',
        duration: 1000
      });
      return;
    }
    
    const newFavoriteStatus = !isFavorite;
    
    this.setData({ isFavorite: newFavoriteStatus });
    
    if (newFavoriteStatus) {
      // 添加收藏
      wx.cloud.callFunction({
        name: 'addFavorite',
        data: {
          itemId: bookId,
          type: 'book',
          itemData: {
            title: bookInfo.title || '未知书名',
            price: bookInfo.price || 0,
            image: bookInfo.coverUrl || '/images/default-book.png',
            sellerName: bookInfo.sellerName || '未知卖家',
            author: bookInfo.author || '未知作者',
            condition: bookInfo.condition || 8,
            campus: bookInfo.sellerCampus || '未知校区',
            dorm: bookInfo.sellerDorm || '未知楼栋'
          }
        },
        success: (res) => {
          console.log('添加收藏结果:', res);
          if (res.result.success) {
            // 更新本地收藏数据
            const userFavorites = app.globalData.userFavorites || [];
            userFavorites.push({
              _id: res.result.data._id,
              userId: app.globalData.openid,
              itemId: bookId,
              type: 'book',
              itemData: {
                title: bookInfo.title || '未知书名',
                price: bookInfo.price || 0,
                image: bookInfo.coverUrl || '/images/default-book.png',
                sellerName: bookInfo.sellerName || '未知卖家'
              },
              createTime: new Date().toISOString()
            });
            app.saveUserDataToStorage();
            
            wx.showToast({
              title: '已收藏',
              icon: 'success',
              duration: 1000
            });
            
            wx.vibrateShort({ type: 'light' });
          } else {
            // 操作失败，恢复原状态
            this.setData({ isFavorite: false });
            wx.showToast({
              title: res.result.message || '收藏失败',
              icon: 'error',
              duration: 1000
            });
          }
        },
        fail: (error) => {
          console.error('调用云函数失败:', error);
          // 操作失败，恢复原状态
          this.setData({ isFavorite: false });
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'error',
            duration: 1000
          });
        }
      });
    } else {
      // 移除收藏
      wx.cloud.callFunction({
        name: 'removeFavorite',
        data: {
          itemId: bookId,
          type: 'book'
        },
        success: (res) => {
          console.log('移除收藏结果:', res);
          if (res.result.success) {
            // 更新本地收藏数据
            const userFavorites = app.globalData.userFavorites || [];
            app.globalData.userFavorites = userFavorites.filter(item => {
              const itemId = item.itemId || item.id || item._id;
              return itemId !== bookId || item.type !== 'book';
            });
            app.saveUserDataToStorage();
            
            wx.showToast({
              title: '已取消',
              icon: 'success',
              duration: 1000
            });
            
            wx.vibrateShort({ type: 'light' });
          } else {
            // 操作失败，恢复原状态
            this.setData({ isFavorite: true });
            wx.showToast({
              title: res.result.message || '取消收藏失败',
              icon: 'error',
              duration: 1000
            });
          }
        },
        fail: (error) => {
          console.error('调用云函数失败:', error);
          // 操作失败，恢复原状态
          this.setData({ isFavorite: true });
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'error',
            duration: 1000
          });
        }
      });
    }
  },

  // 预定/取消预定
  toggleReserve: function() {
    const app = getApp();
    
    if (!app.globalData.isLoggedIn) {
      this.showLoginPrompt();
      return;
    }
    
    const { isReserved, bookInfo } = this.data;
    
    if (isReserved) {
      this.cancelReservation();
    } else {
      this.makeReservation();
    }
  },

  makeReservation: function() {
    const { bookInfo, bookId } = this.data;
    
    wx.showModal({
      title: '确认预定',
      content: `确定要预定《${bookInfo.title}》吗？\n价格：¥${bookInfo.price}`,
      confirmText: '立即预定',
      confirmColor: '#f59e0b',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '预定中...',
            mask: true
          });

          const app = getApp();
          const openid = app.globalData.openid || wx.getStorageSync('openid');
          const userInfo = app.globalData.userInfo || {};

          // 调用云函数创建订单
          wx.cloud.callFunction({
            name: 'createBookOrder',
            data: {
              bookId: bookId,
              bookInfo: bookInfo,
              buyerName: userInfo.nickname || '用户',
              buyerAvatar: userInfo.avatarUrl || ''
            }
          }).then(orderRes => {
            wx.hideLoading();

            if (orderRes.result && orderRes.result.success) {
              const updatedBookInfo = {
                ...bookInfo,
                status: 'reserved',
                statusText: '预定中'
              };
              this.setData({
                isReserved: true,
                bookInfo: updatedBookInfo
              });

              let publishedBooks = wx.getStorageSync('published_books') || [];
              const bookIndex = publishedBooks.findIndex(book => book.id === bookId || book._id === bookId);
              if (bookIndex !== -1) {
                publishedBooks[bookIndex].status = 'reserved';
                publishedBooks[bookIndex].statusText = '预定中';
                wx.setStorageSync('published_books', publishedBooks);
              }

              if (app.globalData.books) {
                const globalBookIndex = app.globalData.books.findIndex(book => book.id === bookId || book._id === bookId);
                if (globalBookIndex !== -1) {
                  app.globalData.books[globalBookIndex].status = 'reserved';
                  app.globalData.books[globalBookIndex].statusText = '预定中';
                }
              }

              // 不显示支付成功提示，直接跳转
              wx.vibrateShort({ type: 'medium' });

              wx.navigateTo({
                url: '/pages/my-orders/my-orders'
              });
              
            } else {
              wx.showToast({
                title: orderRes.result ? orderRes.result.message : '预定失败',
                icon: 'error',
                duration: 1500
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('创建订单失败:', err);
            wx.showToast({
              title: '预定失败，请重试',
              icon: 'error',
              duration: 1500
            });
          });
        }
      }
    });
  },

  cancelReservation: function() {
    const { bookId } = this.data;
    
    wx.showModal({
      title: '取消预定',
      content: '确定要取消预定吗？',
      confirmText: '取消预定',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          try {
            let reservations = wx.getStorageSync('reservations') || [];
            
            // 确保是数组
            if (!Array.isArray(reservations)) {
              reservations = [];
            }
            
            const newReservations = reservations.filter(
              item => item.bookId !== bookId
            );
            
            wx.setStorageSync('reservations', newReservations);
            
            this.setData({ isReserved: false });
            
            wx.showToast({
              title: '已取消',
              icon: 'success',
              duration: 1500
            });
            
            wx.vibrateShort({ type: 'light' });
            
          } catch (error) {
            console.error('取消预定失败:', error);
            wx.showToast({
              title: '操作失败',
              icon: 'error',
              duration: 1500
            });
          }
        }
      }
    });
  },

  // 取消订单（买家专用）
  cancelOrder: function() {
    const { bookId, bookInfo } = this.data;
    const app = getApp();
    const openid = app.globalData.openid || wx.getStorageSync('openid');
    
    wx.showModal({
      title: '取消订单',
      content: `确定要取消《${bookInfo.title}》的订单吗？`,
      confirmText: '取消订单',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '处理中...',
            mask: true
          });
          
          // 调用云函数查询订单
          wx.cloud.callFunction({
            name: 'getMyOrders',
            data: {
              type: 'buy',
              category: 'book',
              status: 'all',
              page: 1,
              pageSize: 100
            }
          }).then(orderRes => {
            wx.hideLoading();
            
            if (orderRes.result && orderRes.result.success && orderRes.result.data.orders) {
              const orders = orderRes.result.data.orders;
              // 查找该书籍的订单
              const targetOrder = orders.find(order =>
                (order.bookId === bookId || (order.bookInfo && order.bookInfo._id === bookId)) &&
                order.status !== 'completed' &&
                order.status !== 'cancelled'
              );
              
              if (!targetOrder) {
                wx.showToast({
                  title: '未找到订单',
                  icon: 'none'
                });
                return;
              }
              
              // 调用云函数取消订单
              wx.showLoading({
                title: '取消中...',
                mask: true
              });
              
              wx.cloud.callFunction({
                name: 'updateOrderStatus',
                data: {
                  orderId: targetOrder._id,
                  category: 'book',
                  status: 'cancelled'
                }
              }).then(cancelRes => {
                wx.hideLoading();
                
                if (cancelRes.result && cancelRes.result.success) {
                  wx.showToast({
                    title: '订单已取消',
                    icon: 'success',
                    duration: 1500
                  });
                  
                  wx.vibrateShort({ type: 'light' });
                  
                  // 更新书籍状态
                  const updatedBookInfo = {
                    ...bookInfo,
                    status: 'available',
                    statusText: '在售'
                  };
                  this.setData({ 
                    isBuyer: false,
                    bookInfo: updatedBookInfo 
                  });
                  
                  // 延迟刷新页面
                  setTimeout(() => {
                    this.loadBookDetail(bookId);
                  }, 1500);
                } else {
                  wx.showToast({
                    title: cancelRes.result ? cancelRes.result.message : '取消失败',
                    icon: 'none'
                  });
                }
              }).catch(err => {
                wx.hideLoading();
                console.error('取消订单失败:', err);
                wx.showToast({
                  title: '取消失败，请重试',
                  icon: 'none'
                });
              });
            } else {
              wx.showToast({
                title: '查询订单失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('查询订单失败:', err);
            wx.showToast({
              title: '网络错误，请稍后重试',
              icon: 'none'
            });
          });
        }
      }
    });
  },

  // 立即购买
  buyNow: function() {
    const app = getApp();
    
    if (!app.globalData.isLoggedIn) {
      this.showLoginPrompt();
      return;
    }
    
    const { bookInfo, bookId } = this.data;
    
    if (bookInfo.status !== 'available') {
      wx.showToast({
        title: '书籍不可购买',
        icon: 'error',
        duration: 2000
      });
      return;
    }
    
    wx.showModal({
      title: '确认购买',
      content: `确定要购买《${bookInfo.title}》吗？\n价格：¥${bookInfo.price}`,
      confirmText: '立即购买',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: `/pages/order-confirm/order-confirm?bookId=${bookId}&title=${encodeURIComponent(bookInfo.title)}&price=${bookInfo.price}`
          });
        }
      }
    });
  },

  // 联系卖家
  contactSeller: function() {
    const app = getApp();
    
    if (!app.globalData.isLoggedIn) {
      this.showLoginPrompt();
      return;
    }
    
    const { bookInfo } = this.data;
    
    // 跳转到聊天页面
    wx.navigateTo({
      url: `/pages/chat/chat?userId=${bookInfo.sellerId}&nickname=${encodeURIComponent(bookInfo.sellerName)}&avatar=${encodeURIComponent(bookInfo.sellerAvatar)}`
    });
  },

  // 暂时下架
  toggleShelve: function() {
    const { bookInfo, bookId } = this.data;
    const newStatus = bookInfo.status === 'available' ? 'offline' : 'available';
    const newStatusText = newStatus === 'available' ? '在售' : '已下架';
    
    wx.showModal({
      title: newStatus === 'available' ? '上架书籍' : '暂时下架',
      content: newStatus === 'available' ? '确定要上架该书籍吗？' : '确定要暂时下架该书籍吗？',
      confirmText: '确定',
      confirmColor: '#f59e0b',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });
          
          // 调用云函数更新数据库
          wx.cloud.callFunction({
            name: 'updateBookStatus',
            data: {
              bookId: bookId,
              status: newStatus
            },
            success: (cloudRes) => {
              wx.hideLoading();
              
              if (cloudRes.result && cloudRes.result.success) {
                // 更新本地存储
                let publishedBooks = wx.getStorageSync('published_books') || [];
                const bookIndex = publishedBooks.findIndex(book => book.id === bookId || book._id === bookId);
                
                if (bookIndex !== -1) {
                  publishedBooks[bookIndex].status = newStatus;
                  publishedBooks[bookIndex].statusText = newStatusText;
                  wx.setStorageSync('published_books', publishedBooks);
                }
                
                // 更新全局数据
                const app = getApp();
                if (app.globalData.books) {
                  const globalBookIndex = app.globalData.books.findIndex(book => book.id === bookId || book._id === bookId);
                  if (globalBookIndex !== -1) {
                    app.globalData.books[globalBookIndex].status = newStatus;
                    app.globalData.books[globalBookIndex].statusText = newStatusText;
                  }
                }
                
                // 设置刷新标志
                wx.setStorageSync('should_refresh_books', true);
                
                // 更新页面数据
                const updatedBookInfo = {
                  ...bookInfo,
                  status: newStatus,
                  statusText: newStatusText
                };
                this.setData({ bookInfo: updatedBookInfo });
                
                wx.showToast({
                  title: newStatus === 'available' ? '上架成功' : '下架成功',
                  icon: 'success',
                  duration: 1500
                });
              } else {
                wx.showToast({
                  title: cloudRes.result ? cloudRes.result.message : '操作失败',
                  icon: 'none'
                });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('调用云函数失败:', err);
              wx.showToast({
                title: '操作失败，请重试',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  // 举报功能
  reportBook: function() {
    const { bookInfo } = this.data;
    const reportTypes = [
      '版权侵权',
      '内容违规',
      '虚假信息',
      '垃圾广告',
      '其他原因'
    ];

    wx.showActionSheet({
      itemList: reportTypes,
      itemColor: '#333',
      success: (res) => {
        const selectedType = reportTypes[res.tapIndex];

        if (selectedType === '其他原因') {
          // 其他原因需要填写具体内容
          wx.showModal({
            title: '填写举报理由',
            editable: true,
            placeholderText: '请详细描述您举报的原因',
            confirmText: '确认举报',
            cancelText: '取消',
            confirmColor: '#ff6b6b',
            success: (editRes) => {
              if (editRes.confirm && editRes.content.trim()) {
                this.submitReport(selectedType, editRes.content.trim());
              } else if (editRes.confirm && !editRes.content.trim()) {
                wx.showToast({
                  title: '请填写举报理由',
                  icon: 'none',
                  duration: 2000
                });
              }
            }
          });
        } else {
          // 其他类型直接确认举报
          wx.showModal({
            title: '确认举报',
            content: `您确定要举报此书籍吗？\n举报类型：${selectedType}`,
            confirmText: '确认举报',
            cancelText: '取消',
            confirmColor: '#ff6b6b',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.submitReport(selectedType, selectedType);
              }
            }
          });
        }
      },
      fail: (res) => {
        console.log('取消举报', res);
      }
    });
  },

  // 提交举报到云端
  submitReport: function(reportType, reason) {
    if (!this.data.bookInfo) {
      wx.showToast({
        title: '书籍信息不存在',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '提交举报...',
      mask: true
    });

    const bookInfo = this.data.bookInfo;

    wx.cloud.callFunction({
      name: 'createReport',
      data: {
        targetType: 'book',
        targetId: bookInfo._id,
        reportType: reportType,
        reason: reason
      }
    }).then(res => {
      wx.hideLoading();

      if (res.result && res.result.success) {
        wx.showToast({
          title: '举报已受理',
          icon: 'success',
          duration: 2000
        });
      } else {
        wx.showToast({
          title: res.result ? res.result.message : '举报失败',
          icon: 'none',
          duration: 2000
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('调用举报云函数失败:', err);
      wx.showToast({
        title: '网络错误，请重试',
        icon: 'none',
        duration: 2000
      });
    });
  },

  // 分享
  shareBook: function() {
    const { bookInfo } = this.data;
    
    wx.showActionSheet({
      itemList: ['分享给好友', '取消'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showShareMenu({ withShareTicket: true });
        }
      }
    });
  },

  // 跳转到卖家其他书籍
  goToRelatedBook: function(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/book-detail/book-detail?id=${bookId}`
    });
  },

  // 跳转到卖家个人主页
  goToSellerProfile: function() {
    const { bookInfo } = this.data;

    console.log('跳转到卖家主页，sellerId:', bookInfo.sellerId);

    // 如果是自己的书籍，不跳转
    if (this.data.isOwnBook) {
      wx.showToast({
        title: '这是您自己的书籍',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    // 优先使用 _openid，其次使用 sellerId，最后使用 _id
    // 注意：书籍数据中的 sellerId 字段存储的是 _openid 的值
    const sellerId = bookInfo._openid || bookInfo.sellerId || bookInfo._id;

    if (!sellerId) {
      wx.showToast({
        title: '获取卖家信息失败',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    console.log('最终跳转的sellerId:', sellerId);

    // 跳转到用户中心页面
    wx.navigateTo({
      url: `/pages/user-center/user-center?id=${sellerId}&tab=books`
    });
  },

  // 返回
  goBack: function() {
    wx.navigateBack();
  },

  // 轮播图切换事件
  onSwiperChange: function(e) {
    this.setData({
      currentImageIndex: e.detail.current
    });
  },

  // 预览图片
  previewImage: function(e) {
    const { bookInfo } = this.data;
    const currentIndex = e && e.currentTarget ? e.currentTarget.dataset.index : 0;
    
    wx.previewImage({
      urls: bookInfo.images,
      current: bookInfo.images[currentIndex] || bookInfo.images[0]
    });
  },

  // 登录提示
  showLoginPrompt: function() {
    wx.showModal({
      title: '提示',
      content: '请先登录',
      confirmText: '去登录',
      cancelText: '再看看',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }
      }
    });
  },

  // 错误提示
  showError: function(message) {
    this.setData({ error: true });
    
    wx.showModal({
      title: '错误',
      content: message,
      showCancel: false,
      confirmText: '确定',
      success: (res) => {
        if (res.confirm) wx.navigateBack();
      }
    });
  }
});