import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import Room from '../models/Room.js';

const router = express.Router();

// Create a new room
router.post('/create', async (req, res) => {
  try {
    const { displayName, videoUrl } = req.body;
    
    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    // Generate unique room code
    let roomCode;
    let exists = true;
    while (exists) {
      roomCode = await Room.generateRoomCode();
      const existing = await Room.findOne({ roomCode });
      if (!existing) exists = false;
    }

    const hostId = uuidv4();
    const newRoom = new Room({
      roomCode,
      hostId,
      currentVideo: extractVideoId(videoUrl) || 'dQw4w9WgXcQ'
    });

    // Add host as first participant
    newRoom.participants.set(hostId, {
      displayName: displayName.trim(),
      socketId: null,
      role: 'host',
      joinedAt: new Date()
    });

    await newRoom.save();

    res.status(201).json({
      roomCode,
      hostId,
      currentVideo: newRoom.currentVideo,
      isPlaying: newRoom.isPlaying,
      currentTime: newRoom.currentTime
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get room info
router.get('/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = await Room.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Convert participants Map to array for frontend
    const participants = Array.from(room.participants.entries()).map(([id, data]) => ({
      id,
      ...data.toObject()
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

// Helper function to extract YouTube video ID
function extractVideoId(url) {
  if (!url) return null;
  
  // Check if it's already a video ID (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&]+)/,
    /(?:youtu\.be\/)([^?]+)/,
    /(?:youtube\.com\/embed\/)([^?]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export default router;