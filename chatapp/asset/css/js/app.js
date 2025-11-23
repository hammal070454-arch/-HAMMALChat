// GLOBAL SHARED STORAGE - Works across browsers
class SharedStorage {
    constructor() {
        this.storageKey = 'chatapp_shared_data_v3';
        this.initializeSharedData();
    }

    initializeSharedData() {
        let data = this.getData();
        
        if (!data.users || data.users.length === 0) {
            data = {
                users: [
                    {
                        id: "1",
                        name: "Alex Johnson",
                        username: "alex",
                        password: "123456",
                        avatar: "AJ",
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: "2",
                        name: "Maria Garcia", 
                        username: "maria",
                        password: "123456",
                        avatar: "MG",
                        createdAt: new Date().toISOString()
                    }
                ],
                messages: {},
                onlineUsers: {},
                lastUpdated: Date.now()
            };
            this.saveData(data);
            console.log('✅ Pre-created test users: alex & maria');
        }
        
        console.log('✅ Shared storage initialized with', data.users.length, 'users');
    }

    getData() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : { users: [], messages: {}, onlineUsers: {} };
        } catch (e) {
            return { users: [], messages: {}, onlineUsers: {} };
        }
    }

    saveData(data) {
        try {
            data.lastUpdated = Date.now();
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            sessionStorage.setItem(this.storageKey, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error saving data:', e);
            return false;
        }
    }

    refreshData() {
        const data = this.getData();
        this.saveData(data);
        return data;
    }

    registerUser(userData) {
        const data = this.getData();
        
        if (data.users.find(u => u.username === userData.username)) {
            throw new Error('Username already exists');
        }

        const newUser = {
            ...userData,
            id: Date.now().toString(),
            createdAt: new Date().toISOString()
        };

        data.users.push(newUser);
        this.saveData(data);
        console.log('✅ New user registered:', userData.username);
        return newUser;
    }

    loginUser(username, password) {
        const data = this.getData();
        const user = data.users.find(u => 
            u.username === username && u.password === password
        );

        if (!user) {
            throw new Error('Invalid username or password');
        }

        data.onlineUsers[username] = Date.now();
        this.saveData(data);

        console.log('✅ User logged in:', username);
        return user;
    }

    getAllUsers(currentUsername) {
        const data = this.getData();
        const now = Date.now();
        
        const users = data.users
            .filter(user => user.username !== currentUsername)
            .map(user => {
                const lastSeen = data.onlineUsers[user.username];
                const isOnline = lastSeen && (now - lastSeen) < 300000;
                
                const lastMessage = this.getLastMessage(currentUsername, user.username);
                
                return {
                    ...user,
                    isOnline: isOnline,
                    status: isOnline ? 'Online' : 'Offline',
                    lastMessage: lastMessage
                };
            });

        console.log('📊 Found', users.length, 'other users');
        return users;
    }

    sendMessage(message) {
        const data = this.getData();
        const chatId = this.getChatId(message.sender, message.receiver);
        
        if (!data.messages[chatId]) {
            data.messages[chatId] = [];
        }

        const newMessage = {
            ...message,
            id: Date.now().toString(),
            timestamp: Date.now()
        };

        data.messages[chatId].push(newMessage);
        this.saveData(data);
        console.log('💬 Message sent from', message.sender, 'to', message.receiver);
        return newMessage;
    }

    getMessages(user1, user2) {
        const data = this.getData();
        const chatId = this.getChatId(user1, user2);
        const messages = data.messages[chatId] || [];
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    }

    getLastMessage(user1, user2) {
        const messages = this.getMessages(user1, user2);
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            return lastMsg.text.length > 30 ? lastMsg.text.substring(0, 30) + '...' : lastMsg.text;
        }
        return "No messages yet";
    }

    updateUserActivity(username) {
        const data = this.getData();
        data.onlineUsers[username] = Date.now();
        this.saveData(data);
    }

    getChatId(user1, user2) {
        return [user1, user2].sort().join('_');
    }
}

// Application state
const appState = {
    currentUser: null,
    allUsers: [],
    activeChat: null,
    checkInterval: null,
    storage: new SharedStorage()
};

// DOM Elements
const authContainer = document.getElementById('auth-container');
const chatApp = document.getElementById('chat-app');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const refreshUsersBtn = document.getElementById('refresh-users');
const usersList = document.getElementById('users-list');
const usersLoading = document.getElementById('users-loading');
const welcomeScreen = document.getElementById('welcome-screen');
const chatInterface = document.getElementById('chat-interface');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const currentUserAvatar = document.getElementById('current-user-avatar');
const currentUserName = document.getElementById('current-user-name');
const activeChatAvatar = document.getElementById('active-chat-avatar');
const activeChatName = document.getElementById('active-chat-name');
const activeChatStatus = document.getElementById('active-chat-status');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');

// Initialize the application
function initApp() {
    console.log("🚀 Initializing ChatApp");
    setupEventListeners();
    setupStorageListener();
    checkExistingSession();
}

// Listen for storage changes
function setupStorageListener() {
    window.addEventListener('storage', function(e) {
        if (e.key === appState.storage.storageKey) {
            console.log('🔄 Storage updated from another tab, refreshing...');
            if (appState.currentUser) {
                refreshAllUsers();
                if (appState.activeChat) {
                    loadMessages();
                }
            }
        }
    });
}

// Check if user is already logged in
function checkExistingSession() {
    try {
        const savedUser = localStorage.getItem('chatapp_current_user');
        
        if (savedUser) {
            appState.currentUser = JSON.parse(savedUser);
            console.log("✅ User found in session:", appState.currentUser.name);
            showChatApp();
        }
    } catch (error) {
        console.error("❌ Error checking session:", error);
    }
}

// Setup event listeners
function setupEventListeners() {
    loginBtn.addEventListener('click', handleLogin);
    registerBtn.addEventListener('click', handleRegister);
    
    showRegister.addEventListener('click', () => showAuthForm('register'));
    showLogin.addEventListener('click', () => showAuthForm('login'));
    
    document.querySelectorAll('.use-test-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const username = btn.dataset.username;
            const password = btn.dataset.password;
            document.getElementById('login-username').value = username;
            document.getElementById('login-password').value = password;
            handleLogin();
        });
    });
    
    logoutBtn.addEventListener('click', handleLogout);
    refreshUsersBtn.addEventListener('click', refreshAllUsers);
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    document.getElementById('user-search').addEventListener('input', filterUsers);
}

// Switch between login and register forms
function showAuthForm(form) {
    if (form === 'register') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    } else {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    }
    clearErrors();
}

// Handle user login
function handleLogin() {
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    
    clearErrors();
    
    if (!username) {
        showError('login-username-error', 'Username is required');
        return;
    }
    
    if (!password) {
        showError('login-password-error', 'Password is required');
        return;
    }
    
    try {
        const user = appState.storage.loginUser(username, password);
        
        appState.currentUser = { 
            name: user.name,
            username: user.username, 
            avatar: user.avatar,
            createdAt: user.createdAt
        };
        
        localStorage.setItem('chatapp_current_user', JSON.stringify(appState.currentUser));
        showChatApp();
    } catch (error) {
        showError('login-error', error.message);
    }
}

// Handle user registration
function handleRegister() {
    const name = document.getElementById('register-name').value.trim();
    const username = document.getElementById('register-username').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    clearErrors();
    
    if (!name) {
        showError('register-name-error', 'Name is required');
        return;
    }
    
    if (!username) {
        showError('register-username-error', 'Username is required');
        return;
    }
    
    if (username.length < 3) {
        showError('register-username-error', 'Username must be at least 3 characters');
        return;
    }
    
    if (!password) {
        showError('register-password-error', 'Password is required');
        return;
    }
    
    if (password.length < 6) {
        showError('register-password-error', 'Password must be at least 6 characters');
        return;
    }
    
    if (password !== confirmPassword) {
        showError('register-confirm-password-error', 'Passwords do not match');
        return;
    }
    
    try {
        const newUser = {
            name: name,
            username: username,
            password: password,
            avatar: name.split(' ').map(n => n[0]).join('').toUpperCase()
        };
        
        const registeredUser = appState.storage.registerUser(newUser);
        
        appState.currentUser = { 
            name: registeredUser.name,
            username: registeredUser.username, 
            avatar: registeredUser.avatar,
            createdAt: registeredUser.createdAt
        };
        
        localStorage.setItem('chatapp_current_user', JSON.stringify(appState.currentUser));
        
        showSuccess('register-success', 'Account created successfully! Redirecting...');
        
        setTimeout(() => {
            showChatApp();
        }, 1500);
    } catch (error) {
        showError('register-error', error.message);
    }
}

// Show error message
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
}

// Show success message
function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
}

// Clear all error messages
function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
    });
    document.querySelectorAll('.success-message').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
    });
}

// Show chat application
function showChatApp() {
    authContainer.style.display = 'none';
    chatApp.style.display = 'flex';
    
    currentUserAvatar.textContent = appState.currentUser.avatar;
    currentUserName.textContent = appState.currentUser.name;
    
    refreshAllUsers();
    welcomeScreen.style.display = 'flex';
    chatInterface.classList.remove('active');
    
    startMessageChecker();
}

// Refresh ALL users
function refreshAllUsers() {
    usersLoading.style.display = 'block';
    
    try {
        appState.storage.refreshData();
        appState.allUsers = appState.storage.getAllUsers(appState.currentUser.username);
        renderUsersList();
    } catch (error) {
        console.error('Error refreshing users:', error);
        showErrorInUsersList('Error loading users');
    } finally {
        usersLoading.style.display = 'none';
    }
}

// Show error in users list
function showErrorInUsersList(message) {
    usersList.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: var(--error);">
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 15px;"></i>
            <p style="font-size: 1.1rem; margin-bottom: 10px;">${message}</p>
            <button onclick="refreshAllUsers()" style="background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Retry</button>
        </div>
    `;
}

// Render users list
function renderUsersList() {
    usersList.innerHTML = '';
    
    if (appState.allUsers.length === 0) {
        usersList.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: var(--gray);">
                <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p style="font-size: 1.1rem; margin-bottom: 10px;">No other users found</p>
                <p style="font-size: 0.9rem;">
                    Ask a friend to create an account to start chatting!
                </p>
            </div>
        `;
        return;
    }
    
    appState.allUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.dataset.username = user.username;
        
        const statusClass = user.isOnline ? 'online' : 'offline';
        const dotClass = user.isOnline ? 'online' : 'offline';
        const statusText = user.status;
        
        userItem.innerHTML = `
            <div class="user-avatar" style="background: ${getRandomColor()}">${user.avatar}</div>
            <div class="user-details">
                <div class="user-details-header">
                    <div class="user-details-name">${user.name}</div>
                    <div class="user-status ${statusClass}">
                        <span class="online-dot ${dotClass}"></span>${statusText}
                    </div>
                </div>
                <div class="user-last-message">${user.lastMessage}</div>
            </div>
        `;
        
        userItem.addEventListener('click', () => openChat(user));
        usersList.appendChild(userItem);
    });

    const userCount = document.createElement('div');
    userCount.style.padding = '15px 20px';
    userCount.style.fontSize = '0.85rem';
    userCount.style.color = 'var(--gray)';
    userCount.style.borderTop = '1px solid var(--light-gray)';
    userCount.style.background = 'var(--light-gray)';
    const onlineCount = appState.allUsers.filter(u => u.isOnline).length;
    userCount.textContent = `${appState.allUsers.length} user(s) total, ${onlineCount} online`;
    usersList.appendChild(userCount);
}

// Filter users based on search input
function filterUsers() {
    const searchTerm = document.getElementById('user-search').value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const username = item.dataset.username.toLowerCase();
        const userName = item.querySelector('.user-details-name').textContent.toLowerCase();
        item.style.display = (userName.includes(searchTerm) || username.includes(searchTerm)) ? 'flex' : 'none';
    });
}

// Open chat with a user
function openChat(user) {
    appState.activeChat = user;
    
    activeChatAvatar.textContent = user.avatar;
    activeChatAvatar.style.background = getRandomColor();
    activeChatName.textContent = user.name;
    
    const statusClass = user.isOnline ? 'online' : 'offline';
    const dotClass = user.isOnline ? 'online' : 'offline';
    const statusText = user.status;
    activeChatStatus.innerHTML = `<span class="online-dot ${dotClass}"></span>${statusText}`;
    activeChatStatus.className = `chat-contact-status ${statusClass}`;
    
    welcomeScreen.style.display = 'none';
    chatInterface.classList.add('active');
    
    loadMessages();
    messageInput.focus();
    
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('chat-area').classList.add('active');
    }
}

// Load messages for active chat
function loadMessages() {
    const messages = appState.storage.getMessages(appState.currentUser.username, appState.activeChat.username);
    
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'message received';
        welcomeMsg.innerHTML = `
            <div class="message-text">No messages yet. Say hello to start the conversation! 👋</div>
            <div class="message-time">Now</div>
        `;
        messagesContainer.appendChild(welcomeMsg);
    } else {
        messages.forEach(message => {
            const messageElement = createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });
    }
    
    scrollToBottom();
}

// Create message element
function createMessageElement(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender === appState.currentUser.username ? 'sent' : 'received'}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageElement.innerHTML = `
        <div class="message-text">${message.text}</div>
        <div class="message-time">${time}</div>
    `;
    
    return messageElement;
}

// Send a message
function sendMessage() {
    const text = messageInput.value.trim();
    
    if (!text || !appState.activeChat) return;
    
    const message = {
        text: text,
        sender: appState.currentUser.username,
        receiver: appState.activeChat.username
    };
    
    try {
        const savedMessage = appState.storage.sendMessage(message);
        const messageElement = createMessageElement(savedMessage);
        messagesContainer.appendChild(messageElement);
        
        messageInput.value = '';
        scrollToBottom();
        refreshAllUsers();
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Start checking for new messages
function startMessageChecker() {
    appState.checkInterval = setInterval(() => {
        if (appState.activeChat) {
            checkForNewMessages();
        }
        appState.storage.updateUserActivity(appState.currentUser.username);
        refreshAllUsers();
    }, 2000);
}

// Check for new messages
function checkForNewMessages() {
    const currentMessages = appState.storage.getMessages(appState.currentUser.username, appState.activeChat.username);
    const currentMessageCount = currentMessages.length;
    
    const loadedMessageCount = messagesContainer.children.length;
    
    if (currentMessageCount > loadedMessageCount) {
        loadMessages();
    }
}

// Scroll messages to bottom
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle user logout
function handleLogout() {
    appState.currentUser = null;
    appState.activeChat = null;
    
    if (appState.checkInterval) {
        clearInterval(appState.checkInterval);
    }
    
    localStorage.removeItem('chatapp_current_user');
    
    chatApp.style.display = 'none';
    authContainer.style.display = 'flex';
    
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('register-name').value = '';
    document.getElementById('register-username').value = '';
    document.getElementById('register-password').value = '';
    document.getElementById('register-confirm-password').value = '';
    clearErrors();
    
    showAuthForm('login');
}

// Generate random color for avatars
function getRandomColor() {
    const colors = [
        '#0084ff', '#00c6ff', '#667eea', '#764ba2',
        '#f093fb', '#f5576c', '#4facfe', '#00f2fe',
        '#43e97b', '#38f9d7', '#fa709a', '#fee140'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Initialize the app when page loads
window.addEventListener('load', initApp);

// Handle window resize for mobile view
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('chat-area').classList.remove('active');
    }
});

// Make refreshAllUsers available globally
window.refreshAllUsers = refreshAllUsers;
