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
  authButton: $("#authButton"),
  logoutButton: $("#logoutButton"),
  authDialog: $("#authDialog"),
  authEmail: $("#authEmail"),
  authPassword: $("#authPassword"),
  loginEmailButton: $("#loginEmailButton"),
  registerEmailButton: $("#registerEmailButton"),
  googleButton: $("#googleButton"),
  verifyEmailButton: $("#verifyEmailButton"),
  authMessage: $("#authMessage"),
  userBadge: $("#userBadge"),
  notice: $("#notice"),

  newPostButton: $("#newPostButton"),
  manageContributorsButton: $("#manageContributorsButton"),
  editorPanel: $("#editorPanel"),
  postForm: $("#postForm"),
  postTitle: $("#postTitle"),
  postBody: $("#postBody"),
  postPublished: $("#postPublished"),
  postPreview: $("#postPreview"),
  cancelEditButton: $("#cancelEditButton"),

  adminPanel: $("#adminPanel"),
  contributorForm: $("#contributorForm"),
  contributorEmail: $("#contributorEmail"),
  contributorRole: $("#contributorRole"),
  contributorResult: $("#contributorResult"),

  searchInput: $("#searchInput"),
  postsList: $("#postsList"),
  postTemplate: $("#postTemplate")
};

let currentUser = null;
let currentProfile = null;
let allPosts = [];
let editingPostId = null;
let unsubscribePosts = null;
let unsubscribeChildListeners = [];

function showNotice(message, isError = false) {
  els.notice.textContent = message;
  els.notice.classList.remove("hidden");
  els.notice.style.color = isError ? "var(--danger)" : "var(--accent-strong)";
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
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ]
    });
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
    els.logoutButton.classList.add("hidden");
    els.userBadge.textContent = "";
    els.newPostButton.classList.add("hidden");
    els.manageContributorsButton.classList.add("hidden");
    els.editorPanel.classList.add("hidden");
    els.adminPanel.classList.add("hidden");
    els.verifyEmailButton.classList.add("hidden");
    return;
  }

  const role = userRole();
  const verifiedLabel = currentUser.emailVerified ? "" : " · verify email";
  els.userBadge.textContent = `${currentUser.email} · ${role}${verifiedLabel}`;
  els.authButton.classList.add("hidden");
  els.logoutButton.classList.remove("hidden");

  els.verifyEmailButton.classList.toggle("hidden", currentUser.emailVerified);
  els.newPostButton.classList.toggle("hidden", !canWritePosts());
  els.manageContributorsButton.classList.toggle("hidden", !canManageContributors());

  if (!canWritePosts()) {
    els.editorPanel.classList.add("hidden");
  }

  if (!canManageContributors()) {
    els.adminPanel.classList.add("hidden");
  }
}

async function registerWithEmail() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: email.split("@")[0] });
    await sendEmailVerification(credential.user);
    els.authMessage.textContent = "Account created. Check your email to verify it before posting/commenting.";
  } catch (error) {
    els.authMessage.textContent = error.message;
  }
}

async function loginWithEmail() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    els.authDialog.close();
    showNotice("Logged in.");
  } catch (error) {
    els.authMessage.textContent = error.message;
  }
}

async function loginWithGoogle() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    els.authDialog.close();
    showNotice("Logged in with Google.");
  } catch (error) {
    els.authMessage.textContent = error.message;
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

  editingPostId = post?.id || null;
  els.postTitle.value = post?.title || "";
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

  if (!title || !body) return;

  const payload = {
    title,
    slug: makeSlug(title),
    body,
    published: els.postPublished.checked,
    updatedAt: serverTimestamp()
  };

  try {
    if (editingPostId) {
      await updateDoc(doc(db, "posts", editingPostId), payload);
      showNotice("Post updated.");
    } else {
      await addDoc(collection(db, "posts"), {
        ...payload,
        authorUid: currentUser.uid,
        authorEmail: currentUser.email,
        authorName: currentUser.displayName || currentUser.email.split("@")[0],
        createdAt: serverTimestamp()
      });
      showNotice("Post published.");
    }
    closeEditor();
  } catch (error) {
    showNotice(error.message, true);
  }
}

async function deletePost(postId) {
  const ok = window.confirm("Delete this post? Comments and likes under it will remain in Firestore unless you delete them separately.");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "posts", postId));
    showNotice("Post deleted.");
  } catch (error) {
    showNotice(error.message, true);
  }
}

function passesSearch(post) {
  const term = els.searchInput.value.trim().toLowerCase();
  if (!term) return true;
  return [post.title, post.body, post.authorName, post.authorEmail]
    .filter(Boolean)
    .some(value => value.toLowerCase().includes(term));
}

function renderPosts() {
  for (const unsubscribe of unsubscribeChildListeners) unsubscribe();
  unsubscribeChildListeners = [];

  const visiblePosts = allPosts.filter(post => {
    if (!post.published && !canWritePosts()) return false;
    return passesSearch(post);
  });

  els.postsList.innerHTML = "";

  if (visiblePosts.length === 0) {
    els.postsList.innerHTML = `<div class="empty-state">No posts yet.</div>`;
    return;
  }

  for (const post of visiblePosts) {
    const node = els.postTemplate.content.firstElementChild.cloneNode(true);

    $(".post-title", node).textContent = post.title;
    $(".post-meta", node).textContent = `${post.authorName || post.authorEmail || "Unknown"} · ${formatDate(post.createdAt)}${post.published ? "" : " · draft"}`;

    renderMarkdownWithLatex(post.body, $(".post-content", node));

    const postActions = $(".post-actions", node);
    const canEditThis =
      canManageContributors() ||
      (canWritePosts() && post.authorUid === currentUser?.uid);

    postActions.classList.toggle("hidden", !canEditThis);
    $(".edit-post", node).addEventListener("click", () => openEditor(post));
    $(".delete-post", node).addEventListener("click", () => deletePost(post.id));

    attachLikes(post.id, node);
    attachComments(post.id, node);

    els.postsList.appendChild(node);
  }
}

function attachLikes(postId, postNode) {
  const likeButton = $(".like-button", postNode);
  const likeCount = $(".like-count", postNode);
  const likesRef = collection(db, "posts", postId, "likes");

  const unsubscribeLikes = onSnapshot(likesRef, snapshot => {
    likeCount.textContent = `${snapshot.size} ${snapshot.size === 1 ? "like" : "likes"}`;

    if (currentUser) {
      const liked = snapshot.docs.some(docSnap => docSnap.id === currentUser.uid);
      likeButton.classList.toggle("liked", liked);
      likeButton.textContent = liked ? "♥ Liked" : "♡ Like";
    } else {
      likeButton.classList.remove("liked");
      likeButton.textContent = "♡ Like";
    }
  });
  unsubscribeChildListeners.push(unsubscribeLikes);

  likeButton.addEventListener("click", async () => {
    if (!currentUser) {
      els.authDialog.showModal();
      return;
    }

    if (!currentUser.emailVerified) {
      showNotice("Verify your email before liking posts.", true);
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

function attachComments(postId, postNode) {
  const commentsList = $(".comments-list", postNode);
  const commentCount = $(".comment-count", postNode);
  const commentForm = $(".comment-form", postNode);
  const commentInput = $(".comment-input", postNode);
  const commentsRef = collection(db, "posts", postId, "comments");

  const q = query(commentsRef, orderBy("createdAt", "asc"));

  const unsubscribeComments = onSnapshot(q, snapshot => {
    commentCount.textContent = `${snapshot.size} ${snapshot.size === 1 ? "comment" : "comments"}`;
    commentsList.innerHTML = "";

    if (snapshot.empty) {
      commentsList.innerHTML = `<p class="muted">No comments yet.</p>`;
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

      const canDelete =
        canManageContributors() ||
        (currentUser && comment.authorUid === currentUser.uid);

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
  });
  unsubscribeChildListeners.push(unsubscribeComments);

  commentForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentUser) {
      els.authDialog.showModal();
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function listenToPosts() {
  if (unsubscribePosts) {
    unsubscribePosts();
    unsubscribePosts = null;
  }

  // Firestore rules reject queries that might return documents the user cannot read.
  // Readers get only published posts; writers/admins can also see drafts.
  const postsQuery = canWritePosts()
    ? query(collection(db, "posts"), orderBy("createdAt", "desc"))
    : query(collection(db, "posts"), where("published", "==", true), orderBy("createdAt", "desc"));

  unsubscribePosts = onSnapshot(postsQuery, snapshot => {
    allPosts = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    renderPosts();
  }, error => {
    els.postsList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
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

els.authButton.addEventListener("click", () => els.authDialog.showModal());
els.logoutButton.addEventListener("click", async () => {
  await signOut(auth);
  showNotice("Logged out.");
});

els.loginEmailButton.addEventListener("click", loginWithEmail);
els.registerEmailButton.addEventListener("click", registerWithEmail);
els.googleButton.addEventListener("click", loginWithGoogle);
els.verifyEmailButton.addEventListener("click", sendVerification);

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
});
