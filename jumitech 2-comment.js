(function () {
  if (window.jumiCommentsLoaded) return;
  window.jumiCommentsLoaded = true;

  /* ===============================
     CONFIG
     =============================== */
  const ADMIN_UID = "CSa8pXYawsSLKwQQKWTBypj1YD42";
  const RESERVED_NAME = "jumitech";
  const THROTTLE_MS = 45000;

  const firebaseConfig = {
    apiKey: "AIzaSyDS0hkaHQd0NhvGOIEHu-saapF0VulJkXo",
    authDomain: "jumitech-comments.firebaseapp.com",
    projectId: "jumitech-comments",
    storageBucket: "jumitech-comments.firebasestorage.app",
    messagingSenderId: "815273959476",
    appId: "1:815273959476:web:959cbb1b17456d3f2e6a61",
    measurementId: "G-87B358GKT1",
  };

  if (!window.firebase || !firebase.apps) return;
  if (firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);

  const db = firebase.firestore();
  const auth = firebase.auth ? firebase.auth() : null;

  /* ===============================
     HELPERS
     =============================== */
  function safeTrim(v) {
    return (v || "").toString().trim();
  }

  function getPostId() {
    const canon = document.querySelector('link[rel="canonical"]');
    return (canon ? canon.href : window.location.href)
      .split("#")[0]
      .split("?")[0];
  }

  function getInitials(name) {
    const n = safeTrim(name);
    if (!n) return "?";
    const p = n.split(/\s+/);
    return p.length === 1
      ? p[0].substring(0, 2).toUpperCase()
      : (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function avatarGradient(name) {
    const h = hashString(name || "guest") % 360;
    return `linear-gradient(135deg, hsl(${h},70%,55%), hsl(${(h + 30) % 360},70%,45%))`;
  }

  function formatDate(ts) {
    try {
      return ts?.toDate ? ts.toDate().toLocaleString() : "";
    } catch {
      return "";
    }
  }

  function closeAllReplyForms() {
    document.querySelectorAll(".jumi-reply-form").forEach(f => {
      f.style.display = "none";
    });
  }
  // ===============================
// REPLY IDENTITY HELPERS
// ===============================
function getSessionName() {
  return sessionStorage.getItem("jumi_reply_name") || "";
}

function getSessionEmail() {
  return sessionStorage.getItem("jumi_reply_email") || "";
}

function setSessionIdentity(name, email) {
  if (name) sessionStorage.setItem("jumi_reply_name", name);
  if (email) sessionStorage.setItem("jumi_reply_email", email);
}

  /* ===============================
     REPLY UI + SAVE
     =============================== */
  function attachReplyUI(commentEl, data) {
    if (!commentEl || data.isReply === true) return;
    if (commentEl.querySelector(".jumi-reply-btn")) return;

    const parentId = commentEl.dataset.commentId;
    if (!parentId) return;

    const replyBtn = document.createElement("button");
    replyBtn.className = "jumi-reply-btn";
    replyBtn.textContent = "Reply";

    const form = document.createElement("div");
    form.className = "jumi-reply-form";

    const textarea = document.createElement("textarea");
    textarea.placeholder = "Write a reply…";

    const actions = document.createElement("div");
    actions.className = "jumi-reply-actions";

    const submitBtn = document.createElement("button");
    submitBtn.className = "jumi-reply-submit";
    submitBtn.textContent = "Post reply";
    submitBtn.type = "button";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "jumi-reply-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.type = "button";

    actions.appendChild(submitBtn);
    actions.appendChild(cancelBtn);
    form.appendChild(textarea);
    form.appendChild(actions);

    replyBtn.onclick = () => {
      closeAllReplyForms();
      form.style.display = "block";
      textarea.focus();
    };

    cancelBtn.onclick = () => {
      form.style.display = "none";
      textarea.value = "";
    };

    submitBtn.onclick = async () => {
  const replyText = safeTrim(textarea.value);
  if (!replyText) return;

  const user = auth?.currentUser || null;
  const isAdmin = user && user.uid === ADMIN_UID;

  let name = "";
  let email = "";

  if (isAdmin) {
    name = "Jumitech";
  } else {
    // Try main form first
    const mainName = safeTrim(document.getElementById("jumi-name")?.value);
    const mainEmail = safeTrim(document.getElementById("jumi-email")?.value);

    name = mainName || getSessionName();
    email = mainEmail || getSessionEmail();

    // If still no name → prompt inline
    if (!name) {
      // Inject identity fields once
      if (!form.querySelector(".jumi-reply-name")) {
        const nameInput = document.createElement("input");
        nameInput.className = "jumi-reply-name";
        nameInput.placeholder = "Your name (required)";
        nameInput.style.marginTop = "6px";

        const emailInput = document.createElement("input");
        emailInput.className = "jumi-reply-email";
        emailInput.placeholder = "Email (optional)";
        emailInput.type = "email";
        emailInput.style.marginTop = "6px";

        form.insertBefore(emailInput, textarea);
        form.insertBefore(nameInput, emailInput);

        alert("Please enter your name to post a reply.");
        return;
      }

      // Read injected fields
      name = safeTrim(form.querySelector(".jumi-reply-name")?.value);
      email = safeTrim(form.querySelector(".jumi-reply-email")?.value);

      if (!name) {
        alert("Name is required.");
        return;
      }
    }
  }

  submitBtn.disabled = true;

  try {
    await db.collection("jumitech_comments").add({
      postId: getPostId(),
      parentId: parentId,
      isReply: true,
      comment: replyText,
      name: name,
      email: email || null,
      isAdmin: isAdmin === true,
      adminUid: isAdmin ? user.uid : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isApproved: true,
    });

    // Cache identity for session
    if (!isAdmin) setSessionIdentity(name, email);

    textarea.value = "";
    form.style.display = "none";
  } catch (e) {
    alert("Failed to post reply. Try again.");
    console.error(e);
  } finally {
    submitBtn.disabled = false;
  }
};

    commentEl.appendChild(replyBtn);
    commentEl.appendChild(form);
  }

  /* ===============================
     RENDER COMMENT
     =============================== */
  function renderComment(data, docId) {
    const item = document.createElement("div");
    item.className = "jumi-comment-item";
    item.dataset.commentId = docId;

    const avatar = document.createElement("div");
    avatar.className = "jumi-comment-avatar";
    avatar.textContent = getInitials(data.name || "Guest");
    avatar.style.backgroundImage = avatarGradient(data.name || "Guest");

    const content = document.createElement("div");
    content.className = "jumi-comment-content";

    const header = document.createElement("div");
    header.className = "jumi-comment-header";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.gap = "8px";
    left.style.alignItems = "center";

    const nameEl = document.createElement("span");
    nameEl.className = "jumi-comment-name";
    nameEl.textContent = data.name || "Guest";
    left.appendChild(nameEl);

    if (data.isAdmin === true) {
      const badge = document.createElement("span");
      badge.className = "jumi-admin-badge";
      badge.textContent = "Admin";
      left.appendChild(badge);
    }

    const dateEl = document.createElement("span");
    dateEl.className = "jumi-comment-date";
    dateEl.textContent = formatDate(data.createdAt);

    header.appendChild(left);
    header.appendChild(dateEl);

    const body = document.createElement("div");
    body.className = "jumi-comment-body";
    body.textContent = data.comment || "";

    content.appendChild(header);
    content.appendChild(body);

    item.appendChild(avatar);
    item.appendChild(content);

    return item;
  }

  /* ===============================
     INIT + GROUPING (STEP 3)
     =============================== */
  function init() {
    const listEl = document.getElementById("jumi-comments-list");
    if (!listEl) return false;

    const postId = getPostId();

    db.collection("jumitech_comments")
      .where("postId", "==", postId)
      .where("isApproved", "==", true)
      .orderBy("createdAt", "asc")
      .onSnapshot((snap) => {
        listEl.innerHTML = "";

        const parents = [];
        const repliesByParent = {};

        snap.forEach((doc) => {
          const data = doc.data();
          const id = doc.id;

          if (data.isReply === true && data.parentId) {
            if (!repliesByParent[data.parentId]) {
              repliesByParent[data.parentId] = [];
            }
            repliesByParent[data.parentId].push({ data, id });
          } else {
            parents.push({ data, id });
          }
        });

       parents.forEach(({ data, id }) => {
  const parentEl = renderComment(data, id);
  attachReplyUI(parentEl, data);

  const replies = repliesByParent[id] || [];

  if (replies.length > 0) {
    // Toggle button
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "jumi-toggle-replies";
    toggleBtn.type = "button";
    toggleBtn.textContent = `View ${replies.length} repl${replies.length === 1 ? "y" : "ies"} ▾`;

    // Replies container
    const repliesWrap = document.createElement("div");
    repliesWrap.className = "jumi-replies is-collapsed";

    replies.forEach(({ data: rData, id: rId }) => {
      const replyEl = renderComment(rData, rId);
      repliesWrap.appendChild(replyEl);
    });

    let open = false;
    toggleBtn.onclick = () => {
      open = !open;
      repliesWrap.classList.toggle("is-collapsed", !open);
      toggleBtn.textContent = open
        ? "Hide replies ▴"
        : `View ${replies.length} repl${replies.length === 1 ? "y" : "ies"} ▾`;
    };

    parentEl.appendChild(toggleBtn);
    parentEl.appendChild(repliesWrap);
  }

  listEl.appendChild(parentEl);
});
      });

    return true;
  }

  (function wait() {
    if (init()) return;
    setTimeout(wait, 150);
  })();
})();
