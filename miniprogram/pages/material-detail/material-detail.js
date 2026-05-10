// pages/material-detail/material-detail.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    isLoading: true,
    materialInfo: null,
    isFavorite: false,
    isDownloading: false,
    isOwner: false,
    hasPurchased: false,
    purchasedOrderId: null,
    showPreviewModal: false,
    previewImageUrl: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const materialId = options.id || '1';
    this.loadMaterialDetail(materialId);
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时检查收藏状态
    if (this.data.materialInfo) {
      this.checkFavoriteStatus();
    }
  },



  /**
   * 加载资料详情
   */
  loadMaterialDetail(materialId) {
    this.setData({ isLoading: true });
    
    // 调用云函数获取资料详情
    wx.cloud.callFunction({
      name: 'getMaterialDetail',
      data: {
        materialId: materialId
      },
      success: (res) => {
        if (res.result.success) {
          const materialInfo = res.result.data;
          
          // 判断是否为本人资料
          const app = getApp();
          const openid = app.globalData.openid || wx.getStorageSync('openid');
          const isOwner = materialInfo._openid === openid;
          
          // 检查是否已购买过该资料
          let hasPurchased = false;
          let purchasedOrderId = null;
          
          if (!isOwner) {
            wx.cloud.callFunction({
              name: 'getMyOrders',
              data: {
                type: 'buy',
                category: 'material',
                status: 'all'
              }
            }).then(res => {
              if (res.result && res.result.success) {
                const orders = res.result.data.orders || [];
                const purchasedOrder = orders.find(order => order.materialId === materialId);
                if (purchasedOrder) {
                  hasPurchased = true;
                  purchasedOrderId = purchasedOrder._id;
                }
                this.setData({
                  hasPurchased: hasPurchased,
                  purchasedOrderId: purchasedOrderId
                });
              }
            }).catch(err => {
              console.error('检查购买状态失败:', err);
            });
          }
          
          // 处理上传者头像 URL（将 cloud:// 文件ID转换为临时HTTP链接）
          const processAvatar = (info) => {
            const avatarUrl = info.uploaderAvatar || info.author?.avatarUrl || '';
            if (!avatarUrl || avatarUrl.startsWith('http')) {
              return Promise.resolve(info);
            }
            // cloud:// 文件ID需要通过云函数获取临时URL
            return new Promise((resolve) => {
              wx.cloud.callFunction({
                name: 'getTempImageUrl',
                data: { fileList: [avatarUrl] }
              }).then(res => {
                if (res.result && res.result.success && res.result.fileList && res.result.fileList[0]) {
                  const httpUrl = res.result.fileList[0].tempFileURL;
                  if (httpUrl) {
                    info.uploaderAvatar = httpUrl;
                    if (info.author) info.author.avatarUrl = httpUrl;
                  }
                }
                resolve(info);
              }).catch(() => {
                // 转换失败不影响页面显示
                resolve(info);
              });
            });
          };
          
          processAvatar(materialInfo).then(processedMaterialInfo => {
            this.setData({
              materialInfo: processedMaterialInfo,
              isOwner: isOwner,
              isLoading: false
            });

            // 检查收藏状态
            this.checkFavoriteStatus();
          }).catch(err => {
            console.error('处理头像 URL 失败:', err);
            this.setData({
              materialInfo: materialInfo,
              isOwner: isOwner,
              isLoading: false
            });

            // 检查收藏状态
            this.checkFavoriteStatus();
          });
        } else {
          this.setData({ isLoading: false });
          wx.showToast({
            title: res.result.message || '获取资料详情失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        console.error('调用云函数失败:', err);
        this.setData({ isLoading: false });
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  /**
   * 检查收藏状态
   */
  checkFavoriteStatus() {
    const materialId = this.data.materialInfo && this.data.materialInfo._id;
    if (!materialId) {
      console.warn('❌ 资料 ID 不存在');
      return;
    }
    
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      this.setData({ isFavorite: false });
      return;
    }
    
    wx.cloud.callFunction({
      name: 'checkFavoriteStatus',
      data: {
        itemId: materialId,
        type: 'material'
      },
      success: (res) => {
        if (res.result && res.result.success) {
          const isFavorite = res.result.data.isFavorite;
          console.log('❤️ 数据库收藏状态:', isFavorite);
          this.setData({ isFavorite });
          
          if (isFavorite) {
            if (!app.globalData.userFavorites) {
              app.globalData.userFavorites = [];
            }
            const exists = app.globalData.userFavorites.some(item => {
              const itemId = item.itemId || item.id || item._id;
              return itemId === materialId && item.type === 'material';
            });
            if (!exists) {
              app.globalData.userFavorites.push({
                _id: res.result.data.favoriteId,
                userId: app.globalData.openid,
                itemId: materialId,
                type: 'material',
                createTime: new Date().toISOString()
              });
              app.saveUserDataToStorage();
            }
          }
        } else {
          console.error('检查收藏状态失败:', res.result ? res.result.message : '未知错误');
          this.setData({ isFavorite: false });
        }
      },
      fail: (err) => {
        console.error('调用云函数检查收藏状态失败:', err);
        const userFavorites = app.globalData.userFavorites || [];
        const isFavorite = userFavorites.some(item => {
          const itemId = item.itemId || item.id || item._id;
          return itemId === materialId && item.type === 'material';
        });
        this.setData({ isFavorite });
      }
    });
  },

  /**
   * 跳转到上传者个人主页
   */
  goToUserProfile() {
    if (!this.data.materialInfo) return;
    
    // 假设上传者信息中有userId
    const userId = this.data.materialInfo.uploaderId || 'default';
    
    wx.navigateTo({
      url: `/pages/user-center/user-center?id=${userId}`
    });
  },

  /**
   * 发送私信给上传者
   */
  sendMessage() {
    if (!this.data.materialInfo) return;
    
    // 假设上传者信息中有userId
    const userId = this.data.materialInfo.uploaderId || 'default';
    const userName = this.data.materialInfo.uploaderName || '用户';
    const userAvatar = this.data.materialInfo.uploaderAvatar || '';
    
    wx.navigateTo({
      url: `/pages/chat/chat?userId=${userId}&nickname=${encodeURIComponent(userName)}&avatar=${encodeURIComponent(userAvatar)}`
    });
  },

  /**
   * 举报资料
   */
  reportMaterial() {
    if (!this.data.materialInfo) return;
    
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
            content: `您确定要举报此资料吗？\n举报类型：${selectedType}`,
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
  
  /**
   * 提交举报到云端
   */
  submitReport(reportType, reason) {
    if (!this.data.materialInfo) {
      wx.showToast({
        title: '资料信息不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '提交举报...',
      mask: true
    });
    
    const materialInfo = this.data.materialInfo;
    
    wx.cloud.callFunction({
      name: 'createReport',
      data: {
        targetType: 'material',
        targetId: materialInfo._id,
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

  /**
   * 在线预览资料
   */
  previewMaterial() {
    const materialInfo = this.data.materialInfo;
    if (!materialInfo) return;

    // 优先取预览图ID或文件ID
    const fileId = materialInfo.previewFileId || materialInfo.previewFileUrl || materialInfo.fileId || materialInfo.fileUrl;
    if (!fileId) {
      wx.showToast({ title: '无预览图', icon: 'none' });
      return;
    }

    // 显示加载提示
    wx.showLoading({ title: '正在加载预览...', mask: true });

    // 如果是 http(s) 链接直接用
    if (fileId.startsWith('http')) {
      wx.hideLoading();
      wx.previewImage({ 
        urls: [fileId], 
        current: fileId,
        success: () => {
          console.log('预览成功');
        },
        fail: (err) => {
          console.error('预览失败', err);
          wx.showToast({ title: '预览失败', icon: 'none' });
        }
      });
      return;
    }

    // 云存储文件需获取临时 URL - 使用 getTempImageUrl 云函数确保有权限
    wx.cloud.callFunction({
      name: 'getTempImageUrl',
      data: {
        fileList: [fileId]   // 云函数要求 fileList 为数组
      },
      success: res => {
        wx.hideLoading();
        console.log('getTempImageUrl 返回:', res);
        // 适配云函数返回结构: { success, fileList: [{ tempFileURL, fileID }] }
        const result = res.result;
        if (result && result.success && Array.isArray(result.fileList)) {
          const fileItem = result.fileList[0];
          if (fileItem && fileItem.tempFileURL) {
            // 使用微信原生预览，自带缩放功能，完整显示图片
            wx.previewImage({
              urls: [fileItem.tempFileURL],
              current: fileItem.tempFileURL,
              success: () => {
                console.log('预览成功');
              },
              fail: (err) => {
                console.error('预览失败', err);
                wx.showToast({ title: '预览失败', icon: 'none' });
              }
            });
          } else {
            console.error('获取预览图失败: tempFileURL 为空');
            wx.showToast({ title: '获取预览图失败: URL为空', icon: 'none' });
          }
        } else {
          const msg = result ? (result.message || '返回数据无效') : '未知错误';
          console.error('获取预览图失败:', msg);
          wx.showToast({ title: '获取预览图失败: ' + msg, icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('调用云函数失败:', err);
        // 降级方案：直接尝试使用 fileId
        wx.previewImage({ 
          urls: [fileId], 
          current: fileId,
          success: () => {
            console.log('降级预览成功');
          },
          fail: (fallbackErr) => {
            console.error('降级预览也失败:', fallbackErr);
            wx.showToast({ title: '预览失败，请稍后重试', icon: 'none' });
          }
        });
      }
    });
  },

  /**
   * 检查登录状态
   */
  checkLogin() {
    const app = getApp();
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !app.globalData.isLoggedIn) {
      wx.showModal({
        title: '请先登录',
        content: '下载资料需要先登录账号',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }
        }
      });
      return false;
    }
    return true;
  },

  /**
   * 下载已购买的资料
   */
  downloadPurchasedMaterial() {
    const materialInfo = this.data.materialInfo;

    if (!materialInfo) {
      wx.showToast({
        title: '资料不存在',
        icon: 'none'
      });
      return;
    }

    // 尝试获取文件ID，优先使用fileId，没有则使用fileUrl
    const fileId = materialInfo.fileId || materialInfo.fileUrl;

    if (!fileId) {
      wx.showToast({
        title: '文件不存在，无法下载',
        icon: 'none'
      });
      return;
    }

    console.log('下载已购买文件ID:', fileId);

    // 直接调用下载文件方法
    this.downloadFile(fileId, materialInfo);
  },

  /**
   * 生成订单
   */
  generateOrder(materialInfo) {
    const userInfo = wx.getStorageSync('userInfo');
    const orderId = 'order_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    const order = {
      _id: orderId,
      type: 'material',
      materialId: materialInfo._id,
      materialTitle: materialInfo.title,
      price: materialInfo.price,
      buyerId: userInfo._id || 'user_001',
      buyerName: userInfo.nickname || '用户',
      sellerId: materialInfo.uploaderId,
      sellerName: materialInfo.uploaderName,
      status: '待付款',
      createTime: new Date().toISOString().replace('T', ' '),
      materialInfo: {
        type: materialInfo.type,
        size: materialInfo.size,
        college: materialInfo.college,
        major: materialInfo.major
      }
    };
    
    // 保存订单到本地存储
    let orders = wx.getStorageSync('orders') || [];
    orders.unshift(order);
    wx.setStorageSync('orders', orders);
    
    return order;
  },

  /**
   * 模拟微信支付
   */
  simulateWechatPay(order, callback) {
    wx.showModal({
      title: '微信支付',
      content: `确认支付 ¥${order.price} 购买此资料？`,
      confirmText: '确认支付',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 模拟支付过程
          wx.showLoading({
            title: '支付中...',
            mask: true
          });
          
          setTimeout(() => {
            wx.hideLoading();
            
            // 更新订单状态为已完成
            let orders = wx.getStorageSync('orders') || [];
            const orderIndex = orders.findIndex(item => item._id === order._id);
            if (orderIndex !== -1) {
              orders[orderIndex].status = '已完成';
              orders[orderIndex].payTime = new Date().toISOString().replace('T', ' ');
              wx.setStorageSync('orders', orders);
            }
            
            callback(true);
          }, 1500);
        } else {
          callback(false);
        }
      },
      fail: () => {
        callback(false);
      }
    });
  },

  /**
   * 保存下载记录
   */
  saveDownloadRecord(materialInfo, tempFilePath) {
    try {
      // 强制设置类型为 pdf
      const fileType = 'pdf';
      
      // 直接保存到本地存储，不依赖云函数
      const downloadRecord = {
        _id: 'download_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        materialId: materialInfo._id,
        title: materialInfo.title,
        type: fileType,
        fileSize: materialInfo.size,
        price: materialInfo.price,
        downloadTime: this.formatDateTime(new Date()),
        uploaderId: materialInfo.uploaderId,
        uploaderName: materialInfo.uploaderName,
        localPath: tempFilePath || ''
      };
      
      // 从本地存储获取现有下载记录
      let downloads = wx.getStorageSync('downloads') || [];
      
      // 检查是否已经下载过，如果存在则更新，不存在则添加
      const existingIndex = downloads.findIndex(item => item.materialId === materialInfo._id);
      if (existingIndex !== -1) {
        downloads[existingIndex] = downloadRecord;
      } else {
        downloads.unshift(downloadRecord);
      }
      
      // 保存到本地存储
      wx.setStorageSync('downloads', downloads);
      console.log('保存下载记录成功:', downloadRecord);
      
      // 可选：尝试调用云函数（不影响主要功能）
      wx.cloud.callFunction({
        name: 'addDownload',
        data: {
          materialId: materialInfo._id,
          title: materialInfo.title,
          type: fileType,
          fileSize: materialInfo.size,
          price: materialInfo.price,
          uploaderId: materialInfo.uploaderId,
          uploaderName: materialInfo.uploaderName
        }
      }).catch(err => {
        console.log('云函数调用失败，但不影响下载记录保存:', err);
      });
      
    } catch (error) {
      console.error('保存下载记录失败:', error);
      // 即使出错也不影响下载流程
    }
    
    // 同步更新我的下载页面的数据
    if (typeof this.updateDownloadsPage === 'function') {
      this.updateDownloadsPage();
    }
  },

  /**
   * 获取最新的文件临时URL
   */
  getLatestFileUrl(fileId) {
    return new Promise((resolve, reject) => {
      if (!fileId) {
        reject('缺少文件ID');
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
            reject(res.result.message || '获取文件URL失败');
          }
        },
        fail: (err) => {
          console.error('调用云函数失败:', err);
          reject('网络错误，请重试');
        }
      });
    });
  },

  /**
   * 下载资料
   */
  downloadMaterial() {
    const materialInfo = this.data.materialInfo;

    if (!materialInfo) {
      wx.showToast({
        title: '资料不存在',
        icon: 'none'
      });
      return;
    }

    // 尝试获取文件ID，优先使用fileId，没有则使用fileUrl
    const fileId = materialInfo.fileId || materialInfo.fileUrl;

    if (!fileId) {
      wx.showToast({
        title: '文件不存在，无法下载',
        icon: 'none'
      });
      return;
    }

    console.log('下载文件ID:', fileId);
    
    // 检查登录状态
    if (!this.checkLogin()) return;
    
    // 检查是否是本人资料
    const app = getApp();
    const openid = app.globalData.openid || wx.getStorageSync('openid');
    
    if (materialInfo._openid === openid) {
      wx.showModal({
        title: '提示',
        content: '这是您自己上传的资料，无需购买',
        confirmText: '查看',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack();
          }
        }
      });
      return;
    }
    
    // 显示加载状态
    wx.showLoading({
      title: '创建订单...',
      mask: true
    });
    
    // 调用云函数创建订单
    wx.cloud.callFunction({
      name: 'createMaterialOrder',
      data: {
        materialId: materialInfo._id,
        buyerName: app.globalData.userInfo?.nickName || '用户',
        buyerAvatar: app.globalData.userInfo?.avatarUrl || ''
      }
    }).then(res => {
      wx.hideLoading();

      if (res.result && res.result.success) {
        if (res.result.data.isFree) {
          // 免费资料直接下载
          this.downloadFile(fileId, materialInfo);
        } else {
          // 付费资料购买成功，更新购买状态并打开文件
          this.setData({
            hasPurchased: true,
            purchasedOrderId: res.result.data.orderId
          });

          wx.showToast({
            title: '购买成功',
            icon: 'success',
            duration: 1500
          });

          // 1.5秒后自动下载并打开文件
          setTimeout(() => {
            this.downloadFile(fileId, materialInfo);
          }, 1500);
        }
      } else if (res.result && res.result.data && res.result.data.existed) {
        // 已购买过，更新购买状态
        this.setData({
          hasPurchased: true,
          purchasedOrderId: res.result.data.orderId
        });

        wx.showToast({
          title: '您已购买过该资料',
          icon: 'success',
          duration: 1500
        });
      } else {
        wx.showToast({
          title: res.result ? res.result.message : '购买失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('创建订单失败:', err);
      wx.showToast({
        title: '购买失败，请重试',
        icon: 'none'
      });
    });
  },

  // 下载文件
  downloadFile: function(fileId, materialInfo) {
    wx.showLoading({ title: '准备下载...' });
    
    this.getLatestFileUrl(fileId).then(fileUrl => {
      wx.hideLoading();
      
      if (!fileUrl) {
        wx.showToast({
          title: '文件链接不存在，无法下载',
          icon: 'none'
        });
        return;
      }
      
      this.setData({ isDownloading: true });
      
      wx.downloadFile({
        url: fileUrl,
        success: (res) => {
          this.setData({ isDownloading: false });
          
          if (res.statusCode === 200) {
            this.saveDownloadRecord(materialInfo, res.tempFilePath);
            
            wx.openDocument({
              filePath: res.tempFilePath,
              showMenu: true,
              success: () => {
                console.log('文件打开成功');
              },
              fail: (err) => {
                console.error('打开文件失败:', err);
              }
            });
            
            wx.showToast({
              title: '下载成功',
              icon: 'success'
            });
            
            this.updateDownloadCount(materialInfo._id);
          } else {
            wx.showToast({
              title: '下载失败',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          this.setData({ isDownloading: false });
          console.error('下载失败:', err);
          wx.showToast({
            title: '网络错误',
            icon: 'none'
          });
        }
      });
    }).catch(err => {
      wx.hideLoading();
      console.error('获取文件 URL 失败:', err);
      wx.showToast({
        title: '获取文件链接失败',
        icon: 'none'
      });
    });
  },

  // 查看已购买的订单
  viewPurchasedOrder() {
    const orderId = this.data.purchasedOrderId;
    if (orderId) {
      wx.navigateTo({
        url: '/pages/my-orders/my-orders?category=material'
      });
    } else {
      wx.showToast({
        title: '未找到订单信息',
        icon: 'none'
      });
    }
  },

  // 切换资料上下架状态
  toggleMaterialOffline() {
    const materialInfo = this.data.materialInfo;
    
    if (!materialInfo) {
      wx.showToast({ title: '资料不存在', icon: 'none' });
      return;
    }
    
    const newStatus = materialInfo.status === 'offline' ? 'available' : 'offline';
    const actionText = newStatus === 'available' ? '上架' : '下架';
    
    wx.showModal({
      title: `确认${actionText}`,
      content: `确定要${actionText}《${materialInfo.title}》吗？`,
      confirmText: actionText,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });
          
          wx.cloud.callFunction({
            name: 'updateMaterialStatus',
            data: {
              materialId: materialInfo._id,
              status: newStatus
            }
          }).then(response => {
            wx.hideLoading();
            
            if (response.result && response.result.success) {
              this.setData({
                'materialInfo.status': newStatus,
                'materialInfo.statusText': newStatus === 'available' ? '在售' : '已下架'
              });
              
              wx.showToast({
                title: `${actionText}成功`,
                icon: 'success'
              });
            } else {
              wx.showToast({
                title: response.result ? response.result.message : `${actionText}失败`,
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('调用云函数失败:', err);
            wx.showToast({
              title: `${actionText}失败，请重试`,
              icon: 'none'
            });
          });
        }
      }
    });
  },

  // 格式化日期时间为标准格式 YYYY-MM-DD HH:MM:SS
  formatDateTime: function(date) {
    const now = date || new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },

  /**
   * 切换收藏状态
   */
  toggleFavorite() {
    const app = getApp();
    
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        confirmText: '去登录',
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
    
    const newIsFavorite = !this.data.isFavorite;
    this.setData({ isFavorite: newIsFavorite });
    
    const materialInfo = this.data.materialInfo;
    
    if (newIsFavorite) {
      // 添加收藏
      wx.cloud.callFunction({
        name: 'addFavorite',
        data: {
          itemId: materialInfo._id,
          type: 'material',
          itemData: {
            title: materialInfo.title,
            price: materialInfo.price,
            size: materialInfo.size,
            type: materialInfo.typeText,
            uploaderName: materialInfo.uploaderName
          }
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
              itemId: materialInfo._id,
              type: 'material',
              itemData: {
                title: materialInfo.title,
                price: materialInfo.price,
                size: materialInfo.size,
                type: materialInfo.typeText,
                uploaderName: materialInfo.uploaderName
              },
              createTime: new Date().toISOString()
            });
            app.saveUserDataToStorage();
            
            wx.showToast({
              title: '收藏成功',
              icon: 'success',
              duration: 1500
            });
            
            wx.vibrateShort({ type: 'light' });
          } else {
            this.setData({ isFavorite: false });
            wx.showToast({
              title: res.result.message || '收藏失败',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (err) => {
          console.error('添加收藏失败:', err);
          this.setData({ isFavorite: false });
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
          itemId: materialInfo._id,
          type: 'material'
        },
        success: (res) => {
          if (res.result.success) {
            // 更新本地收藏数据
            app.globalData.userFavorites = (app.globalData.userFavorites || []).filter(item => {
              const itemId = item.itemId || item.id || item._id;
              return itemId !== materialInfo._id || item.type !== 'material';
            });
            app.saveUserDataToStorage();
            
            wx.showToast({
              title: '取消收藏成功',
              icon: 'success',
              duration: 1500
            });
            
            wx.vibrateShort({ type: 'light' });
          } else {
            this.setData({ isFavorite: true });
            wx.showToast({
              title: res.result.message || '取消收藏失败',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (err) => {
          console.error('移除收藏失败:', err);
          this.setData({ isFavorite: true });
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    }
  },

  /**
   * 关闭预览弹层
   */
  closePreviewModal() {
    this.setData({
      showPreviewModal: false,
      previewImageUrl: ''
    });
  },

  /**
   * 阻止冒泡
   */
  stopPropagation() {
    // 空函数，阻止点击图片关闭弹层
  },

  /**
   * 分享资料
   */
  shareMaterial() {
    if (!this.data.materialInfo) return;
    
    // 显示分享操作菜单
    wx.showActionSheet({
      itemList: ['分享给好友', '分享到朋友圈', '生成分享海报'],
      itemColor: '#333',
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            // 分享给好友
            wx.showModal({
              title: '分享给好友',
              content: '请点击右上角的分享按钮，选择好友进行分享',
              confirmText: '知道了',
              showCancel: false
            });
            break;
          case 1:
            // 分享到朋友圈
            wx.showModal({
              title: '分享到朋友圈',
              content: '请点击右上角的分享按钮，选择分享到朋友圈',
              confirmText: '知道了',
              showCancel: false
            });
            break;
          case 2:
            // 生成分享海报
            wx.showToast({
              title: '生成海报功能开发中',
              icon: 'none',
              duration: 2000
            });
            break;
        }
      },
      fail: (res) => {
        console.log('取消分享', res);
      }
    });
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    wx.showToast({
      title: '暂时无法分享',
      icon: 'none',
      duration: 2000
    });
  },

  /**
   * 用户点击右上角分享到朋友圈
   */
  onShareTimeline() {
    wx.showToast({
      title: '暂时无法分享',
      icon: 'none',
      duration: 2000
    });
  },

  /**
   * 更新下载计数
   */
  updateDownloadCount(materialId) {
    // 调用云函数更新下载计数
    wx.cloud.callFunction({
      name: 'updateDownloadCount',
      data: {
        materialId: materialId
      },
      success: (res) => {
        if (res.result.success) {
          console.log('更新下载计数成功:', res.result.data);
          
          // 更新本地数据
          if (this.data.materialInfo) {
            const updatedMaterialInfo = {
              ...this.data.materialInfo,
              downloads: (this.data.materialInfo.downloads || 0) + 1,
              downloadCount: (this.data.materialInfo.downloadCount || 0) + 1
            };
            this.setData({ materialInfo: updatedMaterialInfo });
          }
        } else {
          console.error('更新下载计数失败:', res.result.message);
        }
      },
      fail: (err) => {
        console.error('调用云函数失败:', err);
        // 即使云函数调用失败，也要更新本地下载计数
        if (this.data.materialInfo) {
          const updatedMaterialInfo = {
            ...this.data.materialInfo,
            downloads: (this.data.materialInfo.downloads || 0) + 1,
            downloadCount: (this.data.materialInfo.downloadCount || 0) + 1
          };
          this.setData({ materialInfo: updatedMaterialInfo });
        }
      }
    });
  }
})