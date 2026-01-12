(function () {
  // Run once
  if (window.jumiCommentsLoaded) return;
  window.jumiCommentsLoaded = true;

  // ====== CONFIG ======
  const ADMIN_UID = "CSa8pXYawsSLKwQQKWTBypj1YD42"; // your admin UID
  const RESERVED_NAME = "jumitech"; // case-insensitive
  const THROTTLE_MS = 45000; // 45s basic client throttle

  // Identity storage (for replies too)
  const ID_STORE_KEY = "jumi_identity_v1"; // {name,email}

  const firebaseConfig = {
    apiKey: "AIzaSyDS0hkaHQd0NhvGOIEHu-saapF0VulJkXo",
    authDomain: "jumitech-comments.firebaseapp.com",
    projectId: "jumitech-comments",
    storageBucket: "jumitech-comments.firebasestorage.app",
    messagingSenderId: "815273959476",
    appId: "1:815273959476:web:959cbb1b17456d3f2e6a61",
    measurementId: "G-87B358GKT1"
  };

  // Firebase SDK presence checks
  if (!window.firebase || !firebase.apps) {
    console.error(
      "Firebase SDK not found. Ensure firebase-app-compat + firestore-compat + auth-compat are loaded."
    );
    return;
  }

  // Initialize Firebase
  if (firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth ? firebase.auth() : null;

  // Helpers
  function safeTrim(v) {
    return (v || "").toString().trim();
  }

  function isReservedName(name) {
    return safeTrim(name).toLowerCase() === RESERVED_NAME;
  }

  function getPostId() {
    const canon = document.querySelector('link[rel="canonical"]');
    return (canon ? canon.href : window.location.href).split("#")[0].split("?")[0];
  }

  function getInitials(name) {
    const n = safeTrim(name);
    if (!n) return "?";
    const parts = n.split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function hashString(str) {
    let hash = 0;
    const s = safeTrim(str);
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function getAvatarGradient(name) {
    const h = hashString(name || "guest") % 360;
    const s = 70, l1 = 55, l2 = 45;
    return (
      "linear-gradient(135deg, hsl(" +
      h +
      "," +
      s +
      "%," +
      l1 +
      "%), hsl(" +
      ((h + 30) % 360) +
      "," +
      s +
      "%," +
      l2 +
      "%))"
    );
  }

  function formatDate(ts) {
    if (!ts) return "";
    try {
      if (ts.toDate) return ts.toDate().toLocaleString();
      return new Date(ts).toLocaleString();
    } catch {
      return "";
    }
  }

  // Throttle
  const throttleKey = "jumi_last_comment_ts";
  function canPostNow() {
    const last = parseInt(localStorage.getItem(throttleKey) || "0", 10);
    return Date.now() - last >= THROTTLE_MS;
  }
  function markPosted() {
    localStorage.setItem(throttleKey, String(Date.now()));
  }

  // Identity store (for replies)
  function getSavedIdentity() {
    try {
      const raw = localStorage.getItem(ID_STORE_KEY);
      if (!raw) return { name: "", email: "" };
      const parsed = JSON.parse(raw);
      return { name: safeTrim(parsed.name), email: safeTrim(parsed.email) };
    } catch {
      return { name: "", email: "" };
    }
  }
  function saveIdentity(name, email) {
    try {
      localStorage.setItem(ID_STORE_KEY, JSON.stringify({ name: safeTrim(name), email: safeTrim(email) }));
    } catch {}
  }

  // Create a Verify UI (only when needed)
  function ensureVerifyUI(modalEl) {
    if (!modalEl) return null;

    let wrap = document.getElementById("jumi-verify-wrap");
    if (wrap) return wrap;

    wrap = document.createElement("div");
    wrap.id = "jumi-verify-wrap";
    wrap.style.marginTop = "10px";
    wrap.style.display = "none";

    const msg = document.createElement("div");
    msg.id = "jumi-verify-msg";
    msg.style.fontSize = "0.9rem";
    msg.style.color = "#333";
    msg.style.marginBottom = "8px";
    msg.textContent =
      "The name “Jumitech” is reserved. Verify identity to use this name.";

    const btn = document.createElement("button");
    btn.id = "jumi-verify-btn";
    btn.type = "button";
    btn.style.padding = "8px 14px";
    btn.style.borderRadius = "999px";
    btn.style.border = "1px solid #007bff";
    btn.style.background = "#007bff";
    btn.style.color = "#fff";
    btn.style.fontWeight = "700";
    btn.style.cursor = "pointer";
    btn.textContent = "Verify identity (Google)";

    wrap.appendChild(msg);
    wrap.appendChild(btn);

    const msgEl = document.getElementById("jumi-form-message");
    if (msgEl && msgEl.parentNode) {
      msgEl.parentNode.appendChild(wrap);
    } else {
      modalEl.appendChild(wrap);
    }

    return wrap;
  }

  // ====== REPLIES (lightweight) ======
  // We use a separate collection: "jumitech_replies"
  // Fields: postId, parentId, name, email, reply, createdAt, isApproved, isAdmin, adminUid
  const repliesRef = db.collection("jumitech_replies");

  function makeEl(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (typeof text === "string") el.textContent = text;
    return el;
  }

  function escapeAttr(s) {
    return safeTrim(s).replace(/"/g, "&quot;");
  }

  function renderReplyItem(data) {
    const wrap = makeEl("div", "jumi-reply-item");

    const avatar = makeEl("div", "jumi-reply-avatar");
    avatar.textContent = getInitials(data.name || "Guest");
    avatar.style.backgroundImage = getAvatarGradient(data.name || "Guest");

    const body = makeEl("div", "jumi-reply-content");

    const head = makeEl("div", "jumi-reply-header");
    const left = makeEl("div", "jumi-reply-header-left");
    const nameEl = makeEl("span", "jumi-reply-name", data.name || "Guest");
    left.appendChild(nameEl);

    if (data.isAdmin === true) {
      const badge = makeEl("span", "jumi-admin-badge", "Admin");
      left.appendChild(badge);
    }

    const dateEl = makeEl("span", "jumi-reply-date", formatDate(data.createdAt));
    head.appendChild(left);
    head.appendChild(dateEl);

    const msg = makeEl("div", "jumi-reply-body", data.reply || "");

    body.appendChild(head);
    body.appendChild(msg);

    wrap.appendChild(avatar);
    wrap.appendChild(body);

    return wrap;
  }

  function mountReplies(commentId, hostEl) {
    // Create container once
    let box = hostEl.querySelector('[data-replies-box="1"]');
    if (!box) {
      box = makeEl("div", "jumi-replies-box");
      box.setAttribute("data-replies-box", "1");
      hostEl.appendChild(box);
    }

    let list = box.querySelector(".jumi-replies-list");
    if (!list) {
      list = makeEl("div", "jumi-replies-list");
      box.appendChild(list);
    }

    let toggle = box.querySelector(".jumi-replies-toggle");
    if (!toggle) {
      toggle = makeEl("button", "jumi-replies-toggle");
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "View replies";
      box.insertBefore(toggle, list);
    }

    // Default collapsed
    list.style.display = "none";

    toggle.addEventListener("click", function () {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      list.style.display = expanded ? "none" : "block";
      toggle.textContent = expanded ? toggle.textContent.replace("Hide", "View") : toggle.textContent.replace("View", "Hide");
      if (!expanded) {
        // scroll into view nicely on mobile
        try { box.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch {}
      }
    });

    // Listen to replies
    repliesRef
      .where("postId", "==", getPostId())
      .where("parentId", "==", commentId)
      .where("isApproved", "==", true)
      .orderBy("createdAt", "asc")
      .onSnapshot(
        function (snap) {
          list.innerHTML = "";
          const count = snap.size || 0;

          if (count === 0) {
            toggle.textContent = "View replies (0)";
            // keep collapsed
            return;
          }

          toggle.textContent = (toggle.getAttribute("aria-expanded") === "true" ? "Hide replies (" : "View replies (") + count + ")";
          snap.forEach(function (d) {
            list.appendChild(renderReplyItem(d.data()));
          });
        },
        function (error) {
          console.error("Error loading replies:", error);
          list.innerHTML = '<div class="jumi-replies-error">Replies could not be loaded.</div>';
          toggle.textContent = "View replies";
        }
      );
  }

  function buildInlineReplyForm(commentId, afterEl, getAdminState) {
    // Remove any open inline reply forms first (mobile sanity)
    const existing = document.querySelector(".jumi-inline-reply");
    if (existing) existing.remove();

    const wrap = makeEl("div", "jumi-inline-reply");
    wrap.setAttribute("data-parent-id", commentId);

    const id = getSavedIdentity();
    const needsIdentity = !safeTrim(id.name);

    // Name + email (optional) only if no name saved
    let nameInput, emailInput;

    if (needsIdentity) {
      const row = makeEl("div", "jumi-inline-row");
      nameInput = document.createElement("input");
      nameInput.className = "jumi-inline-name";
      nameInput.type = "text";
      nameInput.placeholder = "Your name";
      nameInput.maxLength = 40;

      emailInput = document.createElement("input");
      emailInput.className = "jumi-inline-email";
      emailInput.type = "email";
      emailInput.placeholder = "Email (optional)";
      emailInput.maxLength = 120;

      row.appendChild(nameInput);
      row.appendChild(emailInput);
      wrap.appendChild(row);
    }

    const textarea = document.createElement("textarea");
    textarea.className = "jumi-inline-textarea";
    textarea.placeholder = "Write a reply…";
    textarea.rows = 3;
    textarea.maxLength = 1000;
    wrap.appendChild(textarea);

    const actions = makeEl("div", "jumi-inline-actions");
    const postBtn = makeEl("button", "jumi-inline-post", "Post reply");
    postBtn.type = "button";
    const cancelBtn = makeEl("button", "jumi-inline-cancel", "Cancel");
    cancelBtn.type = "button";
    actions.appendChild(postBtn);
    actions.appendChild(cancelBtn);
    wrap.appendChild(actions);

    const msg = makeEl("div", "jumi-inline-msg");
    wrap.appendChild(msg);

    cancelBtn.addEventListener("click", function () {
      wrap.remove();
    });

    postBtn.addEventListener("click", function () {
      const adminState = getAdminState ? getAdminState() : { isAdmin: false, currentUser: null };

      let name = needsIdentity ? safeTrim(nameInput.value) : safeTrim(getSavedIdentity().name);
      let email = needsIdentity ? safeTrim(emailInput.value) : safeTrim(getSavedIdentity().email);
      const reply = safeTrim(textarea.value);

      if (!reply) {
        msg.textContent = "Please write a reply.";
        msg.className = "jumi-inline-msg jumi-inline-msg--error";
        return;
      }

      if (!name) {
        msg.textContent = "Please enter your name.";
        msg.className = "jumi-inline-msg jumi-inline-msg--error";
        return;
      }

      // Enforce reserved name on replies too
      if (isReservedName(name) && !adminState.isAdmin) {
        msg.textContent = 'To use “Jumitech”, please verify identity first (use the main Add a comment modal to verify).';
        msg.className = "jumi-inline-msg jumi-inline-msg--error";
        return;
      }

      postBtn.disabled = true;
      msg.textContent = "Posting…";
      msg.className = "jumi-inline-msg";

      repliesRef
        .add({
          postId: getPostId(),
          parentId: commentId,
          name: adminState.isAdmin ? "Jumitech" : name,
          email: email || null,
          reply: reply,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          isApproved: true,

          isAdmin: adminState.isAdmin === true,
          adminUid: adminState.isAdmin === true && adminState.currentUser ? adminState.currentUser.uid : null,

          notifyAdmin: true
        })
        .then(function () {
          // Save identity if it's a normal user
          if (!adminState.isAdmin) saveIdentity(name, email);
          textarea.value = "";
          msg.textContent = "Reply posted!";
          msg.className = "jumi-inline-msg jumi-inline-msg--success";
          setTimeout(function () {
            wrap.remove();
          }, 700);
        })
        .catch(function (err) {
          console.error("Error adding reply:", err);
          msg.textContent = "Failed to post reply. Try again.";
          msg.className = "jumi-inline-msg jumi-inline-msg--error";
        })
        .finally(function () {
          postBtn.disabled = false;
        });
    });

    afterEl.parentNode.insertBefore(wrap, afterEl.nextSibling);

    // focus textarea (mobile UX)
    setTimeout(function () {
      try { textarea.focus(); } catch {}
    }, 80);
  }

  // ====== Main init (timing-safe for Blogger) ======
  function initJumiComments() {
    const form = document.getElementById("jumi-comment-form");
    const nameInput = document.getElementById("jumi-name");
    const emailInput = document.getElementById("jumi-email");
    const commentInput = document.getElementById("jumi-comment");
    const submitBtn = document.getElementById("jumi-submit-btn");
    const listEl = document.getElementById("jumi-comments-list");
    const countEl = document.getElementById("jumi-comments-count");
    const messageEl = document.getElementById("jumi-form-message");

    const modalEl = document.getElementById("jumi-comment-modal");
    const openModalBtn = document.getElementById("jumi-open-modal-btn");
    const closeModalBtn = document.getElementById("jumi-modal-close");
    const modalBackdrop = document.getElementById("jumi-modal-backdrop");

    if (!form || !listEl || !countEl || !nameInput || !commentInput || !submitBtn) {
      return false; // not ready or not on this page
    }

    const postId = getPostId();
    const commentsRef = db.collection("jumitech_comments");

    let currentUser = null;
    let isAdmin = false;

    // Load saved identity into modal (nice UX)
    const saved = getSavedIdentity();
    if (saved.name && !nameInput.value) nameInput.value = saved.name;
    if (saved.email && emailInput && !emailInput.value) emailInput.value = saved.email;

    function showMsg(text, type) {
      if (!messageEl) return;
      messageEl.textContent = text || "";
      messageEl.className = "jumi-form-message";
      if (type === "success") messageEl.classList.add("jumi-form-message--success");
      if (type === "error") messageEl.classList.add("jumi-form-message--error");
    }

    function openModal() {
      if (!modalEl) return;
      modalEl.classList.add("jumi-modal--open");
      modalEl.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
      if (!modalEl) return;
      modalEl.classList.remove("jumi-modal--open");
      modalEl.setAttribute("aria-hidden", "true");
      showMsg("", "");
      const wrap = document.getElementById("jumi-verify-wrap");
      if (wrap) wrap.style.display = "none";
    }

    if (openModalBtn) openModalBtn.addEventListener("click", openModal);
    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);

    // Auth state (silent)
    if (auth && auth.onAuthStateChanged) {
      auth.onAuthStateChanged(function (user) {
        currentUser = user || null;
        isAdmin = !!(user && user.uid === ADMIN_UID);

        if (isAdmin) {
          nameInput.value = "Jumitech";
          nameInput.setAttribute("disabled", "disabled");
          nameInput.setAttribute("readonly", "readonly");
          showMsg("You are verified as Admin.", "success");
        } else {
          nameInput.removeAttribute("disabled");
          nameInput.removeAttribute("readonly");
        }
      });
    }

    // Verify identity flow (Option B: show button)
    const verifyWrap = ensureVerifyUI(modalEl);
    const verifyBtn = document.getElementById("jumi-verify-btn");

    function showVerifyUI() {
      if (!verifyWrap) return;
      verifyWrap.style.display = "block";
    }

    function hideVerifyUI() {
      if (!verifyWrap) return;
      verifyWrap.style.display = "none";
    }

    function startGoogleVerify() {
      if (!auth) {
        showMsg("Auth not available. Ensure firebase-auth-compat is loaded.", "error");
        return;
      }
      const provider = new firebase.auth.GoogleAuthProvider();
      auth
        .signInWithPopup(provider)
        .then(function (res) {
          const user = res && res.user ? res.user : null;
          if (user && user.uid === ADMIN_UID) {
            isAdmin = true;
            nameInput.value = "Jumitech";
            nameInput.setAttribute("disabled", "disabled");
            nameInput.setAttribute("readonly", "readonly");
            hideVerifyUI();
            showMsg("Verified. You can now post as Jumitech (Admin).", "success");
          } else {
            isAdmin = false;
            hideVerifyUI();
            showMsg("This Google account is not authorized to use “Jumitech”.", "error");
            if (isReservedName(nameInput.value)) nameInput.value = "";
            nameInput.removeAttribute("disabled");
            nameInput.removeAttribute("readonly");
          }
        })
        .catch(function (err) {
          showMsg(
            "Verification failed: " + (err && err.message ? err.message : "Try again."),
            "error"
          );
        });
    }

    if (verifyBtn) verifyBtn.addEventListener("click", startGoogleVerify);

    // If user types Jumitech, require verification
    nameInput.addEventListener("input", function () {
      const n = safeTrim(nameInput.value);
      if (!n) {
        hideVerifyUI();
        return;
      }

      if (isReservedName(n)) {
        if (isAdmin) {
          hideVerifyUI();
          showMsg("Posting as Admin.", "success");
        } else {
          showVerifyUI();
          showMsg("Reserved name detected. Verify identity to use “Jumitech”.", "error");
        }
      } else {
        hideVerifyUI();
      }
    });

    // Render comment
    function renderComment(docId, data) {
      const item = document.createElement("div");
      item.className = "jumi-comment-item";
      item.setAttribute("data-comment-id", docId);

      const avatar = document.createElement("div");
      avatar.className = "jumi-comment-avatar";
      avatar.textContent = getInitials(data.name || "Guest");
      avatar.style.backgroundImage = getAvatarGradient(data.name || "Guest");

      const content = document.createElement("div");
      content.className = "jumi-comment-content";

      const header = document.createElement("div");
      header.className = "jumi-comment-header";

      const left = document.createElement("div");
      left.className = "jumi-comment-header-left";

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

      const bodyEl = document.createElement("div");
      bodyEl.className = "jumi-comment-body";
      bodyEl.textContent = data.comment || "";

      // Reply action row
      const actions = makeEl("div", "jumi-comment-actions");
      const replyBtn = makeEl("button", "jumi-reply-btn", "Reply");
      replyBtn.type = "button";
      replyBtn.setAttribute("data-reply-btn", "1");
      replyBtn.setAttribute("data-parent-id", escapeAttr(docId));
      actions.appendChild(replyBtn);

      content.appendChild(header);
      content.appendChild(bodyEl);
      content.appendChild(actions);

      item.appendChild(avatar);
      item.appendChild(content);

      // Replies mount
      mountReplies(docId, content);

      return item;
    }

    function setListError(msg) {
      listEl.innerHTML = '<div class="jumi-comments-error">' + (msg || "Comments could not be loaded.") + "</div>";
    }

    function loadComments() {
      commentsRef
        .where("postId", "==", postId)
        .where("isApproved", "==", true)
        .orderBy("createdAt", "asc")
        .onSnapshot(
          function (snap) {
            listEl.innerHTML = "";

            if (snap.empty) {
              listEl.innerHTML =
                '<p class="jumi-no-comments">No comments yet. Be the first to comment!</p>';
              countEl.textContent = "0 comments";
              return;
            }

            let count = 0;
            snap.forEach(function (doc) {
              count++;
              listEl.appendChild(renderComment(doc.id, doc.data()));
            });

            countEl.textContent = count + (count === 1 ? " comment" : " comments");
          },
          function (error) {
            console.error("Error loading comments:", error);

            // IMPORTANT: don’t leave “Loading comments...” stuck forever
            countEl.textContent = "Comments could not be loaded.";
            setListError(
              error && error.message
                ? error.message
                : "Comments could not be loaded."
            );

            // If it’s an index issue, hint clearly in console
            if (error && /requires an index/i.test(error.message || "")) {
              console.warn("Firestore index required for comments query. Open the link in the error message to create it.");
            }
          }
        );
    }

    // Event delegation for Reply buttons
    listEl.addEventListener("click", function (e) {
      const t = e.target;
      if (!t) return;

      if (t.getAttribute && t.getAttribute("data-reply-btn") === "1") {
        e.preventDefault();
        const parentId = t.getAttribute("data-parent-id");
        const host = t.closest(".jumi-comment-content");
        if (!parentId || !host) return;

        buildInlineReplyForm(parentId, t.closest(".jumi-comment-actions") || t, function () {
          return { isAdmin: isAdmin, currentUser: currentUser };
        });
      }
    });

    // Submit main comment
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      const nameRaw = safeTrim(nameInput.value) || "Guest";
      const email = safeTrim(emailInput && emailInput.value);
      const comment = safeTrim(commentInput.value);

      if (!comment) {
        showMsg("Please write a comment before posting.", "error");
        return;
      }

      if (!canPostNow()) {
        showMsg("Please wait a bit before posting another comment.", "error");
        return;
      }

      // Enforce reserved name verification
      if (isReservedName(nameRaw) && !isAdmin) {
        showVerifyUI();
        showMsg("To use “Jumitech”, please verify identity first.", "error");
        return;
      }

      submitBtn.disabled = true;
      showMsg("Posting your comment…", "");

      const finalName = isAdmin ? "Jumitech" : nameRaw;

      const payload = {
        postId: postId,
        name: finalName,
        email: email || null,
        comment: comment,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isApproved: true,
        pageUrl: postId,

        notifyAdmin: true,

        isAdmin: isAdmin === true,
        adminUid: isAdmin === true && currentUser ? currentUser.uid : null
      };

      commentsRef
        .add(payload)
        .then(function () {
          commentInput.value = "";
          markPosted();
          if (!isAdmin) saveIdentity(finalName, email);
          showMsg("Comment posted successfully!", "success");
          hideVerifyUI();
          closeModal();
        })
        .catch(function (err) {
          console.error("Error adding comment:", err);
          showMsg("Failed to post comment. Try again.", "error");
        })
        .finally(function () {
          submitBtn.disabled = false;
        });
    });

    loadComments();
    return true;
  }

  (function waitForComments() {
    if (initJumiComments()) return;
    setTimeout(waitForComments, 150);
  })();
})();
