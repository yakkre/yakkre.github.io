// "Done" marks for the problem catalogue.
// Signed out: marks live in this browser (localStorage).
// Signed in by emailed link (Firebase passwordless auth): marks live in Firestore at progress/{uid},
// so they follow the reader to any device. Local marks are merged into the account on sign-in.
// Firebase loads lazily; if it is unavailable the catalogue still works with local marks only.
import {firebaseConfig} from '../firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';
const LOCAL_KEY = 'raindrops-done-v1';
const EMAIL_KEY = 'raindrops-signin-email';
const MAX_MARKS = 5000; // must match firestore.rules

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode: in-memory only */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};
function readLocal() {
  try { const v = JSON.parse(store.get(LOCAL_KEY) || '[]'); return new Set(Array.isArray(v) ? v.filter(k => typeof k === 'string') : []); }
  catch { return new Set(); }
}

// startHref: the page URL captured before the catalogue rewrites the address bar (the sign-in
// link's one-time code is in it). onChange() is called whenever marks or sign-in state change.
export function createProgress({startHref, validKeys, onChange}) {
  let done = readLocal(), user = null, status = '', fb = null, unsubscribe = null;
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

  async function save() {
    if (!user) { store.set(LOCAL_KEY, JSON.stringify([...done])); return; }
    await fb.setDoc(docRef(), {done: [...done].slice(0, MAX_MARKS), updatedAt: fb.serverTimestamp()});
  }

  async function attach(u) {
    unsubscribe?.(); unsubscribe = null; user = u;
    if (!u) { done = readLocal(); emit(); return; }
    status = '';
    const snap = await fb.getDoc(docRef());
    const remote = new Set(snap.exists() ? snap.data().done || [] : []);
    const local = readLocal(), merged = new Set([...remote, ...local]);
    done = merged;
    if (merged.size !== remote.size) await save();
    store.remove(LOCAL_KEY);
    unsubscribe = fb.onSnapshot(docRef(), s => { if (!s.metadata.hasPendingWrites) { done = new Set(s.exists() ? s.data().done || [] : []); emit(); } },
      e => { console.error('Progress sync failed:', e); setStatus('Couldn’t sync your marks. Check your connection.'); });
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

  return {
    get user() { return user; },
    get status() { return status; },
    get available() { return fb !== null; },
    isDone: key => done.has(key),
    count: () => [...done].filter(keep).length,
    has: () => done.size > 0,
    async toggle(key) {
      const was = done.has(key);
      if (was) done.delete(key); else if (done.size < MAX_MARKS) done.add(key);
      emit();
      try { await save(); }
      catch (e) { console.error(e); if (was) done.add(key); else done.delete(key); setStatus('Couldn’t save that. Try again.'); }
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
      unsubscribe?.(); unsubscribe = null;
      await fb.signOut(fb.auth); status = ''; emit();
    },
    init,
  };
}
