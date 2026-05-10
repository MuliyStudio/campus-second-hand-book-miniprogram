# 校园二手书与学习资料共享小程序

![平台](https://img.shields.io/badge/平台-微信小程序-green) ![云开发](https://img.shields.io/badge/后端-微信云开发-blue) ![状态](https://img.shields.io/badge/状态-开发中-orange)

基于微信小程序云开发打造的校园二手书交易与学习资料共享平台，致力于为高校学生提供便捷的教材买卖、资料分享和学术交流服务。

## 目录

- [功能特色](#功能特色)
- [项目结构](#项目结构)
- [页面一览](#页面一览)
- [云函数列表](#云函数列表)
- [数据库设计](#数据库设计)
- [本地开发](#本地开发)
- [部署指南](#部署指南)
- [敏感数据说明](#敏感数据说明)

---

## 功能特色

### 二手书交易
- 发布/浏览/搜索二手教材，支持按分类、校区筛选
- 书籍成色标注（全新/九成新/七成新等）
- 买卖双方在线聊天、订单管理
- 买家确认收货、评价卖家

### 学习资料共享
- 上传/下载复习资料、课堂笔记、历年真题
- 支持免费分享或付费下载
- 资料排行榜（按下载量、点赞数综合排序）
- 按类型筛选（复习资料/笔记/真题）

### 交流社区
- 发布求助或分享帖子，支持图文
- 点赞、评论、收藏、转发
- 标签分类，便于检索

### 消息系统
- 买卖双方的即时聊天
- 系统通知（订单状态变更、审核结果等）
- 未读消息提醒

### 管理员后台
- 内容审核（图片/文本违规检测）
- 举报处理
- 用户管理

---

## 项目结构

```
campus-second-hand-book-miniprogram/
├── miniprogram/               # 小程序前端代码
│   ├── app.js / app.ts        # 全局入口
│   ├── app.json               # 全局配置（页面路由、TabBar）
│   ├── app.wxss              # 全局样式
│   ├── pages/                # 页面目录
│   │   ├── index/            # 首页（书籍推荐、搜索入口）
│   │   ├── discover/         # 发现页（资料库/排行榜/交流区）
│   │   ├── messages/         # 消息列表
│   │   ├── mine/             # 个人中心
│   │   ├── book-detail/      # 书籍详情
│   │   ├── material-detail/  # 资料详情
│   │   ├── post-detail/      # 帖子详情
│   │   ├── publish-book/     # 发布二手书
│   │   ├── publish-material/ # 上传学习资料
│   │   ├── publish-post/     # 发布帖子
│   │   ├── search/           # 搜索页
│   │   ├── category/         # 书籍分类
│   │   ├── favorites/        # 我的收藏
│   │   ├── my-orders/        # 我的订单
│   │   ├── my-downloads/     # 我的下载
│   │   ├── my-posts/        # 我的帖子
│   │   ├── chat/             # 聊天页
│   │   ├── user-center/      # 用户主页
│   │   ├── admin/            # 管理员后台
│   │   └── ...
│   ├── components/           # 自定义组件
│   └── images/               # 静态图片资源
├── cloudfunctions/           # 云函数目录
├── project.config.json        # 项目配置
├── .gitignore                # Git 忽略规则
└── README.md                 # 本文件
```

---

## 页面一览

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `pages/index/index` | 书籍推荐、搜索入口、快捷操作 |
| 发现 | `pages/discover/discover` | 资料库/排行榜/交流区三个 Tab |
| 消息 | `pages/messages/messages` | 会话列表、未读提醒 |
| 我的 | `pages/mine/mine` | 个人中心、我的发布/订单/收藏 |
| 书籍详情 | `pages/book-detail/book-detail` | 书籍信息、卖家信息、购买 |
| 资料详情 | `pages/material-detail/material-detail` | 资料信息、下载/购买 |
| 帖子详情 | `pages/post-detail/post-detail` | 帖子内容、评论列表 |
| 发布二手书 | `pages/publish-book/publish-book` | 填写书籍信息并发布 |
| 上传资料 | `pages/publish-material/publish-material` | 上传学习资料（免费/付费） |
| 发布帖子 | `pages/publish-post/publish-post` | 发布求助/分享帖子 |
| 搜索 | `pages/search/search` | 搜索书籍/资料/帖子 |
| 分类 | `pages/category/category` | 按分类浏览书籍 |
| 我的收藏 | `pages/favorites/favorites` | 收藏的书籍/资料/帖子 |
| 我的订单 | `pages/my-orders/my-orders` | 买家/卖家订单管理 |
| 聊天 | `pages/chat/chat` | 买卖双方即时聊天 |
| 管理员 | `pages/admin/admin` | 内容审核、举报处理 |

---

## 云函数列表

### 书籍相关
| 云函数 | 说明 |
|--------|------|
| `getBooks` | 获取书籍列表（支持筛选、分页） |
| `getCategoryBooks` | 按分类获取书籍 |
| `searchBooks` | 搜索书籍 |
| `publishBook` | 发布二手书 |
| `updateBook` | 更新书籍信息 |
| `updateBookStatus` | 更新书籍状态 |
| `deleteBook` | 删除书籍 |
| `incrementBookViewCount` | 增加浏览量 |
| `getRankList` | 获取排行榜 |

### 资料相关
| 云函数 | 说明 |
|--------|------|
| `getMaterials` | 获取资料列表 |
| `getMaterialDetail` | 获取资料详情 |
| `publishMaterial` | 上传资料 |
| `updateMaterialStatus` | 更新资料状态 |
| `deleteMaterial` | 删除资料 |
| `downloadMaterial` | 下载/购买资料 |
| `updateDownloadCount` | 更新下载量 |

### 订单相关
| 云函数 | 说明 |
|--------|------|
| `createBookOrder` | 创建二手书订单 |
| `createMaterialOrder` | 创建资料订单 |
| `createBatchOrders` | 批量创建订单 |
| `updateOrderStatus` | 更新订单状态 |
| `deleteOrder` | 删除订单 |
| `getMyOrders` | 获取我的订单 |
| `buyerConfirmProcessed` | 买家确认已处理 |
| `sellerConfirmProcessed` | 卖家确认已处理 |
| `sellerConfirmCompleted` | 卖家确认完成 |
| `processPayment` | 处理支付 |
| `checkExpiredOrders` | 检查过期订单 |

### 消息与聊天
| 云函数 | 说明 |
|--------|------|
| `getMessages` | 获取消息列表 |
| `getChatMessages` | 获取聊天记录 |
| `getConversations` | 获取会话列表 |
| `sendChatMessage` | 发送聊天消息 |
| `createMessage` | 创建系统消息 |
| `markMessageAsRead` | 标记消息已读 |
| `deleteMessage` | 删除消息 |
| `notifyNewMessage` | 新消息通知 |
| `getOrderMessages` | 获取订单相关消息 |
| `cleanDuplicateMessages` | 清理重复消息 |

### 帖子与社区
| 云函数 | 说明 |
|--------|------|
| `getPosts` | 获取帖子列表 |
| `getPostDetail` | 获取帖子详情 |
| `publishPost` | 发布帖子 |
| `deletePost` | 删除帖子 |
| `togglePostPublic` | 切换帖子公开状态 |
| `addPostFavorite` / `removePostFavorite` | 收藏/取消收藏帖子 |
| `addPostLike` / `removePostLike` | 点赞/取消点赞帖子 |
| `getMyPostFavorites` | 获取收藏的帖子 |
| `getMyPostLikes` | 获取点赞的帖子 |
| `getMyPosts` | 获取我的帖子 |
| `addComment` / `removeComment` | 添加/删除评论 |
| `addCommentReply` | 回复评论 |

### 用户与收藏
| 云函数 | 说明 |
|--------|------|
| `login` | 用户登录 |
| `getOpenid` | 获取用户 OpenID |
| `updateUserInfo` | 更新用户信息 |
| `getUserCenterData` | 获取用户中心数据 |
| `addFavorite` / `removeFavorite` | 收藏/取消收藏 |
| `checkFavoriteStatus` | 检查收藏状态 |
| `getMyFavorites` | 获取我的收藏 |
| `addLike` / `removeLike` | 点赞/取消点赞 |
| `checkImage` | 图片内容审核 |
| `checkText` | 文本内容审核 |

### 评价与举报
| 云函数 | 说明 |
|--------|------|
| `submitRating` | 提交评价 |
| `createReport` | 创建举报 |
| `deleteReportedContent` | 删除被举报内容 |

### 系统与管理员
| 云函数 | 说明 |
|--------|------|
| `initDatabase` | 初始化数据库 |
| `getNotices` | 获取系统通知 |
| `sendSystemMessage` | 发送系统消息 |
| `sendSystemNotice` | 发送系统通知 |
| `sendToAdmins` | 发送管理员消息 |
| `getAccessToken` | 获取 Access Token |
| `getTempImageUrl` | 获取临时图片 URL |
| `updateFilePermission` | 更新文件权限 |
| `updateBookStatus` | 批量更新书籍状态（管理员） |
| `updateMaterialStatus` | 批量更新资料状态（管理员） |

---

## 数据库设计

共 16 张集合（Collection）：

| 集合名 | 说明 |
|--------|------|
| `users` | 用户信息（昵称、头像、校区、学院、专业等） |
| `books` | 二手书信息（标题、作者、价格、成色、状态等） |
| `book_orders` | 二手书订单 |
| `materials` | 学习资料信息（标题、类型、文件、价格等） |
| `material_orders` | 资料订单 |
| `posts` | 社区帖子（标题、内容、标签、类型等） |
| `comments` | 帖子评论（支持多级回复） |
| `favorites` | 用户收藏记录 |
| `likes` | 用户点赞记录 |
| `conversations` | 聊天会话 |
| `chat_messages` | 聊天消息记录 |
| `messages` | 系统消息 |
| `notices` | 系统通知 |
| `ratings` | 用户评价 |
| `reports` | 举报记录 |
| `audit_logs` | 内容审核日志 |

> 完整的表结构说明请参考项目根目录下的 `table_structures.md`。

---

## 本地开发

### 环境要求
- 微信开发者工具（最新版）
- 注册微信小程序账号，获取 AppID
- 开通微信云开发环境

### 步骤
1. 克隆本项目到本地：
   ```bash
   git clone https://github.com/MuliyStudio/campus-second-hand-book-miniprogram.git
   ```

2. 用微信开发者工具打开项目目录，设置 AppID（在 `project.config.json` 中已配置为 `wx11c832adf2cf1c6d`，需替换为自己的 AppID）。

3. 开通云开发环境，在 `miniprogram/envList.js` 中配置云环境 ID。

4. 上传并部署云函数：在微信开发者工具中右键每个云函数目录 →「上传并部署」。

5. 在云开发控制台中创建对应的数据库集合，并导入 `*.json.example` 文件作为初始数据模板。

6. 编译运行。

---

## 部署指南

### 云函数部署
在微信开发者工具中，对每个云函数执行：
1. 右键云函数文件夹 →「在终端中打开」
2. 安装依赖：`npm install`
3. 右键 →「上传并部署：云端安装依赖」

### 数据库初始化
1. 在云开发控制台创建所有集合（参考 `table_structures.md`）
2. 设置集合权限（建议：仅创建者可读写 + 管理员全域访问）
3. 如需导入示例数据，使用 `*.json.example` 文件作为模板

### 存储配置
1. 在云开发控制台 → 存储管理中创建必要的文件夹结构
2. 配置存储权限

---

## 敏感数据说明

本项目在 Git 仓库中 **不包含** 任何真实用户数据。以下文件已被加入 `.gitignore`，不会上传至 GitHub：

- `users.json` / `用户.json` — 用户个人信息
- `books.json` / `书籍.json` — 书籍数据（含用户 OpenID）
- `book_orders.json` / `书籍订单.json` — 订单数据
- `materials.json` / `资料.json` — 资料数据
- `material_orders.json` / `资料订单.json` — 资料订单
- `posts.json` / `帖子.json` — 帖子数据
- `chat_messages.json` — 聊天记录
- `conversations.json` — 会话数据
- `messages.json` / `消息.json` / `系统消息.json` / `个人消息.json` — 消息数据
- `favorites.json` / `收藏.json` — 收藏数据
- `likes.json` / `ratings.json` / `reports.json` — 点赞/评价/举报数据
- `audit_logs.json` / `notices.json` / `comments.json` — 审核日志/通知/评论数据

如需本地开发使用，请参考对应的 `*.json.example` 文件创建数据结构模板。

---

## 开源协议

本项目仅供学习交流使用，请勿用于商业用途。

---

## 作者

MuliyStudio

- GitHub：[@MuliyStudio](https://github.com/MuliyStudio)
- 项目地址：https://github.com/MuliyStudio/campus-second-hand-book-miniprogram

---

*如果你觉得这个项目对你有帮助，欢迎 star ⭐*
