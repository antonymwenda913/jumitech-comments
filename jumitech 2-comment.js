(function () {
  // Run once
  if (window.jumiCommentsLoaded) return;
  window.jumiCommentsLoaded = true;

  // ✅ Firebase config
  const firebaseConfig = {
    apiKey: "AIzaSyDS0hkaHQd0NhvGOIEHu-saapF0VulJkXo",
    authDomain: "jumitech-comments.firebaseapp.com",
    projectId: "jumitech-comments",
    storageBucket: "jumitech-comments.firebasestorage.app",
    messagingSenderId: "815273959476",
    appId: "1:815273959476:web:959cbb1b17456d3f2e6a61",
    measurementId: "G-87B358GKT1"
  };

  // Initialize Firebase (compat)
  if (!window.firebase || !firebase.apps) {
    console.error("Firebase SDK not found. Ensure firebase-app-compat + firestore-compat are loaded.");
    return;
  }
  if (firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  // --- Helpers ---
  function getPostId() {
    const canon = document.querySelector('link[rel="canonical"]');
    const url = (canon ? canon.href : window.location.href)
      .split("#")[0]
      .split("?")[0];
    return url;
  }

  function safeTrim(v) {
    return (v || "").toString().trim();
  }

  function isAdminName(name) {
    // Your rule: "Jumitech" is Admin (case-insensitive, trimmed)
    return safeTrim(name).toLowerCase() === "jumitech";
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

  // --- Init guarded (Blogger timing-safe) ---
  function initJumiComments() {
    // Required DOM
    const form = document.getElementById("jumi-comment-form");
    const nameInput = document.getElementById("jumi-name");
    const emailInput = document.getElementById("jumi-email");
    const commentInput = document.getElementById("jumi-comment");
    const submitBtn = document.getElementById("jumi-submit-btn");
    const listEl = document.getElementById("jumi-comments-list");
    const countEl = document.getElementById("jumi-comments-count");
    const messageEl = document.getElementById("jumi-form-message");

    // Modal DOM
    const modalEl = document.getElementById("jumi-comment-modal");
    const openModalBtn = document.getElementById("jumi-open-modal-btn");
    const closeModalBtn = document.getElementById("jumi-modal-close");
    const modalBackdrop = document.getElementById("jumi-modal-backdrop");

    if (!form || !listEl || !countEl) return false; // not on this page yet

    const postId = getPostId();
    const commentsRef = db.collection("jumitech_comments");

    // --- UI helpers ---
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
    }

    if (openModalBtn) openModalBtn.addEventListener("click", openModal);
    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);

    // --- Render comment ---
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

      // Admin badge (based on name === "Jumitech")
      if (isAdminName(data.name)) {
        const badge = document.createElement("span");
        badge.className = "jumi-admin-badge";
        badge.textContent = "Admin";
        left.appendChild(nameEl);
        left.appendChild(badge);
      } else {
        left.appendChild(nameEl);
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

    // --- Load comments live ---
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

    // --- Submit (simple anti-spam throttle) ---
    // (Lightweight client throttle; real spam protection can be added server-side later.)
    const THROTTLE_MS = 45000; // 45s
    const throttleKey = "jumi_last_comment_ts";
    function canPostNow() {
      const last = parseInt(localStorage.getItem(throttleKey) || "0", 10);
      const now = Date.now();
      return now - last >= THROTTLE_MS;
    }
    function markPosted() {
      localStorage.setItem(throttleKey, String(Date.now()));
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      const name = safeTrim(nameInput && nameInput.value) || "Guest";
      const email = safeTrim(emailInput && emailInput.value);
      const comment = safeTrim(commentInput && commentInput.value);

      if (!comment) {
        showMsg("Please write a comment before posting.", "error");
        return;
      }

      if (!canPostNow()) {
        showMsg("Please wait a bit before posting another comment.", "error");
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      showMsg("Posting your comment…", "");

      commentsRef
        .add({
          postId: postId,
          name: name,
          email: email || null, // saved, not shown publicly
          comment: comment,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          isApproved: true,
          // Used by server notification logic (Cloud Function)
          notifyAdmin: true,
          pageUrl: postId
        })
        .then(function () {
          if (commentInput) commentInput.value = "";
          markPosted();
          showMsg("Comment posted successfully!", "success");
          // Close modal after a short moment for UX
          setTimeout(function () {
            if (submitBtn) submitBtn.disabled = false;
            if (modalEl) modalEl.classList.remove("jumi-modal--open");
          }, 250);
        })
        .catch(function (err) {
          console.error("Error adding comment:", err);
          showMsg("Failed to post comment. Try again.", "error");
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });

    loadComments();
    return true;
  }

  // Wait until Blogger injects the comments HTML (post pages)
  (function waitForComments() {
    if (initJumiComments()) return;
    setTimeout(waitForComments, 150);
  })();
  // ===== TEMP ADMIN AUTH (REMOVE AFTER UID IS COPIED) =====
(function adminAuthTemp() {
  if (!firebase.auth) return;

  const auth = firebase.auth();
  const loginBtn = document.getElementById("jumi-admin-login");
  const logoutBtn = document.getElementById("jumi-admin-logout");

  if (!loginBtn || !logoutBtn) return;

  loginBtn.addEventListener("click", function () {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(function (err) {
      alert("Login failed: " + err.message);
    });
  });

  logoutBtn.addEventListener("click", function () {
    auth.signOut();
  });

  auth.onAuthStateChanged(function (user) {
    if (user) {
      console.log("ADMIN SIGNED IN");
      console.log("UID:", user.uid);
      console.log("EMAIL:", user.email);

      loginBtn.style.display = "none";
      logoutBtn.style.display = "inline-block";
    } else {
      loginBtn.style.display = "inline-block";
      logoutBtn.style.display = "none";
    }
  });
})();

})();
