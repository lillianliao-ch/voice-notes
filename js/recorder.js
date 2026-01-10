/**
 * 语音录制模块 - 使用 MediaRecorder + 后端 API 转写
 * 支持所有现代浏览器包括 iOS Safari
 */

class VoiceRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.startTime = null;
        this.timerInterval = null;
        this.stream = null;

        // 回调函数
        this.onStart = null;
        this.onResult = null;
        this.onEnd = null;
        this.onError = null;
        this.onTimer = null;
        this.onTranscribing = null; // 转写中回调
    }

    /**
     * 开始录音
     */
    async start() {
        if (this.isRecording) {
            console.warn('Already recording');
            return false;
        }

        try {
            // 请求麦克风权限
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            // 创建 MediaRecorder
            const mimeType = this.getSupportedMimeType();
            this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                // 停止所有音轨
                this.stream.getTracks().forEach(track => track.stop());

                // 处理录音数据
                if (this.audioChunks.length > 0) {
                    await this.processAudio();
                }
            };

            // 开始录音
            this.mediaRecorder.start(100); // 每100ms收集一次数据
            this.isRecording = true;
            this.startTimer();
            this.vibrate(50);

            if (this.onStart) this.onStart();

            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            if (this.onError) {
                if (error.name === 'NotAllowedError') {
                    this.onError('not-allowed');
                } else {
                    this.onError(error.message);
                }
            }
            return false;
        }
    }

    /**
     * 停止录音
     */
    stop() {
        this.stopTimer();

        if (!this.mediaRecorder || !this.isRecording) {
            return;
        }

        this.isRecording = false;
        this.vibrate([30, 50, 30]);

        try {
            this.mediaRecorder.stop();
        } catch (error) {
            console.error('Failed to stop recording:', error);
        }
    }

    /**
     * 处理录音并发送到后端转写
     */
    async processAudio() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        console.log('Audio blob size:', audioBlob.size, 'bytes');

        // 显示转写中状态
        if (this.onTranscribing) {
            this.onTranscribing(true);
        }

        try {
            // 转换为 base64
            const base64Audio = await this.blobToBase64(audioBlob);
            console.log('Base64 audio length:', base64Audio.length);

            // 发送到后端 API
            const token = localStorage.getItem('voicenotes_auth_token');
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    audio: base64Audio,
                    format: 'webm'
                })
            });

            const result = await response.json();
            console.log('API response:', result);

            if (this.onTranscribing) {
                this.onTranscribing(false);
            }

            if (result.success && result.text) {
                if (this.onEnd) {
                    this.onEnd(result.text);
                }
            } else {
                // 显示详细错误信息
                const errorMsg = result.error || 'Unknown error';
                const debugInfo = result.debug ? JSON.stringify(result.debug) : '';
                console.error('Transcription failed:', errorMsg, debugInfo);

                if (this.onError) {
                    this.onError(`${errorMsg} ${debugInfo}`);
                }
                if (this.onEnd) {
                    this.onEnd('');
                }
            }
        } catch (error) {
            console.error('API call failed:', error);
            if (this.onTranscribing) {
                this.onTranscribing(false);
            }
            if (this.onError) {
                this.onError('网络错误: ' + error.message);
            }
            if (this.onEnd) {
                this.onEnd('');
            }
        }
    }

    /**
     * Blob 转 Base64
     */
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // 移除 data:audio/webm;base64, 前缀
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * 获取支持的 MIME 类型
     */
    getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/wav'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return 'audio/webm';
    }

    /**
     * 开始计时器
     */
    startTimer() {
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const displaySeconds = seconds % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
            if (this.onTimer) this.onTimer(timeString);
        }, 1000);
    }

    /**
     * 停止计时器
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * 触发震动反馈
     */
    vibrate(pattern) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }

    /**
     * 检查是否支持录音
     */
    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    }

    /**
     * 不再需要 fallback 模式
     */
    needsFallback() {
        return !VoiceRecorder.isSupported();
    }
}

export default VoiceRecorder;
