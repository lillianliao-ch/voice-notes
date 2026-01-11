/**
 * VoiceNotes 主应用逻辑 - 使用后端 API 转写
 */
import { initDB, createNote, getAllNotes, getNoteById, updateNote, appendToNote, deleteNote, hasLocalNotes, migrateLocalNotes, clearLocalNotes } from './db.js';
import VoiceRecorder from './recorder.js';

// 认证管理
const AUTH_TOKEN_KEY = 'voicenotes_auth_token';

function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearAuthToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function verifyToken(token) {
    try {
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await response.json();
        return data.valid;
    } catch {
        return false;
    }
}

async function login(password) {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
    const data = await response.json();
    if (data.success && data.token) {
        setAuthToken(data.token);
        return true;
    }
    return false;
}

// 获取带认证的 fetch 函数
function authFetch(url, options = {}) {
    const token = getAuthToken();
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        }
    });
}

class VoiceNotesApp {
    constructor() {
        this.currentNoteId = null;
        this.recorder = null;
        this.notes = [];
        this.elements = {};
        this.isAppendMode = false;
        this.init();
    }

    async init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.checkAuthAndSetup());
        } else {
            await this.checkAuthAndSetup();
        }
    }

    async checkAuthAndSetup() {
        const loginView = document.getElementById('login-view');
        const appView = document.getElementById('app');
        const token = getAuthToken();

        if (token && await verifyToken(token)) {
            // 已登录
            loginView.classList.add('hidden');
            appView.classList.remove('hidden');
            await this.setup();
        } else {
            // 未登录，显示登录界面
            clearAuthToken();
            loginView.classList.remove('hidden');
            appView.classList.add('hidden');
            this.setupLoginForm();
        }
    }

    setupLoginForm() {
        const form = document.getElementById('login-form');
        const passwordInput = document.getElementById('login-password');
        const errorEl = document.getElementById('login-error');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = passwordInput.value;

            if (await login(password)) {
                document.getElementById('login-view').classList.add('hidden');
                document.getElementById('app').classList.remove('hidden');
                await this.setup();
            } else {
                errorEl.classList.remove('hidden');
                passwordInput.value = '';
                passwordInput.focus();
                setTimeout(() => errorEl.classList.add('hidden'), 3000);
            }
        });
    }

    async setup() {
        this.cacheElements();

        try {
            await initDB();
        } catch (error) {
            console.error('DB init failed:', error);
        }

        if (VoiceRecorder.isSupported()) {
            this.recorder = new VoiceRecorder();
            this.setupRecorderCallbacks();
        } else {
            // 不支持录音，显示手动输入
            this.elements.recordBtn.querySelector('.record-text').textContent = '点击输入';
            this.elements.recordHint.textContent = '您的浏览器不支持录音';
        }

        this.bindEvents();
        this.loadTheme();
        await this.loadNotes();
        this.registerServiceWorker();

        // 检查是否有本地笔记需要迁移
        await this.checkMigration();
    }

    async checkMigration() {
        try {
            const hasLocal = await hasLocalNotes();
            if (hasLocal) {
                const migrate = confirm('检测到本地有笔记数据，是否同步到云端？\n\n同步后，您可以在任何设备上访问这些笔记。');
                if (migrate) {
                    const result = await migrateLocalNotes();
                    alert(result.message);

                    const clearLocal = confirm('是否清除本地数据？（推荐，以避免重复同步）');
                    if (clearLocal) {
                        await clearLocalNotes();
                    }

                    // 重新加载笔记
                    await this.loadNotes();
                }
            }
        } catch (error) {
            console.error('Migration check failed:', error);
        }
    }

    cacheElements() {
        this.elements = {
            homeView: document.getElementById('home-view'),
            detailView: document.getElementById('detail-view'),
            recordBtn: document.getElementById('record-btn'),
            recordHint: document.querySelector('.record-hint'),
            rippleContainer: document.getElementById('ripple-container'),
            transcriptionArea: document.getElementById('transcription-area'),
            transcriptionText: document.getElementById('transcription-text'),
            timer: document.getElementById('timer'),
            saveToast: document.getElementById('save-toast'),
            notesList: document.getElementById('notes-list'),
            notesCount: document.getElementById('notes-count'),
            themeToggle: document.getElementById('theme-toggle'),
            backBtn: document.getElementById('back-btn'),
            deleteBtn: document.getElementById('delete-btn'),
            detailDate: document.getElementById('detail-date'),
            noteContent: document.getElementById('note-content'),
            appendBtn: document.getElementById('append-btn'),
            appendTranscription: document.getElementById('append-transcription'),
            appendText: document.getElementById('append-text'),
            deleteDialog: document.getElementById('delete-dialog'),
            cancelDelete: document.getElementById('cancel-delete'),
            confirmDelete: document.getElementById('confirm-delete'),
            iosInputArea: document.getElementById('ios-input-area'),
            iosTextarea: document.getElementById('ios-textarea'),
            iosCancel: document.getElementById('ios-cancel'),
            iosSave: document.getElementById('ios-save'),
            summarizeBtn: document.getElementById('summarize-btn'),
            summarySection: document.getElementById('summary-section'),
            summaryContent: document.getElementById('summary-content'),
        };
    }

    setupRecorderCallbacks() {
        this.recorder.onStart = () => {
            document.body.classList.add('recording');
        };

        this.recorder.onTimer = (time) => {
            this.elements.timer.textContent = time;
        };

        this.recorder.onTranscribing = (isTranscribing) => {
            const targetText = this.isAppendMode ? this.elements.appendText : this.elements.transcriptionText;
            if (isTranscribing) {
                targetText.textContent = '识别中...';
            }
        };

        this.recorder.onEnd = async (text) => {
            document.body.classList.remove('recording');

            // 隐藏转写区
            setTimeout(() => {
                this.elements.transcriptionArea.classList.add('hidden');
                this.elements.appendTranscription.classList.add('hidden');
            }, 300);

            if (text) {
                if (this.isAppendMode && this.currentNoteId) {
                    await appendToNote(this.currentNoteId, text);
                    const note = await getNoteById(this.currentNoteId);
                    this.showNoteDetail(note);
                    this.showSaveToast();
                } else {
                    await createNote(text);
                    this.showSaveToast();
                    await this.loadNotes();
                }
            }

            this.isAppendMode = false;
        };

        this.recorder.onError = (error) => {
            document.body.classList.remove('recording');
            this.elements.transcriptionArea.classList.add('hidden');
            this.elements.appendTranscription.classList.add('hidden');

            if (error === 'not-allowed') {
                alert('请允许麦克风权限后重试');
            } else {
                console.error('Recording error:', error);
            }

            this.isAppendMode = false;
        };
    }

    bindEvents() {
        // 主录音按钮
        this.bindRecordButton(this.elements.recordBtn, false);
        // 追加录音按钮
        this.bindRecordButton(this.elements.appendBtn, true);

        // iOS 手动输入（作为备用）
        if (this.elements.iosCancel) {
            this.elements.iosCancel.addEventListener('click', () => this.hideIOSInput());
        }
        if (this.elements.iosSave) {
            this.elements.iosSave.addEventListener('click', () => this.saveIOSInput());
        }

        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.backBtn.addEventListener('click', () => this.showHome());
        this.elements.deleteBtn.addEventListener('click', () => this.showDeleteDialog());
        this.elements.cancelDelete.addEventListener('click', () => this.hideDeleteDialog());
        this.elements.confirmDelete.addEventListener('click', () => this.confirmDeleteNote());
        this.elements.noteContent.addEventListener('blur', () => this.saveNoteContent());
        this.elements.deleteDialog.addEventListener('click', (e) => {
            if (e.target === this.elements.deleteDialog) this.hideDeleteDialog();
        });

        // 生成纪要按钮
        if (this.elements.summarizeBtn) {
            this.elements.summarizeBtn.addEventListener('click', () => this.generateSummary());
        }
    }

    bindRecordButton(button, isAppend) {
        let isPressed = false;

        const start = async (e) => {
            e.preventDefault();
            if (isPressed) return;

            if (!this.recorder || this.recorder.needsFallback()) {
                // 使用手动输入
                this.showIOSInput(isAppend);
                return;
            }

            isPressed = true;
            this.isAppendMode = isAppend;
            button.classList.add('recording');

            if (isAppend) {
                this.elements.appendTranscription.classList.remove('hidden');
                this.elements.appendText.textContent = '录音中...';
            } else {
                this.elements.transcriptionArea.classList.remove('hidden');
                this.elements.transcriptionText.textContent = '录音中...';
                this.elements.timer.textContent = '00:00';
                this.showRipples();
            }

            await this.recorder.start();
        };

        const stop = (e) => {
            e.preventDefault();
            if (!isPressed) return;
            isPressed = false;

            button.classList.remove('recording');
            this.hideRipples();

            if (this.recorder) {
                this.recorder.stop();
            }
        };

        // 触摸事件
        button.addEventListener('touchstart', start, { passive: false });
        button.addEventListener('touchend', stop, { passive: false });
        button.addEventListener('touchcancel', stop, { passive: false });

        // 鼠标事件
        button.addEventListener('mousedown', start);
        button.addEventListener('mouseup', stop);
        button.addEventListener('mouseleave', (e) => { if (isPressed) stop(e); });
    }

    // iOS 手动输入
    showIOSInput(isAppend) {
        if (!this.elements.iosInputArea) return;
        this.elements.iosInputArea.dataset.append = isAppend ? 'true' : 'false';
        this.elements.iosTextarea.value = '';
        this.elements.iosInputArea.classList.remove('hidden');
        this.elements.iosTextarea.focus();
    }

    hideIOSInput() {
        if (!this.elements.iosInputArea) return;
        this.elements.iosInputArea.classList.add('hidden');
    }

    async saveIOSInput() {
        if (!this.elements.iosTextarea) return;
        const text = this.elements.iosTextarea.value.trim();
        if (!text) {
            this.hideIOSInput();
            return;
        }

        const isAppend = this.elements.iosInputArea.dataset.append === 'true';

        if (isAppend && this.currentNoteId) {
            await appendToNote(this.currentNoteId, text);
            const note = await getNoteById(this.currentNoteId);
            this.showNoteDetail(note);
        } else {
            await createNote(text);
            await this.loadNotes();
        }

        this.showSaveToast();
        this.hideIOSInput();
    }

    showRipples() {
        this.elements.rippleContainer.innerHTML = '<div class="ripple"></div><div class="ripple"></div><div class="ripple"></div>';
    }

    hideRipples() {
        this.elements.rippleContainer.innerHTML = '';
    }

    showSaveToast() {
        this.elements.saveToast.classList.remove('hidden');
        setTimeout(() => this.elements.saveToast.classList.add('hidden'), 1500);
    }

    async loadNotes() {
        try {
            this.notes = await getAllNotes();
            this.renderNotesList();
            this.elements.notesCount.textContent = `${this.notes.length} 条`;
        } catch (error) {
            console.error('Failed to load notes:', error);
        }
    }

    renderNotesList() {
        if (this.notes.length === 0) {
            this.elements.notesList.innerHTML = '<div class="empty-state"><div class="empty-icon">🎤</div><p>还没有笔记</p><p class="empty-hint">按住上方按钮开始录音</p></div>';
            return;
        }
        this.elements.notesList.innerHTML = this.notes.map(note =>
            `<div class="note-card" data-id="${note.id}">
                <div class="note-content-wrapper">
                    <div class="note-preview">${this.escapeHtml(note.content)}</div>
                    <div class="note-meta">${this.formatDate(note.updatedAt)}</div>
                </div>
                <button class="note-delete-btn" data-id="${note.id}" aria-label="删除">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>`
        ).join('');

        // 点击卡片进入详情
        this.elements.notesList.querySelectorAll('.note-content-wrapper').forEach(wrapper => {
            wrapper.addEventListener('click', (e) => {
                const card = wrapper.closest('.note-card');
                const note = this.notes.find(n => n.id === card.dataset.id);
                if (note) this.showNoteDetail(note);
            });
        });

        // 删除按钮
        this.elements.notesList.querySelectorAll('.note-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const noteId = btn.dataset.id;
                this.pendingDeleteId = noteId;
                this.showDeleteDialog();
            });
        });
    }

    showNoteDetail(note) {
        this.currentNoteId = note.id;
        this.elements.detailDate.textContent = this.formatDate(note.createdAt);
        this.elements.noteContent.innerHTML = this.formatNoteContent(note.content);
        this.elements.homeView.classList.remove('active');
        this.elements.detailView.classList.add('active');
    }

    async showHome() {
        this.currentNoteId = null;
        this.elements.detailView.classList.remove('active');
        this.elements.homeView.classList.add('active');
        // 隐藏纪要区域
        if (this.elements.summarySection) {
            this.elements.summarySection.classList.add('hidden');
        }
        await this.loadNotes();
    }

    async generateSummary() {
        if (!this.currentNoteId) return;

        const content = this.elements.noteContent.innerText.trim();
        if (!content) {
            alert('笔记内容为空');
            return;
        }

        const btn = this.elements.summarizeBtn;
        const originalText = btn.querySelector('span').textContent;

        try {
            // 显示加载状态
            btn.classList.add('loading');
            btn.querySelector('span').textContent = '生成中...';

            const token = localStorage.getItem('voicenotes_auth_token');
            const response = await fetch('/api/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content })
            });

            const result = await response.json();

            if (result.success && result.summary) {
                // 显示纪要
                this.elements.summaryContent.textContent = result.summary;
                this.elements.summarySection.classList.remove('hidden');

                // 保存纪要到笔记（追加到末尾）
                const note = await getNoteById(this.currentNoteId);
                if (note && !note.content.includes('【智能纪要】')) {
                    const newContent = note.content + '\n\n【智能纪要】\n' + result.summary;
                    await updateNote(this.currentNoteId, newContent);
                    this.elements.noteContent.innerHTML = this.formatNoteContent(newContent);
                }
            } else {
                alert('生成纪要失败: ' + (result.error || '未知错误'));
            }
        } catch (error) {
            console.error('Generate summary failed:', error);
            alert('生成纪要失败，请重试');
        } finally {
            btn.classList.remove('loading');
            btn.querySelector('span').textContent = originalText;
        }
    }

    async saveNoteContent() {
        if (!this.currentNoteId) return;
        const content = this.elements.noteContent.innerText.trim();
        if (content) {
            try {
                await updateNote(this.currentNoteId, content);
            } catch (e) {
                console.error('Save failed:', e);
            }
        }
    }

    showDeleteDialog() { this.elements.deleteDialog.classList.remove('hidden'); }
    hideDeleteDialog() { this.elements.deleteDialog.classList.add('hidden'); }

    async confirmDeleteNote() {
        const noteIdToDelete = this.pendingDeleteId || this.currentNoteId;
        if (!noteIdToDelete) return;

        await deleteNote(noteIdToDelete);
        this.hideDeleteDialog();
        this.pendingDeleteId = null;

        // 如果是从详情页删除，返回首页；否则刷新列表
        if (this.currentNoteId === noteIdToDelete) {
            this.showHome();
        } else {
            await this.loadNotes();
        }
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    }

    loadTheme() {
        const saved = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', saved || (prefersDark ? 'dark' : 'light'));
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('./sw.js');
            } catch (e) { }
        }
    }

    escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    formatDate(iso) {
        const d = new Date(iso), now = new Date();
        if (d.toDateString() === now.toDateString()) {
            return `今天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        }
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        if (d.toDateString() === y.toDateString()) {
            return `昨天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        }
        return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    formatNoteContent(content) {
        return this.escapeHtml(content).replace(/\[(\d{2}:\d{2})\]/g, '<span class="timestamp">[$1]</span>');
    }
}

new VoiceNotesApp();
