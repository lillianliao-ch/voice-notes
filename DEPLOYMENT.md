# VoiceNotes 部署文档

本文档说明如何将 VoiceNotes 部署到不同平台。

## 📦 部署平台

目前项目支持两个平台的部署：

- **Vercel** - Serverless Functions 部署（推荐用于前端和 API）
- **Railway** - 完整应用部署（主要使用）

## 🚀 Railway 部署（推荐）

### 1. 准备工作

确保你已经：
- 注册 [Railway](https://railway.app/) 账号
- 安装 Railway CLI（可选）
- 拥有阿里云 DashScope API Key

### 2. 创建新项目

```bash
# 方式1：通过 Railway CLI
railway login
railway new
cd /Users/lillianliao/notion_rag/voice-notes
railway up

# 方式2：通过 Railway Dashboard
# 1. 访问 https://railway.app/new
# 2. 选择 "Deploy from GitHub repo"
# 3. 选择 voice-notes 仓库
```

### 3. 配置环境变量

在 Railway Dashboard 中添加以下环境变量：

| 变量名 | 说明 | 必需 | 示例值 |
|--------|------|------|--------|
| `DASHSCOPE_API_KEY` | 阿里云 DashScope API Key | ✅ | `sk-xxxxxxxxxxxx` |
| `NODE_ENV` | 运行环境 | ✅ | `production` |
| `PORT` | 服务端口 | ❌ | `3000`（默认） |

### 4. 部署配置

Railway 会自动识别以下配置文件：

- `railway.json` - Railway 部署配置
- `Procfile` - 进程文件
- `package.json` - 依赖和脚本

#### railway.json

```json
{
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
        "builder": "NIXPACKS"
    },
    "deploy": {
        "startCommand": "node server.js",
        "healthcheckPath": "/",
        "healthcheckTimeout": 300,
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 10
    }
}
```

#### Procfile

```
web: node server.js
```

### 5. 部署步骤

```bash
# 推送代码到 GitHub
git add .
git commit -m "your commit message"
git push origin dev  # 推送到 dev 分支测试
git push origin main  # 合并到 main 分支生产部署

# Railway 会自动检测 GitHub 推送并触发部署
```

### 6. 验证部署

部署完成后，Railway 会提供一个公网 URL：
- 访问 `https://your-app.railway.app`
- 检查健康状态：访问根路径应返回页面
- 测试 API：访问 `/api/transcribe`（POST 请求）

### 7. 域名配置（可选）

在 Railway Dashboard 中：
1. 进入项目设置 → Settings → Domains
2. 添加自定义域名
3. 配置 DNS 记录（CNAME）

### 8. 监控和日志

- **日志**：Railway Dashboard → Deployments → 选择部署 → View Logs
- **监控**：Railway Dashboard → Metrics
- **告警**：Settings → Notifications

---

## ☁️ Vercel 部署（备选）

### 1. 安装 Vercel CLI

```bash
npm install -g vercel
```

### 2. 登录并部署

```bash
vercel login
cd /Users/lillianliao/notion_rag/voice-notes
vercel
```

### 3. 配置环境变量

在 Vercel Dashboard 中添加：
- `DASHSCOPE_API_KEY`

或通过 CLI：
```bash
vercel env add DASHSCOPE_API_KEY
```

### 4. 部署配置

#### vercel.json

```json
{
    "functions": {
        "api/*.js": {
            "memory": 256,
            "maxDuration": 30
        }
    }
}
```

### 5. 部署命令

```bash
# 开发环境部署
vercel

# 生产环境部署
vercel --prod
```

---

## 🔧 环境变量说明

### DASHSCOPE_API_KEY

阿里云 DashScope API 密钥，用于：
- 语音识别（ASR）
- 文本优化（去口语）
- 纪要生成

**获取方式**：
1. 访问 [阿里云 DashScope](https://dashscope.console.aliyun.com/)
2. 开通服务
3. 创建 API Key
4. 复制 Key 到项目环境变量

---

## 📊 部署对比

| 特性 | Railway | Vercel |
|------|---------|--------|
| **类型** | 完整服务器 | Serverless Functions |
| **适用场景** | 长时间运行、WebSocket | 短时间请求、API |
| **冷启动** | 无 | 有（首次请求较慢） |
| **价格** | 按 CPU/内存计费 | 按请求次数计费 |
| **配置复杂度** | 简单 | 简单 |
| **推荐使用** | ✅ 主力部署 | 备用 |

---

## 🐛 常见问题

### 1. 部署失败

**检查点**：
- 环境变量是否正确配置
- `package.json` 依赖是否完整
- Railway 日志中的错误信息

**解决方案**：
```bash
# 查看部署日志
railway logs

# 重启服务
railway up
```

### 2. API 超时

**原因**：
- AI 处理时间较长
- Railway 超时设置过短

**解决方案**：
- 在 `railway.json` 中增加 `healthcheckTimeout`
- 优化 API 逻辑，使用异步处理

### 3. 语音识别失败

**检查点**：
- `DASHSCOPE_API_KEY` 是否有效
- API 额度是否用尽
- 网络连接是否正常

**解决方案**：
- 检查阿里云控制台
- 重新生成 API Key
- 更新环境变量

---

## 📝 最佳实践

1. **分支策略**
   - `main` 分支：生产环境
   - `dev` 分支：开发测试
   - 功能分支：新功能开发

2. **部署流程**
   ```
   开发 → dev 分支测试 → 合并到 main → 生产部署
   ```

3. **监控告警**
   - 配置 Railway 告警通知
   - 监控 API 响应时间
   - 定期检查日志

4. **备份策略**
   - 定期备份数据库（IndexedDB 数据在客户端）
   - 版本控制重要配置

---

## 🔗 相关链接

- [Railway 文档](https://docs.railway.app/)
- [Vercel 文档](https://vercel.com/docs)
- [阿里云 DashScope](https://dashscope.console.aliyun.com/)
- [项目 README](./README.md)
- [开发文档](./DEVELOPMENT.md)
