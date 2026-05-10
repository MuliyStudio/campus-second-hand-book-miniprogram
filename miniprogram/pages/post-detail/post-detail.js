// pages/post-detail/post-detail.js
Page({
  data: {
    // 帖子数据
    post: null,
    isLoading: true,
    showFullContent: false,
    shouldShowToggleButton: false,
    isPostAuthor: false,
    
    // 评论相关
    commentInput: '',
    isSubmittingComment: false,
    autoFocusInput: false,
    scrollTop: 0,
    
    // 点赞收藏相关
    isLiking: false,
    isCollecting: false,
    
    // 回复相关
    showReplyInput: false,
    replyContent: '',
    replyToCommentId: '',
    replyToCommentIndex: -1,
    replyToAuthor: '',
    
    // 当前用户 openid
    currentUserOpenid: '',
    
    // 表情相关
    showEmojiPanel: false,
    emojiList: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
      '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
      '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
      '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓',
      '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄',
      '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵',
      '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠',
      '😈', '👿', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺'
    ],
    emojiInput: '',
    
    // 分享菜单
    showShareMenuPanel: false,
    
    // 举报相关
    showReportDialog: false,
    selectedReportOption: '',
    reportReason: '',
    reportOptions: [
      { value: 'illegal', label: '违法违规内容' },
      { value: 'spam', label: '垃圾广告' },
      { value: 'fake', label: '虚假信息' },
      { value: 'abuse', label: '辱骂骚扰' },
      { value: 'other', label: '其他原因' }
    ],
    
    // 当前用户信息
    currentUserAvatar: '/images/default-avatar.png',
    
    // 滚动相关
    lastScrollTop: 0,
    isScrolling: false
  },

  onLoad(options) {
    const postId = options.id || 'post_1';
    console.log('加载帖子详情，ID:', postId);
    
    // 获取当前用户 openid
    this.getCurrentUserOpenid();
    
    // 获取当前用户信息
    this.getCurrentUserInfo();
    
    // 加载帖子详情
    this.loadPostDetail(postId);
    
    // 更新浏览量
    this.updateViewCount(postId);
  },

  onShow() {
    // 页面显示时恢复滚动位置
    if (this.data.post) {
      setTimeout(() => {
        this.setData({
          scrollTop: this.data.lastScrollTop
        });
      }, 100);
    }
  },

  onHide() {
    // 保存当前滚动位置
    if (this.data.scrollTop > 0) {
      this.setData({
        lastScrollTop: this.data.scrollTop
      });
    }
  },

  // 获取公开的图片URL
  getPublicImageUrl: function(fileId) {
    return new Promise((resolve, reject) => {
      if (!fileId || fileId.startsWith('http')) {
        resolve(fileId);
        return;
      }
      
      wx.cloud.callFunction({
        name: 'updateFilePermission',
        data: {
          fileID: fileId
        },
        success: (res) => {
          if (res.result.success) {
            resolve(res.result.data.tempFileURL);
          } else {
            console.error('获取公开图片URL失败:', res.result.message);
            resolve(fileId);
          }
        },
        fail: (err) => {
          console.error('调用云函数失败:', err);
          resolve(fileId);
        }
      });
    });
  },

  // 获取当前用户 openid
  getCurrentUserOpenid() {
    const app = getApp();
    if (app.globalData.openid) {
      this.setData({
        currentUserOpenid: app.globalData.openid
      });
    } else {
      wx.cloud.callFunction({
        name: 'login',
        success: (res) => {
          if (res.result && res.result.openid) {
            this.setData({
              currentUserOpenid: res.result.openid
            });
            app.globalData.openid = res.result.openid;
          }
        },
        fail: (err) => {
          console.error('获取 openid 失败:', err);
        }
      });
    }
  },

  // 获取当前用户信息
  getCurrentUserInfo() {
    const app = getApp();
    if (app.globalData.userInfo) {
      const avatarUrl = app.globalData.userInfo.avatarUrl || this.data.currentUserAvatar;
      this.getPublicImageUrl(avatarUrl).then(publicUrl => {
        this.setData({
          currentUserAvatar: publicUrl
        });
      });
    }
  },

  // 加载帖子详情
  loadPostDetail(postId) {
    this.setData({ isLoading: true });
    console.log('开始加载帖子详情，ID:', postId);

    // 调用云函数获取帖子详情
    wx.cloud.callFunction({
      name: 'getPostDetail',
      data: {
        postId: postId
      },
      success: (res) => {
        console.log('云函数调用成功，结果:', res);
        if (res.result.success) {
          console.log('获取帖子详情成功，数据:', res.result.data);
          let post = res.result.data;

          // 确保帖子数据结构完整
          post = {
            ...post,
            title: post.title || '未命名帖子',
            content: post.content || '',
            author: post.author || { _id: 'unknown', nickname: '未知用户', avatarUrl: 'https://via.placeholder.com/100x100/667eea/ffffff?text=用户' },
            images: post.images || [],
            videos: post.videos || [],
            tags: post.tags || [],
            likeCount: post.likeCount || 0,
            commentCount: post.commentCount || 0,
            collectCount: post.collectCount || 0,
            viewCount: post.viewCount || 0,
            shareCount: post.shareCount || 0,
            isLiked: post.isLiked || false,
            isFavorited: post.isFavorited || false,
            createTime: post.createTime || new Date().toISOString(),
            comments: post.comments || []
          };

          // 处理所有头像URL
          const processAvatars = async () => {
            // 处理作者头像
            if (post.author && post.author.avatarUrl) {
              post.author.avatarUrl = await this.getPublicImageUrl(post.author.avatarUrl);
            }

            // 处理评论作者头像
            if (post.comments && post.comments.length > 0) {
              for (const comment of post.comments) {
                if (comment.authorInfo && comment.authorInfo.avatarUrl) {
                  comment.authorInfo.avatarUrl = await this.getPublicImageUrl(comment.authorInfo.avatarUrl);
                }
                // 处理回复作者头像
                if (comment.replies && comment.replies.length > 0) {
                  for (const reply of comment.replies) {
                    if (reply.author && reply.author.avatarUrl) {
                      reply.author.avatarUrl = await this.getPublicImageUrl(reply.author.avatarUrl);
                    }
                  }
                }
              }
            }

            return post;
          };

          // 合并处理头像和图片的异步操作
          const processAllData = async () => {
            // 处理头像
            if (post.author && post.author.avatarUrl) {
              post.author.avatarUrl = await this.getPublicImageUrl(post.author.avatarUrl);
            }

            // 处理评论作者头像
            if (post.comments && post.comments.length > 0) {
              for (const comment of post.comments) {
                if (comment.authorInfo && comment.authorInfo.avatarUrl) {
                  comment.authorInfo.avatarUrl = await this.getPublicImageUrl(comment.authorInfo.avatarUrl);
                }
                // 处理回复作者头像
                if (comment.replies && comment.replies.length > 0) {
                  for (const reply of comment.replies) {
                    if (reply.author && reply.author.avatarUrl) {
                      reply.author.avatarUrl = await this.getPublicImageUrl(reply.author.avatarUrl);
                    }
                  }
                }
              }
            }

            // 处理帖子图片
            if (post.images && post.images.length > 0) {
              console.log('开始处理帖子图片，原始数据:', post.images);
              const processedImages = [];
              for (const image of post.images) {
                let imageUrl = '';
                // 兼容 fileID 和 fileId 两种字段名
                const cloudFileId = image.fileID || image.fileId;
                if (cloudFileId && !cloudFileId.startsWith('http')) {
                  // 云存储文件，需要通过云函数获取新的临时访问链接
                  imageUrl = await this.getPublicImageUrl(cloudFileId);
                  console.log('转换云存储图片:', cloudFileId, '->', imageUrl);
                } else if (image.url) {
                  imageUrl = image.url;
                } else if (image.path) {
                  imageUrl = image.path;
                } else if (cloudFileId) {
                  // fileID 本身就是 http URL
                  imageUrl = cloudFileId;
                }
                processedImages.push({
                  ...image,
                  // 用获取到的新 URL 覆盖可能过期的 url
                  url: imageUrl
                });
              }
              post.images = processedImages;
              console.log('图片处理完成，最终数据:', post.images);
            }

            return post;
          };

          processAllData().then(processedPost => {
            // 判断是否显示展开按钮（基于字数，超过1000字显示）
            const contentLength = processedPost.content.length;
            console.log('帖子内容长度:', contentLength);
            const shouldShowFullContent = contentLength > 1000;

            // 判断当前用户是否是发帖人
            const app = getApp();
            const currentUserId = app.globalData.openid || 'current_user';
            const isPostAuthor = currentUserId === processedPost.author._id;

            // 检查用户的点赞、收藏和评论状态
            if (app.globalData.isLoggedIn) {
              // 优先使用从云函数返回的状态，而不是本地存储的数据
              // 这样可以确保与云端数据保持同步
              console.log('使用云函数返回的点赞状态:', processedPost.isLiked);
              console.log('使用云函数返回的收藏状态:', processedPost.isFavorited);
              
              // 更新本地存储的数据以匹配云端状态
              if (processedPost.isLiked) {
                // 确保本地存储中有这条点赞记录
                const existingLike = app.globalData.userLikes.find(like => like.itemId === processedPost._id && like.type === 'post');
                if (!existingLike) {
                  app.globalData.userLikes.push({
                    _id: 'temp_' + Date.now(),
                    userId: app.globalData.openid,
                    itemId: processedPost._id,
                    type: 'post',
                    itemData: processedPost,
                    createTime: new Date().toISOString()
                  });
                  app.saveUserDataToStorage();
                }
              } else {
                // 确保本地存储中没有这条点赞记录
                app.globalData.userLikes = (app.globalData.userLikes || []).filter(like => like.itemId !== processedPost._id || like.type !== 'post');
                app.saveUserDataToStorage();
              }
              
              if (processedPost.isFavorited) {
                // 确保本地存储中有这条收藏记录
                const existingFavorite = app.globalData.userFavorites.find(fav => fav.itemId === processedPost._id && fav.type === 'post');
                if (!existingFavorite) {
                  app.globalData.userFavorites.push({
                    _id: 'temp_' + Date.now(),
                    userId: app.globalData.openid,
                    itemId: processedPost._id,
                    type: 'post',
                    itemData: processedPost,
                    createTime: new Date().toISOString()
                  });
                  app.saveUserDataToStorage();
                }
              } else {
                // 确保本地存储中没有这条收藏记录
                app.globalData.userFavorites = (app.globalData.userFavorites || []).filter(fav => fav.itemId !== processedPost._id || fav.type !== 'post');
                app.saveUserDataToStorage();
              }
            }

            this.setData({
              post: processedPost,
              isLoading: false,
              showFullContent: shouldShowFullContent ? false : true,
              shouldShowToggleButton: shouldShowFullContent,
              isPostAuthor: isPostAuthor
            });
            console.log('设置帖子数据成功');

            // 设置页面标题
            wx.setNavigationBarTitle({
              title: processedPost.title
            });

            // 滚动到顶部
            setTimeout(() => {
              this.setData({ scrollTop: 0 });
            }, 100);
          }).catch(err => {
            console.error('处理头像URL失败:', err);
            // 即使处理失败也继续显示数据
            const contentLength = post.content.length;
            const shouldShowFullContent = contentLength > 1000;

            const app = getApp();
            const currentUserId = app.globalData.openid || 'current_user';
            const isPostAuthor = currentUserId === post.author._id;

            this.setData({
              post: post,
              isLoading: false,
              showFullContent: shouldShowFullContent ? false : true,
              shouldShowToggleButton: shouldShowFullContent,
              isPostAuthor: isPostAuthor
            });

            wx.setNavigationBarTitle({
              title: post.title
            });

            setTimeout(() => {
              this.setData({ scrollTop: 0 });
            }, 100);
          });
        } else {
          console.error('获取帖子详情失败:', res.result.message, res.result.error);
          this.setData({ isLoading: false });
          wx.showToast({
            title: res.result.message || '获取帖子详情失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        console.error('调用云函数失败:', err);
        this.setData({ isLoading: false });
        wx.showToast({
          title: '获取帖子详情失败: ' + (err.errMsg || '网络错误'),
          icon: 'none',
          duration: 3000
        });
      }
    });
  },

  // 更新浏览量
  updateViewCount(postId) {
    // 模拟更新浏览量
    setTimeout(() => {
      if (this.data.post) {
        const post = this.data.post;
        post.viewCount += 1;
        this.setData({ post });
      }
    }, 1000);
  },

  // 滚动事件
  onScroll(e) {
    const scrollTop = e.detail.scrollTop;
    this.setData({ scrollTop });
  },

  // 滚动到底部
  onReachBottom() {
    console.log('滚动到底部');
    // 这里可以加载更多评论
  },

  // 格式化时间
  formatTime(timeString) {
    const time = new Date(timeString);
    const year = time.getFullYear();
    const month = time.getMonth() + 1;
    const day = time.getDate();
    const hours = time.getHours();
    const minutes = String(time.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  // 格式化评论时间
  formatCommentTime(timeString) {
    const time = new Date(timeString);
    const year = time.getFullYear();
    const month = time.getMonth() + 1;
    const day = time.getDate();
    const hours = time.getHours();
    const minutes = String(time.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  // 获取帖子类型标签
  getPostTypeLabel(type) {
    const typeMap = {
      'share': '分享',
      'help': '求助',
      'question': '提问',
      'experience': '经验'
    };
    return typeMap[type] || '帖子';
  },

  // 显示更多操作
  showMoreActions() {
    wx.showActionSheet({
      itemList: ['举报', '分享', '复制链接'],
      itemColor: '#333',
      success: (res) => {
        switch (res.tapIndex) {
          case 0: // 举报
            this.showReportDialog();
            break;
          case 1: // 分享
            this.showShareMenu();
            break;
          case 2: // 复制链接
            this.copyPostLink();
            break;
        }
      }
    });
  },

  // 显示举报对话框
  showReportDialog() {
    this.setData({
      showReportDialog: true,
      selectedReportOption: '',
      reportReason: ''
    });
  },

  // 关闭举报对话框
  closeReportDialog() {
    this.setData({ showReportDialog: false });
  },

  // 选择举报选项
  onReportOptionChange(e) {
    this.setData({
      selectedReportOption: e.detail.value
    });
  },

  // 输入举报原因
  bindReportReason(e) {
    this.setData({ reportReason: e.detail.value });
  },

  // 提交举报
  submitReport() {
    const { selectedReportOption, reportReason, post } = this.data;
    
    if (!selectedReportOption) {
      wx.showToast({
        title: '请选择举报原因',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    if (selectedReportOption === 'other' && !reportReason.trim()) {
      wx.showToast({
        title: '请填写举报原因',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    if (!post || !post._id) {
      wx.showToast({
        title: '帖子信息获取失败',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    // 映射举报类型
    const reportTypeMap = {
      'illegal': '内容违规',
      'spam': '垃圾广告',
      'fake': '虚假信息',
      'abuse': '其他原因'
    };

    wx.showLoading({
      title: '提交中...',
      mask: true
    });

    // 调用云函数创建举报
    wx.cloud.callFunction({
      name: 'createReport',
      data: {
        targetType: 'post',
        targetId: post._id,
        reportType: reportTypeMap[selectedReportOption] || '其他原因',
        reason: selectedReportOption === 'other' ? reportReason : reportTypeMap[selectedReportOption],
        evidence: '',
        contact: ''
      },
      success: (res) => {
        wx.hideLoading();
        console.log('举报提交结果:', res);

        if (res.result && res.result.success) {
          this.closeReportDialog();
          this.setData({
            selectedReportOption: '',
            reportReason: ''
          });

          wx.showToast({
            title: '举报已受理',
            icon: 'success',
            duration: 2000
          });
        } else {
          wx.showToast({
            title: (res.result && res.result.message) || '举报提交失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('举报提交失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 复制帖子链接
  copyPostLink() {
    const postId = this.data.post && this.data.post._id;
    if (!postId) return;
    
    const link = `https://example.com/post/${postId}`;
    wx.setClipboardData({
      data: link,
      success: () => {
        wx.showToast({
          title: '链接已复制',
          icon: 'success',
          duration: 1500
        });
      }
    });
  },

  // 显示分享菜单
  showShareMenu() {
    this.setData({ showShareMenuPanel: true });
  },

  // 关闭分享菜单
  closeShareMenu() {
    this.setData({ showShareMenuPanel: false });
  },

  // 处理分享
  onShare(e) {
    const type = e.currentTarget.dataset.type;
    console.log('分享类型:', type);
    
    if (!this.data.post) return;
    
    if (type === 'copy') {
      // 复制链接
      this.copyPostLink();
    } else if (type === 'more') {
      // 更多分享选项
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }
  },
  
  // 更新分享数
  updateShareCount() {
    if (!this.data.post) return;
    
    const post = this.data.post;
    post.shareCount = (post.shareCount || 0) + 1;
    
    this.setData({ post });
  },

  // 点赞帖子
  likePost() {
    if (this.data.isLiking || !this.data.post) return;

    // 检查登录状态
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后可以点赞',
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
      return;
    }

    this.setData({ isLiking: true });

    const post = this.data.post;
    const newIsLiked = !post.isLiked;
    post.isLiked = newIsLiked;
    post.likeCount += newIsLiked ? 1 : -1;

    if (newIsLiked) {
      // 添加点赞
      wx.cloud.callFunction({
        name: 'addLike',
        data: {
          itemId: post._id,
          type: 'post',
          itemData: post
        },
        success: (res) => {
          if (res.result.success) {
            // 更新本地点赞数据
            if (!app.globalData.userLikes) {
              app.globalData.userLikes = [];
            }
            app.globalData.userLikes.push({
              _id: res.result.data._id,
              userId: app.globalData.openid,
              itemId: post._id,
              type: 'post',
              itemData: post,
              createTime: new Date().toISOString()
            });
            app.saveUserDataToStorage();
            
            this.setData({ 
              post, 
              isLiking: false 
            });
            
            wx.showToast({
              title: '点赞成功',
              icon: 'success',
              duration: 1000
            });
          } else {
            post.isLiked = !newIsLiked;
            post.likeCount += newIsLiked ? -1 : 1;
            this.setData({ 
              post, 
              isLiking: false 
            });
            wx.showToast({
              title: res.result.message || '点赞失败',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (err) => {
          console.error('添加点赞失败:', err);
          post.isLiked = !newIsLiked;
          post.likeCount += newIsLiked ? -1 : 1;
          this.setData({ 
            post, 
            isLiking: false 
          });
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    } else {
      // 移除点赞
      wx.cloud.callFunction({
        name: 'removeLike',
        data: {
          itemId: post._id,
          type: 'post'
        },
        success: (res) => {
          if (res.result.success) {
            // 更新本地点赞数据
            app.globalData.userLikes = (app.globalData.userLikes || []).filter(like => like.itemId !== post._id || like.type !== 'post');
            app.saveUserDataToStorage();
            
            this.setData({ 
              post, 
              isLiking: false 
            });
            
            wx.showToast({
              title: '取消点赞',
              icon: 'success',
              duration: 1000
            });
          } else {
            post.isLiked = !newIsLiked;
            post.likeCount += newIsLiked ? -1 : 1;
            this.setData({ 
              post, 
              isLiking: false 
            });
            wx.showToast({
              title: res.result.message || '取消点赞失败',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (err) => {
          console.error('移除点赞失败:', err);
          post.isLiked = !newIsLiked;
          post.likeCount += newIsLiked ? -1 : 1;
          this.setData({ 
            post, 
            isLiking: false 
          });
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    }
  },

  // 切换收藏
  toggleCollect() {
    if (this.data.isCollecting || !this.data.post) return;

    // 检查登录状态
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后可以收藏',
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
      return;
    }

    this.setData({ isCollecting: true });

    const post = this.data.post;
    const newIsCollected = !post.isFavorited;
    post.isFavorited = newIsCollected;
    post.collectCount += newIsCollected ? 1 : -1;

    if (newIsCollected) {
      // 添加收藏
      wx.cloud.callFunction({
        name: 'addFavorite',
        data: {
          itemId: post._id,
          type: 'post',
          itemData: post
        },
        success: (res) => {
          if (res.result.success) {
            // 更新本地收藏数据
            if (!app.globalData.userFavorites) {
              app.globalData.userFavorites = [];
            }
            app.globalData.userFavorites.push({
              _id: res.result.data._id,
              userId: app.globalData.openid,
              itemId: post._id,
              type: 'post',
              itemData: post,
              createTime: new Date().toISOString()
            });
            app.saveUserDataToStorage();
            
            this.setData({ 
              post, 
              isCollecting: false 
            });
            
            wx.showToast({
              title: '已收藏',
              icon: 'success',
              duration: 1000
            });
          } else {
            post.isFavorited = !newIsCollected;
            post.collectCount += newIsCollected ? -1 : 1;
            this.setData({ 
              post, 
              isCollecting: false 
            });
            wx.showToast({
              title: res.result.message || '收藏失败',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (err) => {
          console.error('添加收藏失败:', err);
          post.isFavorited = !newIsCollected;
          post.collectCount += newIsCollected ? -1 : 1;
          this.setData({ 
            post, 
            isCollecting: false 
          });
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    } else {
      // 移除收藏
      wx.cloud.callFunction({
        name: 'removeFavorite',
        data: {
          itemId: post._id,
          type: 'post'
        },
        success: (res) => {
          if (res.result.success) {
            // 更新本地收藏数据
            app.globalData.userFavorites = (app.globalData.userFavorites || []).filter(fav => fav.itemId !== post._id || fav.type !== 'post');
            app.saveUserDataToStorage();
            
            this.setData({ 
              post, 
              isCollecting: false 
            });
            
            wx.showToast({
              title: '已取消收藏',
              icon: 'success',
              duration: 1000
            });
          } else {
            post.isFavorited = !newIsCollected;
            post.collectCount += newIsCollected ? -1 : 1;
            this.setData({ 
              post, 
              isCollecting: false 
            });
            wx.showToast({
              title: res.result.message || '取消收藏失败',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (err) => {
          console.error('移除收藏失败:', err);
          post.isFavorited = !newIsCollected;
          post.collectCount += newIsCollected ? -1 : 1;
          this.setData({ 
            post, 
            isCollecting: false 
          });
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    }
  },

  // 评论输入
  bindCommentInput(e) {
    this.setData({
      commentInput: e.detail.value
    });
  },

  // 评论获取焦点
  onCommentFocus() {
    this.setData({ autoFocusInput: true });
  },

  // 评论失去焦点
  onCommentBlur() {
    this.setData({ autoFocusInput: false });
  },



  // 选择表情
  chooseCommentEmoji() {
    this.setData({ showEmojiPanel: true });
  },

  // 关闭表情面板
  closeEmojiPanel() {
    this.setData({ showEmojiPanel: false });
  },

  // 选择表情
  selectEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({
      emojiInput: this.data.emojiInput + emoji
    });
  },

  // 表情输入框输入
  bindEmojiInput(e) {
    this.setData({
      emojiInput: e.detail.value
    });
  },

  // 确认表情输入
  confirmEmojiInput() {
    const emojiInput = this.data.emojiInput.trim();
    if (emojiInput) {
      // 保存当前的评论输入内容
      const originalCommentInput = this.data.commentInput;
      
      // 将表情添加到评论输入框
      this.setData({
        commentInput: originalCommentInput + emojiInput,
        emojiInput: '',
        showEmojiPanel: false
      });
      
      // 直接调用评论发送函数
      this.submitComment();
    }
  },

  // 删除表情
  deleteEmoji() {
    const emojiInput = this.data.emojiInput;
    if (emojiInput) {
      // 每次删除两个字符，避免表情删除时出现乱码
      this.setData({
        emojiInput: emojiInput.slice(0, -2)
      });
      
      wx.vibrateShort({
        type: 'light'
      });
    }
  },

  // 发布评论
  submitComment() {
    const commentContent = this.data.commentInput.trim();
    if (!commentContent || this.data.isSubmittingComment || !this.data.post) {
      if (!commentContent) {
        wx.showToast({
          title: '请输入评论内容',
          icon: 'none',
          duration: 1500
        });
      }
      return;
    }

    // 检查登录状态
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后可以评论',
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
      return;
    }

    this.setData({ isSubmittingComment: true });

    const userInfo = app.globalData.userInfo || {
      nickname: '当前用户',
      avatarUrl: this.data.currentUserAvatar
    };

    // 调用云函数发布评论
    wx.cloud.callFunction({
      name: 'addComment',
      data: {
        postId: this.data.post._id,
        content: commentContent,
        authorInfo: {
          _id: app.globalData.openid,
          nickname: userInfo.nickname,
          avatarUrl: userInfo.avatarUrl,
          verified: false
        }
      },
      success: (res) => {
        console.log('发表评论结果:', res);
        if (res.result && res.result.success) {
          const newComment = {
            _id: res.result.data._id,
            postId: this.data.post._id,
            content: commentContent,
            authorInfo: {
              _id: app.globalData.openid,
              nickname: userInfo.nickname,
              avatarUrl: userInfo.avatarUrl,
              verified: false
            },
            createTime: res.result.data.createTime,
            likeCount: 0,
            isLiked: false,
            replies: []
          };

          const post = this.data.post;
          post.comments = post.comments || [];
          post.comments.unshift(newComment);
          post.commentCount = (post.commentCount || 0) + 1;

          this.setData({
            post,
            commentInput: '',
            isSubmittingComment: false,
            autoFocusInput: false
          });

          // 滚动到评论区域
          setTimeout(() => {
            this.setData({ scrollTop: 1000 });
          }, 100);

          wx.showToast({
            title: '评论成功',
            icon: 'success',
            duration: 1500
          });
        } else {
          this.setData({ isSubmittingComment: false });
          wx.showToast({
            title: (res.result && res.result.message) || '评论失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        console.error('发布评论失败:', err);
        this.setData({ isSubmittingComment: false });
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 点赞评论
  likeComment(e) {
    const commentIndex = e.currentTarget.dataset.index;
    if (!this.data.post) return;

    const post = this.data.post;
    const comment = post.comments[commentIndex];
    
    if (!comment) return;
    
    const newIsLiked = !comment.isLiked;
    comment.isLiked = newIsLiked;
    comment.likeCount += newIsLiked ? 1 : -1;

    // 检查登录状态
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后可以点赞',
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
      // 恢复原始状态
      comment.isLiked = !newIsLiked;
      comment.likeCount += newIsLiked ? -1 : 1;
      this.setData({ post });
      return;
    }

    if (newIsLiked) {
      // 添加点赞
      wx.cloud.callFunction({
        name: 'addLike',
        data: {
          itemId: comment._id,
          type: 'comment',
          itemData: comment
        },
        success: (res) => {
          if (!res.result.success) {
            comment.isLiked = !newIsLiked;
            comment.likeCount += newIsLiked ? -1 : 1;
            this.setData({ post });
            wx.showToast({
              title: res.result.message || '点赞失败',
              icon: 'none',
              duration: 2000
            });
          } else {
            this.setData({ post });
            wx.showToast({
              title: '已点赞',
              icon: 'success',
              duration: 1000
            });
          }
        },
        fail: (err) => {
          console.error('添加点赞失败:', err);
          comment.isLiked = !newIsLiked;
          comment.likeCount += newIsLiked ? -1 : 1;
          this.setData({ post });
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    } else {
      // 移除点赞
      wx.cloud.callFunction({
        name: 'removeLike',
        data: {
          itemId: comment._id,
          type: 'comment'
        },
        success: (res) => {
          if (!res.result.success) {
            comment.isLiked = !newIsLiked;
            comment.likeCount += newIsLiked ? -1 : 1;
            this.setData({ post });
            wx.showToast({
              title: res.result.message || '取消点赞失败',
              icon: 'none',
              duration: 2000
            });
          } else {
            this.setData({ post });
            wx.showToast({
              title: '已取消',
              icon: 'success',
              duration: 1000
            });
          }
        },
        fail: (err) => {
          console.error('移除点赞失败:', err);
          comment.isLiked = !newIsLiked;
          comment.likeCount += newIsLiked ? -1 : 1;
          this.setData({ post });
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    }
  },

  // 回复评论
  replyComment(e) {
    const commentIndex = e.currentTarget.dataset.index;
    const comment = this.data.post.comments[commentIndex];
    
    if (!comment || !comment.authorInfo) return;
    
    this.setData({
      showReplyInput: true,
      replyToCommentId: comment._id,
      replyToCommentIndex: commentIndex,
      replyToAuthor: comment.authorInfo.nickname || '未知用户',
      replyContent: ''
    });
  },

  // 关闭回复输入
  closeReplyInput() {
    this.setData({
      showReplyInput: false,
      replyToCommentId: '',
      replyToCommentIndex: -1,
      replyToAuthor: '',
      replyContent: ''
    });
  },

  // 输入回复内容
  bindReplyInput(e) {
    this.setData({ replyContent: e.detail.value });
  },

  // 提交回复
  submitReply() {
    const { replyContent, replyToCommentId, replyToCommentIndex, post } = this.data;
    
    if (!replyContent.trim()) {
      wx.showToast({
        title: '请输入回复内容',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    if (!replyToCommentId || !post) return;
    
    const app = getApp();
    
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后可以回复评论',
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
      return;
    }
    
    const userInfo = app.globalData.userInfo || {
      nickname: '当前用户',
      avatarUrl: this.data.currentUserAvatar
    };
    
    wx.cloud.callFunction({
      name: 'addCommentReply',
      data: {
        postId: post._id,
        parentId: replyToCommentId,
        content: replyContent,
        authorInfo: {
          _id: app.globalData.openid,
          nickname: userInfo.nickname,
          avatarUrl: userInfo.avatarUrl
        }
      },
      success: (res) => {
        console.log('回复评论结果:', res);
        if (res.result && res.result.success) {
          const newReply = {
            _id: res.result.data._id,
            content: replyContent,
            author: {
              _id: app.globalData.openid,
              nickname: userInfo.nickname,
              avatarUrl: userInfo.avatarUrl
            },
            createTime: res.result.data.createTime
          };
          
          const updatedPost = { ...post };
          updatedPost.comments[replyToCommentIndex].replies = 
            updatedPost.comments[replyToCommentIndex].replies || [];
          updatedPost.comments[replyToCommentIndex].replies.push(newReply);
          
          this.setData({
            post: updatedPost,
            showReplyInput: false,
            replyContent: '',
            replyToCommentId: '',
            replyToCommentIndex: -1,
            replyToAuthor: ''
          });
          
          wx.showToast({
            title: '回复成功',
            icon: 'success',
            duration: 1500
          });
          
          wx.vibrateShort({
            type: 'light'
          });
        } else {
          wx.showToast({
            title: (res.result && res.result.message) || '回复失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        console.error('回复评论失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 显示评论菜单
  showCommentMenu(e) {
    const commentIndex = e.currentTarget.dataset.index;
    const comment = this.data.post.comments[commentIndex];
    
    if (!comment || !comment.authorInfo) return;
    
    const isAuthor = comment.authorInfo._id === 'current_user';
    
    wx.showActionSheet({
      itemList: isAuthor ? ['删除评论', '复制内容'] : ['举报评论', '复制内容'],
      itemColor: '#333',
      success: (res) => {
        if (res.tapIndex === 0) {
          if (isAuthor) {
            this.deleteComment(commentIndex);
          } else {
            this.reportComment(commentIndex);
          }
        } else if (res.tapIndex === 1) {
          wx.setClipboardData({
            data: comment.content,
            success: () => {
              wx.showToast({
                title: '已复制',
                icon: 'success',
                duration: 1000
              });
            }
          });
        }
      }
    });
  },

  // 显示评论删除菜单
  showCommentDeleteMenu(e) {
    const commentIndex = e.currentTarget.dataset.index;
    const comment = this.data.post.comments[commentIndex];
    
    if (!comment || !comment.authorInfo) return;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条评论吗？删除后无法恢复，且会同时删除该评论下的所有回复',
      confirmText: '删除',
      confirmColor: '#FA5151',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.deleteComment(commentIndex);
        }
      }
    });
  },

  // 删除评论
  deleteComment(commentIndex) {
    const post = this.data.post;
    const comment = post.comments[commentIndex];
    
    if (!comment) return;
    
    wx.cloud.callFunction({
      name: 'removeComment',
      data: { commentId: comment._id },
      success: (res) => {
        console.log('删除评论结果:', res);
        if (res.result && res.result.success) {
          post.comments.splice(commentIndex, 1);
          post.commentCount = Math.max(0, (post.commentCount || 1) - 1);
          
          this.setData({ post });
          
          wx.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 1500
          });
        } else {
          wx.showToast({
            title: (res.result && res.result.message) || '删除失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        console.error('删除评论失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 举报评论
  reportComment(commentIndex) {
    const post = this.data.post;
    const comment = post.comments[commentIndex];

    if (!comment || !comment._id) {
      wx.showToast({
        title: '评论信息获取失败',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    wx.showActionSheet({
      itemList: ['违法违规内容', '垃圾广告', '虚假信息', '辱骂骚扰', '其他原因'],
      itemColor: '#333',
      success: (res) => {
        const reasonMap = ['内容违规', '垃圾广告', '虚假信息', '其他原因', '其他原因'];

        wx.showLoading({
          title: '提交中...',
          mask: true
        });

        // 调用云函数创建举报
        wx.cloud.callFunction({
          name: 'createReport',
          data: {
            targetType: 'post', // 评论也属于帖子内容
            targetId: post._id,
            reportType: reasonMap[res.tapIndex],
            reason: reasonMap[res.tapIndex] + (comment.content ? `: ${comment.content.substring(0, 20)}...` : ''),
            evidence: '',
            contact: ''
          },
          success: (reportRes) => {
            wx.hideLoading();
            console.log('举报提交结果:', reportRes);

            if (reportRes.result && reportRes.result.success) {
              wx.showToast({
                title: '举报已受理',
                icon: 'success',
                duration: 1500
              });
            } else {
              wx.showToast({
                title: (reportRes.result && reportRes.result.message) || '举报提交失败',
                icon: 'none',
                duration: 2000
              });
            }
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('举报提交失败:', err);
            wx.showToast({
              title: '网络错误，请重试',
              icon: 'none',
              duration: 2000
            });
          }
        });
      }
    });
  },

  // 预览图片
  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.post.images.map(img => img.path || img.url);
    
    wx.previewImage({
      urls: images,
      current: images[index]
    });
  },

  // 跳转到用户主页
  goToUserProfile(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId || userId === 'current_user') return;
    
    wx.navigateTo({
      url: `/pages/user-center/user-center?id=${userId}`,
      fail: (err) => {
        console.error('跳转失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none',
          duration: 1500
        });
      }
    });
  },

  // 切换内容展开/收起
  toggleContent() {
    this.setData({
      showFullContent: !this.data.showFullContent
    });
  },

  // 聚焦评论输入框
  focusCommentInput() {
    this.setData({ autoFocusInput: true });
    
    // 滚动到评论输入区域
    setTimeout(() => {
      this.setData({ scrollTop: 2000 }); // 调整到评论输入区域
    }, 100);
  },

  // 返回
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 用户点击右上角分享
  onShareAppMessage() {
    wx.showToast({
      title: '暂时无法分享',
      icon: 'none',
      duration: 2000
    });
  },

  // 用户点击右上角分享到朋友圈
  onShareTimeline() {
    wx.showToast({
      title: '暂时无法分享',
      icon: 'none',
      duration: 2000
    });
  },

  // 页面卸载
  onUnload() {
    // 清理定时器等资源
  }
});