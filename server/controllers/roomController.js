const Room = require("../models/Room");
const { nanoid } = require("nanoid");

/**
 * Generate a unique 6-character room code.
 */
const generateRoomCode = async () => {
  let roomCode;
  let exists = true;

  while (exists) {
    roomCode = nanoid(6).toUpperCase();

    const room = await Room.findOne({ roomCode });

    if (!room) {
      exists = false;
    }
  }

  return roomCode;
};

/**
 * Extract YouTube Video ID
 */
const extractVideoId = (url) => {
  if (!url) return null;

  const regex =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

  const match = url.match(regex);

  return match ? match[1] : null;
};

/**
 * POST /api/rooms
 */
const createRoom = async (req, res) => {
  try {
    const { displayName, youtubeUrl } = req.body;

    if (!displayName || !youtubeUrl) {
      return res.status(400).json({
        success: false,
        message: "Display name and YouTube URL are required.",
      });
    }

    const videoId = extractVideoId(youtubeUrl);

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: "Invalid YouTube URL.",
      });
    }

    const roomCode = await generateRoomCode();

    const hostId = nanoid();

    const room = await Room.create({
      roomCode,
      hostId,

      currentVideo: {
        videoId,
        title: "",
      },

      playback: {
        currentTime: 0,
        isPlaying: false,
        lastUpdated: new Date(),
      },

      status: "ACTIVE",

      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return res.status(201).json({
      success: true,
      message: "Room created successfully.",
      data: {
        roomCode: room.roomCode,
        hostId: room.hostId,
        currentVideo: room.currentVideo,
        playback: room.playback,
        status: room.status,
        expiresAt: room.expiresAt,
        createdAt: room.createdAt,
      },
    });
  } catch (error) {
    console.error("Create Room Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * GET /api/rooms/:roomCode
 */
const getRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;

    const room = await Room.findOne({
      roomCode: roomCode.toUpperCase(),
      status: "ACTIVE",
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    console.error("Get Room Error:", error);

    return res.status(500).json({
        success: false,
        message: "Internal server error.",
    });
  }
};

/**
 * DELETE /api/rooms/:roomCode
 */
const closeRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;

    const room = await Room.findOne({
      roomCode: roomCode.toUpperCase(),
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    room.status = "CLOSED";

    await room.save();

    return res.status(200).json({
      success: true,
      message: "Room closed successfully.",
    });
  } catch (error) {
    console.error("Close Room Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

module.exports = {
  createRoom,
  getRoom,
  closeRoom,
};