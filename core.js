/* Logika bersama: dipakai oleh halaman (index.html) dan service worker (sw.js) */
(function (root) {
  const DB_NAME = 'tabungan-db', STORE = 'kv', DAY = 86400000;

  function openDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function get(key) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const q = db.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  }
  async function set(key, val) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  const pad = n => String(n).padStart(2, '0');
  const dateStr = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const utcDay = str => { const [y, m, d] = str.split('-').map(Number); return Date.UTC(y, m - 1, d) / DAY; };

  function defaults() {
    return { ready: false, startDate: dateStr(), startAmount: 1000, step: 1000,
             remindFrom: 7, remindTo: 22, notifyOn: true, payments: {} };
  }
  async function load() {
    const s = await get('state');
    return Object.assign(defaults(), s || {});
  }
  const save = s => set('state', s);
  const getLast = async () => (await get('lastNotified')) || 0;
  const setLast = t => set('lastNotified', t);

  const dayNo = (s, now = new Date()) => utcDay(dateStr(now)) - utcDay(s.startDate) + 1;
  const amountFor = (s, n) => s.startAmount + (n - 1) * s.step;
  const dateOfDay = (s, n) => new Date((utcDay(s.startDate) + n - 1) * DAY);
  function overdue(s, today) {
    const out = [];
    for (let n = 1; n < today; n++) if (!s.payments[n]) out.push(n);
    return out;
  }
  const rp = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(n);

  function shouldRemind(s, now, last) {
    if (!s.ready || !s.notifyOn) return false;
    const n = dayNo(s, now);
    if (n < 1 || s.payments[n]) return false;
    const h = now.getHours();
    if (h < s.remindFrom || h >= s.remindTo) return false;
    return now.getTime() - (last || 0) >= 55 * 60 * 1000;
  }

  function showReminder(reg, s, now = new Date(), isTest = false) {
    const n = Math.max(1, dayNo(s, now));
    const late = overdue(s, n).length;
    let body = 'Setoran hari ke-' + n + ': ' + rp(amountFor(s, n)) + '. Ketuk untuk setor.';
    if (late) body += ' (' + late + ' hari belum dibayar)';
    return reg.showNotification(isTest ? 'Tes notifikasi' : 'Belum setor hari ini', {
      body, tag: 'setor', renotify: true,
      icon: 'icons/icon-192.png', badge: 'icons/badge-96.png',
      data: { url: './?setor=1' }
    });
  }

  root.Core = { load, save, getLast, setLast, dateStr, dayNo, amountFor, dateOfDay,
                overdue, rp, shouldRemind, showReminder, defaults };
})(typeof self !== 'undefined' ? self : this);
