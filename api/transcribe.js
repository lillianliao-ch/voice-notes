/**
 * DashScope Qwen-ASR 语音识别 API
 * 使用 qwen-audio-asr 模型
 */

const https = require('https');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed', success: false });
    }

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
        return res.status(200).json(result);
    } catch (error) {
        console.error('ASR Error:', error);
        return res.status(500).json({
            error: error.message,
            success: false
        });
    }
};

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

        // 使用 qwen-audio-asr 模型
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
