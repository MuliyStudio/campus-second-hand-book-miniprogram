// components/user-info-dialog/user-info-dialog.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 是否显示对话框
    visible: {
      type: Boolean,
      value: false
    },
    // 用户信息
    userInfo: {
      type: Object,
      value: {}
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    // 加载状态
    isLoading: false
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 关闭对话框
    onClose: function() {
      this.setData({ visible: false });
      this.triggerEvent('close');
    },

    // 查看完整资料
    onViewProfile: function() {
      const userInfo = this.data.userInfo;
      
      // 这里可以跳转到用户的完整资料页面
      wx.navigateTo({
        url: `/pages/user-profile/user-profile?uid=${userInfo.uid || ''}`,
        success: () => {
          // 关闭当前对话框
          this.onClose();
        },
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

    // 加载用户详细信息
    loadUserDetails: function(uid) {
      this.setData({ isLoading: true });
      
      // 模拟加载用户详细信息
      setTimeout(() => {
        const mockUserDetails = {
          ...this.data.userInfo,
          uid: uid || '100001',
          college: '计算机科学与技术学院',
          major: '软件工程',
          grade: '2021级',
          regTime: '2021-09-01',
          publishedBooks: 12,
          soldBooks: 8
        };
        
        this.setData({
          userInfo: mockUserDetails,
          isLoading: false
        });
      }, 1000);
    }
  }
});