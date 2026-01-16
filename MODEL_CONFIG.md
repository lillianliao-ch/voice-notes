# VoiceNotes 模型配置说明

## 当前问题诊断

你遇到的 "无法识别远程异常" 错误通常是因为：
1. 模型名称错误或已下线
2. API 端点不匹配
3. 请求格式不正确

## 语音识别模型（ASR）

### 当前配置
- **模型**: `paraformer-realtime-v2`
- **位置**: server.js:472
- **用途**: 将语音转换为文字

### 可选的语音识别模型

| 模型名称 | 特点 | 推荐场景 |
|---------|------|---------|
| `paraformer-realtime-v2` | 阿里最新实时识别，稳定准确 | ✅ **推荐**（已切换到此） |
| `paraformer-realtime-8k-v1` | 8kHz 采样率 | 旧版兼容 |
| `qwen-audio-asr` | 通义千问音频模型 | 通用场景 |
| `qwen-audio-turbo` | 快速识别 | 需要低延迟 |

**如何修改**: 编辑 `server.js` 第 472 行的 `model` 字段

```javascript
const requestBody = {
    model: 'paraformer-realtime-v2', // 修改这里
    // ...
};
```

## 文本生成模型（Summarize）

### 当前配置
- **模型**: `qwen-plus-2025-07-28`（可通过环境变量 `QWEN_TEXT_MODEL` 修改）
- **位置**: server.js:630
- **用途**: 生成日终复盘纪要

### 可选的文本生成模型

| 模型名称 | 特点 | 价格 | 推荐场景 |
|---------|------|------|---------|
| `qwen-turbo` | 最快，最便宜 | 低 | ✅ **推荐用于快速响应** |
| `qwen-plus` | 平衡性能和价格 | 中 | 通用场景 |
| `qwen-max` | 最强性能 | 高 | 复杂任务 |
| `qwen-plus-latest` | 最新 plus 版本 | 中 | 稳定性好 |

### 关于 qwen-turbo 的使用

**qwen-turbo 可以用于文本生成**，但不能用于语音识别。

**如何切换到 qwen-turbo**:

在 Railway 环境变量中添加：
```
QWEN_TEXT_MODEL=qwen-turbo
```

或者直接修改 `server.js` 第 630 行：
```javascript
const QWEN_TEXT_MODEL = process.env.QWEN_TEXT_MODEL || 'qwen-turbo';
```

## 模型参数调优

### Temperature（温度）
- **范围**: 0.0 - 1.0
- **当前值**: 0.4（可通过 `MODEL_TEMPERATURE` 环境变量修改）
- **说明**:
  - 0.0-0.3: 更确定性，输出更一致
  - 0.4-0.7: 平衡创造性和一致性
  - 0.8-1.0: 更创造性，更随机

### Top_p
- **范围**: 0.0 - 1.0
- **当前值**: 0.8（可通过 `MODEL_TOP_P` 环境变量修改）
- **说明**: 核采样参数，控制词汇选择范围

## Railway 环境变量配置

在 Railway 项目的 "Variables" 标签页添加以下变量：

```bash
# 必需
DASHSCOPE_API_KEY=你的DashScope密钥

# 可选（如不配置则使用代码中的默认值）
QWEN_TEXT_MODEL=qwen-turbo
MODEL_TEMPERATURE=0.4
MODEL_TOP_P=0.8
ADMIN_PASSWORD=你的管理员密码
JWT_SECRET=随机生成的密钥
```

## API 端点说明

### 语音识别端点
```
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
```

### 文本生成端点
```
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
```

## 调试建议

1. **检查模型名称是否正确**：
   - 访问 [DashScope 文档](https://help.aliyun.com/zh/dashscope/developer-reference/model-list)
   - 确认模型名称拼写正确

2. **查看 Railway 日志**：
   - 在 Railway 控制台查看部署日志
   - 搜索 "Using model:" 确认当前使用的模型

3. **测试 API Key**：
   - 访问 `/api/debug` 端点测试 API Key 是否有效

4. **切换到更稳定的模型**：
   - 语音识别：`paraformer-realtime-v2`（推荐）
   - 文本生成：`qwen-turbo`（快速、便宜）

## 常见错误及解决

### 错误：无法识别远程异常
**原因**: 模型名称错误或已下线
**解决**: 切换到 `paraformer-realtime-v2`（已完成）

### 错误：Request timeout
**原因**: 请求超时
**解决**: 增加 `timeout` 参数（server.js:504，当前 30 秒）

### 错误：API key not configured
**原因**: 未设置环境变量
**解决**: 在 Railway 添加 `DASHSCOPE_API_KEY`

## 更新记录

- 2025-01-16: 将语音识别模型从 `qwen-audio-turbo-1204` 切换到 `paraformer-realtime-v2`
- 原因：`qwen-audio-turbo-1204` 可能已下线或不稳定
