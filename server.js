const express = require('express');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'voicenotes123';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY_DAYS = 30;

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
                                text: '语音转写:'
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
                        text = text.replace(/^这段语音的原始内容是[:：]\s*/i, '')
                            .replace(/^语音转写[:：]\s*/i, '')
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

app.listen(PORT, () => {
    console.log(`🎤 VoiceNotes server running on port ${PORT}`);
    console.log(`📦 DashScope API Key: ${DASHSCOPE_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
});
