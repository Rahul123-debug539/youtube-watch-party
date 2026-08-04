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
    return;
  }

  const message = JSON.stringify({ type, payload });
  let count = 0;

  console.log(`📢 Broadcasting ${type} to room ${roomCode}`);
  console.log(`👥 Participants in room:`, Array.from(room.participants.keys()));

  for (const [userId, data] of room.participants.entries()) {
    const socketId = data.socketId;
    
    // Skip if no socket or excluded
    if (!socketId || socketId === excludeSocketId) {
      console.log(`⏭️ Skipping ${data.displayName} (${socketId})`);
      continue;
    }
    
    const client = clients.get(socketId);
    if (client && client.ws.readyState === 1) {
      client.ws.send(message);
      count++;
      console.log(`📤 Sent ${type} to ${data.displayName} (${socketId})`);
    } else {
      console.log(`⚠️ Client ${socketId} not connected`);
    }
  }

  console.log(`📤 Broadcast ${type} to ${count} clients`);
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
    case 'join_room':
      await handleJoin(socketId, payload);
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
      await handleSync(socketId);
      break;
    case 'remove_participant':
      await handleRemove(socketId, payload);
      break;
    default:
      sendError(client.ws, 'Unknown event');
  }
}

// ===== JOIN =====
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

  // New user
  if (!userId) {
    userId = uuidv4();
    room.participants.set(userId, {
      displayName,
      socketId,
      role: 'participant'
    });
    console.log(`✅ New participant: ${displayName}`);
  } else {
    // Update socket
    const participant = room.participants.get(userId);
    participant.socketId = socketId;
    console.log(`🔄 Existing user: ${displayName}`);
  }

  client.roomCode = roomCode;
  client.userId = userId;

  // Send room state to this user
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

  console.log(`📤 Sending room_state to ${displayName}`);
  sendToClient(socketId, 'room_state', roomState);

  // Broadcast user joined to others
  broadcastToRoom(roomCode, 'user_joined', {
    userId,
    displayName,
    role: userRole
  }, socketId);
}

// ===== PLAY - FIXED =====
async function handlePlay(socketId) {
  const client = clients.get(socketId);
  if (!client) return;

  console.log(`🎯 PLAY from ${socketId}`);

  const room = rooms.get(client.roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  // Check if user is HOST
  const isHost = client.userId === room.hostId;
  console.log(`🔍 User ${client.userId} isHost: ${isHost}`);

  if (!isHost) {
    console.log(`❌ Non-host tried to play!`);
    sendError(client.ws, 'Only host can control playback');
    return;
  }

  // Update room state
  room.isPlaying = true;
  console.log(`▶️ Play - Room ${client.roomCode} state updated`);

  // Broadcast to ALL clients (including host)
  broadcastToRoom(client.roomCode, 'play', { 
    timestamp: Date.now(),
    isPlaying: true 
  }, null);
}

// ===== PAUSE - FIXED =====
async function handlePause(socketId) {
  const client = clients.get(socketId);
  if (!client) return;

  console.log(`🎯 PAUSE from ${socketId}`);

  const room = rooms.get(client.roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  // Check if user is HOST
  const isHost = client.userId === room.hostId;
  console.log(`🔍 User ${client.userId} isHost: ${isHost}`);

  if (!isHost) {
    console.log(`❌ Non-host tried to pause!`);
    sendError(client.ws, 'Only host can control playback');
    return;
  }

  // Update room state
  room.isPlaying = false;
  console.log(`⏸️ Pause - Room ${client.roomCode} state updated`);

  // Broadcast to ALL clients (including host)
  broadcastToRoom(client.roomCode, 'pause', { 
    timestamp: Date.now(),
    isPlaying: false 
  }, null);
}

// ===== SEEK - FIXED =====
async function handleSeek(socketId, payload) {
  const { time } = payload;
  const client = clients.get(socketId);
  if (!client) return;

  console.log(`🎯 SEEK from ${socketId} to ${time}`);

  const room = rooms.get(client.roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  // Check if user is HOST
  const isHost = client.userId === room.hostId;
  if (!isHost) {
    console.log(`❌ Non-host tried to seek!`);
    sendError(client.ws, 'Only host can seek');
    return;
  }

  // Update room state
  room.currentTime = time;
  console.log(`⏩ Seek - Room ${client.roomCode} time updated to ${time}`);

  // Broadcast to ALL clients (including host)
  broadcastToRoom(client.roomCode, 'seek', { 
    time,
    timestamp: Date.now()
  }, null);
}

// ===== CHANGE VIDEO - FIXED =====
async function handleChangeVideo(socketId, payload) {
  const { videoId } = payload;
  const client = clients.get(socketId);
  if (!client) return;

  console.log(`🎯 CHANGE_VIDEO from ${socketId} to ${videoId}`);

  const room = rooms.get(client.roomCode);
  if (!room) {
    sendError(client.ws, 'Room not found');
    return;
  }

  // Check if user is HOST
  const isHost = client.userId === room.hostId;
  if (!isHost) {
    console.log(`❌ Non-host tried to change video!`);
    sendError(client.ws, 'Only host can change video');
    return;
  }

  // Update room state
  room.currentVideo = videoId;
  room.currentTime = 0;
  room.isPlaying = false;
  console.log(`🎬 Video changed - Room ${client.roomCode}`);

  // Broadcast to ALL clients (including host)
  broadcastToRoom(client.roomCode, 'change_video', { 
    videoId,
    timestamp: Date.now()
  }, null);
}

// ===== SYNC =====
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

// ===== REMOVE PARTICIPANT =====
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

  // Disconnect the user
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

// ===== DISCONNECT =====
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

// ============ START ============
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket on ws://localhost:${PORT}/ws`);
});