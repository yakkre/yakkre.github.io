// Reader data for the problem catalogue: "done" marks and named collections of problems.
// A collection can be made public (signed-in owners only): a read-only copy is kept at
// sharedCollections/{id} that anyone with the link can view; private collections exist only here.
// Private notes per problem live in their own documents at progress/{uid}/notes/{problemKey}.
// Signed out: kept in this browser (localStorage).
// Signed in by emailed link (Firebase passwordless auth): kept in Firestore at progress/{uid},
// so it follows the reader to any device. Local data is merged into the account on sign-in.
// Firebase loads lazily; if it is unavailable the catalogue still works with local data only.
import {firebaseConfig} from '../firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';
const LOCAL_KEY = 'raindrops-done-v1';
const COLL_KEY = 'raindrops-collections-v1';
const NOTES_KEY = 'raindrops-notes-v1';
export const MAX_NOTE = 10000; // must match firestore.rules
const EMAIL_KEY = 'raindrops-signin-email';
// Limits; MAX_MARKS and MAX_COLLECTIONS must match firestore.rules.
const MAX_MARKS = 5000, MAX_COLLECTIONS = 100, MAX_PER_COLLECTION = 500, MAX_NAME = 80, MAX_DESC = 1000;

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode: in-memory only */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};
const parse = (text, fallback) => { try { return JSON.parse(text) ?? fallback; } catch { return fallback; } };
const cleanKeys = v => Array.isArray(v) ? [...new Set(v.filter(k => typeof k === 'string'))] : [];
function cleanCollections(v) {
  if (!Array.isArray(v)) return [];
  return v.filter(c => c && typeof c.id === 'string' && typeof c.name === 'string').slice(0, MAX_COLLECTIONS).map(c => {
    const keys = cleanKeys(c.keys).slice(0, MAX_PER_COLLECTION), inList = new Set(keys);
    // done: marks local to this collection, independent of the overall done marks and other collections.
    return {id: c.id, name: c.name.slice(0, MAX_NAME), description: typeof c.description === 'string' ? c.description.slice(0, MAX_DESC) : '',
      keys, done: cleanKeys(c.done).filter(k => inList.has(k)), created: Number(c.created) || Date.now(), public: c.public === true};
  });
}
const readLocal = () => new Set(cleanKeys(parse(store.get(LOCAL_KEY), [])));
const readLocalCollections = () => cleanCollections(parse(store.get(COLL_KEY), []));
function readLocalNotes() {
  const v = parse(store.get(NOTES_KEY), {}), m = new Map();
  if (v && typeof v === 'object') for (const [k, t] of Object.entries(v)) if (typeof t === 'string' && t.trim()) m.set(k, t.slice(0, MAX_NOTE));
  return m;
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// startHref: the page URL captured before the catalogue rewrites the address bar (the sign-in
// link's one-time code is in it). onChange() is called whenever data or sign-in state change.
export function createProgress({startHref, validKeys, onChange}) {
  let done = readLocal(), collections = readLocalCollections(), user = null, status = '', fb = null, unsubscribe = null;
  let remoteHasCollections = false, notes = readLocalNotes(), unsubNotes = null;
  const keep = k => !validKeys || validKeys.has(k);
  const emit = () => onChange?.();
  const setStatus = text => { status = text; emit(); };

  async function loadFirebase() {
    if (fb) return fb;
    const [{initializeApp}, authMod, fsMod] = await Promise.all([
      import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
    const app = initializeApp(firebaseConfig);
    fb = {auth: authMod.getAuth(app), db: fsMod.getFirestore(app), ...authMod, ...fsMod};
    return fb;
  }
  const docRef = () => fb.doc(fb.db, 'progress', user.uid);
  const sharedRef = id => fb.doc(fb.db, 'sharedCollections', id);
  const notesCol = () => fb.collection(fb.db, 'progress', user.uid, 'notes');
  const noteRef = key => fb.doc(fb.db, 'progress', user.uid, 'notes', key);
  // Push a public collection's current contents to its shared copy.
  const publish = c => fb.setDoc(sharedRef(c.id), {ownerUid: user.uid, name: c.name, description: c.description, keys: c.keys, updatedAt: fb.serverTimestamp()});
  async function syncShared(id) {
    const c = find(id);
    if (user && c?.public) { try { await publish(c); } catch (e) { console.error(e); setStatus('Saved, but the public copy didn’t update. Try again.'); } }
  }

  async function save() {
    if (!user) { store.set(LOCAL_KEY, JSON.stringify([...done])); store.set(COLL_KEY, JSON.stringify(collections)); return; }
    const data = {done: [...done].slice(0, MAX_MARKS), updatedAt: fb.serverTimestamp()};
    // Only write the collections field once there is something in it, so done marks keep saving
    // under the older rules that allowed just done + updatedAt.
    if (collections.length || remoteHasCollections) { data.collections = collections; remoteHasCollections = true; }
    await fb.setDoc(docRef(), data);
  }
  // Apply a change, save it, and roll back if saving fails.
  async function change(apply, failText = 'Couldn’t save that. Try again.') {
    const before = {done: new Set(done), collections: structuredClone(collections)};
    const result = apply();
    emit();
    try { await save(); return result; }
    catch (e) { console.error(e); done = before.done; collections = before.collections; setStatus(failText); return undefined; }
  }

  function takeRemote(data) {
    done = new Set(cleanKeys(data?.done));
    collections = cleanCollections(data?.collections);
    remoteHasCollections = Array.isArray(data?.collections);
  }
  async function attachNotes() {
    const snap = await fb.getDocs(notesCol());
    const remote = new Map(snap.docs.map(d => [d.id, String(d.data().text || '')]));
    for (const [k, t] of readLocalNotes()) if (!remote.has(k)) { await fb.setDoc(noteRef(k), {text: t, updatedAt: fb.serverTimestamp()}); remote.set(k, t); }
    store.remove(NOTES_KEY);
    notes = remote;
    unsubNotes = fb.onSnapshot(notesCol(), s => {
      if (s.metadata.hasPendingWrites) return;
      notes = new Map(s.docs.map(d => [d.id, String(d.data().text || '')])); emit();
    }, e => { console.error('Notes sync failed:', e); setStatus('Couldn’t sync your notes.'); });
  }
  async function attach(u) {
    unsubscribe?.(); unsubscribe = null; unsubNotes?.(); unsubNotes = null; user = u;
    if (!u) { done = readLocal(); collections = readLocalCollections(); notes = readLocalNotes(); emit(); return; }
    status = '';
    const snap = await fb.getDoc(docRef());
    takeRemote(snap.exists() ? snap.data() : {});
    const localDone = readLocal(), localColls = readLocalCollections();
    const before = done.size, ids = new Set(collections.map(c => c.id));
    for (const k of localDone) done.add(k);
    const extra = localColls.filter(c => !ids.has(c.id));
    collections = [...collections, ...extra].slice(0, MAX_COLLECTIONS);
    if (done.size !== before || extra.length) await save();
    store.remove(LOCAL_KEY); store.remove(COLL_KEY);
    unsubscribe = fb.onSnapshot(docRef(), s => { if (!s.metadata.hasPendingWrites) { takeRemote(s.exists() ? s.data() : {}); emit(); } },
      e => { console.error('Progress sync failed:', e); setStatus('Couldn’t sync your marks. Check your connection.'); });
    emit();
    try { await attachNotes(); } catch (e) { console.error('Notes load failed:', e); setStatus('Couldn’t load your notes.'); }
    emit();
  }

  async function init() {
    try {
      await loadFirebase();
      if (fb.isSignInWithEmailLink(fb.auth, startHref)) {
        let email = store.get(EMAIL_KEY);
        if (!email) email = prompt('Enter your email to finish signing in:');
        if (email) {
          try { await fb.signInWithEmailLink(fb.auth, email.trim(), startHref); store.remove(EMAIL_KEY); }
          catch (e) { console.error(e); status = e.code === 'auth/invalid-action-code' || e.code === 'auth/expired-action-code'
            ? 'That link has expired or was already used. Send yourself a new one.' : 'Sign-in didn’t work. Send yourself a new link.'; }
        }
      }
      fb.onAuthStateChanged(fb.auth, u => attach(u).catch(e => { console.error(e); setStatus('Couldn’t load your marks.'); }));
    } catch (e) {
      console.error('Progress sign-in unavailable:', e); fb = null;
      setStatus('Sign-in isn’t working right now. Your marks are saved in this browser.');
    }
  }
  const find = id => collections.find(c => c.id === id);

  return {
    get user() { return user; },
    get status() { return status; },
    get available() { return fb !== null; },
    isDone: key => done.has(key),
    count: () => [...done].filter(keep).length,
    // Notes: private text per problem. Empty text deletes the note. Returns true when saved.
    note: key => notes.get(key) || '',
    hasNote: key => notes.has(key),
    async setNote(key, text) {
      text = String(text ?? '').slice(0, MAX_NOTE);
      const empty = !text.trim(), before = notes.get(key);
      if (empty) notes.delete(key); else notes.set(key, text);
      try {
        if (!user) { store.set(NOTES_KEY, JSON.stringify(Object.fromEntries(notes))); return true; }
        if (empty) await fb.deleteDoc(noteRef(key)); else await fb.setDoc(noteRef(key), {text, updatedAt: fb.serverTimestamp()});
        return true;
      } catch (e) {
        console.error(e); if (before == null) notes.delete(key); else notes.set(key, before);
        return false;
      }
    },
    toggle: key => change(() => { if (done.has(key)) done.delete(key); else if (done.size < MAX_MARKS) done.add(key); }),
    setDoneMany: (keys, on) => change(() => { for (const k of keys) { if (!on) done.delete(k); else if (done.size < MAX_MARKS) done.add(k); } }),

    // Collections: [{id, name, description, keys, created}], newest first.
    collections: () => [...collections].sort((a, b) => b.created - a.created),
    collection: id => find(id) || null,
    inCollection: (id, key) => !!find(id)?.keys.includes(key),
    createCollection(name, description = '') {
      name = String(name || '').trim().slice(0, MAX_NAME);
      if (!name) { setStatus('Give the collection a name.'); return Promise.resolve(undefined); }
      if (collections.length >= MAX_COLLECTIONS) { setStatus(`You can have up to ${MAX_COLLECTIONS} collections.`); return Promise.resolve(undefined); }
      const c = {id: newId(), name, description: String(description || '').trim().slice(0, MAX_DESC), keys: [], done: [], created: Date.now(), public: false};
      return change(() => { collections.push(c); return c.id; });
    },
    async updateCollection(id, {name, description}) {
      await change(() => {
        const c = find(id); if (!c) return;
        if (name != null && String(name).trim()) c.name = String(name).trim().slice(0, MAX_NAME);
        if (description != null) c.description = String(description).trim().slice(0, MAX_DESC);
      });
      await syncShared(id);
    },
    async deleteCollection(id) {
      if (find(id)?.public && user) {
        try { await fb.deleteDoc(sharedRef(id)); } catch (e) { console.error(e); setStatus('Couldn’t remove the public copy, so the collection was kept. Try again.'); return; }
      }
      await change(() => { collections = collections.filter(c => c.id !== id); });
    },
    async setInCollection(id, key, on) {
      await change(() => {
        const c = find(id); if (!c) return;
        if (on && !c.keys.includes(key) && c.keys.length < MAX_PER_COLLECTION) c.keys.push(key);
        if (!on) { c.keys = c.keys.filter(k => k !== key); c.done = c.done.filter(k => k !== key); }
      });
      await syncShared(id);
    },
    // Done marks that belong to one collection only (never shared, never touch the overall marks).
    isDoneIn: (id, key) => !!find(id)?.done.includes(key),
    toggleDoneIn: (id, key) => change(() => {
      const c = find(id); if (!c || !c.keys.includes(key)) return;
      c.done = c.done.includes(key) ? c.done.filter(k => k !== key) : [...c.done, key];
    }),
    // Adds keys to a collection; returns how many were new (or undefined if saving failed).
    async addManyToCollection(id, keys) {
      const added = await change(() => {
        const c = find(id); if (!c) return 0;
        let n = 0;
        for (const k of keys) if (!c.keys.includes(k) && c.keys.length < MAX_PER_COLLECTION) { c.keys.push(k); n++; }
        return n;
      });
      await syncShared(id);
      return added;
    },
    // Public: anyone with the link can view a read-only copy. Needs a signed-in owner.
    async setPublic(id, on) {
      const c = find(id); if (!c || c.public === on) return false;
      if (!user) { setStatus('Sign in to make a collection public.'); return false; }
      try { if (on) await publish(c); else await fb.deleteDoc(sharedRef(id)); }
      catch (e) { console.error(e); setStatus(on ? 'Couldn’t make it public. Try again.' : 'Couldn’t make it private. Try again.'); return false; }
      await change(() => { c.public = on; });
      return true;
    },
    // Read a public collection by id (no sign-in needed). Returns null if missing or private.
    async getShared(id) {
      await loadFirebase();
      let s;
      try { s = await fb.getDoc(sharedRef(id)); }
      catch (e) { if (e.code === 'permission-denied') return null; throw e; }
      if (!s.exists()) return null;
      const d = s.data();
      return {id, name: String(d.name || ''), description: String(d.description || ''), keys: cleanKeys(d.keys), ownerUid: d.ownerUid};
    },
    async copyShared(shared) {
      const id = await this.createCollection(shared.name, shared.description);
      if (!id) return undefined;
      await change(() => { const c = find(id); if (c) c.keys = shared.keys.slice(0, MAX_PER_COLLECTION); });
      return id;
    },

    async sendLink(email) {
      email = String(email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('Enter a valid email address.'); return false; }
      try {
        await loadFirebase();
        const url = location.origin + location.pathname;
        await fb.sendSignInLinkToEmail(fb.auth, email, {url, handleCodeInApp: true});
        store.set(EMAIL_KEY, email);
        setStatus('Check your inbox (and spam folder) for the sign-in link.');
        return true;
      } catch (e) {
        console.error(e);
        setStatus(e.code === 'auth/quota-exceeded' ? 'Too many sign-in emails today. Try again tomorrow.'
          : 'Couldn’t send the link. Try again later.');
        return false;
      }
    },
    async signOut() {
      if (!fb || !user) return;
      unsubscribe?.(); unsubscribe = null; unsubNotes?.(); unsubNotes = null;
      await fb.signOut(fb.auth); status = ''; emit();
    },
    init,
  };
}
