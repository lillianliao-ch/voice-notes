/**
 * DashScope Qwen-ASR 语音识别 API
 * 使用 qwen2-audio-asr 模型，增加详细日志
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
            success: false,
            debug: { hasKey: false }
        });
    }

    try {
        const { audio, format = 'webm' } = req.body;

        if (!audio) {
            return res.status(400).json({
                error: 'No audio data',
                success: false,
                debug: { audioLength: 0 }
            });
        }

        console.log('Received audio, length:', audio.length, 'format:', format);

        const result = await callQwenASR(audio, format);
        console.log('ASR result:', JSON.stringify(result));

        return res.status(200).json(result);
    } catch (error) {
        console.error('ASR Error:', error);
        return res.status(500).json({
            error: error.message,
            success: false,
            debug: { errorType: error.name }
        });
    }
};

function callQwenASR(audioBase64, format) {
    return new Promise((resolve, reject) => {
        // 根据格式确定 MIME 类型
        const mimeTypes = {
            'webm': 'audio/webm',
            'mp3': 'audio/mp3',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg'
        };
        const mimeType = mimeTypes[format] || 'audio/webm';

        // 使用 qwen-audio-asr 模型 (正确的模型名称)
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
        console.log('Request body length:', postData.length);
        console.log('Audio data URI prefix:', `data:${mimeType};base64,${audioBase64.substring(0, 50)}...`);

        const options = {
            hostname: 'dashscope.aliyuncs.com',
            port: 443,
            path: '/api/v1/services/aigc/multimodal-generation/generation',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const request = https.request(options, (response) => {
            let data = '';

            response.on('data', chunk => data += chunk);

            response.on('end', () => {
                console.log('DashScope raw response:', data.substring(0, 500));

                try {
                    const result = JSON.parse(data);

                    // 成功响应
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
                            success: true,
                            debug: { model: result.output.model || 'unknown' }
                        });
                    }
                    // API 错误
                    else if (result.code || result.message) {
                        resolve({
                            text: '',
                            success: false,
                            error: result.message || result.code,
                            debug: {
                                code: result.code,
                                requestId: result.request_id
                            }
                        });
                    }
                    // 未知格式
                    else {
                        resolve({
                            text: '',
                            success: false,
                            error: 'Unknown response format',
                            debug: { rawResponse: JSON.stringify(result).substring(0, 200) }
                        });
                    }
                } catch (e) {
                    resolve({
                        text: '',
                        success: false,
                        error: 'Failed to parse response',
                        debug: { parseError: e.message, rawData: data.substring(0, 200) }
                    });
                }
            });
        });

        request.on('error', (error) => {
            resolve({
                text: '',
                success: false,
                error: error.message,
                debug: { networkError: true }
            });
        });

        request.write(postData);
        request.end();
    });
}
