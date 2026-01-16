/**
 * 数据库操作模块 - 使用服务器 API + 本地 IndexedDB 迁移支持
 */

const DB_NAME = 'VoiceNotesDB';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

let localDb = null;

// 获取 auth token
function getAuthToken() {
    return localStorage.getItem('voicenotes_auth_token');
}

// 带认证的 fetch
async function authFetch(url, options = {}) {
    const token = getAuthToken();
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });
    return response;
}

/**
 * 初始化 - 检查本地是否有数据需要迁移
 */
export async function initDB() {
    // 初始化本地 IndexedDB（用于迁移检测）
    await initLocalDB();
    console.log('Database initialized');
}

/**
 * 初始化本地 IndexedDB
 */
async function initLocalDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open local database:', request.error);
            resolve(null); // 不阻塞，允许服务端模式
        };

        request.onsuccess = () => {
            localDb = request.result;
            resolve(localDb);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('createdAt', 'createdAt', { unique: false });
                store.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
        };
    });
}

/**
 * 生成唯一 ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 创建新笔记
 */
export async function createNote(content) {
    const note = {
        id: generateId(),
        content: content.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const response = await authFetch('/api/notes', {
        method: 'POST',
        body: JSON.stringify(note)
    });

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Failed to create note');
    }

    console.log('Note created:', note.id);
    return note;
}

/**
 * 获取所有笔记
 */
export async function getAllNotes() {
    const response = await authFetch('/api/notes');
    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Failed to get notes');
    }

    // 转换字段名（后端用 snake_case，前端用 camelCase）
    return result.notes.map(note => ({
        id: note.id,
        content: note.content,
        createdAt: note.created_at,
        updatedAt: note.updated_at
    }));
}

/**
 * 根据 ID 获取单个笔记
 */
export async function getNoteById(id) {
    const response = await authFetch(`/api/notes`);
    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Failed to get notes');
    }

    // 转换字段名并查找匹配的笔记
    const notes = result.notes.map(note => ({
        id: note.id,
        content: note.content,
        createdAt: note.created_at,
        updatedAt: note.updated_at
    }));

    return notes.find(note => note.id === id) || null;
}

/**
 * 更新笔记内容
 */
export async function updateNote(id, content) {
    const response = await authFetch(`/api/notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ content: content.trim() })
    });

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Failed to update note');
    }

    console.log('Note updated:', id);
    return { id, content, updatedAt: new Date().toISOString() };
}

/**
 * 追加内容到笔记
 */
export async function appendToNote(id, appendContent) {
    const note = await getNoteById(id);
    if (!note) {
        throw new Error('Note not found');
    }

    const timestamp = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
    const separator = `\n\n[${timestamp}] `;
    const newContent = note.content + separator + appendContent.trim();

    return updateNote(id, newContent);
}

/**
 * 删除笔记
 */
export async function deleteNote(id) {
    const response = await authFetch(`/api/notes/${id}`, {
        method: 'DELETE'
    });

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Failed to delete note');
    }

    console.log('Note deleted:', id);
}

/**
 * 获取笔记总数
 */
export async function getNotesCount() {
    const notes = await getAllNotes();
    return notes.length;
}

// ========== 迁移相关函数 ==========

/**
 * 获取本地 IndexedDB 中的所有笔记
 */
export async function getLocalNotes() {
    if (!localDb) {
        return [];
    }

    return new Promise((resolve, reject) => {
        const transaction = localDb.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => {
            console.error('Failed to get local notes:', request.error);
            resolve([]);
        };
    });
}

/**
 * 迁移本地笔记到服务器
 */
export async function migrateLocalNotes() {
    const localNotes = await getLocalNotes();

    if (localNotes.length === 0) {
        return { migrated: 0, message: 'No local notes to migrate' };
    }

    const response = await authFetch('/api/notes/migrate', {
        method: 'POST',
        body: JSON.stringify({ notes: localNotes })
    });

    const result = await response.json();

    if (result.success) {
        console.log(`Migrated ${result.migrated} notes to server`);
        return { migrated: result.migrated, message: `成功迁移 ${result.migrated} 条笔记` };
    } else {
        throw new Error(result.error || 'Migration failed');
    }
}

/**
 * 清除本地 IndexedDB 数据
 */
export async function clearLocalNotes() {
    if (!localDb) return;

    return new Promise((resolve, reject) => {
        const transaction = localDb.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            console.log('Local notes cleared');
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * 检查是否有本地笔记需要迁移
 */
export async function hasLocalNotes() {
    const localNotes = await getLocalNotes();
    return localNotes.length > 0;
}
