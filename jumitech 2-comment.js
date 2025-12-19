(function () {
  // Run once
  if (window.jumiCommentsLoaded) return;
  window.jumiCommentsLoaded = true;

  // ====== CONFIG ======
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
    measurementId: "G-87B358GKT1"
  };

  if (!window.firebase || !firebase.apps) return;
  if (firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);

  const db = firebase.firestore();
  const auth = firebase.auth ? firebase.auth() : null;

  /* ===============================
     HELPERS (UNCHANGED)
     =============================== */
  function safeTrim(v) { return (v || "").toString().trim(); }
  function isReservedName(n) { return safeTrim(n).toLowerCase() === RESERVED_NAME; }
  function getPostId() {
    const canon = document.querySelector('link[rel="canonical"]');
    return (canon ? canon.href : location.href).split("#")[0].split("?")[0];
  }

  /* ===============================
     SESSION IDENTITY (ADDED)
     =============================== */
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
     INLINE REPLIES (ADDED)
     =============================== */
  function closeAllReplyForms() {
    document.querySelectorAll(".jumi-reply-form").forEach(f => f.style.display = "none");
  }

  function attachReplyUI(commentEl, data) {
    if (!commentEl || data.isReply === true) return;
    if (commentEl.querySelector(".jumi-reply-btn")) return;

    const parentId = commentEl.dataset.commentId;
    if (!parentId) return;

    const replyBtn = document.createElement("button");
    replyBtn.className = "jumi-reply-btn";
    replyBtn.type = "button";
    replyBtn.textContent = "Reply";

    const form = document.createElement("div");
    form.className = "jumi-reply-form";
    form.style.display = "none";

    const textarea = document.createElement("textarea");
    textarea.placeholder = "Write a reply…";

    const actions = document.createElement("div");
    actions.className = "jumi-reply-actions";

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "Post reply";
    submitBtn.type = "button";

    const cancelBtn = document.createElement("button");
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
        const mainName = safeTrim(document.getElementById("jumi-name")?.value);
        const mainEmail = safeTrim(document.getElementById("jumi-email")?.value);

        name = mainName || getSessionName();
        email = mainEmail || getSessionEmail();

        if (!name) {
          if (!form.querySelector(".jumi-reply-name")) {
            const nameInput = document.createElement("input");
            nameInput.className = "jumi-reply-name";
            nameInput.placeholder = "Your name (required)";

            const emailInput = document.createElement("input");
            emailInput.className = "jumi-reply-email";
            emailInput.placeholder = "Email (optional)";
            emailInput.type = "email";

            form.insertBefore(emailInput, textarea);
            form.insertBefore(nameInput, emailInput);
            alert("Please enter your name to reply.");
            return;
          }

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
          parentId,
          isReply: true,
          name,
          email: email || null,
          comment: replyText,
          isAdmin: isAdmin === true,
          adminUid: isAdmin ? user.uid : null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          isApproved: true
        });

        if (!isAdmin) setSessionIdentity(name, email);
        textarea.value = "";
        form.style.display = "none";
      } catch (e) {
        alert("Failed to post reply.");
        console.error(e);
      } finally {
        submitBtn.disabled = false;
      }
    };

    commentEl.appendChild(replyBtn);
    commentEl.appendChild(form);
  }

  /* ===============================
     RENDER & GROUP (EXTENSION)
     =============================== */
  function renderThread(listEl, snap) {
    listEl.innerHTML = "";

    const parents = [];
    const replies = {};

    snap.forEach(doc => {
      const d = doc.data();
      if (d.isReply && d.parentId) {
        if (!replies[d.parentId]) replies[d.parentId] = [];
        replies[d.parentId].push({ d, id: doc.id });
      } else {
        parents.push({ d, id: doc.id });
      }
    });

    parents.forEach(({ d, id }) => {
      const el = renderComment(d);
      el.dataset.commentId = id;
      attachReplyUI(el, d);

      const child = replies[id] || [];
      if (child.length) {
        const toggle = document.createElement("button");
        toggle.className = "jumi-toggle-replies";
        toggle.textContent = `View ${child.length} replies ▾`;

        const wrap = document.createElement("div");
        wrap.className = "jumi-replies is-collapsed";

        child.forEach(r => {
          const rEl = renderComment(r.d);
          wrap.appendChild(rEl);
        });

        let open = false;
        toggle.onclick = () => {
          open = !open;
          wrap.classList.toggle("is-collapsed", !open);
          toggle.textContent = open ? "Hide replies ▴" : `View ${child.length} replies ▾`;
        };

        el.appendChild(toggle);
        el.appendChild(wrap);
      }

      listEl.appendChild(el);
    });
  }

  /* ===============================
     INIT (UNCHANGED ENTRY)
     =============================== */
  function initJumiComments() {
    const listEl = document.getElementById("jumi-comments-list");
    if (!listEl) return false;

    const postId = getPostId();
    db.collection("jumitech_comments")
      .where("postId", "==", postId)
      .where("isApproved", "==", true)
      .orderBy("createdAt", "asc")
      .onSnapshot(snap => renderThread(listEl, snap));

    return true;
  }

  (function wait() {
    if (initJumiComments()) return;
    setTimeout(wait, 150);
  })();
})();
