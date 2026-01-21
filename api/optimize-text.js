/**
 * DashScope Qwen 文本优化 API - 去口语模式
 *
 * 功能：将口语转写文本优化为规范的书面表达
 * 使用通义千问模型进行文本优化
 */

const https = require('https');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;

// 从配置文件导入 prompt
const PROMPTS = require('../js/config.js').PROMPTS;

module.exports = async (req, res) => {
    // CORS 设置
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            success: false
        });
    }

    if (!DASHSCOPE_API_KEY) {
        return res.status(500).json({
            error: 'API key not configured',
            success: false
        });
    }

    try {
        const { text, mode = 'remove-filler' } = req.body;

        if (!text) {
            return res.status(400).json({
                error: 'No text data provided',
                success: false
            });
        }

        console.log('Text length:', text.length, 'Mode:', mode);

        // 根据模式选择处理方式
        if (mode === 'remove-filler') {
            const result = await optimizeText(text);
            return res.status(200).json(result);
        } else {
            return res.status(400).json({
                error: 'Invalid mode',
                success: false
            });
        }
    } catch (error) {
        console.error('Text optimization error:', error);
        return res.status(500).json({
            error: error.message,
            success: false
        });
    }
};

/**
 * 调用通义千问 API 优化文本
 */
function optimizeText(originalText) {
    return new Promise((resolve, reject) => {
        const systemPrompt = PROMPTS.REMOVE_FILLER_WORDS.system;

        // 使用通义千问兼容 OpenAI 的接口
        const requestBody = {
            model: 'qwen-plus',  // 使用 qwen-plus 模型
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: `请优化以下文本：\n\n${originalText}`
                }
            ],
            temperature: 0.3,  // 降低温度以获得更稳定的输出
            top_p: 0.8
        };

        const postData = JSON.stringify(requestBody);
        console.log('Request body size:', postData.length);

        const options = {
            hostname: 'dashscope.aliyuncs.com',
            port: 443,
            path: '/compatible-mode/v1/chat/completions',  // 使用兼容 OpenAI 的 endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 30000  // 30秒超时
        };

        const request = https.request(options, (response) => {
            let data = '';

            response.on('data', chunk => data += chunk);

            response.on('end', () => {
                console.log('Response status:', response.statusCode);
                console.log('Response preview:', data.substring(0, 500));

                try {
                    const result = JSON.parse(data);

                    // 检查是否有错误
                    if (result.error) {
                        resolve({
                            text: '',
                            success: false,
                            error: result.error.message || result.error
                        });
                        return;
                    }

                    // 提取优化后的文本
                    if (result.choices && result.choices[0] && result.choices[0].message) {
                        const optimizedText = result.choices[0].message.content.trim();

                        resolve({
                            text: optimizedText,
                            originalText: originalText,
                            success: true
                        });
                    } else {
                        resolve({
                            text: '',
                            success: false,
                            error: 'Invalid response format'
                        });
                    }
                } catch (e) {
                    console.error('Parse error:', e);
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
            console.error('Request error:', error);
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
