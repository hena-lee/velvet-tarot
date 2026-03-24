// IndexedDB wrapper for client-side reading history.
// Used when running on the hosted version (Vercel) where the server has no writable storage.
// Exposed as window.historyDB
(function () {
  const DB_NAME = 'velvet-tarot';
  const DB_VERSION = 1;
  const STORE = 'readings';

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  window.historyDB = {
    async save(entry) {
      const db = await openDB();
      const record = {
        ...entry,
        id: Date.now(),
        timestamp: new Date().toISOString(),
        favorite: false,
        notes: null
      };
      return new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readwrite').objectStore(STORE).add(record);
        req.onsuccess = () => { db.close(); resolve(record); };
        req.onerror = (e) => { db.close(); reject(e.target.error); };
      });
    },

    async list() {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = (e) => {
          db.close();
          const all = e.target.result;
          all.sort((a, b) => {
            if (!!a.favorite !== !!b.favorite) return b.favorite ? 1 : -1;
            return new Date(b.timestamp) - new Date(a.timestamp);
          });
          resolve(all);
        };
        req.onerror = (e) => { db.close(); reject(e.target.error); };
      });
    },

    async toggleFavorite(id) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const entry = getReq.result;
          if (!entry) { db.close(); resolve(null); return; }
          entry.favorite = !entry.favorite;
          const putReq = store.put(entry);
          putReq.onsuccess = () => { db.close(); resolve(entry); };
          putReq.onerror = (e) => { db.close(); reject(e.target.error); };
        };
        getReq.onerror = (e) => { db.close(); reject(e.target.error); };
      });
    },

    async deleteMultiple(ids) {
      const db = await openDB();
      const idSet = new Set(ids);
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const getReq = store.getAll();
        getReq.onsuccess = (e) => {
          const toDelete = e.target.result.filter(r => idSet.has(r.id));
          let remaining = toDelete.length;
          if (remaining === 0) { db.close(); resolve(); return; }
          toDelete.forEach(r => {
            const delReq = store.delete(r.id);
            delReq.onsuccess = () => {
              remaining--;
              if (remaining === 0) { db.close(); resolve(); }
            };
            delReq.onerror = (e) => { db.close(); reject(e.target.error); };
          });
        };
        getReq.onerror = (e) => { db.close(); reject(e.target.error); };
      });
    },

    async updateNotes(id, notes) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const entry = getReq.result;
          if (!entry) { db.close(); resolve(null); return; }
          entry.notes = notes;
          const putReq = store.put(entry);
          putReq.onsuccess = () => { db.close(); resolve(entry); };
          putReq.onerror = (e) => { db.close(); reject(e.target.error); };
        };
        getReq.onerror = (e) => { db.close(); reject(e.target.error); };
      });
    }
  };
})();
