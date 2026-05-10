Page({
  data: {
    scrollHeight: 0,
    currentTime: '',
    colleges: [
      {
        id: 'arch',
        name: '建筑与电气工程学院',
        majors: [
          { id: 'all', name: '全部' },
          { id: 'arch-1', name: '工程管理' },
          { id: 'arch-2', name: '电气自动' },
          { id: 'arch-3', name: '土木工程' },
          { id: 'arch-4', name: '工程造价' }
        ]
      },
      {
        id: 'culture',
        name: '文化与传媒学院',
        majors: [
          { id: 'all', name: '全部' },
          { id: 'culture-1', name: '数媒' },
          { id: 'culture-2', name: '编导' },
          { id: 'culture-3', name: '汉本' },
          { id: 'culture-4', name: '播主' },
          { id: 'culture-5', name: '网媒' },
          { id: 'culture-6', name: '播导' }
        ]
      },
      {
        id: 'education',
        name: '教师教育学院',
        majors: [
          { id: 'all', name: '全部' },
          { id: 'education-1', name: '学前教育' },
          { id: 'education-2', name: '小学教育' },
          { id: 'education-3', name: '舞蹈学前' },
          { id: 'education-4', name: '音乐学' },
          { id: 'education-5', name: '历史学' },
          { id: 'education-6', name: '数学' },
          { id: 'education-7', name: '体育教学' },
          { id: 'education-8', name: '心理学' }
        ]
      },
      {
        id: 'tourism',
        name: '旅游与体育健康学院',
        majors: [
          { id: 'all', name: '全部' },
          { id: 'tourism-1', name: '酒店管理' },
          { id: 'tourism-2', name: '旅游管理' },
          { id: 'tourism-3', name: '运动康复' },
          { id: 'tourism-4', name: '社会体育' },
          { id: 'tourism-5', name: '公共事业管理' }
        ]
      },
      {
        id: 'ai',
        name: '人工智能学院',
        majors: [
          { id: 'all', name: '全部' },
          { id: 'ai-1', name: '机械' },
          { id: 'ai-2', name: '电子' },
          { id: 'ai-3', name: '集电' },
          { id: 'ai-4', name: '通信' },
          { id: 'ai-5', name: '数据' },
          { id: 'ai-6', name: '人工' },
          { id: 'ai-7', name: '网工' },
          { id: 'ai-8', name: '制造' },
          { id: 'ai-9', name: '软件' },
          { id: 'ai-10', name: '物联' },
          { id: 'ai-11', name: '机器人' }
        ]
      },
      {
        id: 'foreign',
        name: '外国语学院',
        majors: [
          { id: 'all', name: '全部' },
          { id: 'foreign-1', name: '英语' },
          { id: 'foreign-2', name: '商务英语' },
          { id: 'foreign-3', name: '跨境电子商务' },
          { id: 'foreign-4', name: '国际经济与贸易' }
        ]
      },
      {
        id: 'economics',
        name: '经济与管理学院',
        majors: [
          { id: 'all', name: '全部' },
          { id: 'economics-1', name: '数字经济' },
          { id: 'economics-2', name: '金融科技' },
          { id: 'economics-3', name: '财务管理' },
          { id: 'economics-4', name: '国际经济与贸易' }
        ]
      },
      {
        id: 'design',
        name: '设计学院',
        majors: [
          { id: 'all', name: '全部' },
          { id: 'design-1', name: '视觉传达' },
          { id: 'design-2', name: '服装服饰' },
          { id: 'design-3', name: '美术学' },
          { id: 'design-4', name: '环境设计' },
          { id: 'design-5', name: '产品设计' }
        ]
      },
      {
        id: 'material',
        name: '材料与化学工程学院',
        majors: [
          { id: 'all', name: '全部' },
          { id: 'material-1', name: '分体材料' },
          { id: 'material-2', name: '高分子材料' },
          { id: 'material-3', name: '应用化学' }
        ]
      },
      {
        id: 'food',
        name: '食品与生物工程学院',
        majors: [
          { id: 'all', name: '全部' },
          { id: 'food-1', name: '食品科学' },
          { id: 'food-2', name: '食品质量' },
          { id: 'food-3', name: '生物工程' },
          { id: 'food-4', name: '茶学' }
        ]
      },
      {
        id: 'marx',
        name: '马克思主义学院',
        majors: [
          { id: 'all', name: '全部' },
          { id: 'marx-1', name: '思政' }
        ]
      }
    ],
    selectedCollege: null,
    selectedMajor: null,
    filteredBooks: [],
    isLoading: false,
    isRefreshing: false,
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad(options) {
    this.updateCurrentTime()
    this.calculateScrollHeight()
    
    this.setData({
      selectedCollege: this.data.colleges[0],
      selectedMajor: { id: 'all', name: '全部' }
    })
    
    this.loadBooks()
  },

  onShow() {
    this.updateCurrentTime()
  },

  calculateScrollHeight() {
    const systemInfo = wx.getSystemInfoSync()
    const windowHeight = systemInfo.windowHeight
    const statusBarHeight = systemInfo.statusBarHeight || 20
    const navHeight = 44
    
    const scrollHeight = windowHeight - statusBarHeight - navHeight
    
    this.setData({
      scrollHeight: scrollHeight
    })
  },

  updateCurrentTime() {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    this.setData({
      currentTime: `${hours}:${minutes}`
    })
  },

  selectCollege(e) {
    const collegeId = e.currentTarget.dataset.id
    const college = this.data.colleges.find(c => c.id === collegeId)
    
    if (college) {
      this.setData({
        selectedCollege: college,
        selectedMajor: { id: 'all', name: '全部' },
        page: 1,
        hasMore: true,
        filteredBooks: []
      })
      this.loadBooks()
    }
  },

  selectMajor(e) {
    const majorId = e.currentTarget.dataset.id
    const major = this.data.selectedCollege.majors.find(m => m.id === majorId)
    
    if (major) {
      this.setData({
        selectedMajor: major,
        page: 1,
        hasMore: true,
        filteredBooks: []
      })
      this.loadBooks()
    }
  },

  loadBooks() {
    if (this.data.isLoading || !this.data.hasMore) return
    
    this.setData({ isLoading: true })
    
    const { selectedCollege, selectedMajor, page, pageSize } = this.data
    
    wx.cloud.callFunction({
      name: 'getCategoryBooks',
      data: {
        college: selectedCollege.name,
        major: selectedMajor.name,
        page: page,
        pageSize: pageSize
      },
      success: (res) => {
        if (res.result.success) {
          const data = res.result.data
          let filteredBooks = []
          
          if (page === 1) {
            filteredBooks = data.books
          } else {
            filteredBooks = this.data.filteredBooks.concat(data.books)
          }
          
          this.setData({
            filteredBooks: filteredBooks,
            isLoading: false,
            hasMore: data.hasMore,
            page: page + 1
          })
        } else {
          this.setData({ isLoading: false })
          wx.showToast({
            title: res.result.message || '加载失败',
            icon: 'none'
          })
        }
      },
      fail: (error) => {
        console.error('调用云函数失败:', error)
        this.setData({ isLoading: false })
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        })
      }
    })
  },

  onRefresh() {
    this.setData({ isRefreshing: true })
    
    this.setData({
      page: 1,
      filteredBooks: [],
      hasMore: true
    })
    
    this.loadBooks()
    
    setTimeout(() => {
      this.setData({ isRefreshing: false })
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      })
    }, 500)
  },

  loadMoreBooks() {
    if (!this.data.hasMore || this.data.isLoading) return
    this.loadBooks()
  },

  toggleLike(e) {
    e.stopPropagation()
    const index = e.currentTarget.dataset.index
    const books = this.data.filteredBooks
    const book = books[index]
    
    book.isLiked = !book.isLiked
    book.likeCount = book.isLiked ? (book.likeCount || 0) + 1 : Math.max(0, (book.likeCount || 0) - 1)
    
    this.setData({ filteredBooks: books })
    
    wx.vibrateShort({ type: 'light' })
    wx.showToast({
      title: book.isLiked ? '已点赞' : '已取消',
      icon: 'success',
      duration: 1000
    })
  },

  goToSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    })
  },

  goToPublishBook() {
    const app = getApp()
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        confirmText: '去登录',
        cancelText: '再看看',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            })
          }
        }
      })
      return
    }

    wx.navigateTo({
      url: '/pages/publish-book/publish-book'
    })
  },

  goToBookDetail(e) {
    const bookId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/book-detail/book-detail?id=${bookId}`
    })
  },

  onReady() {},

  onHide() {},

  onUnload() {},

  onPullDownRefresh() {
    this.onRefresh()
  },

  onReachBottom() {
    this.loadMoreBooks()
  },

  onShareAppMessage() {
    wx.showToast({
      title: '暂时无法分享',
      icon: 'none',
      duration: 2000
    });
  },

  goBack() {
    wx.navigateBack()
  }
})
