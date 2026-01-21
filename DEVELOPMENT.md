# VoiceNotes 开发指南

本文档面向开发者，说明如何参与 VoiceNotes 项目的开发。

## 📋 目录

- [环境准备](#环境准备)
- [项目结构](#项目结构)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [测试指南](#测试指南)
- [Git 工作流](#git-工作流)
- [API 文档](#api-文档)
- [故障排查](#故障排查)

---

## 🛠️ 环境准备

### 必需工具

- **Node.js**: 18.x 或更高版本
- **npm**: 9.x 或更高版本
- **Git**: 最新版本
- **浏览器**: Chrome、Firefox、Safari（最新版）

### 可选工具

- **Railway CLI**: 用于 Railway 部署
- **Vercel CLI**: 用于 Vercel 部署

### 本地开发环境搭建

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/voice-notes.git
cd voice-notes

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加 DASHSCOPE_API_KEY

# 4. 启动本地服务器
npm start

# 5. 访问应用
# 打开浏览器访问 http://localhost:3000
```

---

## 📁 项目结构

```
voice-notes/
├── api/                        # Vercel/Railway Serverless Functions
│   ├── transcribe.js          # 语音识别 API
│   ├── optimize-text.js       # 文本优化 API（去口语）
│   └── summarize.js           # 纪要生成 API
│
├── css/
│   └── style.css              # 主样式文件
│
├── js/
│   ├── config.js              # AI Prompts 配置 ⭐
│   ├── app.js                 # 主应用逻辑
│   ├── db.js                  # IndexedDB 封装
│   └── recorder.js            # 录音模块
│
├── icons/                     # PWA 图标
│
├── index.html                 # 主页面
├── manifest.json              # PWA 配置
├── sw.js                      # Service Worker
├── server.js                  # 本地/生产服务器
├── package.json               # 项目配置
├── railway.json               # Railway 部署配置
├── vercel.json                # Vercel 部署配置
├── Procfile                   # Railway 进程配置
│
└── docs/                      # 文档目录
    ├── README.md              # 项目说明
    ├── FEATURES.md            # 功能文档
    ├── DEVELOPMENT.md         # 开发指南（本文件）
    ├── DEPLOYMENT.md          # 部署文档
    └── MODEL_CONFIG.md        # 模型配置说明
```

---

## 🔄 开发流程

### 1. 创建功能分支

```bash
# 从 main 或 dev 分支创建
git checkout dev
git checkout -b feature/your-feature-name

# 或修复 bug
git checkout -b fix/bug-description
```

### 2. 开发和测试

```bash
# 本地开发
npm start

# 测试功能
# 打开 http://localhost:3000
```

### 3. 代码审查清单

- [ ] 代码符合项目规范
- [ ] 功能测试通过
- [ ] 新增功能已添加文档
- [ ] 无控制台错误
- [ ] 在主流浏览器中测试

### 4. 提交代码

```bash
git add .
git commit -m "feat: add your feature description"
git push origin feature/your-feature-name
```

### 5. 创建 Pull Request

在 GitHub 上创建 PR：
- 标题：清晰描述改动
- 内容：详细说明功能和测试结果
- 目标分支：`dev`

### 6. 合并到 main

```bash
# 等待代码审查通过后
git checkout dev
git merge feature/your-feature-name
git push origin dev

# 测试无误后合并到 main
git checkout main
git merge dev
git push origin main
```

---

## 📐 代码规范

### JavaScript

```javascript
// ✅ 好的实践
const optimizeText = async (text) => {
    try {
        const result = await api.optimize(text);
        return result;
    } catch (error) {
        console.error('Optimize failed:', error);
        throw error;
    }
};

// ❌ 避免
const o = async (t) => {
    const r = await api.o(t);
    return r;
};
```

**规则**：
- 使用 `const`/`let`，避免 `var`
- 使用 async/await 处理异步
- 函数命名使用驼峰命名法
- 添加必要的注释

### CSS

```css
/* ✅ 好的实践 */
.action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
}

/* ❌ 避免 */
.btn{display:flex}
```

**规则**：
- 使用 CSS 变量定义颜色和尺寸
- BEM 命名规范（block__element--modifier）
- 移动端优先的响应式设计

### HTML

```html
<!-- ✅ 好的实践 -->
<button id="optimize-btn" class="action-btn" aria-label="优化文本">
    <svg>...</svg>
    <span>去口语</span>
</button>

<!-- ❌ 避免 -->
<button onclick="doSomething()">点击</button>
```

**规则**：
- 使用语义化标签
- 添加无障碍属性（aria-label）
- 内容和脚本分离

---

## 🧪 测试指南

### 功能测试

#### 1. 语音录制测试

```bash
# 测试步骤
1. 打开应用
2. 按住录音按钮
3. 说话 5-10 秒
4. 松手，检查是否保存并转写
```

**验证点**：
- [ ] 录音波形显示
- [ ] 实时转写显示
- [ ] 松手后自动保存
- [ ] 笔记列表显示新记录

#### 2. 文本优化测试

```bash
# 测试步骤
1. 创建一条带口语的笔记（如："那个...今天就是...嗯..."）
2. 点击"去口语"按钮
3. 等待优化完成
4. 检查文本是否被优化
```

**验证点**：
- [ ] 按钮显示"优化中..."
- [ ] 优化后文本替换原文
- [ ] 去除了填充词
- [ ] 保持了原意

#### 3. 纪要生成测试

```bash
# 测试步骤
1. 创建一条较长的笔记（会议内容）
2. 点击"生成纪要"按钮
3. 等待生成完成
4. 检查纪要格式和内容
```

**验证点**：
- [ ] 纪要结构完整
- [ ] 要点提取准确
- [ ] 行动项清晰
- [ ] 追加到笔记末尾

### 浏览器兼容性测试

| 浏览器 | 版本 | 测试状态 |
|--------|------|----------|
| Chrome | 最新 | ✅ |
| Firefox | 最新 | ✅ |
| Safari | 最新 | ✅ |
| Edge | 最新 | ✅ |

### 移动端测试

| 设备 | 测试内容 | 状态 |
|------|----------|------|
| iPhone | 录音、PWA 安装 | ✅ |
| Android | 录音、PWA 安装 | ✅ |

---

## 🌿 Git 工作流

### 分支策略

```
main (生产环境)
  ↑
dev (开发环境)
  ↑
feature/* (功能分支)
fix/* (修复分支)
```

### Commit Message 规范

```bash
# 格式
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具变动

**示例**：
```bash
feat(optimize): add text optimization API
fix(transcribe): resolve timeout issue
docs(readme): update deployment instructions
```

### 版本发布

```bash
# 更新版本号
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0

# 创建标签
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

---

## 🔌 API 文档

### 1. 语音识别 API

**端点**：`POST /api/transcribe`

**请求**：
```json
{
  "audio": "base64_encoded_audio_data",
  "format": "mp3"
}
```

**响应**：
```json
{
  "text": "识别出的文本",
  "success": true
}
```

### 2. 文本优化 API

**端点**：`POST /api/optimize-text`

**请求**：
```json
{
  "text": "原始口语文本",
  "mode": "remove-filler"
}
```

**响应**：
```json
{
  "text": "优化后的文本",
  "originalText": "原始文本",
  "success": true
}
```

### 3. 纪要生成 API

**端点**：`POST /api/summarize`

**请求**：
```json
{
  "content": "笔记完整内容"
}
```

**响应**：
```json
{
  "summary": "# 会议纪要\n\n...",
  "success": true
}
```

---

## 🐛 故障排查

### 常见问题

#### 1. 语音识别失败

**症状**：录音后没有文字输出

**排查步骤**：
```bash
# 1. 检查环境变量
echo $DASHSCOPE_API_KEY

# 2. 检查 API Key 有效性
curl -X POST https://dashscope.aliyuncs.com/...

# 3. 查看浏览器控制台错误
# 打开开发者工具 → Console
```

**解决方案**：
- 确认 API Key 配置正确
- 检查网络连接
- 查看阿里云控制台的调用日志

#### 2. 文本优化无效

**症状**：点击"去口语"后文本无变化

**排查步骤**：
```javascript
// 检查 API 响应
console.log(result);

// 检查配置文件
console.log(PROMPTS.REMOVE_FILLER_WORDS);
```

**解决方案**：
- 检查 `js/config.js` 配置
- 查看 `/api/optimize-text` 日志
- 确认模型调用正常

#### 3. PWA 安装失败

**症状**：无法添加到主屏幕

**排查步骤**：
```bash
# 检查 manifest.json
cat manifest.json

# 检查 Service Worker
# 开发者工具 → Application → Service Workers
```

**解决方案**：
- 确认 HTTPS 环境（PWA 要求）
- 检查 manifest.json 配置
- 清除浏览器缓存重试

---

## 📚 学习资源

### 相关技术

- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA 最佳实践](https://web.dev/progressive-web-apps/)

### AI 模型

- [通义千问文档](https://help.aliyun.com/zh/dashscope/)
- [Qwen-ASR 使用指南](https://help.aliyun.com/zh/dashscope/developer-reference/quick-start)

---

## 🤝 贡献指南

### 如何贡献

1. Fork 本仓库
2. 创建功能分支
3. 提交改动
4. 推送到分支
5. 创建 Pull Request

### 报告问题

在 [Issues](https://github.com/your-username/voice-notes/issues) 中报告：

- Bug 报告
- 功能请求
- 文档改进
- 性能问题

### 讨论交流

- [GitHub Discussions](https://github.com/your-username/voice-notes/discussions)
- 邮件：your-email@example.com

---

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

---

## 🔗 相关文档

- [README](./README.md) - 项目概述
- [FEATURES](./FEATURES.md) - 功能说明
- [DEPLOYMENT](./DEPLOYMENT.md) - 部署指南
- [MODEL_CONFIG](./MODEL_CONFIG.md) - 模型配置
