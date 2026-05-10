// pages/publish-post/publish-post.js
Page({
  data: {
    postInfo: {
      title: '',
      content: '',
      type: 'share',
      tags: []
    },
    postTypes: [
      { value: 'share', label: '分享', icon: '📤', color: '#4CAF50' },
      { value: 'help', label: '求助', icon: '🆘', color: '#FF9800' },
      { value: 'question', label: '提问', icon: '❓', color: '#2196F3' },
      { value: 'experience', label: '经验', icon: '📝', color: '#9C27B0' }
    ],
    suggestedTags: [
      '学习经验', '考试技巧', '资料分享', '课程推荐', 
      '校园生活', '社团活动', '兼职实习', '考研攻略',
      '留学咨询', '就业指导', '技术讨论', '作品展示'
    ],
    selectedImages: [],
    isSubmitting: false,
    canSubmit: false,
    tagInput: '',
    isTitleFocused: false,
    isContentFocused: false,
    isTagFocused: false,
    isDeletingImageIndex: -1
  },

  onLoad(options) {
    console.log('编辑模式参数:', options);
    
    if (options.edit && options.id) {
      this.loadPostData(options.id);
    }
    
    this.updateCanSubmit();
  },

  // 加载帖子数据（编辑模式）
  loadPostData(postId) {
    try {
      // 从本地存储获取帖子数据
      const userPosts = wx.getStorageSync('user_posts') || [];
      const post = userPosts.find(p => p._id === postId);
      
      if (post) {
        console.log('找到帖子数据:', post);
        
        // 填充表单数据
        this.setData({
          postInfo: {
            title: post.title || '',
            content: post.content || '',
            type: post.type || 'share',
            tags: post.tags || []
          },
          selectedImages: post.images || []
        });
        
        wx.showToast({
          title: '已加载帖子数据',
          icon: 'success',
          duration: 1000
        });
      } else {
        console.error('未找到帖子数据:', postId);
        wx.showToast({
          title: '未找到帖子数据',
          icon: 'none',
          duration: 1500
        });
      }
    } catch (error) {
      console.error('加载帖子数据失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 1500
      });
    }
  },

  onShow() {
    // 页面显示时更新发布按钮状态
    this.updateCanSubmit();
  },

  // 输入标题
  bindTitleInput(e) {
    const title = e.detail.value;
    this.setData({
      'postInfo.title': title
    });
    this.updateCanSubmit();
  },

  // 标题获取焦点
  onTitleFocus() {
    this.setData({ isTitleFocused: true });
  },

  // 标题失去焦点
  onTitleBlur() {
    this.setData({ isTitleFocused: false });
  },

  // 输入内容
  bindContentInput(e) {
    const content = e.detail.value;
    this.setData({
      'postInfo.content': content
    });
    this.updateCanSubmit();
  },

  // 内容获取焦点
  onContentFocus() {
    this.setData({ isContentFocused: true });
  },

  // 内容失去焦点
  onContentBlur() {
    this.setData({ isContentFocused: false });
  },

  // 选择帖子类型
  selectPostType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      'postInfo.type': type
    });
    
    // 添加振动反馈

  },

  // 选择图片
  chooseImages() {
    const that = this;
    const remainingCount = 9 - that.data.selectedImages.length;
    
    if (remainingCount <= 0) {
      wx.showToast({
        title: '最多只能选择9张图片',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    wx.chooseMedia({
      count: remainingCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      maxDuration: 30,
      camera: 'back',
      success(res) {
        const newImages = res.tempFiles.map(file => ({
          path: file.tempFilePath,
          size: file.size,
          width: file.width,
          height: file.height
        }));
        
        that.setData({
          selectedImages: [...that.data.selectedImages, ...newImages]
        });
        
        wx.showToast({
          title: `已添加${newImages.length}张图片`,
          icon: 'success',
          duration: 1000
        });
      },
      fail(err) {
        console.error('选择图片失败:', err);
        if (err.errMsg.includes('cancel')) return;
        
        wx.showToast({
          title: '选择图片失败',
          icon: 'none',
          duration: 1500
        });
      }
    });
  },

  // 预览图片
  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const urls = this.data.selectedImages.map(img => img.path);
    
    wx.previewImage({
      urls: urls,
      current: urls[index],
      success: () => {
        console.log('预览图片成功');
      },
      fail: (err) => {
        console.error('预览图片失败:', err);
      }
    });
  },

  // 删除选中的图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    
    this.setData({
      isDeletingImageIndex: index
    });
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张图片吗？',
      confirmText: '删除',
      confirmColor: '#FA5151',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          const newImages = [...this.data.selectedImages];
          newImages.splice(index, 1);
          this.setData({
            selectedImages: newImages,
            isDeletingImageIndex: -1
          });
          
          wx.showToast({
            title: '已删除',
            icon: 'success',
            duration: 1000
          });
        } else {
          this.setData({
            isDeletingImageIndex: -1
          });
        }
      }
    });
  },

  // 输入标签
  bindTagInput(e) {
    const value = e.detail.value;
    this.setData({
      tagInput: value
    });
  },

  // 标签获取焦点
  onTagFocus() {
    this.setData({ isTagFocused: true });
  },

  // 标签失去焦点
  onTagBlur() {
    this.setData({ isTagFocused: false });
  },

  // 选择推荐标签
  selectSuggestedTag(e) {
    const tag = e.currentTarget.dataset.tag;
    
    if (this.data.postInfo.tags.length >= 5) {
      wx.showToast({
        title: '最多只能添加5个标签',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    // 检查是否已存在相同标签
    if (this.data.postInfo.tags.includes(tag)) {
      wx.showToast({
        title: '该标签已存在',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    const newTags = [...this.data.postInfo.tags, tag];
    this.setData({
      'postInfo.tags': newTags
    });
    
    wx.vibrateShort({
      type: 'light'
    });
  },

  // 添加标签
  addTag() {
    const tag = this.data.tagInput.trim();
    
    if (!tag) {
      wx.showToast({
        title: '请输入标签内容',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    if (tag.length > 10) {
      wx.showToast({
        title: '标签不能超过10个字',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    if (this.data.postInfo.tags.length >= 5) {
      wx.showToast({
        title: '最多只能添加5个标签',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    // 检查是否已存在相同标签
    if (this.data.postInfo.tags.includes(tag)) {
      wx.showToast({
        title: '该标签已存在',
        icon: 'none',
        duration: 1000
      });
      this.setData({ tagInput: '' });
      return;
    }
    
    const newTags = [...this.data.postInfo.tags, tag];
    this.setData({
      'postInfo.tags': newTags,
      tagInput: ''
    });
    
    wx.showToast({
      title: '标签已添加',
      icon: 'success',
      duration: 1000
    });
    
    wx.vibrateShort({
      type: 'light'
    });
  },

  // 删除标签
  deleteTag(e) {
    const index = e.currentTarget.dataset.index;
    const tag = this.data.postInfo.tags[index];
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除标签"${tag}"吗？`,
      confirmText: '删除',
      confirmColor: '#FA5151',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          const newTags = [...this.data.postInfo.tags];
          newTags.splice(index, 1);
          this.setData({
            'postInfo.tags': newTags
          });
          
          wx.showToast({
            title: '已删除',
            icon: 'success',
            duration: 1000
          });
        }
      }
    });
  },

  // 阻止事件冒泡
  stopPropagation(e) {
    // 阻止事件冒泡
  },

  // 更新是否可以提交
  updateCanSubmit() {
    const { postInfo } = this.data;
    const hasTitle = postInfo.title.trim().length >= 5 && postInfo.title.trim().length <= 50;
    const hasContent = postInfo.content.trim().length >= 10 && postInfo.content.trim().length <= 2000;
    const canSubmit = hasTitle && hasContent;
    this.setData({ canSubmit });
  },

  // 验证表单
  validateForm() {
    const { postInfo } = this.data;
    const errors = [];
    
    // 验证标题
    if (!postInfo.title.trim()) {
      errors.push('请输入标题');
    } else if (postInfo.title.trim().length < 5) {
      errors.push('标题至少需要5个字');
    } else if (postInfo.title.trim().length > 50) {
      errors.push('标题不能超过50个字');
    }
    
    // 验证内容
    if (!postInfo.content.trim()) {
      errors.push('请输入内容');
    } else if (postInfo.content.trim().length < 10) {
      errors.push('内容至少需要10个字');
    } else if (postInfo.content.trim().length > 2000) {
      errors.push('内容不能超过2000字');
    }
    
    // 验证标签
    if (postInfo.tags.length === 0) {
      errors.push('请至少添加一个标签');
    }
    
    return errors;
  },

  // 发布帖子
  async submitPost() {
    if (!this.data.canSubmit || this.data.isSubmitting) {
      if (!this.data.canSubmit) {
        const errors = this.validateForm();
        if (errors.length > 0) {
          wx.showToast({
            title: errors[0],
            icon: 'none',
            duration: 2000
          });
        }
      }
      return;
    }
    
    // 验证表单
    const errors = this.validateForm();
    if (errors.length > 0) {
      wx.showToast({
        title: errors[0],
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 开始提交
    this.setData({ isSubmitting: true });
    
    try {
      // 获取全局应用实例
      const app = getApp();
      
      // 模拟上传媒体文件（实际项目中需要上传到服务器）
      const uploadedImages = await this.uploadImages();
      
      // 获取页面参数，判断是否为编辑模式
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const options = currentPage.options;
      const isEditMode = options.edit && options.id;
      
      if (isEditMode) {
        // 编辑模式：更新现有帖子
        await this.updateExistingPost(options.id, uploadedImages);
      } else {
        // 发布模式：创建新帖子
        await this.createNewPost(uploadedImages);
      }
      
      // 提交成功
      this.setData({ isSubmitting: false });
      
    } catch (error) {
      console.error('提交失败:', error);
      this.setData({ isSubmitting: false });

      // 根据错误信息显示不同的提示
      const errorMsg = error.message || '提交失败';
      if (errorMsg.includes('图片') && errorMsg.includes('违规')) {
        wx.showModal({
          title: '提交失败',
          content: '图片包含违规内容，请更换图片后重试',
          showCancel: false,
          confirmText: '确定',
          confirmColor: '#FA5151'
        });
      } else if (errorMsg.includes('图片') && errorMsg.includes('审核')) {
        wx.showModal({
          title: '提交失败',
          content: '图片审核失败，请稍后重试',
          showCancel: false,
          confirmText: '确定',
          confirmColor: '#FA5151'
        });
      } else {
        wx.showModal({
          title: '提交失败',
          content: errorMsg || '网络错误，请稍后重试',
          showCancel: false,
          confirmText: '确定',
          confirmColor: '#FA5151'
        });
      }
    }
  },

  // 创建新帖子
  async createNewPost(uploadedImages) {
    const app = getApp();

    // 准备帖子数据
    const postData = {
      title: this.data.postInfo.title.trim(),
      content: this.data.postInfo.content.trim(),
      type: this.data.postInfo.type,
      tags: this.data.postInfo.tags,
      images: uploadedImages,
author: {
  _id: (app.globalData.userInfo && app.globalData.userInfo._id) || app.globalData.openid || 'current_user',
  nickname: (app.globalData.userInfo && app.globalData.userInfo.nickname) || '当前用户',
  avatarUrl: (app.globalData.userInfo && app.globalData.userInfo.avatarUrl) || '/images/default-avatar.png',
  openid: app.globalData.openid || 'current_user'
}
    };
    
    // 调用云函数发布帖子
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'publishPost',
        data: postData,
        success: (res) => {
          if (res.result.success) {
            const newPost = res.result.data;
            
            // 保存到本地存储
            const userPosts = wx.getStorageSync('user_posts') || [];
            userPosts.unshift(newPost);
            wx.setStorageSync('user_posts', userPosts);
            
            // 显示成功提示
            wx.showModal({
              title: '发布成功！',
              content: '你的帖子已经成功发布到社区，快去看看吧！',
              showCancel: false,
              confirmText: '确定',
              confirmColor: '#07C160',
              success: async (res) => {
                if (res.confirm) {
                  // 清除表单数据
                  this.clearForm();
                  
                  // 返回上一页
                  const pages = getCurrentPages();
                  if (pages.length > 1) {
                    wx.navigateBack({
                      delta: 1,
                      success: () => {
                        // 通知上一页刷新数据
                        const prevPage = pages[pages.length - 2];
                        if (prevPage && prevPage.onNewPostPublished) {
                          prevPage.onNewPostPublished(newPost);
                        }
                      }
                    });
                  } else {
                    wx.redirectTo({
                      url: '/pages/forum/forum'
                    });
                  }
                  resolve();
                }
              }
            });
          } else {
            reject(new Error(res.result.message || '发布失败'));
          }
        },
        fail: (err) => {
          console.error('调用云函数失败:', err);
          reject(new Error('网络错误，请重试'));
        }
      });
    });
  },

  // 更新现有帖子
  async updateExistingPost(postId, uploadedImages) {
    // 暂时使用本地存储更新，后续可以添加更新帖子的云函数
    const userPosts = wx.getStorageSync('user_posts') || [];
    const postIndex = userPosts.findIndex(p => p._id === postId);
    
    if (postIndex > -1) {
      // 更新帖子数据
      const updatedPost = {
        ...userPosts[postIndex],
        title: this.data.postInfo.title.trim(),
        content: this.data.postInfo.content.trim(),
        type: this.data.postInfo.type,
        tags: this.data.postInfo.tags,
        images: uploadedImages,
        updateTime: new Date().toISOString()
      };
      
      // 保存更新后的数据
      userPosts[postIndex] = updatedPost;
      wx.setStorageSync('user_posts', userPosts);
      
      // 显示成功提示
      wx.showModal({
        title: '更新成功！',
        content: '你的帖子已经成功更新，快去看看吧！',
        showCancel: false,
        confirmText: '确定',
        confirmColor: '#07C160',
        success: async (res) => {
          if (res.confirm) {
            // 返回上一页
            const pages = getCurrentPages();
            if (pages.length > 1) {
              wx.navigateBack({
                delta: 1,
                success: () => {
                  // 通知上一页刷新数据
                  const prevPage = pages[pages.length - 2];
                  if (prevPage && prevPage.refreshData) {
                    prevPage.refreshData();
                  }
                }
              });
            } else {
              wx.redirectTo({
                url: '/pages/forum/forum'
              });
            }
          }
        }
      });
    } else {
      throw new Error('未找到要更新的帖子');
    }
  },

  // 上传图片（带审核）
  uploadImages() {
    return new Promise(async (resolve, reject) => {
      try {
        wx.showLoading({ title: '正在审核图片...', mask: true });

        const uploadedImages = [];

        // 逐个审核并上传图片
        for (let i = 0; i < this.data.selectedImages.length; i++) {
          const img = this.data.selectedImages[i];

          try {
            // 先上传到云存储
            const uploadRes = await wx.cloud.uploadFile({
              cloudPath: `post_images/${Date.now()}_${i}.png`,
              filePath: img.path
            })

            // 调用图片审核云函数（使用云存储 fileID）
            const checkRes = await wx.cloud.callFunction({
              name: 'checkImage',
              data: {
                fileUrl: uploadRes.fileID
              }
            });

            if (!checkRes.result.success) {
              wx.hideLoading();
              reject(new Error(checkRes.result.message || `第 ${i + 1} 张图片${checkRes.result.message}`));
              return;
            }

            // 审核通过，获取云存储文件的下载 URL
            const fileUrlRes = await wx.cloud.getTempFileURL({
              fileList: [uploadRes.fileID]
            })
            const fileUrl = fileUrlRes.fileList[0].tempFileURL

            // 审核通过，添加到上传列表
            uploadedImages.push({
              id: `img_${Date.now()}_${i}`,
              url: fileUrl, // 使用云存储的下载 URL
              fileId: uploadRes.fileID, // 保存云存储 fileID
              width: img.width || 800,
              height: img.height || 600,
              size: img.size || 0
            });

          } catch (error) {
            wx.hideLoading();
            reject(error);
            return;
          }
        }

        wx.hideLoading();
        resolve(uploadedImages);

      } catch (error) {
        wx.hideLoading();
        reject(error);
      }
    });
  },

  // 清除表单数据
  clearForm() {
    this.setData({
      postInfo: {
        title: '',
        content: '',
        type: 'share',
        tags: []
      },
      selectedImages: [],
      tagInput: ''
    });
  },

  // 返回上一页
  goBack() {
    const { postInfo, selectedImages } = this.data;

    // 检查是否有未保存的内容
    if (postInfo.title || postInfo.content || selectedImages.length > 0) {
      wx.showModal({
        title: '提示',
        content: '您有未保存的内容，确定要返回吗？',
        confirmText: '确定',
        confirmColor: '#FA5151',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack({
              delta: 1
            });
          }
        }
      });
    } else {
      wx.navigateBack({
        delta: 1
      });
    }
  }
});