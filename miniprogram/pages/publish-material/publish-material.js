// pages/publish-material/publish-material.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    selectedFile: null,      // 源文件(PDF)
    selectedPreviewImage: null, // 预览图片
    fileSizeText: '', // 格式化后的文件大小文本
    previewImageSizeText: '', // 格式化后的预览图大小文本
    materialInfo: {
      title: '',
      description: '',
      category: '', // 资料类别：review_materials(复习资料)、notes(笔记)、past_exam(真题)
      price: 0,
      studentId: ''
    },
    copyrightAgree: false,
    isUploading: false,
    canUpload: false,
    canvasWidth: 300,  // canvas宽度
    canvasHeight: 300  // canvas高度
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 保存options到实例
    this.options = options;
    
    // 初始化数据
    this.updateCanUpload();
    // 自动读取用户个人信息
    this.loadUserInfo();
    
    // 检查是否是编辑模式
    if (options.edit && options.material) {
      try {
        const material = JSON.parse(decodeURIComponent(options.material));
        this.setData({
          materialInfo: {
            title: material.title || '',
            description: material.description || '',
            category: material.category || '',
            price: material.price || 0,
            studentId: material.studentId || ''
          },
          // 模拟文件选择
          selectedFile: {
            name: material.title + '.' + ((material.format && material.format.toLowerCase()) || 'pdf'),
            size: 1024 * 1024 // 模拟1MB
          }
        });

        this.updateCanUpload();
      } catch (error) {
        console.error('解析资料数据失败:', error);
      }
    }
  },

  /**
   * 自动读取用户个人信息
   */
  loadUserInfo() {
    // 从全局数据中获取用户信息
    const app = getApp();
    console.log('App globalData:', app.globalData);
    
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    console.log('Loaded userInfo:', userInfo);
    
    // 设置用户信息到表单
    if (userInfo) {
      console.log('User info found, setting form data');
      
      // 确保用户信息字段存在
      const studentId = userInfo.studentId || userInfo.StudentId || userInfo.stuId || '';
      
      console.log('Processed user info:', { studentId });
      
      if (studentId) {
        console.log('Student ID found:', studentId);
        this.setData({
          'materialInfo.studentId': studentId
        });
      }
    } else {
      console.log('No user info found');
    }
    
    this.updateCanUpload();
  },



  /**
   * 选择源文件(PDF)
   */
  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: (res) => {
        const file = res.tempFiles[0];

        console.log('选择的文件:', file);
        console.log('文件大小:', file.size);

        // 验证文件格式
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'pdf') {
          wx.showToast({
            title: '仅支持PDF格式',
            icon: 'none',
            duration: 2000
          });
          return;
        }

        // 确保文件大小存在
        if (file.size === undefined || file.size === null) {
          console.warn('文件大小不存在，尝试使用其他方式获取');
          file.size = file.size || 0;
        }

        // 格式化文件大小
        const fileSizeText = this.formatFileSize(file.size);
        console.log('格式化后的文件大小:', fileSizeText);

        this.setData({
          selectedFile: file,
          fileSizeText: fileSizeText,
          'materialInfo.type': 'pdf'
        });
        this.updateCanUpload();
      },
      fail: (err) => {
        console.error('选择文件失败:', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 验证文件格式
   */
  validateFileFormat(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    return ext === 'pdf';
  },

  /**
   * 选择预览图片
   */
  choosePreviewImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const image = res.tempFiles[0];

        console.log('选择的预览图:', image);
        console.log('图片大小:', image.size);

        // 确保文件大小存在
        if (image.size === undefined || image.size === null) {
          image.size = image.size || 0;
        }

        // 格式化文件大小
        const previewImageSizeText = this.formatFileSize(image.size);
        console.log('格式化后的预览图大小:', previewImageSizeText);

        this.setData({
          selectedPreviewImage: image,
          previewImageSizeText: previewImageSizeText
        });
        this.updateCanUpload();
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 格式化文件大小
   */
  formatFileSize(size) {
    if (size < 1024) {
      return size + ' B';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(2) + ' KB';
    } else {
      return (size / (1024 * 1024)).toFixed(2) + ' MB';
    }
  },


  /**
   * 表单输入处理
   */
  bindInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;

    // 更新表单数据
    const updateData = {};
    updateData[`materialInfo.${field}`] = value;

    this.setData(updateData);
    this.updateCanUpload();
  },

  /**
   * 选择资料分类
   */
  selectCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      'materialInfo.category': category
    });
    this.updateCanUpload();
  },

  /**
   * 选择资料类型
   */
  selectType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      'materialInfo.type': type
    });
    this.updateCanUpload();
  },

  /**
   * 选择学院
   */
  bindCollegeChange(e) {
    const index = e.detail.value;
    const college = this.data.colleges[index];
    this.setData({
      collegeIndex: index,
      'materialInfo.college': college
    });
    // 更新专业列表
    this.updateMajors();
    this.updateCanUpload();
  },

  /**
   * 选择专业
   */
  bindMajorChange(e) {
    const index = e.detail.value;
    const major = this.data.currentMajors[index];
    this.setData({
      majorIndex: index,
      'materialInfo.major': major
    });
    this.updateCanUpload();
  },

  /**
   * 切换版权承诺勾选
   */
  toggleCopyrightAgree() {
    this.setData({
      copyrightAgree: !this.data.copyrightAgree
    });
    this.updateCanUpload();
  },

  /**
   * 更新是否可以上传
   */
  updateCanUpload() {
    const { selectedFile, selectedPreviewImage, materialInfo, copyrightAgree } = this.data;
    const canUpload = selectedFile &&
                     selectedPreviewImage &&
                     materialInfo.title.trim() &&
                     materialInfo.type &&
                     materialInfo.studentId.trim() &&
                     copyrightAgree;

    this.setData({ canUpload });
  },

  /**
   * 为图片添加水印
   */
  addWatermarkToImage(imagePath, studentId) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: imagePath,
        success: (info) => {
          let canvasWidth = info.width;
          let canvasHeight = info.height;

          console.log('图片原始尺寸:', canvasWidth, 'x', canvasHeight);

          // 限制canvas最大尺寸，防止超大图导致绘制失败（保持原始比例）
          const MAX_SIZE = 2000;
          if (canvasWidth > MAX_SIZE || canvasHeight > MAX_SIZE) {
            const ratio = Math.min(MAX_SIZE / canvasWidth, MAX_SIZE / canvasHeight);
            canvasWidth = Math.round(canvasWidth * ratio);
            canvasHeight = Math.round(canvasHeight * ratio);
            console.log('图片缩放后尺寸:', canvasWidth, 'x', canvasHeight);
          }

          // 设置canvas宽高（必须与canvas元素的CSS宽高一致）
          this.setData({
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight
          });

          // 延迟一帧确保canvas尺寸更新完毕
          setTimeout(() => {
            const canvasId = 'watermark-canvas';
            const context = wx.createCanvasContext(canvasId);

            // 绘制原始图片（完整绘制，不裁剪）
            context.drawImage(imagePath, 0, 0, canvasWidth, canvasHeight);

            // 设置水印样式（根据图片大小自适应字体）
            const fontSize = Math.max(16, Math.round(canvasWidth / 25));
            context.setFontSize(fontSize);
            context.setFillStyle('rgba(255, 255, 255, 0.7)');
            context.setStrokeStyle('rgba(0, 0, 0, 0.3)');
            context.setLineWidth(1);
            context.textAlign = 'center';
            context.textBaseline = 'middle';

            // 绘制水印文字（带描边增强可读性）
            const text = `学号: ${studentId}`;
            context.strokeText(text, canvasWidth / 2, canvasHeight / 2);
            context.fillText(text, canvasWidth / 2, canvasHeight / 2);

            // 保存带水印的图片
            context.draw(false, () => {
              setTimeout(() => {
                wx.canvasToTempFilePath({
                  canvasId: canvasId,
                  width: canvasWidth,
                  height: canvasHeight,
                  destWidth: canvasWidth,
                  destHeight: canvasHeight,
                  success: (res) => {
                    console.log('水印图片生成成功，尺寸:', canvasWidth, 'x', canvasHeight);
                    resolve(res.tempFilePath);
                  },
                  fail: (err) => {
                    console.error('保存水印图片失败:', err);
                    reject(err);
                  }
                });
              }, 300);
            });
          }, 100);
        },
        fail: (err) => {
          console.error('获取图片信息失败:', err);
          reject(err);
        }
      });
    });
  },

  /**
   * 检查文件是否为图片
   */
  isImageFile(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    return imageExtensions.includes(ext);
  },

  /**
   * 发布资料
   */
  uploadMaterial() {
    if (!this.data.canUpload) return;

    // 检查是否勾选版权承诺
    if (!this.data.copyrightAgree) {
      wx.showModal({
        title: '提示',
        content: '请先阅读并同意版权承诺',
        showCancel: false,
        confirmText: '确定',
        confirmColor: '#07C160'
      });
      return;
    }

    this.setData({ isUploading: true });

    try {
      // 获取全局应用实例
      const app = getApp();
      const selectedFile = this.data.selectedFile;
      const selectedPreviewImage = this.data.selectedPreviewImage;

      if (!selectedFile) {
        wx.showToast({
          title: '请选择PDF文件',
          icon: 'none',
          duration: 2000
        });
        this.setData({ isUploading: false });
        return;
      }

      if (!selectedPreviewImage) {
        wx.showToast({
          title: '请选择预览图',
          icon: 'none',
          duration: 2000
        });
        this.setData({ isUploading: false });
        return;
      }

      // 处理文件上传
      const handleFileUpload = async () => {
        wx.showLoading({
          title: '正在上传...',
          mask: true
        });

        try {
          // 1. 先给预览图添加水印
          wx.showLoading({
            title: '添加水印中...',
            mask: true
          });

          const watermarkedImagePath = await this.addWatermarkToImage(selectedPreviewImage.path, this.data.materialInfo.studentId);

          // 2. 上传预览图到云存储
          wx.showLoading({
            title: '上传预览图中...',
            mask: true
          });

          const previewUploadRes = await new Promise((resolve, reject) => {
            wx.cloud.uploadFile({
              cloudPath: 'materials/preview/' + Date.now() + '_preview.jpg',
              filePath: watermarkedImagePath,
              success: resolve,
              fail: reject
            });
          });

          const previewFileId = previewUploadRes.fileID;

          // 3. 审核上传后的图片
          wx.showLoading({
            title: '审核中...',
            mask: true
          });

          const checkRes = await wx.cloud.callFunction({
            name: 'checkImage',
            data: {
              fileUrl: previewFileId
            }
          });

          console.log('图片审核结果:', checkRes.result);

          if (!checkRes.result.success) {
            wx.hideLoading();
            this.setData({ isUploading: false });
            wx.showModal({
              title: '图片审核不通过',
              content: checkRes.result.message || '图片包含违规内容，请更换后重试',
              showCancel: false,
              confirmText: '确定',
              confirmColor: '#FA5151'
            });
            return;
          }

          // 4. 上传PDF源文件到云存储
          const pdfUploadRes = await new Promise((resolve, reject) => {
            wx.cloud.uploadFile({
              cloudPath: 'materials/pdf/' + Date.now() + '_' + selectedFile.name,
              filePath: selectedFile.path,
              success: resolve,
              fail: reject
            });
          });

          const pdfFileId = pdfUploadRes.fileID;

          // 5. 准备资料数据
          // 映射分类到资料库使用的类型
          const categoryMap = {
            'exam': 'past_exam',
            'note': 'notes',
            'review': 'review_materials',
            'none': 'review_materials' // 无分类默认为复习资料
          };
          const materialType = categoryMap[this.data.materialInfo.category] || 'review_materials';

          const materialData = {
            title: this.data.materialInfo.title.trim(),
            description: this.data.materialInfo.description.trim(),
            type: materialType,
            category: this.data.materialInfo.category, // 保存原始分类标识
            price: this.data.materialInfo.price,
            studentId: this.data.materialInfo.studentId.trim(),
            author: {
              _id: app.globalData.openid || 'current_user',
              nickname: (app.globalData.userInfo && app.globalData.userInfo.nickname) || '当前用户',
              avatarUrl: (app.globalData.userInfo && app.globalData.userInfo.avatarUrl) || '../../images/default-avatar.png'
            },
            fileSize: this.formatFileSize(selectedFile.size),
            format: 'PDF',
            fileId: pdfFileId,
            previewFileId: previewFileId // 添加预览图ID
          };

          // 6. 调用云函数上传资料
          wx.cloud.callFunction({
            name: 'publishMaterial',
            data: materialData,
            success: (res) => {
              wx.hideLoading();
              this.setData({ isUploading: false });

              if (res.result.success) {
                const newMaterial = res.result.data;

                // 显示成功提示
                wx.showModal({
                  title: '发布成功',
                  content: `资料发布成功！！`,
                  showCancel: false,
                  confirmText: '确定',
                  confirmColor: '#07C160',
                  success: (res) => {
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
                            if (prevPage && prevPage.onNewMaterialPublished) {
                              prevPage.onNewMaterialPublished(newMaterial);
                            }
                          }
                        });
                      } else {
                        wx.redirectTo({
                          url: '/pages/discover/discover'
                        });
                      }
                    }
                  }
                });
              } else {
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
                } else {
                  wx.showToast({
                    title: errorMsg || '发布失败',
                    icon: 'none',
                    duration: 2000
                  });
                }
              }
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('调用云函数失败:', err);
              this.setData({ isUploading: false });

              wx.showModal({
                title: '上传失败',
                content: '网络错误，请稍后重试',
                showCancel: false,
                confirmText: '确定',
                confirmColor: '#FA5151'
              });
            }
          });
        } catch (error) {
          wx.hideLoading();
          console.error('上传失败:', error);
          this.setData({ isUploading: false });

          wx.showModal({
            title: '上传失败',
            content: error.message || '网络错误，请稍后重试',
            showCancel: false,
            confirmText: '确定',
            confirmColor: '#FA5151'
          });
        }
      };

      // 执行文件上传处理
      handleFileUpload();
    } catch (error) {
      console.error('上传失败:', error);
      this.setData({ isUploading: false });

      wx.showModal({
        title: '上传失败',
        content: error.message || '网络错误，请稍后重试',
        showCancel: false,
        confirmText: '确定',
        confirmColor: '#FA5151'
      });
    }
  },

  /**
   * 清除表单数据
   */
  clearForm() {
    this.setData({
      selectedFile: null,
      selectedPreviewImage: null,
      fileSizeText: '',
      previewImageSizeText: '',
      materialInfo: {
        title: '',
        description: '',
        type: 'pdf',
        price: 0,
        studentId: ''
      },
      copyrightAgree: false
    });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  }
})