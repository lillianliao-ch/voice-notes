/**
 * 调试端点 - 检查 API 配置状态
 */

const https = require('https');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const debug = {
        hasApiKey: !!DASHSCOPE_API_KEY,
        apiKeyPrefix: DASHSCOPE_API_KEY ? DASHSCOPE_API_KEY.substring(0, 8) + '...' : null,
        timestamp: new Date().toISOString()
    };

    // 如果有 API Key，尝试一个简单的测试请求
    if (DASHSCOPE_API_KEY) {
        try {
            const testResult = await testApiKey();
            debug.apiTest = testResult;
        } catch (error) {
            debug.apiTest = { error: error.message };
        }
    }

    return res.status(200).json(debug);
};

function testApiKey() {
    return new Promise((resolve, reject) => {
        // 发送一个最小的测试请求到 DashScope
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
