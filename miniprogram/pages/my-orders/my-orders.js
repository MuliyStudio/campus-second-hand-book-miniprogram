const app = getApp()

Page({
  data: {
    activeType: 'buy',
    activeCategory: 'book',
    activeStatus: 'all',

    loading: false,
    items: [],

    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,

    searchKeyword: '',
    showSearch: false
  },

  onLoad() {
    console.log('加载我的订单页面');
    this.checkLoginStatus();
  },

  onUnload() {
    // 页面卸载时无需操作
  },

  onShow() {
    if (this.checkLoginStatus()) {
      this.refreshData();
    }
  },

  onPullDownRefresh() {
    this.refreshData();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  checkLoginStatus() {
    if (!app.globalData.isLoggedIn || !app.globalData.userInfo) {
      wx.navigateTo({
        url: '../login/login'
      });
      return false;
    }
    return true;
  },

  loadData() {
    this.setData({ loading: true, items: [] });
    
    wx.cloud.callFunction({
      name: 'getMyOrders',
      data: {
        type: this.data.activeType,
        category: this.data.activeCategory,
        status: this.data.activeStatus,
        page: this.data.page,
        pageSize: this.data.pageSize
      }
    }).then(res => {
      if (res.result && res.result.success) {
        const orders = res.result.data.orders || [];
        this.setData({
          items: orders,
          total: res.result.data.total || 0,
          hasMore: res.result.data.hasMore || false,
          loading: false
        });
      } else {
        wx.showToast({
          title: res.result ? res.result.message : '加载失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }
    }).catch(err => {
      console.error('加载订单失败:', err);
      wx.showToast({
        title: '网络错误，请稍后重试',
        icon: 'none'
      });
      this.setData({ loading: false });
    });
  },

  refreshData() {
    this.setData({ page: 1 });
    this.loadData();
  },

  loadMore() {
    if (this.data.loading) return;
    
    const nextPage = this.data.page + 1;
    this.setData({ loading: true, page: nextPage });
    
    wx.cloud.callFunction({
      name: 'getMyOrders',
      data: {
        type: this.data.activeType,
        category: this.data.activeCategory,
        status: this.data.activeStatus,
        page: nextPage,
        pageSize: this.data.pageSize
      }
    }).then(res => {
      if (res.result && res.result.success) {
        const newOrders = res.result.data.orders || [];
        this.setData({
          items: [...this.data.items, ...newOrders],
          total: res.result.data.total || 0,
          hasMore: res.result.data.hasMore || false,
          loading: false
        });
      } else {
        this.setData({ page: nextPage - 1, loading: false });
      }
    }).catch(err => {
      console.error('加载更多失败:', err);
      this.setData({ page: nextPage - 1, loading: false });
    });
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ activeType: type, page: 1 }, () => {
      this.loadData();
    });
  },

  switchCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ activeCategory: category, page: 1 }, () => {
      this.loadData();
    });
  },

  switchStatus(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ activeStatus: status, page: 1 }, () => {
      this.loadData();
    });
  },

  formatDate(dateStr) {
    if (!dateStr) return '未知日期';
    
    let date;
    if (typeof dateStr === 'string') {
      date = new Date(dateStr);
    } else if (dateStr && dateStr.$date) {
      date = new Date(dateStr.$date);
    } else {
      date = new Date(dateStr);
    }
    
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return (date.getMonth() + 1) + '月' + date.getDate() + '日';
    }
  },

  getStatusText(status, item) {
    // 处理中状态：根据当前用户角色和处理情况显示更明确的提示
    if (status === 'processing' && item) {
      const isBuyer = this.data.activeType === 'buy';
      const buyerProcessed = item.buyerProcessed;
      const sellerProcessed = item.sellerProcessed;

      if (isBuyer) {
        // 买家视角
        if (buyerProcessed && !sellerProcessed) {
          return '待对方确认';
        } else if (!buyerProcessed && sellerProcessed) {
          return '待你确认';
        }
      } else {
        // 卖家视角
        if (sellerProcessed && !buyerProcessed) {
          return '待对方确认';
        } else if (!sellerProcessed && buyerProcessed) {
          return '待你确认';
        }
      }
      return '处理中';
    }

    const statusMap = {
      'pending': '待处理',
      'pending_processing': '待处理',
      'processing': '处理中',
      'pending_payment': '待付款',
      'completed': '已完成',
      'cancelled': '已取消',
      'shipped': '已发货',
      'downloaded': '已下载'
    };
    // 调试日志
    console.log('订单状态映射:', { status, category: this.data.activeCategory, mapped: statusMap[status] || '未知' });
    return statusMap[status] || '未知';
  },

  getStatusColor(status) {
    const colorMap = {
      'pending_processing': '#f59e0b',
      'processing': '#8b5cf6',
      'pending': '#3b82f6',
      'pending_payment': '#3b82f6',
      'completed': '#07C160',
      'cancelled': '#ef4444',
      'shipped': '#10b981'
    };
    return colorMap[status] || '#667eea';
  },

  getEmptyText() {
    const { activeType, activeCategory, activeStatus } = this.data;
    
    if (activeStatus !== 'all') {
      return `暂无${this.getStatusText(activeStatus)}的${activeType === 'buy' ? '购买' : '出售'}记录`;
    }
    
    return `暂无${activeType === 'buy' ? '购买' : '出售'}的${activeCategory === 'book' ? '书籍' : '资料'}`;
  },

  getActionType(status) {
    if (status === 'pending_payment') {
      return 'pay';
    } else if (status === 'completed') {
      return 'review';
    }
    return null;
  },

  getActionText(status) {
    if (status === 'pending_payment') {
      return '去付款';
    } else if (status === 'pending' || status === 'pending_processing') {
      return '取消订单';
    } else if (status === 'completed') {
      return '评价';
    } else if (status === 'cancelled') {
      return '重新购买';
    }
    return '查看';
  },

  getActionBtnClass(status) {
    if (status === 'pending_payment') {
      return 'pay';
    } else if (status === 'pending' || status === 'pending_processing') {
      return 'cancel';
    } else if (status === 'completed') {
      return 'review';
    } else if (status === 'cancelled') {
      return 'rebuy';
    }
    return 'default';
  },

  handleAction(e) {
    const id = e.currentTarget.dataset.id;
    const action = e.currentTarget.dataset.action;
    const item = this.data.items.find(i => i._id === id);

    if (!item) {
      wx.showToast({ title: '订单不存在', icon: 'none' });
      return;
    }

    switch (action) {
      case 'confirm':
        this.confirmReceipt(id);
        break;
      case 'deliver':
        this.deliverItem(id);
        break;
      case 'pay':
        this.payOrder(id, item);
        break;
      case 'download':
        this.downloadMaterial(id, item);
        break;
      case 'review':
        wx.showToast({ title: '评价功能开发中', icon: 'none' });
        break;
      case 'process':
      case 'complete':
        this.processOrder(id);
        break;
      case 'cancel':
        this.cancelOrder(id);
        break;
      default:
        wx.showToast({ title: '查看详情', icon: 'none' });
    }
  },

  payOrder(orderId, item) {
    wx.showModal({
      title: '确认付款',
      content: `支付金额：¥${item.price}`,
      confirmText: '立即支付',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '支付中...', mask: true });
          
          wx.cloud.callFunction({
            name: 'processPayment',
            data: {
              orderId: orderId,
              category: this.data.activeCategory,
              amount: item.price
            }
          }).then(paymentRes => {
            wx.hideLoading();
            
            if (paymentRes.result && paymentRes.result.success) {
              wx.showToast({ title: '付款成功', icon: 'success' });
              
              setTimeout(() => {
                if (this.data.activeStatus === 'pending_payment') {
                  this.setData({ activeStatus: 'all' });
                }
                this.refreshData();
              }, 1000);
            } else {
              wx.showToast({
                title: paymentRes.result ? paymentRes.result.message : '支付失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('支付失败:', err);
            wx.showToast({ title: '支付失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  downloadMaterial(orderId, item) {
    if (!item.fileId) {
      wx.showToast({ title: '文件不存在', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '下载中...', mask: true });
    
    wx.cloud.downloadFile({
      fileID: item.fileId,
      success: (res) => {
        wx.hideLoading();
        wx.showToast({ title: '下载成功', icon: 'success' });
        
        wx.cloud.callFunction({
          name: 'updateOrderStatus',
          data: {
            orderId: orderId,
            category: 'material',
            status: 'downloaded'
          }
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('下载失败:', err);
        wx.showToast({ title: '下载失败', icon: 'none' });
      }
    });
  },

  confirmReceipt(orderId) {
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });
          
          wx.cloud.callFunction({
            name: 'updateOrderStatus',
            data: {
              orderId: orderId,
              category: this.data.activeCategory,
              status: 'completed'
            }
          }).then(updateRes => {
            wx.hideLoading();
            
            if (updateRes.result && updateRes.result.success) {
              wx.showToast({ title: '确认收货成功', icon: 'success' });
              
              setTimeout(() => {
                if (this.data.activeStatus === 'pending') {
                  this.setData({ activeStatus: 'all' });
                }
                this.refreshData();
              }, 1000);
            } else {
              wx.showToast({
                title: updateRes.result ? updateRes.result.message : '操作失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('确认收货失败:', err);
            wx.showToast({ title: '操作失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  deliverItem(orderId) {
    wx.showModal({
      title: '确认发货',
      content: '确认已发货？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });
          
          wx.cloud.callFunction({
            name: 'updateOrderStatus',
            data: {
              orderId: orderId,
              category: this.data.activeCategory,
              status: 'completed'
            }
          }).then(updateRes => {
            wx.hideLoading();
            
            if (updateRes.result && updateRes.result.success) {
              wx.showToast({ title: '发货成功', icon: 'success' });
              
              setTimeout(() => {
                if (this.data.activeStatus === 'pending') {
                  this.setData({ activeStatus: 'all' });
                }
                this.refreshData();
              }, 1000);
            } else {
              wx.showToast({
                title: updateRes.result ? updateRes.result.message : '操作失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('发货失败:', err);
            wx.showToast({ title: '操作失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  completeOrder(orderId) {
    wx.showModal({
      title: '确认完成',
      content: this.data.activeType === 'buy' ? '确认已收货？' : '确认订单已处理完成？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });

          wx.cloud.callFunction({
            name: 'updateOrderStatus',
            data: {
              orderId: orderId,
              category: this.data.activeCategory,
              status: 'completed'
            }
          }).then(updateRes => {
            wx.hideLoading();

            if (updateRes.result && updateRes.result.success) {
              wx.showToast({
                title: this.data.activeType === 'buy' ? '已确认收货' : '订单已处理完成',
                icon: 'success'
              });

              setTimeout(() => {
                if (this.data.activeStatus === 'pending') {
                  this.setData({ activeStatus: 'all' });
                }
                this.refreshData();
              }, 1000);
            } else {
              wx.showToast({
                title: updateRes.result ? updateRes.result.message : '操作失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('完成订单失败:', err);
            wx.showToast({ title: '操作失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  // 买家确认已处理
  buyerConfirmProcessed(e) {
    const orderId = e.currentTarget.dataset.id;
    console.log('买家确认已处理，orderId:', orderId);

    wx.showModal({
      title: '确认已处理',
      content: '确认卖家已处理您的订单？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });

          wx.cloud.callFunction({
            name: 'buyerConfirmProcessed',
            data: {
              orderId: orderId,
              category: this.data.activeCategory
            }
          }).then(confirmRes => {
            wx.hideLoading();

            if (confirmRes.result && confirmRes.result.success) {
              wx.showToast({
                title: '确认成功，订单进入处理中状态',
                icon: 'success'
              });

              setTimeout(() => {
                if (this.data.activeStatus === 'pending_processing') {
                  this.setData({ activeStatus: 'all' });
                }
                this.refreshData();
              }, 1000);
            } else {
              wx.showToast({
                title: confirmRes.result ? confirmRes.result.message : '操作失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('买家确认失败:', err);
            wx.showToast({ title: '操作失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },



  // 卖家确认已处理
  sellerConfirmProcessed(e) {
    const orderId = e.currentTarget.dataset.id;
    console.log('卖家确认已处理，orderId:', orderId);

    wx.showModal({
      title: '确认已处理',
      content: '确认已处理买家的订单？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });

          wx.cloud.callFunction({
            name: 'sellerConfirmProcessed',
            data: {
              orderId: orderId,
              category: this.data.activeCategory
            }
          }).then(confirmRes => {
            wx.hideLoading();

            if (confirmRes.result && confirmRes.result.success) {
              wx.showToast({
                title: '确认成功，订单进入处理中状态',
                icon: 'success'
              });

              setTimeout(() => {
                if (this.data.activeStatus === 'pending_processing') {
                  this.setData({ activeStatus: 'all' });
                }
                this.refreshData();
              }, 1000);
            } else {
              wx.showToast({
                title: confirmRes.result ? confirmRes.result.message : '操作失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('卖家确认失败:', err);
            wx.showToast({ title: '操作失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  // 确认订单已完成（买家确认卖家的处理 / 卖家确认买家的确认）
  sellerConfirmCompleted(e) {
    const orderId = e.currentTarget.dataset.id;
    console.log('确认订单已完成，orderId:', orderId);

    wx.showModal({
      title: '确认完成',
      content: '确认该订单交易已完成？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });

          wx.cloud.callFunction({
            name: 'sellerConfirmCompleted',
            data: {
              orderId: orderId,
              category: this.data.activeCategory
            }
          }).then(confirmRes => {
            wx.hideLoading();

            if (confirmRes.result && confirmRes.result.success) {
              const newStatus = confirmRes.result.data?.newStatus;
              wx.showToast({
                title: newStatus === 'completed' ? '订单已完成' : '已确认，等待对方确认',
                icon: 'success'
              });

              setTimeout(() => {
                if (this.data.activeStatus === 'processing') {
                  this.setData({ activeStatus: 'all' });
                }
                this.refreshData();
              }, 1000);
            } else {
              wx.showToast({
                title: confirmRes.result ? confirmRes.result.message : '操作失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('确认完成失败:', err);
            wx.showToast({ title: '操作失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  processOrder(orderId) {
    wx.showModal({
      title: '确认已处理',
      content: this.data.activeType === 'buy' ? '确认已收货？' : '确认已发货/交付？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });

          wx.cloud.callFunction({
            name: 'updateOrderStatus',
            data: {
              orderId: orderId,
              category: this.data.activeCategory,
              status: 'completed'
            }
          }).then(updateRes => {
            wx.hideLoading();

            if (updateRes.result && updateRes.result.success) {
              // 如果订单状态变成了 processing，说明对方还没处理
              const newStatus = updateRes.result.data?.newStatus;
              if (newStatus === 'processing') {
                wx.showToast({
                  title: this.data.activeType === 'buy' ? '已确认，等待卖家处理' : '已处理，等待买家确认',
                  icon: 'success'
                });
              } else {
                wx.showToast({
                  title: '订单已完成',
                  icon: 'success'
                });
              }

              setTimeout(() => {
                if (this.data.activeStatus === 'pending' || this.data.activeStatus === 'processing') {
                  this.setData({ activeStatus: 'all' });
                }
                this.refreshData();
              }, 1000);
            } else {
              wx.showToast({
                title: updateRes.result ? updateRes.result.message : '操作失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('处理订单失败:', err);
            wx.showToast({ title: '操作失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  // 下载资料
  downloadMaterial(e) {
    const orderId = e.currentTarget.dataset.id;
    const item = this.data.items.find(i => i._id === orderId);
    
    if (!item || !item.fileId) {
      wx.showToast({ title: '文件不存在', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '获取下载链接...', mask: true });
    
    // 调用云函数获取临时下载 URL
    wx.cloud.callFunction({
      name: 'downloadMaterial',
      data: {
        fileId: item.fileId,
        orderId: orderId
      }
    }).then(res => {
      if (res.result && res.result.success && res.result.data.tempFileURL) {
        const downloadUrl = res.result.data.tempFileURL;
        
        // 使用临时 URL 下载文件
        wx.downloadFile({
          url: downloadUrl,
          success: (downloadRes) => {
            wx.hideLoading();
            
            if (downloadRes.statusCode === 200) {
              wx.openDocument({
                filePath: downloadRes.tempFilePath,
                showMenu: true,
                success: () => {
                  wx.showToast({ title: '打开成功', icon: 'success' });
                  
                  wx.cloud.callFunction({
                    name: 'updateOrderStatus',
                    data: {
                      orderId: orderId,
                      category: 'material',
                      status: 'completed'
                    }
                  });
                },
                fail: (err) => {
                  console.error('打开文件失败:', err);
                  wx.showToast({ title: '打开失败', icon: 'none' });
                }
              });
            } else {
              wx.showToast({ title: '下载失败', icon: 'none' });
            }
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('下载失败:', err);
            wx.showToast({ title: '下载失败：' + (err.errMsg || '网络错误'), icon: 'none', duration: 3000 });
          }
        });
      } else {
        wx.hideLoading();
        wx.showToast({ 
          title: res.result ? res.result.message : '获取链接失败', 
          icon: 'none',
          duration: 3000
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('获取下载链接失败:', err);
      wx.showToast({ title: '网络错误，请稍后重试', icon: 'none', duration: 3000 });
    });
  },

  cancelOrder(orderId) {
    wx.showModal({
      title: '取消订单',
      content: '确认要取消此订单吗？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });
          
          wx.cloud.callFunction({
            name: 'updateOrderStatus',
            data: {
              orderId: orderId,
              category: this.data.activeCategory,
              status: 'cancelled'
            }
          }).then(updateRes => {
            wx.hideLoading();
            
            if (updateRes.result && updateRes.result.success) {
              wx.showToast({ title: '订单已取消', icon: 'success' });
              
              setTimeout(() => {
                if (this.data.activeStatus === 'pending') {
                  this.setData({ activeStatus: 'all' });
                }
                this.refreshData();
              }, 1000);
            } else {
              wx.showToast({
                title: updateRes.result ? updateRes.result.message : '操作失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('取消订单失败:', err);
            wx.showToast({ title: '操作失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  deleteOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '删除订单',
      content: '确认要删除此订单吗？删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...', mask: true });
          
          wx.cloud.callFunction({
            name: 'deleteOrder',
            data: {
              orderId: orderId,
              category: this.data.activeCategory
            }
          }).then(deleteRes => {
            wx.hideLoading();
            
            if (deleteRes.result && deleteRes.result.success) {
              wx.showToast({ title: '订单已删除', icon: 'success' });
              
              setTimeout(() => {
                this.refreshData();
              }, 1000);
            } else {
              wx.showToast({
                title: deleteRes.result ? deleteRes.result.message : '删除失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('删除订单失败:', err);
            wx.showToast({ title: '删除失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  contactUser(e) {
    const id = e.currentTarget.dataset.id;
    const contactType = e.currentTarget.dataset.type;
    
    const item = this.data.items.find(i => i._id === id);
    if (!item) {
      wx.showToast({ title: '获取用户信息失败', icon: 'none' });
      return;
    }
    
    let userId, userName, userAvatar;
    
    if (contactType === 'seller' || contactType === 'uploader') {
      userId = item.sellerId;
      userName = item.sellerName || '卖家';
      userAvatar = item.sellerAvatar || '';
    } else if (contactType === 'buyer') {
      userId = item.buyerId;
      userName = item.buyerName || '买家';
      userAvatar = item.buyerAvatar || '';
    } else {
      wx.showToast({ title: '无法识别联系对象', icon: 'none' });
      return;
    }
    
    if (!userId) {
      wx.showToast({ title: '用户信息不完整', icon: 'none' });
      return;
    }
    
    // 跳转到聊天页面
    wx.navigateTo({
      url: `/pages/chat/chat?userId=${userId}&nickname=${encodeURIComponent(userName)}&avatar=${encodeURIComponent(userAvatar || '')}`
    });
  },

  goToDiscover() {
    wx.switchTab({
      url: '/pages/discover/discover'
    });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type;
    const item = this.data.items.find(i => i._id === id);
    
    if (!item) {
      wx.showToast({ title: '未找到商品信息', icon: 'none' });
      return;
    }
    
    console.log('点击订单进入详情页:', {
      orderId: item._id,
      bookId: item.bookId,
      title: item.title,
      type: type
    });
    
    if (type === 'book') {
      // 传递书籍 ID 而不是订单 ID
      const bookId = item.bookId;
      if (!bookId) {
        wx.showToast({ title: '书籍 ID 不存在', icon: 'none' });
        return;
      }
      console.log('跳转到书籍详情页，bookId:', bookId);
      wx.navigateTo({
        url: `/pages/book-detail/book-detail?id=${bookId}`
      });
    } else if (type === 'material') {
      // 传递资料 ID 而不是订单 ID
      const materialId = item.materialId;
      if (!materialId) {
        wx.showToast({ title: '资料 ID 不存在', icon: 'none' });
        return;
      }
      console.log('跳转到资料详情页，materialId:', materialId);
      wx.navigateTo({
        url: `/pages/material-detail/material-detail?id=${materialId}`
      });
    }
  },

  rateOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    const rating = e.currentTarget.dataset.rating;
    const item = this.data.items.find(i => i._id === orderId);
    
    if (!item) {
      wx.showToast({ title: '订单不存在', icon: 'none' });
      return;
    }
    
    if (item.rated) {
      wx.showToast({ title: '您已经评价过该订单', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '确认评价',
      content: `您确定要给${rating}星评价吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '提交中...', mask: true });
          
          wx.cloud.callFunction({
            name: 'submitRating',
            data: {
              orderId: orderId,
              category: this.data.activeCategory,
              rating: rating
            }
          }).then(res => {
            wx.hideLoading();
            
            if (res.result && res.result.success) {
              let creditText = '';
              if (res.result.data.creditChange > 0) {
                creditText = `，卖家信誉分 +${res.result.data.creditChange}`;
              } else if (res.result.data.creditChange < 0) {
                creditText = `，卖家信誉分 ${res.result.data.creditChange}`;
              }
              
              wx.showToast({
                title: '评价成功' + creditText,
                icon: 'success',
                duration: 2000
              });
              
              // 更新本地数据
              const items = this.data.items.map(item => {
                if (item._id === orderId) {
                  return { ...item, rating: rating, rated: true };
                }
                return item;
              });
              
              this.setData({ items });
            } else {
              wx.showToast({
                title: res.result ? res.result.message : '评价失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('评价失败:', err);
            wx.showToast({
              title: '评价失败，请重试',
              icon: 'none'
            });
          });
        }
      }
    });
  },

  toggleSearch() {
    this.setData({ showSearch: !this.data.showSearch });
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  searchOrders() {
    if (!this.data.searchKeyword.trim()) {
      wx.showToast({ title: '请输入搜索内容', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '搜索中...', mask: true });
    
    const filtered = this.data.items.filter(item => {
      return item.title && item.title.toLowerCase().includes(this.data.searchKeyword.toLowerCase());
    });
    
    wx.hideLoading();
    
    if (filtered.length === 0) {
      wx.showToast({ title: '未找到相关订单', icon: 'none' });
    } else {
      wx.showToast({ title: `找到 ${filtered.length} 个订单`, icon: 'success' });
      this.setData({ items: filtered });
    }
  },

  // 格式化日期时间
  formatDate(date) {
    if (!date) return '';

    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
});
