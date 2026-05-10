// pages/login/login.js
Page({
  data: {
    showLoading: false
  },

  onLoad: function (options) {
    // 检查是否已经登录
    const app = getApp();
    if (app.globalData.isLoggedIn) {
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  onShow: function () {
    // 每次显示页面时检查登录状态
    const app = getApp();
    if (app.globalData.isLoggedIn) {
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  // 微信一键登录
  wechatLogin: function() {
    const app = getApp();
    this.setData({ showLoading: true });

    // 先获取微信用户信息
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (userRes) => {
        console.log('获取到的用户信息:', userRes.userInfo);
        // 保存用户信息到全局变量
        app.globalData.wechatUserInfo = userRes.userInfo;
        
        // 执行微信登录
        wx.login({
          success: (loginRes) => {
            if (loginRes.code) {
              // 调用云函数获取openid
              wx.cloud.callFunction({
                name: 'login',
                data: { code: loginRes.code },
                success: (cloudRes) => {
                  app.globalData.openid = cloudRes.result.openid;
                  console.log('获取到的openid:', app.globalData.openid);
                  
                  // 保存openid到本地存储
                  wx.setStorageSync('openid', app.globalData.openid);
                  
                  // 检查用户是否已完善信息
                  this.checkUserInfo();
                },
                fail: (err) => {
                  console.error('登录失败:', err);
                  this.setData({ showLoading: false });
                  wx.showToast({
                    title: '登录失败，请重试',
                    icon: 'none',
                    duration: 2000
                  });
                }
              });
            } else {
              console.error('获取登录凭证失败');
              this.setData({ showLoading: false });
              wx.showToast({
                title: '登录失败，请重试',
                icon: 'none',
                duration: 2000
              });
            }
          },
          fail: (err) => {
            console.error('微信登录失败:', err);
            this.setData({ showLoading: false });
            wx.showToast({
              title: '登录失败，请重试',
              icon: 'none',
              duration: 2000
            });
          }
        });
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
        this.setData({ showLoading: false });
        wx.showToast({
          title: '获取微信信息失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 检查用户信息
  checkUserInfo: function() {
    const app = getApp();
    
    wx.cloud.database().collection('users')
      .where({ _openid: app.globalData.openid })
      .get({
        success: (res) => {
          this.setData({ showLoading: false });
          
          if (res.data.length === 0) {
            // 新用户，跳转到完善信息页面，并传递微信头像和昵称
            const wechatUserInfo = app.globalData.wechatUserInfo || {};
            const avatarUrl = wechatUserInfo.avatarUrl || '';
            const nickName = wechatUserInfo.nickName || '';
            const params = `?avatarUrl=${encodeURIComponent(avatarUrl)}&nickName=${encodeURIComponent(nickName)}`;
            wx.redirectTo({
              url: '/pages/complete-info/complete-info' + params
            });
          } else {
            // 老用户，直接登录
            // 确保获取的是最新的用户信息
            const latestUserInfo = res.data[0];
            app.globalData.userInfo = latestUserInfo;
            app.globalData.isLoggedIn = true;
            
            // 保存登录状态和用户信息到本地存储
            app.saveLoginStatus();
            wx.setStorageSync('userInfo', JSON.stringify(latestUserInfo));
            
            // 跳转到首页
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        },
        fail: (err) => {
          console.error('检查用户信息失败:', err);
          this.setData({ showLoading: false });
          // 尝试从本地存储获取用户信息
          const localUserInfo = wx.getStorageSync('userInfo');
          if (localUserInfo) {
            try {
              const parsedUserInfo = JSON.parse(localUserInfo);
              app.globalData.userInfo = parsedUserInfo;
              app.globalData.isLoggedIn = true;
              app.saveLoginStatus();
              wx.switchTab({
                url: '/pages/index/index'
              });
              return;
            } catch (e) {
              console.error('解析本地用户信息失败:', e);
            }
          }
          // 如果本地也没有用户信息，提示错误
          wx.showToast({
            title: '登录失败，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
  },

  // 其他手机号登录
  phoneLogin: function() {
    wx.showToast({
      title: '手机号登录功能开发中',
      icon: 'none',
      duration: 2000
    });
  },

  // 查看用户服务协议
  viewUserAgreement: function() {
    wx.showModal({
      title: '用户服务协议',
      content: '欢迎使用贺院书驿！\n\n1. 协议适用范围\n本协议适用于所有使用贺院书驿服务的用户。\n\n2. 用户注册和账号管理\n用户通过微信登录或手机号注册成为平台用户，应提供真实、准确的个人信息。\n\n3. 用户的权利和义务\n用户有权在平台发布二手书和学习资料，有权购买和下载平台上的资源。用户应遵守平台规则，不得发布违法违规内容。\n\n4. 平台的权利和义务\n平台为用户提供交易和资源共享服务，有权对违规内容进行处理，保护用户的合法权益。\n\n5. 内容规范\n用户发布的内容应符合法律法规和公序良俗，不得发布侵权、色情、暴力等违法内容。\n\n6. 违约责任\n用户违反本协议的，平台有权采取警告、限制功能、封禁账号等措施。\n\n7. 协议的修改\n平台有权根据业务发展需要修改本协议，修改后将通过平台公告通知用户。\n\n8. 法律适用\n本协议的订立、执行、解释及争议的解决均适用中华人民共和国法律。',
      showCancel: true,
      confirmText: '同意',
      cancelText: '取消'
    });
  },

  // 查看隐私政策
  viewPrivacyPolicy: function() {
    wx.showModal({
      title: '隐私政策',
      content: '贺院书驿致力于保护用户的隐私和个人信息安全。\n\n1. 收集的个人信息\n我们收集用户的微信头像、昵称、手机号等信息，用于用户身份识别和服务提供。\n\n2. 个人信息的使用\n我们使用收集的信息为用户提供个性化服务，如推荐相关资源、维护账号安全等。\n\n3. 个人信息的保护\n我们采取加密、访问控制等技术措施保护用户个人信息，防止信息泄露。\n\n4. 个人信息的共享\n我们不会向第三方共享用户个人信息，除非获得用户授权或法律法规要求。\n\n5. 隐私政策的修改\n我们可能根据业务发展需要修改隐私政策，修改后将通过平台公告通知用户。\n\n6. 用户权利\n用户有权查询、修改、删除自己的个人信息，有权注销账号。\n\n7. 联系我们\n如对隐私政策有疑问，请通过平台客服与我们联系。',
      showCancel: true,
      confirmText: '同意',
      cancelText: '取消'
    });
  }
});