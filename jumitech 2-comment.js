(function () {
  // Run once
  if (window.jumiCommentsLoaded) return;
  window.jumiCommentsLoaded = true;

  // ====== CONFIG ======
  const ADMIN_UID = "CSa8pXYawsSLKwQQKWTBypj1YD42"; // <-- your admin UID
  const RESERVED_NAME = "jumitech"; // case-insensitive
  const THROTTLE_MS = 45000; // 45s basic client throttle

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
    const s = 70,
      l1 = 55,
      l2 = 45;
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

    // Append inside modal, below the form message if possible
    const msgEl = document.getElementById("jumi-form-message");
    if (msgEl && msgEl.parentNode) {
      msgEl.parentNode.appendChild(wrap);
    } else {
      modalEl.appendChild(wrap);
    }

    return wrap;
  }

  // Main init (timing-safe for Blogger)
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

        // If admin, lock name to Jumitech
        if (isAdmin) {
          nameInput.value = "Jumitech";
          nameInput.setAttribute("disabled", "disabled");
          nameInput.setAttribute("readonly", "readonly");
          showMsg("You are verified as Admin.", "success");
        } else {
          // If not admin, allow name edits unless they are trying to use reserved name
          nameInput.removeAttribute("disabled");
          nameInput.removeAttribute("readonly");
          // do not overwrite their chosen name
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
            // Verified admin
            isAdmin = true;
            nameInput.value = "Jumitech";
            nameInput.setAttribute("disabled", "disabled");
            nameInput.setAttribute("readonly", "readonly");
            hideVerifyUI();
            showMsg("Verified. You can now post as Jumitech (Admin).", "success");
          } else {
            // Wrong account
            isAdmin = false;
            hideVerifyUI();
            showMsg("This Google account is not authorized to use “Jumitech”.", "error");
            // Force them off reserved name
            if (isReservedName(nameInput.value)) nameInput.value = "";
            nameInput.removeAttribute("disabled");
            nameInput.removeAttribute("readonly");
          }
        })
        .catch(function (err) {
          showMsg("Verification failed: " + (err && err.message ? err.message : "Try again."), "error");
        });
    }

    if (verifyBtn) verifyBtn.addEventListener("click", startGoogleVerify);

    // If user types Jumitech, we require verification
    nameInput.addEventListener("input", function () {
      const n = safeTrim(nameInput.value);
      if (!n) {
        hideVerifyUI();
        return;
      }

      if (isReservedName(n)) {
        if (isAdmin) {
          // already verified
          hideVerifyUI();
          showMsg("Posting as Admin.", "success");
        } else {
          // Not verified: do NOT allow posting yet
          showVerifyUI();
          showMsg("Reserved name detected. Verify identity to use “Jumitech”.", "error");
        }
      } else {
        hideVerifyUI();
      }
    });

    // Render
    function renderComment(data) {
      const item = document.createElement("div");
      item.className = "jumi-comment-item";

      const avatar = document.createElement("div");
      avatar.className = "jumi-comment-avatar";
      avatar.textContent = getInitials(data.name || "Guest");
      avatar.style.backgroundImage = getAvatarGradient(data.name || "Guest");

      const content = document.createElement("div");
      content.className = "jumi-comment-content";

      const header = document.createElement("div");
      header.className = "jumi-comment-header";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "8px";
      left.style.minWidth = "0";

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

      const bodyEl = document.createElement("div");
      bodyEl.className = "jumi-comment-body";
      bodyEl.textContent = data.comment || "";

      header.appendChild(left);
      header.appendChild(dateEl);

      content.appendChild(header);
      content.appendChild(bodyEl);

      item.appendChild(avatar);
      item.appendChild(content);

      return item;
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
              listEl.appendChild(renderComment(doc.data()));
            });

            countEl.textContent = count + (count === 1 ? " comment" : " comments");
          },
          function (error) {
            console.error("Error loading comments:", error);
            countEl.textContent = "Comments could not be loaded.";
          }
        );
    }

    // Submit
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

      const payload = {
        postId: postId,
        name: isAdmin ? "Jumitech" : nameRaw,
        email: email || null,
        comment: comment,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isApproved: true,
        pageUrl: postId,

        // For server notification logic
        notifyAdmin: true,

        // Admin proof
        isAdmin: isAdmin === true,
        adminUid: isAdmin === true && currentUser ? currentUser.uid : null
      };

      commentsRef
        .add(payload)
        .then(function () {
          commentInput.value = "";
          markPosted();
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
