/**
 * IndexedDB 数据库操作模块
 * 管理笔记的 CRUD 操作
 */

const DB_NAME = 'VoiceNotesDB';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

let db = null;

/**
 * 初始化数据库
 */
export async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('Database initialized');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // 创建笔记存储
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('createdAt', 'createdAt', { unique: false });
                store.createIndex('updatedAt', 'updatedAt', { unique: false });
                console.log('Object store created');
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
 * @param {string} content - 笔记内容
 * @returns {Promise<Object>} 创建的笔记对象
 */
export async function createNote(content) {
    const note = {
        id: generateId(),
        content: content.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(note);

        request.onsuccess = () => {
            console.log('Note created:', note.id);
            resolve(note);
        };

        request.onerror = () => {
            console.error('Failed to create note:', request.error);
            reject(request.error);
        };
    });
}

/**
 * 获取所有笔记（按更新时间倒序）
 * @returns {Promise<Array>} 笔记数组
 */
export async function getAllNotes() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            // 按更新时间倒序排列
            const notes = request.result.sort((a, b) =>
                new Date(b.updatedAt) - new Date(a.updatedAt)
            );
            resolve(notes);
        };

        request.onerror = () => {
            console.error('Failed to get notes:', request.error);
            reject(request.error);
        };
    });
}

/**
 * 根据 ID 获取单个笔记
 * @param {string} id - 笔记 ID
 * @returns {Promise<Object|null>} 笔记对象或 null
 */
export async function getNoteById(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            console.error('Failed to get note:', request.error);
            reject(request.error);
        };
    });
}

/**
 * 更新笔记内容
 * @param {string} id - 笔记 ID
 * @param {string} content - 新内容
 * @returns {Promise<Object>} 更新后的笔记
 */
export async function updateNote(id, content) {
    const note = await getNoteById(id);
    if (!note) {
        throw new Error('Note not found');
    }

    note.content = content.trim();
    note.updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(note);

        request.onsuccess = () => {
            console.log('Note updated:', id);
            resolve(note);
        };

        request.onerror = () => {
            console.error('Failed to update note:', request.error);
            reject(request.error);
        };
    });
}

/**
 * 追加内容到笔记
 * @param {string} id - 笔记 ID
 * @param {string} appendContent - 要追加的内容
 * @returns {Promise<Object>} 更新后的笔记
 */
export async function appendToNote(id, appendContent) {
    const note = await getNoteById(id);
    if (!note) {
        throw new Error('Note not found');
    }

    // 添加时间戳分隔
    const timestamp = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
    const separator = `\n\n[${timestamp}] `;
    note.content = note.content + separator + appendContent.trim();
    note.updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(note);

        request.onsuccess = () => {
            console.log('Content appended to note:', id);
            resolve(note);
        };

        request.onerror = () => {
            console.error('Failed to append to note:', request.error);
            reject(request.error);
        };
    });
}

/**
 * 删除笔记
 * @param {string} id - 笔记 ID
 * @returns {Promise<void>}
 */
export async function deleteNote(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log('Note deleted:', id);
            resolve();
        };

        request.onerror = () => {
            console.error('Failed to delete note:', request.error);
            reject(request.error);
        };
    });
}

/**
 * 获取笔记总数
 * @returns {Promise<number>}
 */
export async function getNotesCount() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}
