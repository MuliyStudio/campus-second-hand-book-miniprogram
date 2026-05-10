Page({
  data: {
    // 客服消息列表
    messages: [
      {
        id: 1,
        content: '您好，欢迎使用校园二手书交易平台客服服务，请问有什么可以帮助您的？',
        type: 'service',
        time: '10:00'
      },
      {
        id: 2,
        content: '我想咨询一下如何发布二手书',
        type: 'user',
        time: '10:01'
      },
      {
        id: 3,
        content: '您可以在首页点击"发布"按钮，选择"发布二手书"，然后按照提示填写书籍信息即可。',
        type: 'service',
        time: '10:02'
      },
      {
        id: 4,
        content: '好的，谢谢',
        type: 'user',
        time: '10:03'
      },
      {
        id: 5,
        content: '不客气，有任何其他问题随时咨询我们。',
        type: 'service',
        time: '10:04'
      }
    ],
    // 输入框内容
    inputValue: '',
    // 客服状态
    serviceStatus: 'online', // online, busy, offline
    // 是否显示快捷问题
    showQuickQuestions: true,
    // 快捷问题列表
    quickQuestions: [
      '如何发布二手书？',
      '如何购买书籍？',
      '如何下载资料？',
      '如何退款/退货？',
      '如何联系人工客服？'
    ],
    // 最后一条消息ID（用于滚动到底部）
    lastMessageId: '',
    // 是否正在加载回复
    isLoading: false
  },

  onLoad() {
    console.log('加载客服页面');
    this.scrollToBottom();
  },

  onShow() {
    // 页面显示时滚动到底部
    this.scrollToBottom();
  },

  // 输入框输入事件
  handleInput(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  // 发送消息
  sendMessage(e) {
    let content;
    if (e.currentTarget) {
      // 从快捷问题点击获取内容
      content = e.currentTarget.dataset.content;
    } else {
      // 从输入框获取内容
      content = this.data.inputValue.trim();
      if (!content) return;
      // 清空输入框
      this.setData({ inputValue: '' });
    }

    // 添加用户消息
    const newMessage = {
      id: Date.now(),
      content: content,
      type: 'user',
      time: this.getCurrentTime()
    };

    const messages = [...this.data.messages, newMessage];
    this.setData({ 
      messages: messages,
      isLoading: true
    });

    // 滚动到底部
    this.scrollToBottom();

    // 模拟客服回复
    this.getAIReply(content).then((reply) => {
      const replyMessage = {
        id: Date.now() + 1,
        content: reply,
        type: 'service',
        time: this.getCurrentTime()
      };
      const updatedMessages = [...messages, replyMessage];
      this.setData({ 
        messages: updatedMessages,
        isLoading: false,
        lastMessageId: replyMessage.id.toString()
      });
      this.scrollToBottom();
    });
  },

  // 发送快捷问题
  sendQuickQuestion(e) {
    const content = e.currentTarget.dataset.content;
    this.sendMessage({ currentTarget: { dataset: { content: content } } });
  },

  // 获取当前时间
  getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // AI智能回复
  getAIReply(content) {
    return new Promise((resolve) => {
      // 模拟AI思考过程（1-2秒）
      const thinkingTime = Math.random() * 1000 + 1000;
      
      setTimeout(() => {
        // 关键词匹配，提供更准确的回复
        const keywords = {
          '你好|您好': '您好！欢迎使用校园二手书交易平台客服服务，请问有什么可以帮助您的？',
          '谢谢|感谢': '不客气，有任何其他问题随时咨询我们。',
          '发布|上传': '您可以在首页点击"发布"按钮，选择"发布二手书"或"发布学习资料"，然后按照提示填写信息即可。',
          '购买|下单': '您可以在浏览页面找到心仪的商品，点击进入详情页后选择"立即购买"。',
          '下载|资料': '您可以在"我的下载"页面查看已下载的资料，点击"再次下载"按钮重新下载。',
          '订单|交易': '您可以在"我的订单"页面查看所有订单状态，包括待付款、待处理、已完成等。',
          '退款|退货': '如果您需要退款，请在订单详情页联系卖家协商，或者联系客服处理。',
          '客服|人工': '您现在正在与AI客服对话，如需人工客服，请直接回复"人工客服"。',
          '问题|帮助': '请问您遇到了什么问题？可以详细描述一下，我会尽力帮助您。',
          '价格|费用': '平台上的商品价格由卖家自行设定，您可以与卖家协商价格。',
          '物流|配送': '二手书交易一般为线下交易，您可以与卖家协商见面地点和时间。',
          '账号|密码': '如果您忘记了密码，可以在登录页面点击"忘记密码"进行重置。',
          '认证|验证': '为了保障交易安全，平台要求用户进行实名认证。',
          '投诉|举报': '如果您遇到违规行为，可以在商品详情页点击"举报"按钮。'
        };
        
        // 检查是否包含关键词
        for (const [pattern, reply] of Object.entries(keywords)) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(content)) {
            resolve(reply);
            return;
          }
        }
        
        // 如果没有匹配到关键词，提供通用回复
        const genericReplies = [
          '我理解您的问题，让我为您详细解答...',
          '感谢您的咨询，我正在为您处理这个问题。',
          '根据您的问题，我建议您可以在首页查看相关帮助文档。',
          '您的问题我已经收到，我们会尽快为您处理。',
          '非常抱歉给您带来不便，我们会尽快解决您的问题。',
          '感谢您的反馈，我们会不断改进我们的服务。',
          '您可以在"我的订单"页面查看订单状态，或者在"管理发布"页面管理您的商品。',
          '如果您需要帮助，您可以尝试使用页面底部的快捷问题，或者直接描述您的问题。'
        ];
        
        // 随机选择一个通用回复
        const randomIndex = Math.floor(Math.random() * genericReplies.length);
        resolve(genericReplies[randomIndex]);
      }, thinkingTime);
    });
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      const query = wx.createSelectorQuery();
      query.select('.chat-messages').boundingClientRect();
      query.selectViewport().scrollOffset();
      query.exec((res) => {
        if (res[0] && res[1]) {
          wx.pageScrollTo({
            scrollTop: res[0].bottom,
            duration: 300
          });
        }
      });
    }, 100);
  }
});