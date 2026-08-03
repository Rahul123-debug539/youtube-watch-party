import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import Room from '../models/Room.js';

class SocketManager {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map(); // socketId -> { ws, roomCode, userId }
    this.rooms = new Map(); // roomCode -> Set of socketIds
    
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      const socketId = uuidv4();
      
      this.clients.set(socketId, {
        ws,
        roomCode: null,
        userId: null
      });

      console.log(`New WebSocket connection: ${socketId}`);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleMessage(socketId, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', async () => {
        await this.handleDisconnect(socketId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${socketId}:`, error);
      });
    });
  }

  async handleMessage(socketId, data) {
    const client = this.clients.get(socketId);
    if (!client) return;

    const { ws } = client;
    const { type, payload } = data;

    switch (type) {
      case 'join_room':
        await this.handleJoinRoom(socketId, payload);
        break;
      case 'play':
        await this.handlePlay(socketId);
        break;
      case 'pause':
        await this.handlePause(socketId);
        break;
      case 'seek':
        await this.handleSeek(socketId, payload);
        break;
      case 'change_video':
        await this.handleChangeVideo(socketId, payload);
        break;
      case 'sync_request':
        await this.handleSyncRequest(socketId);
        break;
      case 'remove_participant':
        await this.handleRemoveParticipant(socketId, payload);
        break;
      default:
        this.sendError(ws, 'Unknown event type');
    }
  }

  async handleJoinRoom(socketId, payload) {
    const { roomCode, displayName } = payload;
    const client = this.clients.get(socketId);
    if (!client) return;

    const room = await Room.findOne({ roomCode });
    if (!room) {
      this.sendError(client.ws, 'Room not found');
      return;
    }

    // Check if room is full or other constraints
    if (room.participants.size >= 20) {
      this.sendError(client.ws, 'Room is full');
      return;
    }

    // Check if display name is taken
    let userId = null;
    let userRole = 'participant';
    
    for (const [id, data] of room.participants.entries()) {
      if (data.displayName === displayName) {
        userId = id;
        userRole = data.role;
        break;
      }
    }

    // If new user
    if (!userId) {
      userId = uuidv4();
      room.participants.set(userId, {
        displayName,
        socketId,
        role: 'participant',
        joinedAt: new Date()
      });
    } else {
      // Update socket ID for reconnecting user
      room.participants.get(userId).socketId = socketId;
    }

    await room.save();

    // Update client info
    client.roomCode = roomCode;
    client.userId = userId;

    // Add to room's socket set
    if (!this.rooms.has(roomCode)) {
      this.rooms.set(roomCode, new Set());
    }
    this.rooms.get(roomCode).add(socketId);

    // Send room state to new user
    const participants = Array.from(room.participants.entries()).map(([id, data]) => ({
      id,
      ...data.toObject()
    }));

    const roomState = {
      roomCode: room.roomCode,
      currentVideo: room.currentVideo,
      currentTime: room.currentTime,
      isPlaying: room.isPlaying,
      participants,
      hostId: room.hostId,
      userId: userId,
      userRole: userRole || 'participant'
    };

    this.sendToClient(socketId, 'room_state', roomState);

    // Broadcast user_joined to others
    this.broadcastToRoom(roomCode, 'user_joined', {
      userId,
      displayName,
      role: userRole || 'participant'
    }, socketId);
  }

  async handlePlay(socketId) {
    const client = this.clients.get(socketId);
    if (!client) return;

    const room = await this.getRoom(client.roomCode);
    if (!room) return;

    // Check if user is host
    if (client.userId !== room.hostId) {
      this.sendError(client.ws, 'Only host can control playback');
      return;
    }

    room.isPlaying = true;
    await room.save();

    this.broadcastToRoom(client.roomCode, 'play', {
      timestamp: Date.now()
    }, socketId);
  }

  async handlePause(socketId) {
    const client = this.clients.get(socketId);
    if (!client) return;

    const room = await this.getRoom(client.roomCode);
    if (!room) return;

    if (client.userId !== room.hostId) {
      this.sendError(client.ws, 'Only host can control playback');
      return;
    }

    room.isPlaying = false;
    await room.save();

    this.broadcastToRoom(client.roomCode, 'pause', {
      timestamp: Date.now()
    }, socketId);
  }

  async handleSeek(socketId, payload) {
    const { time } = payload;
    const client = this.clients.get(socketId);
    if (!client) return;

    const room = await this.getRoom(client.roomCode);
    if (!room) return;

    if (client.userId !== room.hostId) {
      this.sendError(client.ws, 'Only host can seek');
      return;
    }

    room.currentTime = time;
    await room.save();

    this.broadcastToRoom(client.roomCode, 'seek', {
      time,
      timestamp: Date.now()
    }, socketId);
  }

  async handleChangeVideo(socketId, payload) {
    const { videoId } = payload;
    const client = this.clients.get(socketId);
    if (!client) return;

    const room = await this.getRoom(client.roomCode);
    if (!room) return;

    if (client.userId !== room.hostId) {
      this.sendError(client.ws, 'Only host can change video');
      return;
    }

    room.currentVideo = videoId;
    room.currentTime = 0;
    room.isPlaying = false;
    await room.save();

    this.broadcastToRoom(client.roomCode, 'change_video', {
      videoId,
      timestamp: Date.now()
    }, socketId);
  }

  async handleSyncRequest(socketId) {
    const client = this.clients.get(socketId);
    if (!client || !client.roomCode) return;

    const room = await this.getRoom(client.roomCode);
    if (!room) return;

    this.sendToClient(socketId, 'sync_response', {
      videoId: room.currentVideo,
      time: room.currentTime,
      isPlaying: room.isPlaying,
      timestamp: Date.now()
    });
  }

  async handleRemoveParticipant(socketId, payload) {
    const { targetUserId } = payload;
    const client = this.clients.get(socketId);
    if (!client) return;

    const room = await this.getRoom(client.roomCode);
    if (!room) return;

    if (client.userId !== room.hostId) {
      this.sendError(client.ws, 'Only host can remove participants');
      return;
    }

    const participant = room.participants.get(targetUserId);
    if (!participant) return;

    // Remove participant
    room.participants.delete(targetUserId);
    await room.save();

    // Notify everyone
    this.broadcastToRoom(client.roomCode, 'user_left', {
      userId: targetUserId,
      displayName: participant.displayName
    });

    // Disconnect the participant if connected
    const targetSocketId = participant.socketId;
    if (targetSocketId) {
      const targetClient = this.clients.get(targetSocketId);
      if (targetClient) {
        this.sendToClient(targetSocketId, 'removed_by_host', {
          message: 'You have been removed by the host'
        });
        // Close connection
        targetClient.ws.close();
      }
    }
  }

  async handleDisconnect(socketId) {
    const client = this.clients.get(socketId);
    if (!client) return;

    const { roomCode, userId } = client;

    if (roomCode && userId) {
      const room = await this.getRoom(roomCode);
      if (room) {
        const participant = room.participants.get(userId);
        if (participant) {
          // Check if host is leaving
          if (userId === room.hostId) {
            // Room closes when host leaves
            await Room.deleteOne({ roomCode });
            this.broadcastToRoom(roomCode, 'room_closed', {
              message: 'Host has left the room'
            });
            // Clean up room sockets
            this.rooms.delete(roomCode);
          } else {
            // Remove participant
            room.participants.delete(userId);
            await room.save();
            this.broadcastToRoom(roomCode, 'user_left', {
              userId,
              displayName: participant.displayName
            });
          }
        }
      }
    }

    // Remove from rooms set
    if (roomCode && this.rooms.has(roomCode)) {
      this.rooms.get(roomCode).delete(socketId);
      if (this.rooms.get(roomCode).size === 0) {
        this.rooms.delete(roomCode);
      }
    }

    this.clients.delete(socketId);
  }

  async getRoom(roomCode) {
    if (!roomCode) return null;
    return await Room.findOne({ roomCode });
  }

  sendToClient(socketId, type, payload) {
    const client = this.clients.get(socketId);
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify({ type, payload }));
    }
  }

  broadcastToRoom(roomCode, type, payload, excludeSocketId = null) {
    const sockets = this.rooms.get(roomCode);
    if (!sockets) return;

    const message = JSON.stringify({ type, payload });
    for (const socketId of sockets) {
      if (socketId === excludeSocketId) continue;
      const client = this.clients.get(socketId);
      if (client && client.ws.readyState === 1) {
        client.ws.send(message);
      }
    }
  }

  sendError(ws, message) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { message } 
      }));
    }
  }
}

export default SocketManager;