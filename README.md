# VoiceNotes 语音速记

一个简洁的语音转文字笔记 PWA 应用。

## ✨ 功能特点

- 🎤 **按住说话** - 按住录音按钮，松手自动保存
- 🔊 **语音识别** - 使用阿里云 Qwen-ASR 进行语音转文字
- 📝 **笔记管理** - 查看、编辑、删除笔记
- 📱 **PWA 支持** - 可添加到手机主屏幕
- 🌙 **深色模式** - 支持浅色/深色主题切换
- 💾 **本地存储** - 使用 IndexedDB 存储数据

## 🚀 在线体验

**线上地址**: https://voice-notes-delta.vercel.app

## 🛠️ 技术栈

- **前端**: 原生 HTML/CSS/JavaScript (无框架)
- **语音识别**: 阿里云 DashScope Qwen-ASR API
- **存储**: IndexedDB
- **部署**: Vercel Serverless Functions

## 📁 项目结构

```
voice-notes/
├── api/                 # Vercel Serverless Functions
│   ├── transcribe.js    # 语音转文字 API
│   └── debug.js         # 调试端点
├── css/
│   └── style.css        # 样式文件
├── js/
│   ├── app.js           # 主应用逻辑
│   ├── db.js            # IndexedDB 封装
│   └── recorder.js      # 录音模块
├── icons/               # PWA 图标
├── index.html           # 主页面
├── manifest.json        # PWA 配置
├── sw.js                # Service Worker
└── vercel.json          # Vercel 配置
```

## 🔧 本地开发

```bash
# 启动本地服务器
python3 -m http.server 8080
# 访问 http://localhost:8080
```

## 📦 部署

```bash
# 设置环境变量
vercel env add DASHSCOPE_API_KEY production

# 部署到 Vercel
vercel --prod
```

## 📄 License

MIT
