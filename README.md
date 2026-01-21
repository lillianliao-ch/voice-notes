# VoiceNotes 语音速记

一个简洁的语音转文字笔记 PWA 应用，支持 AI 文本优化和智能纪要生成。

## ✨ 功能特点

- 🎤 **按住说话** - 按住录音按钮，松手自动保存
- 🔊 **语音识别** - 使用阿里云 Qwen-ASR 进行语音转文字
- ✨ **文本优化** - AI 去除口语冗余，提升表达专业性
- 📋 **智能纪要** - AI 自动生成结构化会议纪要
- ➕ **追加录音** - 在已有笔记上继续录音
- 📝 **笔记管理** - 查看、编辑、删除笔记
- 📱 **PWA 支持** - 可添加到手机主屏幕
- 🌙 **深色模式** - 支持浅色/深色主题切换
- 💾 **本地存储** - 使用 IndexedDB 存储数据

## 🚀 在线体验

**线上地址**: https://voice-notes-delta.vercel.app

## 🛠️ 技术栈

- **前端**: 原生 HTML/CSS/JavaScript (无框架)
- **语音识别**: 阿里云 DashScope Qwen-ASR API
- **AI 文本处理**: 通义千问 Qwen-Plus
- **存储**: IndexedDB
- **部署**: Vercel Serverless Functions / Railway

## 📁 项目结构

```
voice-notes/
├── api/                      # API 接口
│   ├── transcribe.js         # 语音转文字 API
│   ├── optimize-text.js      # 文本优化 API（去口语）
│   └── summarize.js          # 纪要生成 API
├── css/
│   └── style.css             # 样式文件
├── js/
│   ├── config.js             # AI Prompts 配置 ⭐
│   ├── app.js                # 主应用逻辑
│   ├── db.js                 # IndexedDB 封装
│   └── recorder.js           # 录音模块
├── icons/                    # PWA 图标
├── index.html                # 主页面
├── manifest.json             # PWA 配置
├── sw.js                     # Service Worker
├── server.js                 # 本地/生产服务器
├── railway.json              # Railway 部署配置
├── vercel.json               # Vercel 配置
├── Procfile                  # Railway 进程配置
└── docs/                     # 文档
    ├── FEATURES.md           # 功能说明
    ├── DEVELOPMENT.md        # 开发指南
    └── DEPLOYMENT.md         # 部署文档
```

## 🔧 本地开发

### 环境准备

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/voice-notes.git
cd voice-notes

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，添加 DASHSCOPE_API_KEY

# 4. 启动本地服务器
npm start

# 5. 访问应用
# 打开浏览器访问 http://localhost:3000
```

### 环境变量

创建 `.env` 文件：

```bash
DASHSCOPE_API_KEY=sk-your-api-key-here
NODE_ENV=development
PORT=3000
```

## 🎯 核心功能使用

### 1. 录音转文字

1. 按住"按住说话"按钮
2. 说话
3. 松手自动保存并转写

### 2. 文本优化（去口语）

1. 打开已有笔记
2. 点击"去口语"按钮
3. AI 自动优化文本，去除口语冗余
4. 原文被优化后的文本替换

**使用场景**：多次录音后统一优化，提升专业性

### 3. 生成智能纪要

1. 打开已有笔记（通常是一天的完整记录）
2. 点击"生成纪要"按钮
3. AI 自动提取要点、行动项、决策
4. 纪要追加到笔记末尾

**使用场景**：一天结束时的复盘总结

### 4. 追加录音

1. 打开已有笔记
2. 长按"按住追加"按钮
3. 录音内容自动追加到笔记末尾

## ⚙️ 配置说明

### AI Prompts 自定义

所有 AI 交互的 Prompt 都可以在 `js/config.js` 中自定义：

```javascript
// js/config.js
const PROMPTS = {
  // 去口语模式 - System Prompt
  REMOVE_FILLER_WORDS: {
    system: `你是一个专业的内容编辑...
    任务：去除文本中的冗余口语表达...`
  },

  // 生成纪要模式 - User Prompt
  GENERATE_SUMMARY: {
    user: `请根据以下语音笔记生成结构化会议纪要...`
  }
};
```

修改配置后无需重启，刷新页面即可生效。

## 📦 部署

### Vercel 部署

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

### Railway 部署

```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 初始化项目
railway init

# 部署
railway up
```

详细的部署指南请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📖 文档

- [FEATURES.md](./FEATURES.md) - 详细功能说明
- [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发指南
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署文档
- [MODEL_CONFIG.md](./MODEL_CONFIG.md) - 模型配置说明

## 🔗 相关链接

- [通义千问文档](https://help.aliyun.com/zh/dashscope/)
- [Qwen-ASR 使用指南](https://help.aliyun.com/zh/dashscope/developer-reference/quick-start)
- [Railway 文档](https://docs.railway.app/)
- [Vercel 文档](https://vercel.com/docs)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交改动 (`git commit -m 'feat: add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

详细开发指南请参考 [DEVELOPMENT.md](./DEVELOPMENT.md)

## 📄 License

MIT License - 详见 [LICENSE](./LICENSE) 文件

## 📮 联系方式

- 提交 [Issue](https://github.com/your-username/voice-notes/issues)
- 邮件：your-email@example.com

---

**⚠️ 免责声明**: 本项目仅供学习和个人使用，请遵守相关服务条款。
