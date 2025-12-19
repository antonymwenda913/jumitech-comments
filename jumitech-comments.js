(function () {
  // Prevent double init
  if (window.jumiCommentsLoaded) return;
  window.jumiCommentsLoaded = true;

  // Firebase config
  const firebaseConfig = {
    apiKey: "AIzaSyDS0hkaHQd0NhvGOIEHu-saapF0VulJkXo",
    authDomain: "jumitech-comments.firebaseapp.com",
    projectId: "jumitech-comments",
    storageBucket: "jumitech-comments.firebasestorage.app",
    messagingSenderId: "815273959476",
    appId: "1:815273959476:web:959cbb1b17456d3f2e6a61",
    measurementId: "G-87B358GKT1"
  };

  // Init Firebase (compat)
  if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }
  const db = firebase.firestore();

  // Wait for Blogger to render post HTML
  function waitForDOM() {
    const root = document.getElementById("jumi-comments-root");
    if (!root) {
      setTimeout(waitForDOM, 150);
      return;
    }
    initComments();
  }

  function initComments() {
    // DOM elements
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

    if (!form || !listEl) return;

    // Helpers
    function getPostId() {
      const canon = document.querySelector('link[rel="canonical"]');
      return (canon ? canon.href : location.href).split("#")[0].split("?")[0];
    }

    function getInitials(name) {
      if (!name) return "?";
      const p = name.trim().split(/\s+/);
      if (p.length === 1) return p[0].substring(0, 2).toUpperCase();
      return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    }

    function hash(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
      }
      return Math.abs(h);
    }

    function avatarBg(name) {
      const h = hash(name || "guest") % 360;
      return `linear-gradient(135deg, hsl(${h},70%,55%), hsl(${(h + 30) % 360},70%,45%))`;
    }

    function formatDate(ts) {
      try {
        return ts && ts.toDate ? ts.toDate().toLocaleString() : "";
      } catch {
        return "";
      }
    }

    const postId = getPostId();
    const commentsRef = db.collection("jumitech_comments");

    function renderComment(data) {
      const item = document.createElement("div");
      item.className = "jumi-comment-item";

      const avatar = document.createElement("div");
      avatar.className = "jumi-comment-avatar";
      avatar.textContent = getInitials(data.name || "Guest");
      avatar.style.backgroundImage = avatarBg(data.name || "Guest");

      const content = document.createElement("div");
      content.className = "jumi-comment-content";

      const header = document.createElement("div");
      header.className = "jumi-comment-header";

      const nameEl = document.createElement("span");
      nameEl.className = "jumi-comment-name";
      nameEl.textContent = data.name || "Guest";

      const dateEl = document.createElement("span");
      dateEl.className = "jumi-comment-date";
      dateEl.textContent = formatDate(data.createdAt);

      const body = document.createElement("div");
      body.className = "jumi-comment-body";
      body.textContent = data.comment || "";

      header.appendChild(nameEl);
      header.appendChild(dateEl);
      content.appendChild(header);
      content.appendChild(body);

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
          snap => {
            listEl.innerHTML = "";
            if (snap.empty) {
              listEl.innerHTML =
                '<p class="jumi-no-comments">No comments yet. Be the first to comment!</p>';
              countEl.textContent = "0 comments";
              return;
            }
            let count = 0;
            snap.forEach(doc => {
              count++;
              listEl.appendChild(renderComment(doc.data()));
            });
            countEl.textContent = count + (count === 1 ? " comment" : " comments");
          },
          err => {
            console.error(err);
            countEl.textContent = "Comments could not be loaded.";
          }
        );
    }

    function showMsg(text, type) {
      if (!messageEl) return;
      messageEl.textContent = text;
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
      if (messageEl) messageEl.textContent = "";
    }

    // Events
    if (openModalBtn) openModalBtn.addEventListener("click", openModal);
    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);

    form.addEventListener("submit", e => {
      e.preventDefault();

      const name = nameInput.value.trim() || "Guest";
      const email = emailInput.value.trim() || null;
      const comment = commentInput.value.trim();

      if (!comment) {
        showMsg("Please write a comment before posting.", "error");
        return;
      }

      submitBtn.disabled = true;
      showMsg("Posting your comment…");

      commentsRef
        .add({
          postId,
          name,
          email,
          comment,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          isApproved: true
        })
        .then(() => {
          commentInput.value = "";
          showMsg("Comment posted successfully!", "success");
          closeModal();
        })
        .catch(() => {
          showMsg("Failed to post comment. Try again.", "error");
        })
        .finally(() => {
          submitBtn.disabled = false;
        });
    });

    loadComments();
  }

  waitForDOM();
})();
