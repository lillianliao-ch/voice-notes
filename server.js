const express = require('express');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8080;

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'voicenotes123';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY_DAYS = 30;

// PostgreSQL 连接池
const DATABASE_URL = process.env.DATABASE_URL;
let pool = null;

async function initDatabase() {
    if (!DATABASE_URL) {
        console.log('⚠️ DATABASE_URL not configured, notes will not be synced');
        return;
    }

    pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // 创建笔记表
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id VARCHAR(50) PRIMARY KEY,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Database initialized');
    } catch (error) {
        console.error('❌ Database init failed:', error.message);
    }
}

// 启动时初始化数据库
initDatabase();

// 生成 token
function generateToken() {
    const payload = {
        exp: Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        random: crypto.randomBytes(16).toString('hex')
    };
    const data = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
    return Buffer.from(data).toString('base64') + '.' + signature;
}

// 验证 token
function verifyToken(token) {
    try {
        const [dataBase64, signature] = token.split('.');
        const data = Buffer.from(dataBase64, 'base64').toString();
        const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
        if (signature !== expectedSig) return false;
        const payload = JSON.parse(data);
        return payload.exp > Date.now();
    } catch {
        return false;
    }
}

// 中间件
app.use(express.json({ limit: '50mb' }));

// CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// 登录 API
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = generateToken();
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

// 验证 token API
app.post('/api/verify', (req, res) => {
    const { token } = req.body;
    const valid = verifyToken(token);
    res.json({ valid });
});

// 认证中间件 - 保护 API 和静态资源
app.use((req, res, next) => {
    // 登录相关不需要认证
    if (req.path === '/api/login' || req.path === '/api/verify') {
        return next();
    }

    // 检查 Authorization header 或 cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (token && verifyToken(token)) {
        return next();
    }

    // 如果是 API 请求，返回 401
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // 静态资源请求交给后续处理
    next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '.')));

// 调试端点
app.get('/api/debug', async (req, res) => {
    const debug = {
        hasApiKey: !!DASHSCOPE_API_KEY,
        apiKeyPrefix: DASHSCOPE_API_KEY ? DASHSCOPE_API_KEY.substring(0, 8) + '...' : null,
        timestamp: new Date().toISOString(),
        platform: 'Railway'
    };

    if (DASHSCOPE_API_KEY) {
        try {
            const testResult = await testApiKey();
            debug.apiTest = testResult;
        } catch (error) {
            debug.apiTest = { error: error.message };
        }
    }

    res.json(debug);
});

// 语音转文字 API
app.post('/api/transcribe', async (req, res) => {
    if (!DASHSCOPE_API_KEY) {
        return res.status(500).json({
            error: 'API key not configured',
            success: false
        });
    }

    try {
        const { audio, format = 'mp3' } = req.body;

        if (!audio) {
            return res.status(400).json({
                error: 'No audio data',
                success: false
            });
        }

        console.log('Audio length:', audio.length, 'Format:', format);

        const result = await callQwenASR(audio, format);
        res.json(result);
    } catch (error) {
        console.error('ASR Error:', error);
        res.status(500).json({
            error: error.message,
            success: false
        });
    }
});

// 可配置的 Prompt - 日终复盘整理助手
const SUMMARIZE_PROMPT = process.env.SUMMARIZE_PROMPT || `你是我的「日终复盘整理助手」。

我会输入一段【非常原始的文字或语音转写】：
- 内容是第一人称、自言自语
- 可能有大量口语、重复、跳跃
- 可能存在语音识别错误
- 不一定有清晰结构

你的任务不是总结、不是拔高、不是写文章，而是：

【核心目标】
在【最大程度保持我原意、原判断、原思路节奏】的前提下，
把我的原始内容，整理成一份【第一人称 · 日终复盘记录】。

【最高优先级原则（必须严格遵守）】
1. ❌ 不允许任何推测、补充、合理化延展
2. ❌ 不允许新增任何原文未出现的事实、判断或情绪
3. ❌ 不允许替我"想得更清楚"
4. ✅ 只允许：去口语、纠错、顺语序
5. ✅ 所有内容必须可追溯到原文表达

【语言与视角要求】
- 必须使用第一人称（"我"）
- 保持"记录感"，像我自己晚上在记日志
- 允许短句、碎句
- 不写成复盘报告或总结文章
- 不使用上帝视角、教训式语言

【输出结构】
请严格按照以下结构输出，不得增减模块，不得合并模块，
若某一部分原文未涉及，可写"今天未重点涉及"。

------------------------------------------------

# 日终复盘（Daily Review）

## 一、核心认知与关键收获
（只写我在原文中**明确说过或确认过**的认知、判断或方向，不做提炼）

---

## 二、昨日复盘：我做了什么（事实层）

### 1. 工具 / 产品
（只记录我昨天在工具、系统、产品上**实际做了什么**）

### 2. 猎头相关 / 人才推进
（只记录我昨天在找人、规划、沟通、系统设计上**实际做了什么**）

### 3. 内容与 IP
（只记录我昨天在内容输出、观察反馈上**实际做了什么**）

### 4. 家庭与个人优先事项
（只记录我昨天在家庭、孩子、个人事务上**实际做了什么**）

### 5. 投资理财
（只记录我昨天在投资、资金安排上**实际做了什么或明确想过什么**）

### 6. 其他
（只记录原文中提到、但不属于以上分类的事情）

---

## 三、整体判断（评价层）

### 今天整体做得好的地方
（只基于原文中**已经出现的判断或明确倾向**）

### 今天整体做得不好的地方
（只基于原文中**已经出现的判断或明确倾向**）

---

## 四、今日 & 近期执行重点

### 1. 工具 / 产品
（只写我在原文中**明确提到接下来要做的事**）

### 2. 猎头相关 / 人才推进
（同上）

### 3. 内容与 IP
（同上）

### 4. 家庭与个人优先事项
（同上）

### 5. 投资理财
（同上）

### 6. 其他
（同上）

---

## 五、今天最值得保留的一件事（只能一件）
（必须来自原文，不能提炼、不能升华，只能原意转述）

---

## 六、其他事项
（原文中出现、但尚未进入行动或判断层的想法或待办）

------------------------------------------------

【补充约束】
- 如果原文中没有明确提到某一模块内容，请明确写"今天未重点涉及"
- 不允许为了"完整"而编造内容
- 宁可少写，也不要多写`;

// 纪要生成 API
app.post('/api/summarize', async (req, res) => {
    if (!DASHSCOPE_API_KEY) {
        return res.status(500).json({
            error: 'API key not configured',
            success: false
        });
    }

    try {
        const { content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                error: 'No content provided',
                success: false
            });
        }

        console.log('Summarizing content length:', content.length);

        const summary = await callQwenText(SUMMARIZE_PROMPT, content);

        res.json({
            summary: summary,
            success: true
        });
    } catch (error) {
        console.error('Summarize Error:', error);
        res.status(500).json({
            error: error.message,
            success: false
        });
    }
});

// ========== 笔记 CRUD API ==========

// 检查数据库是否可用
function checkDatabase(res) {
    if (!pool) {
        res.status(503).json({ error: 'Database not configured', success: false });
        return false;
    }
    return true;
}

// 获取所有笔记
app.get('/api/notes', async (req, res) => {
    if (!checkDatabase(res)) return;

    try {
        const result = await pool.query(
            'SELECT * FROM notes ORDER BY updated_at DESC'
        );
        res.json({ notes: result.rows, success: true });
    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({ error: error.message, success: false });
    }
});

// 创建笔记
app.post('/api/notes', async (req, res) => {
    if (!checkDatabase(res)) return;

    try {
        const { id, content, createdAt, updatedAt } = req.body;
        const noteId = id || crypto.randomBytes(8).toString('hex');

        await pool.query(
            `INSERT INTO notes (id, content, created_at, updated_at) 
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET content = $2, updated_at = $4`,
            [noteId, content, createdAt || new Date(), updatedAt || new Date()]
        );

        res.json({ id: noteId, success: true });
    } catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({ error: error.message, success: false });
    }
});

// 更新笔记
app.put('/api/notes/:id', async (req, res) => {
    if (!checkDatabase(res)) return;

    try {
        const { id } = req.params;
        const { content } = req.body;

        await pool.query(
            'UPDATE notes SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [content, id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({ error: error.message, success: false });
    }
});

// 删除笔记
app.delete('/api/notes/:id', async (req, res) => {
    if (!checkDatabase(res)) return;

    try {
        const { id } = req.params;
        await pool.query('DELETE FROM notes WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({ error: error.message, success: false });
    }
});

// 批量迁移本地笔记
app.post('/api/notes/migrate', async (req, res) => {
    if (!checkDatabase(res)) return;

    try {
        const { notes } = req.body;

        if (!Array.isArray(notes)) {
            return res.status(400).json({ error: 'Invalid notes array', success: false });
        }

        let migrated = 0;
        for (const note of notes) {
            await pool.query(
                `INSERT INTO notes (id, content, created_at, updated_at) 
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (id) DO NOTHING`,
                [note.id, note.content, note.createdAt, note.updatedAt]
            );
            migrated++;
        }

        console.log(`Migrated ${migrated} notes`);
        res.json({ migrated, success: true });
    } catch (error) {
        console.error('Migrate notes error:', error);
        res.status(500).json({ error: error.message, success: false });
    }
});

// 检查数据库状态
app.get('/api/notes/status', (req, res) => {
    res.json({
        databaseConfigured: !!pool,
        databaseUrl: DATABASE_URL ? 'configured' : 'not configured'
    });
});

// 默认路由 - 返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Qwen Audio Turbo ASR 调用 (切换自 qwen-audio-asr 以使用不同配额)
function callQwenASR(audioBase64, format) {
    return new Promise((resolve, reject) => {
        const mimeTypes = {
            'webm': 'audio/webm',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'm4a': 'audio/mp4'
        };
        const mimeType = mimeTypes[format] || 'audio/mpeg';

        // 使用 qwen-audio-turbo 模型
        const requestBody = {
            model: 'qwen-audio-turbo-1204',
            input: {
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                audio: `data:${mimeType};base64,${audioBase64}`
                            },
                            {
                                text: '请将这段语音准确转写为文字，直接输出转写内容，不要添加任何前缀或说明。'
                            }
                        ]
                    }
                ]
            }
        };

        const postData = JSON.stringify(requestBody);
        console.log('Request body size:', postData.length);
        console.log('Using model: qwen-audio-turbo-1204');

        const options = {
            hostname: 'dashscope.aliyuncs.com',
            port: 443,
            path: '/api/v1/services/aigc/multimodal-generation/generation',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 30000
        };

        const request = https.request(options, (response) => {
            let data = '';

            response.on('data', chunk => data += chunk);

            response.on('end', () => {
                console.log('Response:', data.substring(0, 500));
                try {
                    const result = JSON.parse(data);

                    if (result.output && result.output.choices && result.output.choices[0]) {
                        const content = result.output.choices[0].message.content;
                        let text = '';
                        if (Array.isArray(content)) {
                            text = content.map(c => c.text || '').join('');
                        } else if (typeof content === 'string') {
                            text = content;
                        }
                        // 去掉模型可能添加的前缀
                        text = text.replace(/^这段音频的原始内容是[:：]\s*/gi, '')
                            .replace(/^这段语音的原始内容是[:：]\s*/gi, '')
                            .replace(/^语音转写的内容是[:：]\s*/gi, '')
                            .replace(/^语音转写[:：]\s*/gi, '')
                            .replace(/^语音内容[:：]\s*/i, '')
                            .replace(/^['"'](.*)['"']$/s, '$1')
                            .trim();
                        resolve({
                            text: text.trim(),
                            success: true
                        });
                    } else if (result.code || result.message) {
                        resolve({
                            text: '',
                            success: false,
                            error: result.message || result.code
                        });
                    } else {
                        resolve({
                            text: '',
                            success: false,
                            error: 'Unknown response format'
                        });
                    }
                } catch (e) {
                    resolve({
                        text: '',
                        success: false,
                        error: 'Parse error: ' + e.message
                    });
                }
            });
        });

        request.on('timeout', () => {
            request.destroy();
            resolve({
                text: '',
                success: false,
                error: 'Request timeout'
            });
        });

        request.on('error', (error) => {
            resolve({
                text: '',
                success: false,
                error: error.message
            });
        });

        request.write(postData);
        request.end();
    });
}

// API Key 测试
function testApiKey() {
    return new Promise((resolve, reject) => {
        const testBody = JSON.stringify({
            model: 'qwen-turbo',
            input: {
                messages: [{ role: 'user', content: 'hi' }]
            }
        });

        const options = {
            hostname: 'dashscope.aliyuncs.com',
            port: 443,
            path: '/api/v1/services/aigc/text-generation/generation',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                'Content-Length': Buffer.byteLength(testBody)
            }
        };

        const request = https.request(options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.output) {
                        resolve({ status: 'ok', message: 'API Key is valid' });
                    } else if (result.code) {
                        resolve({ status: 'error', code: result.code, message: result.message });
                    } else {
                        resolve({ status: 'unknown', response: result });
                    }
                } catch (e) {
                    reject(new Error('Parse error'));
                }
            });
        });

        request.on('error', reject);
        request.write(testBody);
        request.end();
    });
}

// 调用千问文本模型生成纪要
const QWEN_TEXT_MODEL = process.env.QWEN_TEXT_MODEL || 'qwen-plus-2025-07-28';

// 模型参数配置
const MODEL_PARAMS = {
    temperature: parseFloat(process.env.MODEL_TEMPERATURE) || 0.4,
    top_p: parseFloat(process.env.MODEL_TOP_P) || 0.8
};

function callQwenText(systemPrompt, userContent) {
    return new Promise((resolve, reject) => {
        const requestBody = {
            model: QWEN_TEXT_MODEL,
            input: {
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: userContent
                    }
                ]
            },
            parameters: {
                temperature: MODEL_PARAMS.temperature,
                top_p: MODEL_PARAMS.top_p,
                result_format: 'message'
            }
        };

        const postData = JSON.stringify(requestBody);
        console.log('Calling Qwen text model:', QWEN_TEXT_MODEL);

        const options = {
            hostname: 'dashscope.aliyuncs.com',
            port: 443,
            path: '/api/v1/services/aigc/text-generation/generation',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 30000
        };

        const request = https.request(options, (response) => {
            let data = '';

            response.on('data', chunk => data += chunk);

            response.on('end', () => {
                console.log('Text model response:', data.substring(0, 300));
                try {
                    const result = JSON.parse(data);

                    if (result.output && result.output.text) {
                        resolve(result.output.text.trim());
                    } else if (result.output && result.output.choices && result.output.choices[0]) {
                        resolve(result.output.choices[0].message.content.trim());
                    } else if (result.code || result.message) {
                        reject(new Error(result.message || result.code));
                    } else {
                        reject(new Error('Unknown response format'));
                    }
                } catch (e) {
                    reject(new Error('Parse error: ' + e.message));
                }
            });
        });

        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });

        request.write(postData);
        request.end();
    });
}

app.listen(PORT, () => {
    console.log(`🎤 VoiceNotes server running on port ${PORT}`);
    console.log(`📦 DashScope API Key: ${DASHSCOPE_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
});
