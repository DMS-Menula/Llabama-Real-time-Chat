const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Message storage file
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Initialize messages file if it doesn't exist
if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
}

// Load messages from file
function loadMessages() {
    try {
        const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading messages:', err);
        return [];
    }
}

// Save messages to file
function saveMessages(messages) {
    try {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    } catch (err) {
        console.error('Error saving messages:', err);
    }
}

// Clean up old messages
function cleanOldMessages() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let messages = loadMessages();
    messages = messages.filter(msg => msg.timestamp > thirtyDaysAgo);
    saveMessages(messages);
}

// Run cleanup every day
setInterval(cleanOldMessages, 24 * 60 * 60 * 1000);
cleanOldMessages(); // Run once on startup

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Route for root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let users = [];

io.on('connection', (socket) => {
    console.log('New client connected');
    
    // Send current state to new client
    socket.emit('users-online', users.length);
    socket.emit('user-connected', users);
    socket.emit('initial-messages', loadMessages());

    socket.on('user-connected', (userData) => {
        if (!users.some(u => u.userId === userData.userId)) {
            users.push({
                userId: userData.userId,
                username: userData.username,
                socketId: socket.id
            });
            
            io.emit('users-online', users.length);
            io.emit('user-connected', users);
            console.log(`${userData.username} connected`);
        }
    });

    socket.on('message', (message) => {
        const messages = loadMessages();
        messages.push(message);
        saveMessages(messages);
        io.emit('message', message);
    });

    socket.on('change-name', (data) => {
        const user = users.find(u => u.userId === data.userId);
        if (user) {
            user.username = data.newName;
            io.emit('name-changed', {
                userId: data.userId,
                newName: data.newName,
                users: users
            });
            console.log(`${user.userId} changed name to ${data.newName}`);
        }
    });

    socket.on('disconnect', () => {
        const disconnectedUser = users.find(u => u.socketId === socket.id);
        if (disconnectedUser) {
            users = users.filter(u => u.socketId !== socket.id);
            io.emit('users-online', users.length);
            io.emit('user-disconnected', users);
            console.log(`${disconnectedUser.username} disconnected`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});