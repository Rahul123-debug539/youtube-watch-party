import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    length: 6
  },
  hostId: {
    type: String,
    required: true
  },
  currentVideo: {
    type: String,
    default: 'dQw4w9WgXcQ' // Default video
  },
  currentTime: {
    type: Number,
    default: 0
  },
  isPlaying: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Auto-delete after 24 hours
  },
  participants: {
    type: Map,
    of: new mongoose.Schema({
      displayName: String,
      socketId: String,
      role: {
        type: String,
        enum: ['host', 'participant'],
        default: 'participant'
      },
      joinedAt: Date
    }),
    default: new Map()
  }
}, {
  timestamps: true
});

// Generate a 6-character room code
roomSchema.statics.generateRoomCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const Room = mongoose.model('Room', roomSchema);
export default Room;