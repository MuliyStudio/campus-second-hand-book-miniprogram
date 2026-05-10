// 测试用户信息存储
console.log('测试用户信息存储...');

try {
  const userInfo = wx.getStorageSync('userInfo');
  console.log('用户信息:', userInfo);
  
  if (userInfo) {
    console.log('用户昵称:', userInfo.nickname);
    console.log('用户校区:', userInfo.campus);
    console.log('用户宿舍:', userInfo.dorm);
    console.log('用户学院:', userInfo.college);
    console.log('用户专业:', userInfo.major);
  } else {
    console.log('本地存储中没有用户信息');
  }
} catch (error) {
  console.error('读取用户信息失败:', error);
}
