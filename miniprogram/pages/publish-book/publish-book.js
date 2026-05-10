// pages/publish-book/publish-book.js
Page({
  data: {
    // 页面配置
    showBack: true,
    
    // 表单数据
    formData: {
      title: '',
      author: '',
      publisher: '',
      course: '',
      price: '',
      condition: 8,
      description: ''
    },
    
    // 图片相关
    bookImages: [],
    isUploading: false,
    uploadProgress: 0,
    
    // 新旧程度配置
    conditionOptions: [
      '1分(较差)', '2分', '3分', 
      '4分(一般)', '5分', '6分', 
      '7分(良好)', '8分', '9分(很好)', '10分(全新)'
    ],
    conditionIndex: 7,
    
    conditionDesc: {
      1: '较差', 2: '较差', 3: '较差', 
      4: '一般', 5: '一般', 6: '一般', 
      7: '良好', 8: '良好', 9: '很好', 10: '全新'
    },
    
    // 提交状态
    isSubmitting: false
  },

  onLoad: function (options) {
    this.initPage();

    // 检查是否是编辑模式
    if (options.edit && options.book) {
      try {
        const book = JSON.parse(decodeURIComponent(options.book));

        // 处理图片数据，兼容字符串数组和对象数组
        let bookImages = book.images || book.bookImages || [];
        // 如果图片是字符串数组，转换为对象格式
        if (bookImages.length > 0 && typeof bookImages[0] === 'string') {
          bookImages = bookImages.map(img => ({
            fileID: img,
            imageChecked: true,
            checkTime: Date.now()
          }));
        }

        this.setData({
          formData: {
            title: book.title || '',
            author: book.author || '',
            publisher: book.publisher || '',
            course: book.course || '',
            price: book.price || '',
            condition: book.condition || 8,
            description: book.description || ''
          },
          conditionIndex: (book.condition || 8) - 1,
          bookImages: bookImages
        });
      } catch (error) {
        console.error('解析书籍数据失败:', error);
      }
    }
  },

  onShow: function () {
    // 页面显示
  },

  // 初始化页面
  initPage: function () {
    this.setData({
      showBack: false
    });
  },

  // 返回上一页
  goBack: function () {
    wx.navigateBack();
  },

  // 选择书籍图片
  chooseBookImages: function () {
    const that = this;
    const remaining = 5 - this.data.bookImages.length;
    
    if (remaining <= 0) {
      wx.showToast({
        title: '最多上传5张图片',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: function (res) {
        that.uploadImages(res.tempFiles.map(file => file.tempFilePath));
      },
      fail: function (err) {
        console.error('选择图片失败:', err);
        if (err.errMsg.includes('cancel')) return;
        wx.showToast({
          title: '选择图片失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 上传图片（带审核）
  uploadImages: async function (tempFilePaths) {
    if (!tempFilePaths || tempFilePaths.length === 0) return;

    const that = this;
    const newImages = [];
    const total = tempFilePaths.length;
    let uploadedCount = 0;

    this.setData({
      isUploading: true,
      uploadProgress: 0
    });

    try {
      // 逐个上传图片到云存储，然后审核
      for (let i = 0; i < tempFilePaths.length; i++) {
        const path = tempFilePaths[i];

        try {
          // 先上传到云存储
          const cloudPath = `book-images/${Date.now()}_${i}_${Math.floor(Math.random() * 10000)}.jpg`;

          const uploadResult = await new Promise((resolve, reject) => {
            wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: path,
              success: (res) => {
                console.log(`图片 ${i + 1} 上传成功:`, res.fileID);
                resolve(res.fileID);
              },
              fail: (error) => {
                console.error(`图片 ${i + 1} 上传失败:`, error);
                reject(error);
              }
            });
          });

          // 审核云存储中的图片
          const checkRes = await wx.cloud.callFunction({
            name: 'checkImage',
            data: {
              fileUrl: uploadResult
            }
          });

          console.log(`图片 ${i + 1} 审核结果:`, checkRes.result);

          if (!checkRes.result.success) {
            // 审核不通过，删除已上传的图片
            try {
              await wx.cloud.deleteFile({
                fileList: [uploadResult]
              });
            } catch (deleteError) {
              console.error('删除违规图片失败:', deleteError);
            }

            // 审核不通过
            const currentProgress = Math.floor((uploadedCount / total) * 100);
            that.setData({
              uploadProgress: currentProgress,
              isUploading: false
            });

            wx.showModal({
              title: '图片审核不通过',
              content: checkRes.result.message || `第 ${i + 1} 张图片包含违规内容，请更换后重试`,
              showCancel: false,
              confirmText: '确定',
              confirmColor: '#FA5151'
            });
            return;
          }

          // 审核通过，保存云存储路径和审核标记
          newImages.push({
            fileID: uploadResult,
            imageChecked: true,
            checkTime: Date.now()
          });
          uploadedCount++;

          // 更新进度
          const progress = Math.floor((uploadedCount / total) * 100);
          that.setData({ uploadProgress: progress });

        } catch (error) {
          console.error(`图片 ${i + 1} 审核失败:`, error);
          const currentProgress = Math.floor((uploadedCount / total) * 100);
          that.setData({
            uploadProgress: currentProgress,
            isUploading: false
          });

          wx.showModal({
            title: '图片审核失败',
            content: `第 ${i + 1} 张图片审核失败，请稍后重试`,
            showCancel: false,
            confirmText: '确定',
            confirmColor: '#FA5151'
          });
          return;
        }
      }
    } catch (error) {
      console.error('上传图片异常:', error);
      that.setData({
        isUploading: false,
        uploadProgress: 0
      });
    }

    // 所有图片都处理完成后，显示成功消息
    if (newImages.length > 0) {
      that.setData({
        bookImages: [...that.data.bookImages, ...newImages],
        isUploading: false,
        uploadProgress: 0
      });

      wx.showToast({
        title: `上传成功 ${newImages.length} 张`,
        icon: 'success',
        duration: 1500
      });
    }
  },

  // 删除图片
  deleteImage: function (e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.bookImages];
    const imageToDelete = images[index];

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张图片吗？',
      confirmText: '删除',
      confirmColor: '#ff6b6b',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          // 获取文件ID（支持对象格式和字符串格式）
          const fileID = typeof imageToDelete === 'object' ? imageToDelete.fileID : imageToDelete;

          // 删除云存储文件（如果是云存储路径）
          if (fileID && fileID.startsWith('cloud://')) {
            try {
              await wx.cloud.deleteFile({
                fileList: [fileID]
              });
              console.log('云存储文件删除成功:', fileID);
            } catch (error) {
              console.error('删除云存储文件失败:', error);
            }
          }

          images.splice(index, 1);
          this.setData({ bookImages: images });

          wx.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 1000
          });
        }
      }
    });
  },

  // 通用输入处理
  onInput: function (e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`formData.${field}`]: value
    });
  },

  // 价格输入处理
  onPriceInput: function (e) {
    let value = e.detail.value;
    
    // 过滤非数字字符
    value = value.replace(/[^\d.]/g, '');
    
    // 处理小数位数
    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts[1].length > 2) {
        value = parts[0] + '.' + parts[1].substring(0, 2);
      }
    }
    
    this.setData({
      'formData.price': value
    });
  },

  // 新旧程度选择
  onConditionChange: function (e) {
    const value = parseInt(e.detail.value) + 1;
    
    this.setData({
      'formData.condition': value,
      conditionIndex: e.detail.value
    });
  },

  // 描述输入处理
  onDescriptionInput: function (e) {
    this.setData({
      'formData.description': e.detail.value
    });
  },

  // 表单验证
  validateForm: function () {
    const { title, author, publisher, course, price, description } = this.data.formData;
    const { bookImages } = this.data;
    
    // 验证图片
    if (bookImages.length === 0) {
      wx.showToast({
        title: '请至少上传一张书籍图片',
        icon: 'none',
        duration: 2000
      });
      return false;
    }
    
    // 验证标题
    if (!title.trim()) {
      wx.showToast({
        title: '请输入书籍标题',
        icon: 'none',
        duration: 2000
      });
      return false;
    }
    
    if (title.trim().length < 2) {
      wx.showToast({
        title: '书籍标题至少2个字',
        icon: 'none',
        duration: 2000
      });
      return false;
    }
    
    // 验证作者
    if (!author.trim()) {
      wx.showToast({
        title: '请输入作者',
        icon: 'none',
        duration: 2000
      });
      return false;
    }
    
    // 验证出版社
    if (!publisher.trim()) {
      wx.showToast({
        title: '请输入出版社',
        icon: 'none',
        duration: 2000
      });
      return false;
    }
    
    // 验证课程
    if (!course.trim()) {
      wx.showToast({
        title: '请输入对应课程',
        icon: 'none',
        duration: 2000
      });
      return false;
    }
    
    // 验证价格
    if (!price) {
      wx.showToast({
        title: '请输入价格',
        icon: 'none',
        duration: 2000
      });
      return false;
    }
    
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      wx.showToast({
        title: '请输入有效的价格',
        icon: 'none',
        duration: 2000
      });
      return false;
    }
    
    if (priceNum > 10000) {
      wx.showToast({
        title: '价格不能超过10000元',
        icon: 'none',
        duration: 2000
      });
      return false;
    }
    
    // 验证描述
    if (!description.trim()) {
      wx.showToast({
        title: '请输入书籍描述',
        icon: 'none',
        duration: 2000
      });
      return false;
    }
    
    if (description.trim().length < 20) {
      wx.showToast({
        title: '描述至少20个字',
        icon: 'none',
        duration: 2000
      });
      return false;
    }
    
    return true;
  },

  // 表单提交
  onSubmit: function (e) {
    if (!this.validateForm()) {
      return;
    }
    
    this.setData({ isSubmitting: true });
    
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {
      _id: 'user001',
      nickname: '张三学长',
      avatarUrl: '👨‍🎓',
      college: '数学学院',
      campus: '西校区',
      dorm: '南苑',
      dormitory: '南苑',
      major: '计算机科学与技术'
    };
    
    console.log('📋 发布书籍时的用户信息:', userInfo);
    
    // 获取页面参数
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const options = currentPage.options;
    
    // 检查是否是编辑模式
    const isEdit = options.edit;
    const bookId = options.bookId || '';
    
    // 获取用户openid
    const openid = app.globalData.openid || wx.getStorageSync('openid');
    
    // 构造书籍数据（不设置id字段，让数据库自动生成_id）
    const bookData = {
      title: this.data.formData.title,
      author: this.data.formData.author,
      publisher: this.data.formData.publisher,
      course: this.data.formData.course,
      price: parseFloat(this.data.formData.price).toFixed(2),
      condition: this.data.formData.condition,
      conditionText: this.data.conditionDesc[this.data.formData.condition],
      description: this.data.formData.description,
      images: this.data.bookImages.map(img => img.fileID || img), // 兼容新旧格式
      coverUrl: (this.data.bookImages[0]?.fileID || this.data.bookImages[0]) || '', // 第一张作为封面
      image: (this.data.bookImages[0]?.fileID || this.data.bookImages[0]) || '',
      // 添加图片审核标记
      imagesChecked: this.data.bookImages.length > 0 && this.data.bookImages.every(img => img.imageChecked === true),
      checkTime: this.data.bookImages.length > 0 ? Math.max(...this.data.bookImages.map(img => img.checkTime || 0)) : 0,
      sellerId: openid,
      sellerName: userInfo.nickname || '我',
      sellerAvatar: userInfo.avatarUrl,
      college: userInfo.college || '数学学院',
      sellerCollege: userInfo.college || '数学学院',
      campus: userInfo.campus || '西校区',
      sellerCampus: userInfo.campus || '西校区',
      dorm: userInfo.dorm || userInfo.dormitory || '南苑',
      sellerDorm: userInfo.dorm || userInfo.dormitory || '南苑',
      dormitory: userInfo.dorm || userInfo.dormitory || '南苑',
      sellerDormitory: userInfo.dorm || userInfo.dormitory || '南苑',
      major: userInfo.major || '计算机科学与技术',
      sellerMajor: userInfo.major || '计算机科学与技术',
      status: 'available',
      statusText: '在售',
      isLiked: false,
      likeCount: 0,
      isCollected: false,
      isFree: false,
      viewCount: 0,
      
      // 模拟其他信息
      originalPrice: (parseFloat(this.data.formData.price) * 1.5).toFixed(2),
      isbn: this.generateISBN(),
      format: '平装',
      pages: Math.floor(Math.random() * 200) + 200,
      language: '中文',
      category: '教材',
      tags: ['二手书', this.data.formData.course, this.data.formData.author],
      shippingMethod: '校内自提/上门',
      location: '学生宿舍区',
      contactInfo: '微信/电话',
      availableCount: 1
    };
    
    console.log('准备发布的书籍数据:', bookData);
    console.log('CODEBUDDY_DEBUG publishBook onSubmit bookData.title=', bookData.title, 'bookData.images.length=', bookData.images.length);

    if (isEdit) {
      // 编辑模式：调用 updateBook 云函数
      console.log('调用 updateBook 云函数');
      wx.cloud.callFunction({
        name: 'updateBook',
        data: {
          bookId: bookId,
          bookData: bookData
        },
        success: (res) => {
          console.log('updateBook 云函数调用成功:', res);
          if (res.result.success) {
            // 保存到本地
            this.saveBookToLocal(bookData, isEdit);

            // 显示成功
            wx.showToast({
              title: '编辑成功！',
              icon: 'success',
              duration: 2000
            });

            this.setData({ isSubmitting: false });

            // 延迟返回上一页
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } else {
            console.error('编辑书籍失败:', res.result.message);
            this.setData({ isSubmitting: false });

            // 根据错误信息显示不同的提示
            const errorMsg = res.result.message || '编辑失败';
            if (errorMsg.includes('图片') && errorMsg.includes('违规')) {
              wx.showToast({
                title: '图片包含违规内容，请更换图片后重试',
                icon: 'none',
                duration: 3000
              });
            } else if (errorMsg.includes('图片') && errorMsg.includes('审核')) {
              wx.showToast({
                title: '图片审核失败，请稍后重试',
                icon: 'none',
                duration: 3000
              });
            } else {
              wx.showToast({
                title: errorMsg || '编辑失败，请重试',
                icon: 'error',
                duration: 2000
              });
            }
          }
        },
        fail: (error) => {
          console.error('调用 updateBook 云函数失败:', error);
          this.setData({ isSubmitting: false });
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'error',
            duration: 2000
          });
        }
      });
    } else {
      // 发布模式：调用 publishBook 云函数
      console.log('调用 publishBook 云函数');
      wx.cloud.callFunction({
        name: 'publishBook',
        data: {
          bookData: bookData
        },
        success: (res) => {
          console.log('publishBook 云函数调用成功:', res);
          if (res.result.success) {
            const savedBookData = res.result.data;

            // 保存到本地
            this.saveBookToLocal(savedBookData, isEdit);

            // 显示成功
            wx.showToast({
              title: '发布成功！',
              icon: 'success',
              duration: 2000
            });

            this.setData({ isSubmitting: false });

            // 延迟跳转到详情页
            setTimeout(() => {
              wx.redirectTo({
                url: `/pages/book-detail/book-detail?id=${savedBookData._id}&title=${encodeURIComponent(savedBookData.title)}`
              });
            }, 1500);
          } else {
            console.error('发布书籍失败:', res.result.message);
            this.setData({ isSubmitting: false });

            // 根据错误信息显示不同的提示
            const errorMsg = res.result.message || '发布失败';
            if (errorMsg.includes('图片') && errorMsg.includes('违规')) {
              wx.showToast({
                title: '图片包含违规内容，请更换图片后重试',
                icon: 'none',
                duration: 3000
              });
            } else if (errorMsg.includes('图片') && errorMsg.includes('审核')) {
              wx.showToast({
                title: '图片审核失败，请稍后重试',
                icon: 'none',
                duration: 3000
              });
            } else if (errorMsg.includes('文本') || errorMsg.includes('标题') || 
                       errorMsg.includes('作者') || errorMsg.includes('描述') ||
                       errorMsg.includes('色情') || errorMsg.includes('谩骂') ||
                       errorMsg.includes('广告') || errorMsg.includes('敏感')) {
              wx.showToast({
                title: errorMsg,
                icon: 'none',
                duration: 3000
              });
            } else {
              wx.showToast({
                title: errorMsg || '发布失败，请重试',
                icon: 'error',
                duration: 2000
              });
            }
            
            // 如果有详细的文本审核结果，可以显示更多细节
            if (res.result.textCheckResult && res.result.textCheckResult.results) {
              const blockedResults = res.result.textCheckResult.results.filter(r => r.blocked);
              if (blockedResults.length > 0) {
                console.error('被拦截的文本字段:', blockedResults.map(r => r.fieldName));
              }
            }
          }
        },
        fail: (error) => {
          console.error('调用 publishBook 云函数失败:', error);
          this.setData({ isSubmitting: false });
          
          let errorMessage = '网络错误，请重试';
          if (error.errMsg) {
            if (error.errMsg.includes('文本审核')) {
              errorMessage = '文本审核失败，请检查内容是否合规';
            } else if (error.errMsg.includes('图片审核')) {
              errorMessage = '图片审核失败，请更换图片';
            }
          }
          
          wx.showToast({
            title: errorMessage,
            icon: 'error',
            duration: 2000
          });
        }
      });
    }
  },

  // 保存到本地存储
  saveBookToLocal: function (bookData, isEdit) {
    try {
      const app = getApp();
      
      // 1. 更新或添加到全局数据
      if (!app.globalData.books) {
        app.globalData.books = [];
      }
      
      if (isEdit) {
        // 编辑模式：更新现有数据
        const index = app.globalData.books.findIndex(book => book._id === bookData._id);
        if (index !== -1) {
          app.globalData.books[index] = bookData;
        } else {
          app.globalData.books.unshift(bookData);
        }
      } else {
        // 发布模式：添加新数据
        app.globalData.books.unshift(bookData);
      }
      
      // 2. 更新或添加到本地缓存
      let publishedBooks = wx.getStorageSync('published_books') || [];
      
      if (isEdit) {
        // 编辑模式：更新现有数据
        const index = publishedBooks.findIndex(book => book._id === bookData._id);
        if (index !== -1) {
          publishedBooks[index] = bookData;
        } else {
          publishedBooks.unshift(bookData);
        }
      } else {
        // 发布模式：添加新数据
        publishedBooks.unshift(bookData);
      }
      
      wx.setStorageSync('published_books', publishedBooks);
      
      // 3. 保存到所有书籍缓存
      const allBooks = wx.getStorageSync('all_books') || {};
      allBooks[bookData.id] = bookData;
      wx.setStorageSync('all_books', allBooks);
      
      // 4. 设置刷新标志
      wx.setStorageSync('should_refresh_books', true);
      
      console.log(isEdit ? '✅ 书籍编辑成功:' : '✅ 书籍发布成功:', bookData);
      
      // 5. 发送全局事件通知（如果 eventCenter 存在）
      if (wx.eventCenter && wx.eventCenter.trigger) {
        wx.eventCenter.trigger(isEdit ? 'bookUpdated' : 'bookPublished', bookData);
      }
      
    } catch (error) {
      console.error('❌ 保存失败:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'error',
        duration: 2000
      });
    }
  },

  // 生成ISBN
  generateISBN: function () {
    const parts = [];
    for (let i = 0; i < 13; i++) {
      parts.push(Math.floor(Math.random() * 10));
    }
    return parts.join('');
  },

  // 重置表单
  resetForm: function () {
    this.setData({
      formData: {
        title: '',
        author: '',
        publisher: '',
        course: '',
        price: '',
        condition: 8,
        description: ''
      },
      bookImages: [],
      conditionIndex: 7
    });
  }
});