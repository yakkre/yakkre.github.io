import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig, OWNER_EMAIL } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (selector, root = document) => root.querySelector(selector);

const els = {
  homeView: $("#homeView"),
  postView: $("#postView"),
  loginView: $("#loginView"),
  registerView: $("#registerView"),
  singlePostContainer: $("#singlePostContainer"),

  authButton: $("#authButton"),
  registerNavButton: $("#registerNavButton"),
  logoutButton: $("#logoutButton"),
  verifyEmailButton: $("#verifyEmailButton"),
  userBadge: $("#userBadge"),
  notice: $("#notice"),

  loginForm: $("#loginForm"),
  loginEmail: $("#loginEmail"),
  loginPassword: $("#loginPassword"),
  loginGoogleButton: $("#loginGoogleButton"),
  loginMessage: $("#loginMessage"),

  registerForm: $("#registerForm"),
  registerEmail: $("#registerEmail"),
  registerPassword: $("#registerPassword"),
  registerGoogleButton: $("#registerGoogleButton"),
  registerMessage: $("#registerMessage"),

  newPostButton: $("#newPostButton"),
  manageContributorsButton: $("#manageContributorsButton"),
  editorPanel: $("#editorPanel"),
  postForm: $("#postForm"),
  postTitle: $("#postTitle"),
  postTags: $("#postTags"),
  postBody: $("#postBody"),
  postPublished: $("#postPublished"),
  postPreview: $("#postPreview"),
  cancelEditButton: $("#cancelEditButton"),

  adminPanel: $("#adminPanel"),
  contributorForm: $("#contributorForm"),
  contributorEmail: $("#contributorEmail"),
  contributorRole: $("#contributorRole"),
  contributorResult: $("#contributorResult"),

  statsEntries: $("#statsEntries"),
  statsLikes: $("#statsLikes"),
  statsComments: $("#statsComments"),

  searchInput: $("#searchInput"),
  postsList: $("#postsList"),
  postTemplate: $("#postTemplate")
};

let currentUser = null;
let currentProfile = null;
let allPosts = [];
let hasLoadedPosts = false;
let editingPostId = null;
let unsubscribePosts = null;
let unsubscribeChildListeners = [];

const likeCountsByPost = new Map();
const commentCountsByPost = new Map();

function showNotice(message, isError = false) {
  els.notice.textContent = message;
  els.notice.classList.remove("hidden");
  els.notice.style.color = isError ? "var(--danger)" : "var(--accent-deep)";
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    els.notice.classList.add("hidden");
  }, 5200);
}

function formatDate(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : null;
  if (!date) return "just now";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function makeSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80) || "post";
}

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map(tag => tag.trim().replace(/^#+/, ""))
    .filter(Boolean)
    .slice(0, 12);
}

function formatTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return "";
  return tags.map(tag => `#${tag}`).join(" ");
}

function makeExcerpt(markdown, maxLength = 220) {
  const text = String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " equation ")
    .replace(/\\\[[\s\S]*?\\\]/g, " equation ")
    .replace(/\\\([\s\S]*?\\\)/g, " equation ")
    .replace(/[#>*_`~\[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}…` : text;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function isOwner(user = currentUser) {
  return Boolean(
    user &&
    user.email &&
    user.email.toLowerCase() === OWNER_EMAIL.toLowerCase() &&
    user.emailVerified
  );
}

function userRole() {
  if (isOwner()) return "admin";
  return currentProfile?.role || "reader";
}

function canWritePosts() {
  const role = userRole();
  return isOwner() || role === "writer" || role === "admin";
}

function canManageContributors() {
  return isOwner() || userRole() === "admin";
}

function readablePosts() {
  return allPosts.filter(post => post.published || canWritePosts());
}

function renderMarkdownWithLatex(markdown, target) {
  const rawHtml = window.marked.parse(markdown || "", {
    breaks: true,
    gfm: true
  });

  target.innerHTML = window.DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true }
  });

  if (window.renderMathInElement) {
    window.renderMathInElement(target, {
      throwOnError: false,
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ]
    });
  }
}

function clearChildListeners() {
  for (const unsubscribe of unsubscribeChildListeners) unsubscribe();
  unsubscribeChildListeners = [];
}

function getRoute() {
  const hash = window.location.hash || "#/";
  if (hash.startsWith("#/post/")) {
    return { view: "post", postId: decodeURIComponent(hash.replace("#/post/", "")) };
  }
  if (hash === "#/login") return { view: "login" };
  if (hash === "#/register") return { view: "register" };
  return { view: "home" };
}

function showView(view) {
  els.homeView.classList.toggle("hidden", view !== "home");
  els.postView.classList.toggle("hidden", view !== "post");
  els.loginView.classList.toggle("hidden", view !== "login");
  els.registerView.classList.toggle("hidden", view !== "register");
}

function renderCurrentRoute() {
  const route = getRoute();
  showView(route.view);

  if (route.view === "home") {
    renderPosts();
  } else if (route.view === "post") {
    renderSinglePost(route.postId);
  } else {
    clearChildListeners();
  }
}

async function ensureUserDocument(user) {
  if (!user) return null;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email,
      displayName: user.displayName || user.email?.split("@")[0] || "Reader",
      photoURL: user.photoURL || "",
      role: "reader",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return {
      email: user.email,
      displayName: user.displayName || user.email?.split("@")[0] || "Reader",
      photoURL: user.photoURL || "",
      role: "reader"
    };
  }

  return snap.data();
}

function updateAuthUi() {
  if (!currentUser) {
    els.authButton.classList.remove("hidden");
    els.registerNavButton.classList.remove("hidden");
    els.logoutButton.classList.add("hidden");
    els.verifyEmailButton.classList.add("hidden");
    els.userBadge.textContent = "";
    els.newPostButton.classList.add("hidden");
    els.manageContributorsButton.classList.add("hidden");
    els.editorPanel.classList.add("hidden");
    els.adminPanel.classList.add("hidden");
    return;
  }

  const role = userRole();
  const verifiedLabel = currentUser.emailVerified ? "" : " · verify email";
  els.userBadge.textContent = `${currentUser.email} · ${role}${verifiedLabel}`;

  els.authButton.classList.add("hidden");
  els.registerNavButton.classList.add("hidden");
  els.logoutButton.classList.remove("hidden");
  els.verifyEmailButton.classList.toggle("hidden", currentUser.emailVerified);

  els.newPostButton.classList.toggle("hidden", !canWritePosts());
  els.manageContributorsButton.classList.toggle("hidden", !canManageContributors());

  if (!canWritePosts()) els.editorPanel.classList.add("hidden");
  if (!canManageContributors()) els.adminPanel.classList.add("hidden");
}

async function registerWithEmail(event) {
  event.preventDefault();
  const email = els.registerEmail.value.trim();
  const password = els.registerPassword.value;
  els.registerMessage.textContent = "";

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: email.split("@")[0] });
    await sendEmailVerification(credential.user);
    els.registerMessage.textContent = "Account created. Check your email to verify it before liking or commenting.";
  } catch (error) {
    els.registerMessage.textContent = error.message;
  }
}

async function loginWithEmail(event) {
  event.preventDefault();
  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;
  els.loginMessage.textContent = "";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.hash = "#/";
    showNotice("Logged in.");
  } catch (error) {
    els.loginMessage.textContent = error.message;
  }
}

async function loginWithGoogle(targetMessage = els.loginMessage) {
  targetMessage.textContent = "";

  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    window.location.hash = "#/";
    showNotice("Logged in with Google.");
  } catch (error) {
    targetMessage.textContent = error.message;
  }
}

async function sendVerification() {
  if (!auth.currentUser) return;
  try {
    await sendEmailVerification(auth.currentUser);
    showNotice("Verification email sent.");
  } catch (error) {
    showNotice(error.message, true);
  }
}

function openEditor(post = null) {
  if (!canWritePosts()) {
    showNotice("Only the owner and approved contributors can write posts.", true);
    return;
  }

  if (window.location.hash !== "#/") window.location.hash = "#/";

  editingPostId = post?.id || null;
  els.postTitle.value = post?.title || "";
  els.postTags.value = Array.isArray(post?.tags) ? post.tags.join(", ") : "";
  els.postBody.value = post?.body || "";
  els.postPublished.checked = post?.published ?? true;
  els.cancelEditButton.classList.toggle("hidden", !editingPostId);
  renderMarkdownWithLatex(els.postBody.value, els.postPreview);
  els.editorPanel.classList.remove("hidden");
  els.editorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditor() {
  editingPostId = null;
  els.postForm.reset();
  els.postPublished.checked = true;
  els.postPreview.innerHTML = "";
  els.cancelEditButton.classList.add("hidden");
  els.editorPanel.classList.add("hidden");
}

async function savePost(event) {
  event.preventDefault();

  if (!canWritePosts()) {
    showNotice("Only the owner and approved contributors can write posts.", true);
    return;
  }

  if (!currentUser.emailVerified) {
    showNotice("Verify your email before writing posts.", true);
    return;
  }

  const title = els.postTitle.value.trim();
  const body = els.postBody.value.trim();
  const tags = parseTags(els.postTags.value);
  if (!title || !body) return;

  const payload = {
    title,
    slug: makeSlug(title),
    tags,
    body,
    published: els.postPublished.checked,
    updatedAt: serverTimestamp()
  };

  try {
    if (editingPostId) {
      await updateDoc(doc(db, "posts", editingPostId), payload);
      showNotice("Entry updated.");
    } else {
      await addDoc(collection(db, "posts"), {
        ...payload,
        authorUid: currentUser.uid,
        authorEmail: currentUser.email,
        authorName: currentUser.displayName || currentUser.email.split("@")[0],
        createdAt: serverTimestamp()
      });
      showNotice("Entry published.");
    }
    closeEditor();
  } catch (error) {
    showNotice(error.message, true);
  }
}

async function deletePost(postId) {
  const ok = window.confirm("Delete this entry? Comments and likes under it will remain in Firestore unless you delete them separately.");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "posts", postId));
    showNotice("Entry deleted.");
  } catch (error) {
    showNotice(error.message, true);
  }
}

function passesSearch(post) {
  const term = els.searchInput.value.trim().toLowerCase();
  if (!term) return true;

  return [post.title, post.body, ...(Array.isArray(post.tags) ? post.tags : [])]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(term));
}

function updateStats() {
  const posts = readablePosts();
  const ids = new Set(posts.map(post => post.id));

  const totalLikes = [...likeCountsByPost.entries()]
    .filter(([postId]) => ids.has(postId))
    .reduce((sum, [, count]) => sum + count, 0);

  const totalComments = [...commentCountsByPost.entries()]
    .filter(([postId]) => ids.has(postId))
    .reduce((sum, [, count]) => sum + count, 0);

  els.statsEntries.textContent = String(posts.length);
  els.statsLikes.textContent = String(totalLikes);
  els.statsComments.textContent = String(totalComments);
}

function isInteractiveClick(target) {
  return Boolean(target.closest("a, button, input, textarea, select, summary, details, form"));
}

function activateCard(node) {
  document.querySelectorAll(".post-card.active").forEach(card => card.classList.remove("active"));
  node.classList.add("active");
}

function fillPostNode(node, post, { full = false } = {}) {
  const title = $(".post-title", node);
  const meta = $(".post-meta", node);
  const content = $(".post-content", node);
  const readLink = $(".read-post-link", node);

  title.textContent = post.title;
  const tagText = formatTags(post.tags);
  meta.textContent = `${formatDate(post.createdAt)}${tagText ? " — " + tagText : ""}${post.published ? "" : " · draft"}`;

  const postUrl = `${window.location.origin}${window.location.pathname}#/post/${encodeURIComponent(post.id)}`;
  readLink.href = postUrl;

  if (full) {
    node.classList.add("active", "single-post-card");
    renderMarkdownWithLatex(post.body, content);
  } else {
    content.classList.add("excerpt");
    const excerpt = makeExcerpt(post.body);
    content.innerHTML = excerpt ? `<p>${escapeHtml(excerpt)}</p>` : "";
  }

  title.addEventListener("click", () => {
    if (full) return;
    activateCard(node);
    window.open(postUrl, "_blank", "noopener");
  });

  const postActions = $(".post-actions", node);
  const canEditThis = canManageContributors() || (canWritePosts() && post.authorUid === currentUser?.uid);

  postActions.classList.toggle("hidden", !canEditThis);
  $(".edit-post", node).addEventListener("click", () => openEditor(post));
  $(".delete-post", node).addEventListener("click", () => deletePost(post.id));

  node.addEventListener("click", event => {
    if (!isInteractiveClick(event.target)) activateCard(node);
  });

  attachLikes(post.id, node);
  attachComments(post.id, node);
}

function renderPosts() {
  clearChildListeners();
  const visiblePosts = readablePosts().filter(passesSearch);
  updateStats();

  els.postsList.innerHTML = "";

  if (visiblePosts.length === 0) {
    els.postsList.innerHTML = `<div class="empty-state">No entries yet.</div>`;
    return;
  }

  for (const post of visiblePosts) {
    const node = els.postTemplate.content.firstElementChild.cloneNode(true);
    fillPostNode(node, post, { full: false });
    els.postsList.appendChild(node);
  }
}

function renderSinglePost(postId) {
  clearChildListeners();
  els.singlePostContainer.innerHTML = "";

  const post = readablePosts().find(item => item.id === postId);

  if (!post) {
    els.singlePostContainer.innerHTML = `<div class="empty-state">${hasLoadedPosts ? "Entry not found, private, or unpublished." : "Loading entry..."}</div>`;
    return;
  }

  const node = els.postTemplate.content.firstElementChild.cloneNode(true);
  fillPostNode(node, post, { full: true });
  els.singlePostContainer.appendChild(node);
}

function attachLikes(postId, postNode) {
  const likeButton = $(".like-button", postNode);
  const likeCount = $(".like-count", postNode);
  const likesRef = collection(db, "posts", postId, "likes");

  const unsubscribeLikes = onSnapshot(likesRef, snapshot => {
    likeCountsByPost.set(postId, snapshot.size);
    likeCount.textContent = `${snapshot.size} ${snapshot.size === 1 ? "like" : "likes"}`;

    if (currentUser) {
      const liked = snapshot.docs.some(docSnap => docSnap.id === currentUser.uid);
      likeButton.classList.toggle("liked", liked);
      likeButton.classList.remove("requires-login");
      likeButton.textContent = liked ? "♥ Liked" : "♡ Like";
    } else {
      likeButton.classList.remove("liked");
      likeButton.classList.add("requires-login");
      likeButton.textContent = "♡ Log in to like";
    }

    updateStats();
  });
  unsubscribeChildListeners.push(unsubscribeLikes);

  likeButton.addEventListener("click", async () => {
    if (!currentUser) {
      window.location.hash = "#/login";
      return;
    }

    if (!currentUser.emailVerified) {
      showNotice("Verify your email before liking entries.", true);
      return;
    }

    const likeRef = doc(db, "posts", postId, "likes", currentUser.uid);
    const snap = await getDoc(likeRef);

    try {
      if (snap.exists()) {
        await deleteDoc(likeRef);
      } else {
        await setDoc(likeRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      showNotice(error.message, true);
    }
  });
}

function updateCommentFormState(postNode) {
  const commentForm = $(".comment-form", postNode);
  const note = $(".comment-login-note", postNode);

  if (!currentUser) {
    commentForm.classList.add("hidden");
    note.classList.remove("hidden");
    note.innerHTML = `<a href="#/login">Log in</a> to leave a comment.`;
    return;
  }

  if (!currentUser.emailVerified) {
    commentForm.classList.add("hidden");
    note.classList.remove("hidden");
    note.textContent = "Verify your email before leaving a comment.";
    return;
  }

  commentForm.classList.remove("hidden");
  note.classList.add("hidden");
  note.textContent = "";
}

function attachComments(postId, postNode) {
  const commentsList = $(".comments-list", postNode);
  const commentCount = $(".comment-count", postNode);
  const commentForm = $(".comment-form", postNode);
  const commentInput = $(".comment-input", postNode);
  const commentsRef = collection(db, "posts", postId, "comments");

  updateCommentFormState(postNode);

  const q = query(commentsRef, orderBy("createdAt", "asc"));

  const unsubscribeComments = onSnapshot(q, snapshot => {
    commentCountsByPost.set(postId, snapshot.size);
    commentCount.textContent = `${snapshot.size} ${snapshot.size === 1 ? "comment" : "comments"}`;
    commentsList.innerHTML = "";

    if (snapshot.empty) {
      commentsList.innerHTML = `<p class="muted">No comments yet.</p>`;
      updateStats();
      return;
    }

    for (const commentSnap of snapshot.docs) {
      const comment = commentSnap.data();
      const div = document.createElement("div");
      div.className = "comment";

      const header = document.createElement("div");
      header.className = "comment-header";
      header.innerHTML = `
        <span>${escapeHtml(comment.authorName || comment.authorEmail || "Reader")}</span>
        <span>${formatDate(comment.createdAt)}</span>
      `;

      const p = document.createElement("p");
      p.textContent = comment.text;

      div.append(header, p);

      const canDelete = canManageContributors() || (currentUser && comment.authorUid === currentUser.uid);

      if (canDelete) {
        const del = document.createElement("button");
        del.className = "button small danger";
        del.type = "button";
        del.textContent = "Delete";
        del.addEventListener("click", async () => {
          await deleteDoc(doc(db, "posts", postId, "comments", commentSnap.id));
        });
        div.appendChild(del);
      }

      commentsList.appendChild(div);
    }

    updateStats();
  });
  unsubscribeChildListeners.push(unsubscribeComments);

  commentForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentUser) {
      window.location.hash = "#/login";
      return;
    }

    if (!currentUser.emailVerified) {
      showNotice("Verify your email before commenting.", true);
      return;
    }

    const text = commentInput.value.trim();
    if (!text) return;

    try {
      await addDoc(commentsRef, {
        text,
        authorUid: currentUser.uid,
        authorEmail: currentUser.email,
        authorName: currentUser.displayName || currentUser.email.split("@")[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      commentInput.value = "";
    } catch (error) {
      showNotice(error.message, true);
    }
  });
}

function listenToPosts() {
  if (unsubscribePosts) {
    unsubscribePosts();
    unsubscribePosts = null;
  }

  // Logged-out readers use a single-field query so Firestore does not require a composite index.
  // We sort client-side after loading.
  const postsQuery = canWritePosts()
    ? query(collection(db, "posts"), orderBy("createdAt", "desc"))
    : query(collection(db, "posts"), where("published", "==", true));

  unsubscribePosts = onSnapshot(postsQuery, snapshot => {
    hasLoadedPosts = true;
    allPosts = snapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
    renderCurrentRoute();
  }, error => {
    hasLoadedPosts = true;
    if (getRoute().view === "post") {
      els.singlePostContainer.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    } else {
      els.postsList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  });
}

async function updateContributorRole(event) {
  event.preventDefault();

  if (!canManageContributors()) {
    showNotice("Only the owner/admin can manage contributors.", true);
    return;
  }

  const email = els.contributorEmail.value.trim();
  const role = els.contributorRole.value;

  try {
    const usersQuery = query(collection(db, "users"), where("email", "==", email));
    const snapshot = await getDocs(usersQuery);

    if (snapshot.empty) {
      els.contributorResult.textContent = "No registered user found with that email. Ask them to register first.";
      return;
    }

    const userDoc = snapshot.docs[0];
    await updateDoc(doc(db, "users", userDoc.id), {
      role,
      updatedAt: serverTimestamp()
    });

    els.contributorResult.textContent = `${email} is now ${role}.`;
    els.contributorForm.reset();
  } catch (error) {
    els.contributorResult.textContent = error.message;
  }
}

els.authButton.addEventListener("click", () => { window.location.hash = "#/login"; });
els.registerNavButton.addEventListener("click", () => { window.location.hash = "#/register"; });

els.logoutButton.addEventListener("click", async () => {
  await signOut(auth);
  window.location.hash = "#/";
  showNotice("Logged out.");
});

els.verifyEmailButton.addEventListener("click", sendVerification);
els.loginForm.addEventListener("submit", loginWithEmail);
els.loginGoogleButton.addEventListener("click", () => loginWithGoogle(els.loginMessage));
els.registerForm.addEventListener("submit", registerWithEmail);
els.registerGoogleButton.addEventListener("click", () => loginWithGoogle(els.registerMessage));

els.newPostButton.addEventListener("click", () => openEditor());
els.cancelEditButton.addEventListener("click", closeEditor);
els.postForm.addEventListener("submit", savePost);
els.postBody.addEventListener("input", () => renderMarkdownWithLatex(els.postBody.value, els.postPreview));

els.manageContributorsButton.addEventListener("click", () => {
  els.adminPanel.classList.toggle("hidden");
  if (!els.adminPanel.classList.contains("hidden")) {
    els.adminPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

els.contributorForm.addEventListener("submit", updateContributorRole);
els.searchInput.addEventListener("input", renderPosts);
window.addEventListener("hashchange", renderCurrentRoute);

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (user) {
    try {
      currentProfile = await ensureUserDocument(user);
    } catch (error) {
      showNotice(error.message, true);
      currentProfile = null;
    }
  } else {
    currentProfile = null;
  }

  updateAuthUi();
  listenToPosts();
  renderCurrentRoute();
});