const isBrowser = typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const DB_NAME = 'groupchat-cache';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

let dbPromise = null;

const openDatabase = () => {
    if (!isBrowser) {
        return Promise.resolve(null);
    }
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        }).catch((error) => {
            dbPromise = null;
            throw error;
        });
    }
    return dbPromise;
};

const runRequest = async (mode, operation) => {
    const db = await openDatabase();
    if (!db) {
        return null;
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let request;
        try {
            request = operation(store);
        } catch (operationError) {
            reject(operationError);
            return;
        }
        if (!request) {
            resolve(null);
            return;
        }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getItem = (key) => {
    if (!isBrowser) {
        return Promise.resolve(null);
    }
    return runRequest('readonly', (store) => store.get(key));
};

export const setItem = (key, value) => {
    if (!isBrowser) {
        return Promise.resolve(null);
    }
    return runRequest('readwrite', (store) => store.put(value, key));
};

export const deleteItem = (key) => {
    if (!isBrowser) {
        return Promise.resolve(null);
    }
    return runRequest('readwrite', (store) => store.delete(key));
};
