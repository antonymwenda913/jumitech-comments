(function () {
  // Avoid running multiple times
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
  if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }
  const db = firebase.firestore();

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

  if (!form || !listEl) {
    console.warn("Jumitech comments: Comment container not found.");
    return;
  }

  // Get unique Post ID (canonical URL without query/hash)
  function getPostId() {
    const canon = document.querySelector('link[rel="canonical"]');
    const url = (canon ? canon.href : window.location.href)
      .split("#")[0]
      .split("?")[0];
    return url;
  }
  const postId = getPostId();
  const commentsRef = db.collection("jumitech_comments");

  // Get initials from name
  function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    const first = parts[0].charAt(0);
    const last = parts[parts.length - 1].charAt(0);
    return (first + last).toUpperCase();
  }

  // Simple string hash
  function hashString(str) {
    let hash = 0;
    if (!str) return hash;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // Gradient avatar background
  function getAvatarStyle(name) {
    const h = hashString(name || "guest") % 360;
    const s = 70;
    const l1 = 55;
    const l2 = 45;
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

  // Format Firestore timestamp
  function formatDate(ts) {
    if (!ts) return "";
    try {
      if (ts.toDate) {
        return ts.toDate().toLocaleString();
      }
      return new Date(ts).toLocaleString();
    } catch (e) {
      return "";
    }
  }

  // Render a single comment
  function renderComment(data) {
    const item = document.createElement("div");
    item.className = "jumi-comment-item";

    const avatar = document.createElement("div");
    avatar.className = "jumi-comment-avatar";
    avatar.textContent = getInitials(data.name || "Guest");
    avatar.style.backgroundImage = getAvatarStyle(data.name || "Guest");

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

    const bodyEl = document.createElement("div");
    bodyEl.className = "jumi-comment-body";
    bodyEl.textContent = data.comment || "";

    header.appendChild(nameEl);
    header.appendChild(dateEl);
    content.appendChild(header);
    content.appendChild(bodyEl);

    item.appendChild(avatar);
    item.appendChild(content);

    return item;
  }

  // Load comments in real time
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

  // Show message under form
  function showMsg(text, type) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.className = "jumi-form-message";
    if (type === "success") {
      messageEl.classList.add("jumi-form-message--success");
    } else if (type === "error") {
      messageEl.classList.add("jumi-form-message--error");
    }
  }

  // Modal handlers
  function openModal() {
    if (!modalEl) return;
    modalEl.classList.add("jumi-modal--open");
    modalEl.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove("jumi-modal--open");
    modalEl.setAttribute("aria-hidden", "true");
    if (messageEl) {
      messageEl.textContent = "";
      messageEl.className = "jumi-form-message";
    }
  }

  if (openModalBtn) {
    openModalBtn.addEventListener("click", function () {
      openModal();
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", function () {
      closeModal();
    });
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", function () {
      closeModal();
    });
  }

  // Submit new comment
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const name = (nameInput.value || "").trim() || "Guest";
    const email =
      emailInput && emailInput.value ? emailInput.value.trim() : "";
    const comment = (commentInput.value || "").trim();

    if (!comment) {
      showMsg("Please write a comment before posting.", "error");
      return;
    }

    submitBtn.disabled = true;
    showMsg("Posting your comment…", "neutral");

    commentsRef
      .add({
        postId: postId,
        name: name,
        email: email || null, // stored, not shown
        comment: comment,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isApproved: true
      })
      .then(function () {
        commentInput.value = "";
        showMsg("Comment posted successfully!", "success");
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

  // Start listening
  loadComments();
})();
