import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

console.log('📡 Starting YouTube Watch Party Server...');

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/watchparty';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.log('⚠️ MongoDB not connected (using in-memory):', err.message));

// Room Schema
let Room;
try {
  const roomSchema = new mongoose.Schema({
    roomCode: { type: String, required: true, unique: true, uppercase: true },
    hostId: { type: String, required: true },
    currentVideo: { type: String, default: 'dQw4w9WgXcQ' },
    currentTime: { type: Number, default: 0 },
    isPlaying: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 86400 },
    participants: {
      type: Map,
      of: new mongoose.Schema({
        displayName: String,
        socketId: String,
        role: { type: String, enum: ['host', 'participant'], default: 'participant' },
        joinedAt: Date
      }),
      default: new Map()
    }
  });
  
  roomSchema.statics.generateRoomCode = function() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };
  
  Room = mongoose.model('Room', roomSchema);
} catch (e) {
  console.log('MongoDB model not created');
}

// In-memory storage
const inMemoryRooms = new Map();

// Helper functions
const getRoom = async (roomCode) => {
  if (Room) {
    const room = await Room.findOne({ roomCode });
    if (room) return room;
  }
  return inMemoryRooms.get(roomCode);
};

const saveRoom = async (room) => {
  if (Room && room.save) {
    return await room.save();
  }
  inMemoryRooms.set(room.roomCode, room);
  return room;
};

const deleteRoom = async (roomCode) => {
  if (Room) {
    await Room.deleteOne({ roomCode });
  }
  inMemoryRooms.delete(roomCode);
};

function extractVideoId(url) {
  if (!url) return 'dQw4w9WgXcQ';
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&]+)/,
    /(?:youtu\.be\/)([^?]+)/,
    /(?:youtube\.com\/embed\/)([^?]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return 'dQw4w9WgXcQ';
}

// ============ API ROUTES ============

app.post('/api/rooms/create', async (req, res) => {
  console.log('📨 Create room request:', req.body);
  
  try {
    const { displayName, videoUrl } = req.body;
    
    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    let roomCode;
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 10) {
      roomCode = '';
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      for (let i = 0; i < 6; i++) {
        roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existing = await getRoom(roomCode);
      if (!existing) exists = false;
      attempts++;
    }

    if (exists) {
      return res.status(500).json({ error: 'Failed to generate unique room code' });
    }

    const hostId = uuidv4();

    let newRoom;
    if (Room) {
      newRoom = new Room({
        roomCode,
        hostId,
        currentVideo: extractVideoId(videoUrl)
      });
      newRoom.participants.set(hostId, {
        displayName: displayName.trim(),
        socketId: null,
        role: 'host',
        joinedAt: new Date()
      });
    } else {
      newRoom = {
        roomCode,
        hostId,
        currentVideo: extractVideoId(videoUrl),
        currentTime: 0,
        isPlaying: false,
        participants: new Map(),
        save: async function() { 
          inMemoryRooms.set(this.roomCode, this); 
          return this; 
        }
      };
      newRoom.participants.set(hostId, {
        displayName: displayName.trim(),
        socketId: null,
        role: 'host',
        joinedAt: new Date()
      });
    }

    await saveRoom(newRoom);

    console.log(`✅ Room created: ${roomCode} by ${displayName}`);

    res.status(201).json({
      roomCode,
      hostId,
      currentVideo: newRoom.currentVideo,
      isPlaying: newRoom.isPlaying || false,
      currentTime: newRoom.currentTime || 0
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room: ' + error.message });
  }
});

app.get('/api/rooms/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    console.log(`📨 Get room: ${roomCode}`);
    
    const room = await getRoom(roomCode);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const participants = Array.from(room.participants.entries()).map(([id, data]) => ({
      id,
      ...(data.toObject ? data.toObject() : data)
    }));

    res.json({
      roomCode: room.roomCode,
      currentVideo: room.currentVideo,
      currentTime: room.currentTime || 0,
      isPlaying: room.isPlaying || false,
      participants,
      hostId: room.hostId
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// ============ WEBSOCKET SERVER ============

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map();
const rooms = new Map();

wss.on('connection', (ws) => {
  const socketId = uuidv4();
  
  clients.set(socketId, {
    ws,
    roomCode: null,
    userId: null
  });

  console.log(`🔌 New WebSocket connection: ${socketId}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      await handleMessage(socketId, data);
    } catch (error) {
      console.error('WebSocket message error:', error);
      sendError(ws, 'Invalid message format');
    }
  });

  ws.on('close', async () => {
    await handleDisconnect(socketId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${socketId}:`, error);
  });
});

// ============ WEBSOCKET MESSAGE HANDLERS ============

async function handleMessage(socketId, data) {
  const client = clients.get(socketId);
  if (!client) return;

  const { ws } = client;
  const { type, payload } = data;

  console.log(`📨 Message from ${socketId}:`, type);

  switch (type) {
    case 'join_room':
      await handleJoinRoom(socketId, payload);
      break;
    case 'play':
      await handlePlay(socketId);
      break;
    case 'pause':
      await handlePause(socketId);
      break;
    case 'seek':
      await handleSeek(socketId, payload);
      break;
    case 'change_video':
      await handleChangeVideo(socketId, payload);
      break;
    case 'sync_request':
      await handleSyncRequest(socketId);
      break;
    case 'remove_participant':
      await handleRemoveParticipant(socketId, payload);
      break;
    default:
      sendError(ws, 'Unknown event type');
  }
}

async function handleJoinRoom(socketId, payload) {
  const { roomCode, displayName } = payload;
  const client = clients.get(socketId);
  if (!client) return;

  console.log(`👤 ${displayName} joining room ${roomCode}`);

  const room = await getRoom(roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  // Check if user already exists
  let userId = null;
  let userRole = 'participant';
  
  for (const [id, data] of room.participants.entries()) {
    if (data.displayName === displayName) {
      userId = id;
      userRole = data.role;
      break;
    }
  }

  // If new user, add them
  if (!userId) {
    userId = uuidv4();
    const participantData = {
      displayName,
      socketId,
      role: 'participant',
      joinedAt: new Date()
    };
    room.participants.set(userId, participantData);
    console.log(`✅ Added new participant: ${displayName} (${userId})`);
  } else {
    // Update existing user's socket ID
    const participant = room.participants.get(userId);
    participant.socketId = socketId;
    room.participants.set(userId, participant);
    console.log(`🔄 Updated existing participant: ${displayName} (${userId})`);
  }

  await saveRoom(room);

  // Update client info
  client.roomCode = roomCode;
  client.userId = userId;

  // Add to room's socket set
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, new Set());
  }
  rooms.get(roomCode).add(socketId);

  // Prepare participants list
  const participants = Array.from(room.participants.entries()).map(([id, data]) => ({
    id,
    displayName: data.displayName,
    role: data.role,
    socketId: data.socketId
  }));

  // Send room state to the new user
  const roomState = {
    roomCode: room.roomCode,
    currentVideo: room.currentVideo,
    currentTime: room.currentTime || 0,
    isPlaying: room.isPlaying || false,
    participants: participants,
    hostId: room.hostId,
    userId: userId,
    userRole: userRole || 'participant'
  };

  console.log(`📤 Sending room state to ${displayName}`);
  sendToClient(socketId, 'room_state', roomState);

  // Broadcast to others that a new user joined
  broadcastToRoom(roomCode, 'user_joined', {
    userId,
    displayName,
    role: userRole || 'participant'
  }, socketId);
}

async function handlePlay(socketId) {
  const client = clients.get(socketId);
  if (!client) return;

  console.log(`🎯 Play requested by ${socketId}`);

  const room = await getRoom(client.roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  // Check if user is host
  if (client.userId !== room.hostId) {
    console.log(`❌ User ${socketId} is not host. Host is ${room.hostId}`);
    sendError(client.ws, 'Only host can control playback');
    return;
  }

  room.isPlaying = true;
  await saveRoom(room);

  console.log(`▶️ Play broadcast to room ${client.roomCode}`);
  broadcastToRoom(client.roomCode, 'play', { timestamp: Date.now() }, socketId);
}

async function handlePause(socketId) {
  const client = clients.get(socketId);
  if (!client) return;

  console.log(`🎯 Pause requested by ${socketId}`);

  const room = await getRoom(client.roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  // Check if user is host
  if (client.userId !== room.hostId) {
    console.log(`❌ User ${socketId} is not host. Host is ${room.hostId}`);
    sendError(client.ws, 'Only host can control playback');
    return;
  }

  room.isPlaying = false;
  await saveRoom(room);

  console.log(`⏸️ Pause broadcast to room ${client.roomCode}`);
  broadcastToRoom(client.roomCode, 'pause', { timestamp: Date.now() }, socketId);
}

async function handleSeek(socketId, payload) {
  const { time } = payload;
  const client = clients.get(socketId);
  if (!client) return;

  console.log(`🎯 Seek requested by ${socketId} to ${time}`);

  const room = await getRoom(client.roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  // Check if user is host
  if (client.userId !== room.hostId) {
    console.log(`❌ User ${socketId} is not host. Host is ${room.hostId}`);
    sendError(client.ws, 'Only host can seek');
    return;
  }

  room.currentTime = time;
  await saveRoom(room);

  console.log(`⏩ Seek to ${time} broadcast to room ${client.roomCode}`);
  broadcastToRoom(client.roomCode, 'seek', { time, timestamp: Date.now() }, socketId);
}

async function handleChangeVideo(socketId, payload) {
  const { videoId } = payload;
  const client = clients.get(socketId);
  if (!client) return;

  console.log(`🎯 Change video requested by ${socketId} to ${videoId}`);

  const room = await getRoom(client.roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  // Check if user is host
  if (client.userId !== room.hostId) {
    console.log(`❌ User ${socketId} is not host. Host is ${room.hostId}`);
    sendError(client.ws, 'Only host can change video');
    return;
  }

  room.currentVideo = videoId;
  room.currentTime = 0;
  room.isPlaying = false;
  await saveRoom(room);

  console.log(`🎬 Video changed to ${videoId} in room ${client.roomCode}`);
  broadcastToRoom(client.roomCode, 'change_video', { videoId, timestamp: Date.now() }, socketId);
}

async function handleSyncRequest(socketId) {
  const client = clients.get(socketId);
  if (!client || !client.roomCode) return;

  const room = await getRoom(client.roomCode);
  if (!room) return;

  console.log(`🔄 Sync request from ${socketId}`);
  
  sendToClient(socketId, 'sync_response', {
    videoId: room.currentVideo,
    time: room.currentTime || 0,
    isPlaying: room.isPlaying || false,
    timestamp: Date.now()
  });
}

async function handleRemoveParticipant(socketId, payload) {
  const { targetUserId } = payload;
  const client = clients.get(socketId);
  if (!client) return;

  const room = await getRoom(client.roomCode);
  if (!room) return;

  // Check if user is host
  if (client.userId !== room.hostId) {
    sendError(client.ws, 'Only host can remove participants');
    return;
  }

  const participant = room.participants.get(targetUserId);
  if (!participant) return;

  room.participants.delete(targetUserId);
  await saveRoom(room);

  broadcastToRoom(client.roomCode, 'user_left', {
    userId: targetUserId,
    displayName: participant.displayName
  });

  const targetSocketId = participant.socketId;
  if (targetSocketId) {
    const targetClient = clients.get(targetSocketId);
    if (targetClient) {
      sendToClient(targetSocketId, 'removed_by_host', {
        message: 'You have been removed by the host'
      });
      targetClient.ws.close();
    }
  }
}

async function handleDisconnect(socketId) {
  const client = clients.get(socketId);
  if (!client) return;

  const { roomCode, userId } = client;

  if (roomCode && userId) {
    const room = await getRoom(roomCode);
    if (room) {
      const participant = room.participants.get(userId);
      if (participant) {
        if (userId === room.hostId) {
          await deleteRoom(roomCode);
          broadcastToRoom(roomCode, 'room_closed', {
            message: 'Host has left the room'
          });
          rooms.delete(roomCode);
          console.log(`🏠 Room ${roomCode} closed by host`);
        } else {
          room.participants.delete(userId);
          await saveRoom(room);
          broadcastToRoom(roomCode, 'user_left', {
            userId,
            displayName: participant.displayName
          });
          console.log(`👤 ${participant.displayName} left room ${roomCode}`);
        }
      }
    }
  }

  if (roomCode && rooms.has(roomCode)) {
    rooms.get(roomCode).delete(socketId);
    if (rooms.get(roomCode).size === 0) {
      rooms.delete(roomCode);
    }
  }

  clients.delete(socketId);
  console.log(`🔌 Client disconnected: ${socketId}`);
}

// ============ WEBSOCKET HELPER FUNCTIONS ============

function sendToClient(socketId, type, payload) {
  const client = clients.get(socketId);
  if (client && client.ws.readyState === 1) {
    client.ws.send(JSON.stringify({ type, payload }));
    console.log(`📤 Sent to ${socketId}:`, type);
  }
}

function broadcastToRoom(roomCode, type, payload, excludeSocketId = null) {
  const sockets = rooms.get(roomCode);
  if (!sockets) {
    console.log(`⚠️ No sockets in room ${roomCode}`);
    return;
  }

  const message = JSON.stringify({ type, payload });
  let sentCount = 0;
  
  for (const socketId of sockets) {
    if (socketId === excludeSocketId) continue;
    const client = clients.get(socketId);
    if (client && client.ws.readyState === 1) {
      client.ws.send(message);
      sentCount++;
    }
  }
  
  console.log(`📤 Broadcast ${type} to ${sentCount} clients in room ${roomCode}`);
}

function sendError(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      payload: { message } 
    }));
  }
}

// ============ START SERVER ============

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server on ws://localhost:${PORT}/ws`);
  console.log(`🔗 API endpoint: http://localhost:${PORT}/api`);
  console.log(`✅ Test API: http://localhost:${PORT}/api/test`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
});