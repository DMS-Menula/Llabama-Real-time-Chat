document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const messageInput = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const messagesContainer = document.getElementById("messages");
  const stickerBtn = document.getElementById("sticker-btn");
  const gifBtn = document.getElementById("gif-btn");
  const stickerPicker = document.getElementById("sticker-picker");
  const gifPicker = document.getElementById("gif-picker");
  const changeNameBtn = document.getElementById("change-name-btn");
  const nameModal = document.getElementById("name-modal");
  const newUsernameInput = document.getElementById("new-username");
  const confirmNameBtn = document.getElementById("confirm-name-btn");
  const cancelNameBtn = document.getElementById("cancel-name-btn");
  const usernameDisplay = document.getElementById("username-display");
  const usersList = document.getElementById("users-list");
  const onlineCount = document.getElementById("online-count");
  const gifSearch = document.getElementById("gif-search");
  const gifGrid = document.getElementById("gif-grid");

  // Connect to Socket.io server
  const socket = io();

  // User state
  let userId = generateId();
  let username =
    localStorage.getItem("llabama-username") ||
    `User_${Math.floor(Math.random() * 1000)}`;
  usernameDisplay.textContent = username;

  // Initialize the app
  init();

  function init() {
    // Send user info to server
    socket.emit("user-connected", { userId, username });

    // Load recent messages (would be from database in a real app)
    // In this demo, we'll just show a welcome message
    addSystemMessage(
      "Welcome to Llabama chat! Messages are automatically deleted after 30 days."
    );

    // Set up event listeners
    setupEventListeners();
  }

  function setupEventListeners() {
    // Message sending
    sendBtn.addEventListener("click", sendMessage);
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });

    // Sticker and GIF pickers
    stickerBtn.addEventListener("click", toggleStickerPicker);
    gifBtn.addEventListener("click", toggleGifPicker);

    // Close pickers when clicking outside
    document.addEventListener("click", (e) => {
      if (!stickerBtn.contains(e.target) && !stickerPicker.contains(e.target)) {
        stickerPicker.style.display = "none";
      }
      if (!gifBtn.contains(e.target) && !gifPicker.contains(e.target)) {
        gifPicker.style.display = "none";
      }
    });

    // Sticker selection
    document.querySelectorAll(".sticker").forEach((sticker) => {
      sticker.addEventListener("click", () => {
        sendSticker(sticker.src, sticker.dataset.sticker);
        stickerPicker.style.display = "none";
      });
    });

    // Name change
    changeNameBtn.addEventListener("click", () => {
      newUsernameInput.value = username;
      nameModal.style.display = "flex";
    });

    confirmNameBtn.addEventListener("click", changeUsername);
    cancelNameBtn.addEventListener("click", () => {
      nameModal.style.display = "none";
    });

    // GIF search
    gifSearch.addEventListener("input", debounce(searchGIFs, 500));

    // Socket.io events
    socket.on("message", addMessage);
    socket.on("user-connected", updateUserList);
    socket.on("user-disconnected", updateUserList);
    socket.on("users-online", updateOnlineCount);
    socket.on("name-changed", handleNameChange);
  }

  // Socket.io event handlers
  function addMessage(data) {
    const isCurrentUser = data.userId === userId;
    const messageClass = isCurrentUser ? "user-message" : "other-message";

    const messageElement = document.createElement("div");
    messageElement.className = `message ${messageClass}`;

    let contentHtml = "";
    if (data.type === "text") {
      contentHtml = data.content;
    } else if (data.type === "sticker") {
      contentHtml = `<img src="${data.content}" class="sticker" alt="${data.alt}">`;
    } else if (data.type === "gif") {
      contentHtml = `<img src="${data.content}" class="gif" alt="GIF">`;
    }

    messageElement.innerHTML = `
            <div class="message-info">
                <span class="message-sender">${data.username}</span>
                <span class="message-time">${formatTime(data.timestamp)}</span>
            </div>
            <div class="message-content">${contentHtml}</div>
        `;

    messagesContainer.appendChild(messageElement);
    scrollToBottom();
  }

  function addSystemMessage(text) {
    const messageElement = document.createElement("div");
    messageElement.className = "message system-message";
    messageElement.innerHTML = `
            <div class="message-content">${text}</div>
        `;
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
  }

  function updateUserList(users) {
    usersList.innerHTML = "";
    users.forEach((user) => {
      if (user.userId !== userId) {
        // Don't show ourselves in the list
        const li = document.createElement("li");
        li.textContent = user.username;
        usersList.appendChild(li);
      }
    });
  }

  function updateOnlineCount(count) {
    onlineCount.textContent = count;
  }

  function handleNameChange(data) {
    if (data.userId === userId) {
      username = data.newName;
      usernameDisplay.textContent = username;
      localStorage.setItem("llabama-username", username);
    }
    updateUserList(data.users);
  }

  // Message handling
  function sendMessage() {
    const content = messageInput.value.trim();
    if (content) {
      const message = {
        userId,
        username,
        content,
        type: "text",
        timestamp: new Date().getTime(),
      };
      socket.emit("message", message);
      messageInput.value = "";
    }
  }

  function sendSticker(stickerUrl, stickerName) {
    const message = {
      userId,
      username,
      content: stickerUrl,
      type: "sticker",
      alt: stickerName,
      timestamp: new Date().getTime(),
    };
    socket.emit("message", message);
  }

  function sendGif(gifUrl) {
    const message = {
      userId,
      username,
      content: gifUrl,
      type: "gif",
      timestamp: new Date().getTime(),
    };
    socket.emit("message", message);
  }

  // UI functions
  function toggleStickerPicker() {
    stickerPicker.style.display =
      stickerPicker.style.display === "block" ? "none" : "block";
    gifPicker.style.display = "none";
  }

  function toggleGifPicker() {
    gifPicker.style.display =
      gifPicker.style.display === "block" ? "none" : "block";
    stickerPicker.style.display = "none";

    // Load trending GIFs when first opened
    if (gifGrid.children.length === 0) {
      searchGIFs("trending");
    }
  }

  async function searchGIFs(query = "") {
    try {
      // In a real app, you would use the Giphy API or similar
      // For this demo, we'll simulate with some placeholder GIFs
      const gifs = [
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDk1a3FmN2F2M3Z1YzV5Z3V4dWw2dGt4bGJmZ2JjY3FqZ2N5eWpmbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT5LMHxhOfscxPfIfm/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDk1a3FmN2F2M3Z1YzV5Z3V4dWw2dGt4bGJmZ2JjY3FqZ2N5eWpmbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7aTskHEUdgCQAXde/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDk1a3FmN2F2M3Z1YzV5Z3V4dWw2dGt4bGJmZ2JjY3FqZ2N5eWpmbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlOBZcl7vVQgZnG/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDk1a3FmN2F2M3Z1YzV5Z3V4dWw2dGt4bGJmZ2JjY3FqZ2N5eWpmbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HU7f6pS2A5Kk5rq/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDk1a3FmN2F2M3Z1YzV5Z3V4dWw2dGt4bGJmZ2JjY3FqZ2N5eWpmbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o6Zt481isNVuQI1l6/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDk1a3FmN2F2M3Z1YzV5Z3V4dWw2dGt4bGJmZ2JjY3FqZ2N5eWpmbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlTyXxYf4nF6Ota/giphy.gif",
      ];

      gifGrid.innerHTML = "";
      gifs.forEach((gifUrl) => {
        const img = document.createElement("img");
        img.src = gifUrl;
        img.addEventListener("click", () => {
          sendGif(gifUrl);
          gifPicker.style.display = "none";
        });
        gifGrid.appendChild(img);
      });
    } catch (error) {
      console.error("Error loading GIFs:", error);
    }
  }

  function changeUsername() {
    const newName = newUsernameInput.value.trim();
    if (newName && newName !== username) {
      socket.emit("change-name", { userId, newName });
      nameModal.style.display = "none";
    }
  }

  // Utility functions
  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  function debounce(func, wait) {
    let timeout;
    return function () {
      const context = this,
        args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
      }, wait);
    };
  }

  socket.on("initial-messages", (loadedMessages) => {
    loadedMessages.forEach((message) => {
      addMessage(message);
    });
    scrollToBottom();
  });

});
