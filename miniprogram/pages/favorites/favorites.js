// pages/favorites/favorites.js
Page({
  data: {
    // 当前选中的标签
    activeTab: 0,
    
    // 自定义标题
    customTitle: '我的收藏夹',
    
    // 编辑模式
    isEditMode: false,
    
    // 搜索相关
    showSearchInput: false,
    searchKeyword: '',
    
    // 原始数据
    favoriteBooks: [],
    favoriteMaterials: [],
    
    // 过滤后的数据
    filteredBooks: [],
    filteredMaterials: [],
    
    // 分组后的书籍数据
    groupedBooks: [],
    
    // 选中状态
    selectedBooks: [],
    selectedMaterials: [],
    
    // 全选状态
    isAllBooksSelected: false,
    isAllMaterialsSelected: false,
    isAllCurrentSelected: false,
    
    // 统计
    selectedBooksCount: 0,
    selectedMaterialsCount: 0,
    selectedCount: 0,
    totalPrice: 0,
    totalMaterialPrice: 0,
    
    // 是否有选中
    hasSelectedBooks: false,
    hasSelectedMaterials: false
  },

  onLoad(options) {
    if (!this.checkLoginStatus()) {
      return;
    }
    this.loadFavorites()
  },

  onShow() {
    if (!this.checkLoginStatus()) {
      return;
    }
    this.loadFavorites()
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const app = getApp();
    if (!app.globalData.isLoggedIn || !app.globalData.userInfo) {
      wx.navigateTo({
        url: '../login/login'
      });
      return false;
    }
    return true;
  },

  // 加载收藏数据
  loadFavorites() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'getMyFavorites',
      data: {
        type: 'all'
      },
      success: (res) => {
        console.log('获取收藏数据成功:', res);
        if (res.result && res.result.success) {
          const favorites = res.result.data.favorites || [];
          console.log('收藏数据:', favorites);
          
          const favoriteBooks = favorites
            .filter(item => item.type === 'book')
            .map((item, index) => {
              console.log('处理书籍项:', item);

              const bookStatus = item.bookStatus || 'available';
              const bookStatusText = item.bookStatusText || '在售';
              const isReserved = bookStatus === 'reserved';
              const isSold = bookStatus === 'sold';
              const isOffline = bookStatus === 'offline';
              const isInvalid = isSold || isOffline;

              return {
                id: item.itemId || item._id,
                title: item.title || '未知书名',
                image: item.coverImage || item.image || '/images/default-book.png',
                price: parseFloat(item.price) || 0,
                condition: item.condition || 8,
                status: bookStatus,
                statusText: isInvalid ? '已失效' : bookStatusText,
                college: item.college || '未知学院',
                sellerId: item.sellerId || 'unknown_seller',
                sellerName: item.sellerName || '未知卖家',
                sellerAvatar: item.sellerAvatar || '/images/default-avatar.png',
                sellerDorm: item.sellerDorm || '',
                sellerMajor: item.sellerMajor || '',
                selected: false,
                isReserved: isReserved,
                isSold: isSold,
                isOffline: isOffline,
                isInvalid: isInvalid
              };
            });
          
          const groupedBooks = this.groupBooksBySeller(favoriteBooks);
          
          const favoriteMaterials = favorites
            .filter(item => item.type === 'material')
            .map((item, index) => {
              console.log('处理资料项:', item);

              return {
                id: item.itemId || item._id,
                title: item.title || '未知资料',
                type: (item.format && item.format.toLowerCase()) || 'unknown',
                typeText: item.format || '未知格式',
                size: item.fileSize || '未知大小',
                downloads: item.downloadCount || 0,
                price: parseFloat(item.price) || 0,
                college: item.sellerCollege || '未知学院',
                sellerId: item.sellerId || 'unknown_seller',
                sellerName: item.sellerName || '未知卖家',
                sellerAvatar: item.sellerAvatar || '/images/default-avatar.png',
                sellerDorm: item.sellerDorm || '',
                sellerMajor: item.sellerMajor || '',
                selected: false,
                isPurchased: item.isPurchased || false
              };
            });
          
          console.log('处理后的书籍数据:', favoriteBooks);
          console.log('处理后的资料数据:', favoriteMaterials);
          console.log('按卖家分组的书籍数据:', groupedBooks);
          
          this.setData({
            favoriteBooks,
            favoriteMaterials,
            groupedBooks
          }, () => {
            this.filterData()
          });
        } else {
          console.error('获取收藏失败:', res.result.message);
          wx.showToast({
            title: res.result.message || '获取收藏失败',
            icon: 'none',
            duration: 1500
          });
        }
      },
      fail: (error) => {
        console.error('调用云函数失败:', error);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 1500
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },


  // 过滤数据
  filterData() {
    const { favoriteBooks, favoriteMaterials, searchKeyword, activeTab } = this.data
    
    let filteredBooks = favoriteBooks
    let filteredMaterials = favoriteMaterials
    
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase()
      filteredBooks = favoriteBooks.filter(book => 
        book.title.toLowerCase().includes(keyword) ||
        book.college.toLowerCase().includes(keyword) ||
        book.sellerName.toLowerCase().includes(keyword)
      )
      
      filteredMaterials = favoriteMaterials.filter(material => 
        material.title.toLowerCase().includes(keyword) ||
        material.college.toLowerCase().includes(keyword) ||
        material.typeText.toLowerCase().includes(keyword)
      )
    }
    
    const groupedBooks = this.groupBooksBySeller(filteredBooks)
    
    this.setData({
      filteredBooks,
      filteredMaterials,
      groupedBooks
    }, () => {
      this.updateSelection()
    })
  },
  
  // 按卖家分组书籍
  groupBooksBySeller(books) {
    const sellerMap = {}
    
    books.forEach(book => {
      const sellerId = book.sellerId || 'unknown'
      if (!sellerMap[sellerId]) {
        sellerMap[sellerId] = {
          sellerId: sellerId,
          sellerName: book.sellerName || '未知卖家',
          sellerAvatar: book.sellerAvatar || '/images/default-avatar.png',
          sellerDorm: book.sellerDorm || '',
          sellerMajor: book.sellerMajor || '',
          books: [],
          selected: false,
          bookCount: 0
        }
      }
      sellerMap[sellerId].books.push(book)
      sellerMap[sellerId].bookCount++
    })
    
    return Object.values(sellerMap)
  },

  // 更新选中状态
  updateSelection() {
    const { activeTab, filteredBooks, filteredMaterials } = this.data
    
    if (activeTab === 0) {
      const selectedBooks = filteredBooks.filter(book => book.selected)
      const selectedCount = selectedBooks.length
      const isAllSelected = selectedCount > 0 && selectedCount === filteredBooks.length
      
      const totalPrice = selectedBooks.reduce((sum, book) => sum + book.price, 0)
      
      this.setData({
        selectedBooksCount: selectedCount,
        selectedBooks: selectedBooks,
        isAllBooksSelected: isAllSelected,
        isAllCurrentSelected: isAllSelected,
        selectedCount: selectedCount,
        totalPrice: totalPrice,
        hasSelectedBooks: selectedCount > 0
      })
    } else {
      const selectedMaterials = filteredMaterials.filter(material => material.selected)
      const selectedCount = selectedMaterials.length
      const isAllSelected = selectedCount > 0 && selectedCount === filteredMaterials.length
      
      const totalMaterialPrice = selectedMaterials.reduce((sum, material) => sum + material.price, 0)
      
      this.setData({
        selectedMaterialsCount: selectedCount,
        selectedMaterials: selectedMaterials,
        isAllMaterialsSelected: isAllSelected,
        isAllCurrentSelected: isAllSelected,
        selectedCount: selectedCount,
        hasSelectedMaterials: selectedCount > 0,
        totalMaterialPrice: totalMaterialPrice
      })
    }
  },

  // 切换选中状态
  toggleSelect(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    const sellerId = e.currentTarget.dataset.sellerId
    const { activeTab, groupedBooks } = this.data
    
    if (activeTab === 0) {
      const updatedGroups = groupedBooks.map(group => {
        if (group.sellerId === sellerId) {
          const updatedBooks = group.books.map((book, bookIndex) => {
            if (bookIndex === index) {
              return { ...book, selected: !book.selected }
            }
            return book
          })
          return { ...group, books: updatedBooks }
        }
        return group
      })
      
      const updatedBooks = []
      updatedGroups.forEach(group => {
        updatedBooks.push(...group.books)
      })
      
      this.setData({
        groupedBooks: updatedGroups,
        filteredBooks: updatedBooks
      }, () => {
        this.updateSelection()
      })
    } else {
      const materials = [...this.data.filteredMaterials]
      materials[index].selected = !materials[index].selected
      
      this.setData({
        filteredMaterials: materials
      }, () => {
        this.updateSelection()
      })
    }
  },
  
  // 跳转到卖家页面
  goToSellerPage(e) {
    const sellerId = e.currentTarget.dataset.sellerId
    if (sellerId && sellerId !== 'unknown') {
      wx.navigateTo({
        url: `/pages/user-profile/user-profile?userId=${sellerId}`
      })
    }
  },

  // 选择卖家
  selectSeller(e) {
    const sellerId = e.currentTarget.dataset.sellerId
    const groups = [...this.data.groupedBooks]
    
    const groupIndex = groups.findIndex(group => group.sellerId === sellerId)
    if (groupIndex === -1) return
    
    const group = groups[groupIndex]
    const isAllSelected = group.books.every(book => book.selected)
    
    // 切换卖家下所有书籍的选中状态
    group.books.forEach(book => {
      book.selected = !isAllSelected
    })
    
    group.selected = !isAllSelected
    groups[groupIndex] = group
    
    // 更新过滤后的数据
    const updatedBooks = []
    groups.forEach(g => {
      updatedBooks.push(...g.books)
    })
    
    this.setData({
      groupedBooks: groups,
      filteredBooks: updatedBooks
    }, () => {
      this.updateSelection()
    })
  },

  // 全选书籍
  selectAllBooks() {
    const { groupedBooks, isAllBooksSelected } = this.data
    const updatedGroups = groupedBooks.map(group => {
      const updatedBooks = group.books.map(book => ({
        ...book,
        selected: !isAllBooksSelected
      }))
      return { ...group, books: updatedBooks }
    })
    
    const updatedBooks = []
    updatedGroups.forEach(group => {
      updatedBooks.push(...group.books)
    })
    
    this.setData({
      groupedBooks: updatedGroups,
      filteredBooks: updatedBooks
    }, () => {
      this.updateSelection()
    })
  },

  // 全选资料
  selectAllMaterials() {
    const { filteredMaterials, isAllMaterialsSelected } = this.data
    const updatedMaterials = filteredMaterials.map(material => ({
      ...material,
      selected: !isAllMaterialsSelected
    }))
    
    this.setData({
      filteredMaterials: updatedMaterials
    }, () => {
      this.updateSelection()
    })
  },

  // 全选当前标签
  selectAllCurrent() {
    const { activeTab, groupedBooks, filteredMaterials } = this.data
    const isAllSelected = this.data.isAllCurrentSelected
    
    if (activeTab === 0) {
      const updatedGroups = groupedBooks.map(group => {
        const updatedBooks = group.books.map(book => ({
          ...book,
          selected: !isAllSelected
        }))
        return { ...group, books: updatedBooks }
      })
      
      const updatedBooks = []
      updatedGroups.forEach(group => {
        updatedBooks.push(...group.books)
      })
      
      this.setData({
        groupedBooks: updatedGroups,
        filteredBooks: updatedBooks
      }, () => {
        this.updateSelection()
      })
    } else {
      const updatedMaterials = filteredMaterials.map(material => ({
        ...material,
        selected: !isAllSelected
      }))
      
      this.setData({
        filteredMaterials: updatedMaterials
      }, () => {
        this.updateSelection()
      })
    }
  },

  // 显示搜索框
  showSearch() {
    this.setData({
      showSearchInput: true
    })
  },

  // 隐藏搜索框
  hideSearch() {
    this.setData({
      showSearchInput: false,
      searchKeyword: ''
    }, () => {
      this.filterData()
    })
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      searchKeyword: ''
    }, () => {
      this.filterData()
    })
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    }, () => {
      this.filterData()
    })
  },

  // 搜索
  onSearch() {
    this.filterData()
  },

  // 切换标签
  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    this.setData({
      activeTab: index
    }, () => {
      this.updateSelection()
    })
  },

  // 切换编辑模式
  toggleEdit() {
    const isEditMode = !this.data.isEditMode
    
    if (!isEditMode) {
      this.resetSelection()
    }
    
    this.setData({ isEditMode })
  },

  // 重置选中状态
  resetSelection() {
    const { favoriteBooks, favoriteMaterials, groupedBooks } = this.data
    
    const updatedBooks = favoriteBooks.map(book => ({
      ...book,
      selected: false
    }))
    
    const updatedMaterials = favoriteMaterials.map(material => ({
      ...material,
      selected: false
    }))
    
    const updatedGroups = groupedBooks.map(group => {
      const updatedGroupBooks = group.books.map(book => ({
        ...book,
        selected: false
      }))
      return { ...group, books: updatedGroupBooks }
    })
    
    this.setData({
      favoriteBooks: updatedBooks,
      favoriteMaterials: updatedMaterials,
      filteredBooks: updatedBooks,
      filteredMaterials: updatedMaterials,
      groupedBooks: updatedGroups
    }, () => {
      this.updateSelection()
    })
  },

  // 删除选中项
  deleteSelected() {
    const { activeTab, selectedCount, selectedBooks, selectedMaterials } = this.data
    
    if (selectedCount === 0) {
      wx.showToast({
        title: '请先选择要删除的项目',
        icon: 'none',
        duration: 1500
      })
      return
    }
    
    wx.showModal({
      title: '提示',
      content: `确定要删除选中的${selectedCount}个项目吗？`,
      confirmText: '删除',
      confirmColor: '#ff6b6b',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
            mask: true
          });
          
          // 批量删除收藏
          const deletePromises = [];
          
          if (activeTab === 0) {
            // 删除选中的书籍
            selectedBooks.forEach(book => {
              deletePromises.push(
                new Promise((resolve, reject) => {
                  wx.cloud.callFunction({
                    name: 'removeFavorite',
                    data: {
                      itemId: book.id,
                      type: 'book'
                    },
                    success: (res) => {
                      resolve(res.result.success);
                    },
                    fail: (error) => {
                      console.error('删除收藏失败:', error);
                      resolve(false);
                    }
                  });
                })
              );
            });
          } else {
            // 删除选中的资料
            selectedMaterials.forEach(material => {
              deletePromises.push(
                new Promise((resolve, reject) => {
                  wx.cloud.callFunction({
                    name: 'removeFavorite',
                    data: {
                      itemId: material.id,
                      type: 'material'
                    },
                    success: (res) => {
                      resolve(res.result.success);
                    },
                    fail: (error) => {
                      console.error('删除收藏失败:', error);
                      resolve(false);
                    }
                  });
                })
              );
            });
          }
          
          // 等待所有删除操作完成
          Promise.all(deletePromises).then((results) => {
            const successCount = results.filter(r => r).length;
            
            wx.hideLoading();
            
            if (successCount > 0) {
              // 重新加载数据
              this.loadFavorites();
              wx.showToast({
                title: `成功删除${successCount}个项目`,
                icon: 'success',
                duration: 1500
              });
            } else {
              wx.showToast({
                title: '删除失败，请重试',
                icon: 'none',
                duration: 1500
              });
            }
          }).catch((error) => {
            wx.hideLoading();
            console.error('删除操作失败:', error);
            wx.showToast({
              title: '删除失败，请重试',
              icon: 'none',
              duration: 1500
            });
          });
        }
      }
    })
  },

  // 去结算
  goToSettle() {
    const { selectedBooks, selectedMaterials, totalPrice, totalMaterialPrice, activeTab } = this.data
    
    // 获取当前选中的项目
    let itemsToCheckout = []
    let totalAmount = 0
    
    if (activeTab === 0) {
      // 二手书
      if (selectedBooks.length === 0) {
        wx.showToast({
          title: '请先选择要结算的书籍',
          icon: 'none',
          duration: 1500
        })
        return
      }
      
      itemsToCheckout = selectedBooks.map(book => ({
        itemId: book.id,
        type: 'book',
        itemData: {
          title: book.title,
          price: book.price,
          image: book.image
        }
      }))
      totalAmount = totalPrice
    } else {
      // 资料
      if (selectedMaterials.length === 0) {
        wx.showToast({
          title: '请先选择要下载的资料',
          icon: 'none',
          duration: 1500
        })
        return
      }
      
      itemsToCheckout = selectedMaterials.map(material => ({
        itemId: material.id,
        type: 'material',
        itemData: {
          title: material.title,
          price: material.price,
          format: material.typeText,
          size: material.size
        }
      }))
      totalAmount = totalMaterialPrice
    }
    
    // 显示确认弹窗
    const itemType = activeTab === 0 ? '书籍' : '资料'
    wx.showModal({
      title: '确认结算',
      content: `总计 ¥${totalAmount.toFixed(2)}，共${itemsToCheckout.length}个${itemType}，确认结算？`,
      confirmText: '确认支付',
      confirmColor: '#ff6b6b',
      cancelText: '再想想',
      success: (res) => {
        if (res.confirm) {
          this.createBatchOrders(itemsToCheckout)
        }
      }
    })
  },
  
  // 批量创建订单
  createBatchOrders(items) {
    wx.showLoading({
      title: '创建订单中...',
      mask: true
    })
    
    const app = getApp()
    const userInfo = app.globalData.userInfo || {}
    
    wx.cloud.callFunction({
      name: 'createBatchOrders',
      data: {
        items: items,
        buyerName: userInfo.nickname || '用户',
        buyerAvatar: userInfo.avatarUrl || ''
      },
      success: (res) => {
        wx.hideLoading()
        console.log('批量订单创建结果:', res)
        
        if (res.result && res.result.success) {
          const successCount = res.result.data.success.length
          const failedCount = res.result.data.failed.length
          
          let message = `结算成功，创建了${successCount}个订单`
          if (failedCount > 0) {
            message += `，${failedCount}个商品失败`
          }
          
          this.resetSelection()
          
          wx.hideLoading()
          wx.showModal({
            title: '结算成功',
            content: message,
            showCancel: false,
            confirmText: '查看订单',
            complete: (modalRes) => {
              if (modalRes.confirm) {
                wx.switchTab({
                  url: '/pages/my-orders/my-orders',
                  fail: (err) => {
                    console.error('跳转失败:', err)
                    wx.navigateTo({
                      url: '/pages/my-orders/my-orders'
                    })
                  }
                })
              }
            }
          })
        } else {
          wx.showToast({
            title: res.result?.message || '结算失败',
            icon: 'none',
            duration: 2000
          })
        }
      },
      fail: (error) => {
        wx.hideLoading()
        console.error('调用云函数失败:', error)
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        })
      }
    })
  },

  // 下载选中资料
  downloadSelected() {
    const { selectedMaterials, totalMaterialPrice, selectedMaterialsCount } = this.data
    
    if (selectedMaterialsCount === 0) {
      wx.showToast({
        title: '请先选择要下载的资料',
        icon: 'none',
        duration: 1500
      })
      return
    }
    
    const freeMaterials = selectedMaterials.filter(material => material.price === 0)
    const paidMaterials = selectedMaterials.filter(material => material.price > 0)
    
    if (paidMaterials.length > 0) {
      wx.showModal({
        title: '确认下载',
        content: `有${paidMaterials.length}个收费资料，总计¥${totalMaterialPrice}，确认下载${selectedMaterialsCount}个资料？`,
        confirmText: '确认下载',
        confirmColor: '#4CAF50',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.processDownload(selectedMaterials)
          }
        }
      })
    } else {
      wx.showModal({
        title: '确认下载',
        content: `确认下载${selectedMaterialsCount}个免费资料？`,
        confirmText: '确认下载',
        confirmColor: '#4CAF50',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.processDownload(selectedMaterials)
          }
        }
      })
    }
  },

  // 处理下载
  processDownload(materials) {
    wx.showLoading({
      title: '准备下载中...',
      mask: true
    })
    
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '下载成功',
        icon: 'success',
        duration: 1500
      })
      
      this.resetSelection()
    }, 1500)
  },

  // 咨询卖家
  consultSeller(e) {
    const sellerId = e.currentTarget.dataset.sellerId
    const seller = this.data.groupedBooks.find(group => group.sellerId === sellerId)
    
    if (seller) {
      wx.navigateTo({
        url: `/pages/chat/chat?userId=${sellerId}&nickname=${seller.sellerName}&avatar=${seller.sellerAvatar}`
      })
    }
  },

  // 跳转到详情页
  goToDetail(e) {
    if (this.data.isEditMode) return
    
    const id = e.currentTarget.dataset.id
    const type = e.currentTarget.dataset.type
    
    if (type === 'book') {
      wx.navigateTo({
        url: `/pages/book-detail/book-detail?id=${id}`
      })
    } else {
      wx.navigateTo({
        url: `/pages/material-detail/material-detail?id=${id}`
      })
    }
  },

  onPullDownRefresh() {
    this.loadFavorites()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  onReachBottom() {
    // 可以在这里实现加载更多功能
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
})