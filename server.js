const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 8080;

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;

// 中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '.')));

// CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

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

// Qwen ASR 调用
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

        const requestBody = {
            model: 'qwen-audio-asr',
            input: {
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                audio: `data:${mimeType};base64,${audioBase64}`
                            }
                        ]
                    }
                ]
            }
        };

        const postData = JSON.stringify(requestBody);
        console.log('Request body size:', postData.length);

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
            timeout: 25000
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
