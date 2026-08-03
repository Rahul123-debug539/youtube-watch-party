const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
  socketId: String,
  username: String,
  role: {
    type: String,
    enum: ["host", "moderator", "participant"],
    default: "participant",
  },
});

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    unique: true,
    required: true,
  },

  videoId: {
    type: String,
    default: "dQw4w9WgXcQ",
  },

  participants: [participantSchema],

  playerState: {
    playing: {
      type: Boolean,
      default: false,
    },

    currentTime: {
      type: Number,
      default: 0,
    },
  },
});

module.exports = mongoose.model("Room", roomSchema);