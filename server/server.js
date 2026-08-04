import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

console.log('📡 Starting Watch Party Server...');

// ============ STORAGE ============
const rooms = new Map();
const clients = new Map();

// ============ HELPERS ============
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

function sendToClient(socketId, type, payload) {
  const client = clients.get(socketId);
  if (client && client.ws.readyState === 1) {
    client.ws.send(JSON.stringify({ type, payload }));
    console.log(`📤 Sent ${type} to ${socketId}`);
    return true;
  }
  return false;
}

function broadcastToRoom(roomCode, type, payload, excludeSocketId = null) {
  const room = rooms.get(roomCode);
  if (!room) {
    console.log(`⚠️ Room ${roomCode} not found`);
    return 0;
  }

  const message = JSON.stringify({ type, payload });
  let count = 0;

  console.log(`📢 Broadcasting ${type} to room ${roomCode}`);

  for (const [userId, data] of room.participants.entries()) {
    const socketId = data.socketId;
    if (!socketId || socketId === excludeSocketId) continue;
    
    const client = clients.get(socketId);
    if (client && client.ws.readyState === 1) {
      client.ws.send(message);
      count++;
      console.log(`✅ Sent ${type} to ${data.displayName}`);
    }
  }

  console.log(`📤 Broadcast ${type} to ${count} clients`);
  return count;
}

function sendError(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'error', payload: { message } }));
  }
}

// ============ API ROUTES ============
app.post('/api/rooms/create', (req, res) => {
  try {
    const { displayName, videoUrl } = req.body;
    
    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    let roomCode;
    let exists = true;
    while (exists) {
      roomCode = generateRoomCode();
      if (!rooms.has(roomCode)) exists = false;
    }

    const hostId = uuidv4();
    
    const room = {
      roomCode,
      hostId,
      currentVideo: extractVideoId(videoUrl),
      currentTime: 0,
      isPlaying: false,
      participants: new Map()
    };

    room.participants.set(hostId, {
      displayName: displayName.trim(),
      socketId: null,
      role: 'host'
    });

    rooms.set(roomCode, room);

    console.log(`✅ Room created: ${roomCode} by ${displayName}`);

    res.status(201).json({
      roomCode,
      hostId,
      currentVideo: room.currentVideo,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.get('/api/rooms/:roomCode', (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = rooms.get(roomCode);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const participants = Array.from(room.participants.entries()).map(([id, data]) => ({
      id,
      displayName: data.displayName,
      role: data.role
    }));

    res.json({
      roomCode: room.roomCode,
      currentVideo: room.currentVideo,
      currentTime: room.currentTime,
      isPlaying: room.isPlaying,
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
    rooms: rooms.size,
    clients: clients.size 
  });
});

// ============ WEBSOCKET SERVER ============
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  const socketId = uuidv4();
  
  clients.set(socketId, {
    ws,
    roomCode: null,
    userId: null
  });

  console.log(`🔌 New connection: ${socketId}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      await handleMessage(socketId, data);
    } catch (error) {
      console.error('Message error:', error);
      sendError(ws, 'Invalid message');
    }
  });

  ws.on('close', () => {
    handleDisconnect(socketId);
  });

  ws.on('error', (error) => {
    console.error(`Socket error ${socketId}:`, error);
  });
});

// ============ MESSAGE HANDLERS ============
async function handleMessage(socketId, data) {
  const client = clients.get(socketId);
  if (!client) return;

  const { type, payload } = data;
  console.log(`📨 ${type} from ${socketId}`);

  switch (type) {
    case 'join_room': await handleJoin(socketId, payload); break;
    case 'play': await handlePlay(socketId); break;
    case 'pause': await handlePause(socketId); break;
    case 'seek': await handleSeek(socketId, payload); break;
    case 'change_video': await handleChangeVideo(socketId, payload); break;
    case 'sync_request': await handleSync(socketId); break;
    case 'remove_participant': await handleRemove(socketId, payload); break;
    default: sendError(client.ws, 'Unknown event');
  }
}

async function handleJoin(socketId, payload) {
  const { roomCode, displayName } = payload;
  const client = clients.get(socketId);
  if (!client) return;

  console.log(`👤 ${displayName} joining room ${roomCode}`);

  const room = rooms.get(roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  let userId = null;
  let userRole = 'participant';
  
  for (const [id, data] of room.participants.entries()) {
    if (data.displayName === displayName) {
      userId = id;
      userRole = data.role;
      break;
    }
  }

  if (!userId) {
    userId = uuidv4();
    room.participants.set(userId, {
      displayName,
      socketId,
      role: 'participant'
    });
    console.log(`✅ New participant: ${displayName}`);
  } else {
    const participant = room.participants.get(userId);
    participant.socketId = socketId;
    console.log(`🔄 Existing user: ${displayName}`);
  }

  client.roomCode = roomCode;
  client.userId = userId;

  const participants = Array.from(room.participants.entries()).map(([id, data]) => ({
    id,
    displayName: data.displayName,
    role: data.role
  }));

  const roomState = {
    roomCode: room.roomCode,
    currentVideo: room.currentVideo,
    currentTime: room.currentTime,
    isPlaying: room.isPlaying,
    participants,
    hostId: room.hostId,
    userId: userId,
    userRole: userRole
  };

  sendToClient(socketId, 'room_state', roomState);
  broadcastToRoom(roomCode, 'user_joined', {
    userId,
    displayName,
    role: userRole
  }, socketId);
}

async function handlePlay(socketId) {
  const client = clients.get(socketId);
  if (!client) return;

  const room = rooms.get(client.roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  const isHost = client.userId === room.hostId;
  if (!isHost) {
    sendError(client.ws, 'Only host can control playback');
    return;
  }

  room.isPlaying = true;
  console.log(`▶️ Play - Room ${client.roomCode}`);

  // Broadcast to ALL including host
  broadcastToRoom(client.roomCode, 'play', { 
    timestamp: Date.now(),
    isPlaying: true 
  }, null);
}

async function handlePause(socketId) {
  const client = clients.get(socketId);
  if (!client) return;

  const room = rooms.get(client.roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  const isHost = client.userId === room.hostId;
  if (!isHost) {
    sendError(client.ws, 'Only host can control playback');
    return;
  }

  room.isPlaying = false;
  console.log(`⏸️ Pause - Room ${client.roomCode}`);

  broadcastToRoom(client.roomCode, 'pause', { 
    timestamp: Date.now(),
    isPlaying: false 
  }, null);
}

async function handleSeek(socketId, payload) {
  const { time } = payload;
  const client = clients.get(socketId);
  if (!client) return;

  const room = rooms.get(client.roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  const isHost = client.userId === room.hostId;
  if (!isHost) {
    sendError(client.ws, 'Only host can seek');
    return;
  }

  room.currentTime = time;
  console.log(`⏩ Seek - Room ${client.roomCode} to ${time}`);

  broadcastToRoom(client.roomCode, 'seek', { 
    time,
    timestamp: Date.now()
  }, null);
}

async function handleChangeVideo(socketId, payload) {
  const { videoId } = payload;
  const client = clients.get(socketId);
  if (!client) return;

  const room = rooms.get(client.roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  const isHost = client.userId === room.hostId;
  if (!isHost) {
    sendError(client.ws, 'Only host can change video');
    return;
  }

  room.currentVideo = videoId;
  room.currentTime = 0;
  room.isPlaying = false;
  console.log(`🎬 Video changed - Room ${client.roomCode} to ${videoId}`);

  broadcastToRoom(client.roomCode, 'change_video', { 
    videoId,
    timestamp: Date.now()
  }, null);
}

async function handleSync(socketId) {
  const client = clients.get(socketId);
  if (!client || !client.roomCode) return;

  const room = rooms.get(client.roomCode);
  if (!room) return;

  console.log(`🔄 SYNC from ${socketId}`);
  
  sendToClient(socketId, 'sync_response', {
    videoId: room.currentVideo,
    time: room.currentTime,
    isPlaying: room.isPlaying
  });
}

async function handleRemove(socketId, payload) {
  const { targetUserId } = payload;
  const client = clients.get(socketId);
  if (!client) return;

  const room = rooms.get(client.roomCode);
  if (!room) return;

  const isHost = client.userId === room.hostId;
  if (!isHost) {
    sendError(client.ws, 'Only host can remove participants');
    return;
  }

  const participant = room.participants.get(targetUserId);
  if (!participant) return;

  room.participants.delete(targetUserId);
  
  broadcastToRoom(client.roomCode, 'user_left', {
    userId: targetUserId,
    displayName: participant.displayName
  });

  if (participant.socketId) {
    const targetClient = clients.get(participant.socketId);
    if (targetClient) {
      sendToClient(participant.socketId, 'removed_by_host', {
        message: 'You have been removed by the host'
      });
      targetClient.ws.close();
    }
  }
}

function handleDisconnect(socketId) {
  const client = clients.get(socketId);
  if (!client) return;

  const { roomCode, userId } = client;

  if (roomCode && userId) {
    const room = rooms.get(roomCode);
    if (room) {
      const participant = room.participants.get(userId);
      if (participant) {
        if (userId === room.hostId) {
          rooms.delete(roomCode);
          broadcastToRoom(roomCode, 'room_closed', {
            message: 'Host has left the room'
          });
          console.log(`🏠 Room ${roomCode} closed by host`);
        } else {
          room.participants.delete(userId);
          broadcastToRoom(roomCode, 'user_left', {
            userId,
            displayName: participant.displayName
          });
          console.log(`👤 ${participant.displayName} left`);
        }
      }
    }
  }

  clients.delete(socketId);
  console.log(`🔌 Disconnected: ${socketId}`);
}

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket on ws://localhost:${PORT}/ws`);
});