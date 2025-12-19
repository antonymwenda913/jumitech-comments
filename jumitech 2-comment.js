(function () {
  // Prevent double execution
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

  if (!window.firebase || !firebase.apps) {
    console.error("Firebase SDK missing");
    return;
  }

  if (firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth ? firebase.auth() : null;

  /* ===============================
     HELPERS
     =============================== */
  function safeTrim(v) {
    return (v || "").toString().trim();
  }

  function isReservedName(name) {
    return safeTrim(name).toLowerCase() === RESERVED_NAME;
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
    if (p.length === 1) return p[0].substring(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
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

  /* ===============================
     REPLY UI (STEP 1)
     =============================== */
  function closeAllReplyForms() {
    document.querySelectorAll(".jumi-reply-form").forEach((f) => {
      f.style.display = "none";
    });
  }

  function attachReplyUI(commentEl, isReply) {
    if (!commentEl || isReply) return;
    if (commentEl.querySelector(".jumi-reply-btn")) return;

    const replyBtn = document.createElement("button");
    replyBtn.className = "jumi-reply-btn";
    replyBtn.type = "button";
    replyBtn.textContent = "Reply";

    const repliesWrap = document.createElement("div");
    repliesWrap.className = "jumi-replies";

    const form = document.createElement("div");
    form.className = "jumi-reply-form";

    const textarea = document.createElement("textarea");
    textarea.placeholder = "Write a reply…";

    const actions = document.createElement("div");
    actions.className = "jumi-reply-actions";

    const submitBtn = document.createElement("button");
    submitBtn.className = "jumi-reply-submit";
    submitBtn.type = "button";
    submitBtn.textContent = "Post reply";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "jumi-reply-cancel";
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";

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

    submitBtn.onclick = () => {
      alert("Replies will be saved in STEP 2.");
    };

    commentEl.appendChild(replyBtn);
    commentEl.appendChild(form);
    commentEl.appendChild(repliesWrap);
  }

  /* ===============================
     INIT (TIMING SAFE)
     =============================== */
  function init() {
    const form = document.getElementById("jumi-comment-form");
    const nameInput = document.getElementById("jumi-name");
    const emailInput = document.getElementById("jumi-email");
    const commentInput = document.getElementById("jumi-comment");
    const submitBtn = document.getElementById("jumi-submit-btn");
    const listEl = document.getElementById("jumi-comments-list");
    const countEl = document.getElementById("jumi-comments-count");
    const messageEl = document.getElementById("jumi-form-message");

    if (!form || !listEl) return false;

    const postId = getPostId();
    const commentsRef = db.collection("jumitech_comments");

    function showMsg(t, e) {
      if (!messageEl) return;
      messageEl.textContent = t;
      messageEl.className = "jumi-form-message";
      if (e === "error") messageEl.classList.add("jumi-form-message--error");
      if (e === "success") messageEl.classList.add("jumi-form-message--success");
    }

    /* ===============================
       RENDER COMMENT
       =============================== */
    function renderComment(data, docId) {
      const item = document.createElement("div");
      item.className = "jumi-comment-item";
      item.dataset.commentId = docId;
      if (data.isReply === true) item.dataset.isReply = "1";

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
       LOAD COMMENTS
       =============================== */
    commentsRef
      .where("postId", "==", postId)
      .where("isApproved", "==", true)
      .orderBy("createdAt", "asc")
      .onSnapshot((snap) => {
        listEl.innerHTML = "";
        let count = 0;

        snap.forEach((doc) => {
          const data = doc.data();
          const el = renderComment(data, doc.id);
          attachReplyUI(el, data.isReply === true);
          listEl.appendChild(el);
          count++;
        });

        countEl.textContent = `${count} comment${count === 1 ? "" : "s"}`;
      });

    return true;
  }

  (function wait() {
    if (init()) return;
    setTimeout(wait, 150);
  })();
})();
