# 🎬 YouTube Watch Party

A real-time YouTube Watch Party application built with the MERN Stack and Socket.IO. It allows multiple users to watch YouTube videos together in sync, just like Teleparty or Watch2Gether.

---

## 🚀 Features

### Room Management
- Create a Watch Party Room
- Join Room using Room ID / Invite Link
- Unique Room ID generation
- Live participant count
- Live participant list
- Host role management
- Automatic host transfer when host leaves
- Delete room when all users leave

### Video Synchronization
- Play synchronization
- Pause synchronization
- Seek synchronization
- Change YouTube video synchronization
- Real-time playback using Socket.IO

### User Roles

#### 👑 Host
- Create Room
- Change YouTube Video
- Play Video
- Pause Video
- Seek Video
- Copy Room ID
- Copy Invite Link
- Leave Room

#### 👤 Participant
- Join Room
- Watch synchronized video
- View participants
- Leave Room

---

# 🛠 Tech Stack

## Frontend

- React.js
- React Router DOM
- React Player
- Socket.IO Client
- CSS

## Backend

- Node.js
- Express.js
- Socket.IO
- MongoDB
- Mongoose

---

# 📂 Project Structure

```text
youtube-watch-party
│
├── client
│   ├── src
│   │   ├── pages
│   │   ├── socket
│   │   ├── components
│   │   └── App.jsx
│
├── server
│   ├── models
│   ├── socket
│   ├── routes
│   ├── controllers
│   ├── server.js
│   └── app.js
│
├── README.md
└── package.json
```

---

# ⚙ Installation

## Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/youtube-watch-party.git
```

```bash
cd youtube-watch-party
```

---

## Backend Setup

```bash
cd server
```

Install dependencies

```bash
npm install
```

Create `.env`

```env
PORT=5000

MONGO_URI=YOUR_MONGODB_CONNECTION_STRING
```

Run backend

```bash
npm run dev
```

---

## Frontend Setup

```bash
cd client
```

Install dependencies

```bash
npm install
```

Run frontend

```bash
npm run dev
```

---

# 🌐 Live Demo

## Frontend

```
https://youtube-watch-party-blond.vercel.app/
```

## Backend

```
https://youtube-watch-party-s7p4.onrender.com/health
```

---

# 📡 WebSocket Architecture

```text
Host
      │
      ▼
Create Room
      │
      ▼
MongoDB
      │
      ▼
Socket.IO Room
      │
      ▼
Participants Join
      │
      ▼
Video Synchronization
      │
      ▼
Play
Pause
Seek
Change Video
```

---

# 🔄 Socket Events

```
create-room

join-room

leave-room

participants-updated

change-video

video-changed

play-video

pause-video

seek-video

get-player-state
```

---

# 📸 Screenshots

Add screenshots of:

- Home Page
- Room Page
- Host View
- Participant View

---

# 🎥 Demo Video

(Optional)

Add demo video link here.

---

# 📌 Future Improvements

- Video Queue
- Chat System
- Emoji Reactions
- Screen Sharing
- Voice Chat
- Moderator Role
- Authentication
- Password Protected Rooms
- Recording Support
- File Sharing (PDF, PPT, DOC)

---

# 👨‍💻 Author

**Rahul Kumar Tiwari**

MCA Student

GitHub:
https://github.com/Rahul123-debug539

LinkedIn:
https://www.linkedin.com/in/rahulkumartiwari/

Portfolio:
https://rahulkumartiwari-portfolio.netlify.app/

---

# 📄 License

This project is developed for educational and assignment purposes.