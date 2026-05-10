Page({
  data: {
    searchText: '',
    searchHistory: [],
    hasSearched: false,
    searchResults: [],
    currentFilter: '',
    hasMore: true,
    page: 1,
    pageSize: 10,
    isLoading: false,
    
    hotSearch: [
      '高等数学', '大学英语', '软件工程', 
      '土木工程', '学前教育', '数据结构'
    ],
    
    suggestions: [],
    showSuggestions: false,
    searchDebounceTimer: null
  },

  onLoad() {
    this.loadHistory()
  },

  loadHistory() {
    const history = wx.getStorageSync('searchHistory') || []
    this.setData({ searchHistory: history })
  },

  saveHistory(keyword) {
    if (!keyword) return
    
    let history = wx.getStorageSync('searchHistory') || []
    history = history.filter(item => item !== keyword)
    history.unshift(keyword)
    
    if (history.length > 10) {
      history = history.slice(0, 10)
    }
    
    wx.setStorageSync('searchHistory', history)
    this.setData({ searchHistory: history })
  },

  deleteHistory(e) {
    e.stopPropagation()
    const index = e.currentTarget.dataset.index
    let history = this.data.searchHistory
    history.splice(index, 1)
    
    wx.setStorageSync('searchHistory', history)
    this.setData({ searchHistory: history })
  },

  clearAllHistory() {
    wx.showModal({
      title: '提示',
      content: '确定清空所有搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory')
          this.setData({ searchHistory: [] })
          wx.showToast({
            title: '已清空',
            icon: 'success'
          })
        }
      }
    })
  },

  onInput(e) {
    const value = e.detail.value
    this.setData({ searchText: value })
    
    if (this.data.searchDebounceTimer) {
      clearTimeout(this.data.searchDebounceTimer)
    }
    
    const timer = setTimeout(() => {
      if (value.trim().length > 0) {
        this.getSuggestions(value.trim())
      } else {
        this.setData({ 
          showSuggestions: false,
          suggestions: []
        })
      }
    }, 300)
    
    this.setData({ searchDebounceTimer: timer })
  },

  getSuggestions(keyword) {
    const suggestions = []
    
    this.data.hotSearch.forEach(item => {
      if (this.fuzzyMatch(item, keyword)) {
        suggestions.push({
          text: item,
          type: 'hot',
          highlightText: this.highlightText(item, keyword)
        })
      }
    })
    
    this.data.searchHistory.forEach(item => {
      if (this.fuzzyMatch(item, keyword) && !suggestions.find(s => s.text === item)) {
        suggestions.push({
          text: item,
          type: 'history',
          highlightText: this.highlightText(item, keyword)
        })
      }
    })
    
    this.setData({ 
      suggestions: suggestions.slice(0, 8),
      showSuggestions: suggestions.length > 0
    })
  },

  // 智能模糊搜索 - 支持简称、同义词匹配
  fuzzyMatch: function(text, keyword) {
    if (!text || !keyword) return false;
    
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    // 1. 直接包含
    if (lowerText.includes(lowerKeyword)) {
      return true;
    }
    
    // 2. 常见课程简称映射
    const courseMap = {
      '高数': ['高等数学', '高等数学（一）', '高等数学（二）', '高数Ⅰ', '高数Ⅱ'],
      '线代': ['线性代数', '线性代数课程', '线代课程'],
      '概率': ['概率论', '概率论与数理统计', '概率统计'],
      '大英': ['大学英语', '大学英语（一）', '大学英语（二）', '大学英语（三）', '大学英语（四）'],
      '思修': ['思想道德修养', '思想道德修养与法律基础', '思修课'],
      '毛概': ['毛泽东思想', '毛泽东思想和中国特色社会主义理论体系概论', '毛概课'],
      '马原': ['马克思主义', '马克思主义基本原理概论', '马原课'],
      '近代史': ['中国近代史', '中国近现代史纲要', '近代史纲要'],
      '军理': ['军事理论', '军事理论课程'],
      '体育': ['体育课', '体育与健康', '体育课程'],
      '计算机': ['计算机基础', '计算机应用基础', '计算机导论'],
      '程序设计': ['编程', '程序设计基础', '编程基础'],
      'c语言': ['c程序', 'c编程', 'c++'],
      'java': ['java编程', 'java程序', 'java开发'],
      'python': ['python编程', 'python程序', 'python开发'],
      '数据结构': ['算法', '算法与数据结构'],
      '操作系统': ['os', '操作系统原理'],
      '数据库': ['数据库原理', '数据库系统', 'mysql', 'sql'],
      '计算机网络': ['网络', '网络原理', '网络课程'],
      '人工智能': ['ai', '机器学习', '深度学习']
    };
    
    // 3. 检查简称映射
    if (courseMap[lowerKeyword]) {
      return courseMap[lowerKeyword].some(related => lowerText.includes(related.toLowerCase()));
    }
    
    // 4. 反向检查：如果输入的是全称，检查是否匹配简称
    for (const [abbr, fullNames] of Object.entries(courseMap)) {
      if (fullNames.some(full => lowerText.includes(full.toLowerCase())) && lowerText.includes(abbr)) {
        return true;
      }
    }
    
    return false;
  },

  highlightText(text, keyword) {
    if (!text || !keyword) return text
    const regex = new RegExp(`(${keyword})`, 'gi')
    return text.replace(regex, '{{$1}}')
  },

  selectSuggestion(e) {
    const text = e.currentTarget.dataset.text
    this.setData({ 
      searchText: text,
      showSuggestions: false,
      suggestions: []
    })
    this.onSearch()
  },

  clearInput() {
    this.setData({ 
      searchText: '',
      showSuggestions: false,
      suggestions: []
    })
  },

  hideSuggestions() {
    this.setData({ showSuggestions: false })
  },

  onSearch() {
    const keyword = this.data.searchText.trim()
    if (!keyword) {
      wx.showToast({ title: '请输入关键词', icon: 'none' })
      return
    }
    
    this.saveHistory(keyword)
    
    this.setData({
      hasSearched: true,
      page: 1,
      hasMore: true,
      showSuggestions: false,
      suggestions: [],
      isLoading: true
    })
    
    this.searchProducts(keyword)
  },

  searchProducts(keyword) {
    const { currentFilter, page, pageSize } = this.data
    
    wx.cloud.callFunction({
      name: 'searchBooks',
      data: {
        keyword: keyword,
        filter: currentFilter,
        page: page,
        pageSize: pageSize
      },
      success: (res) => {
        if (res.result.success) {
          const data = res.result.data
          
          if (page === 1) {
            this.setData({ 
              searchResults: data.books,
              hasMore: data.hasMore,
              isLoading: false
            })
          } else {
            this.setData({ 
              searchResults: this.data.searchResults.concat(data.books),
              hasMore: data.hasMore,
              isLoading: false
            })
          }
        } else {
          this.setData({ isLoading: false })
          wx.showToast({
            title: res.result.message || '搜索失败',
            icon: 'none'
          })
        }
      },
      fail: (error) => {
        console.error('调用搜索云函数失败:', error)
        this.setData({ isLoading: false })
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        })
      }
    })
  },

  clickHotTag(e) {
    const keyword = e.currentTarget.dataset.text
    this.setData({ 
      searchText: keyword,
      showSuggestions: false
    })
    this.onSearch()
  },

  clickHistory(e) {
    const keyword = e.currentTarget.dataset.text
    this.setData({ 
      searchText: keyword,
      showSuggestions: false
    })
    this.onSearch()
  },

  changeFilter(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ 
      currentFilter: filter,
      page: 1
    })
    
    const keyword = this.data.searchText
    if (keyword) {
      this.searchProducts(keyword)
    }
  },

  loadMore() {
    if (!this.data.hasMore || this.data.isLoading) return
    
    this.setData({ 
      page: this.data.page + 1,
      isLoading: true
    })
    
    const keyword = this.data.searchText
    if (keyword) {
      this.searchProducts(keyword)
    }
  },

  goBack() {
    if (this.data.hasSearched) {
      this.setData({ 
        hasSearched: false,
        searchText: '',
        searchResults: []
      })
    } else {
      wx.navigateBack()
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/book-detail/book-detail?id=${id}`
    })
  },

  getMatchTypeText(type) {
    const typeMap = {
      'title': '书名匹配',
      'course': '课程匹配',
      'college': '学院匹配',
      'major': '专业匹配',
      'author': '作者匹配',
      'other': '其他匹配'
    }
    return typeMap[type] || ''
  }
})
