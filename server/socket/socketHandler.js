const { v4: uuidv4 } = require("uuid");
const Room = require("../models/Room");

const socketHandler = (io) => {
  io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // ==========================
    // CREATE ROOM
    // ==========================
    socket.on("create-room", async ({ username }, callback) => {
      try {
        const roomId = uuidv4().slice(0, 6).toUpperCase();

        const room = await Room.create({
          roomId,
          participants: [
            {
              socketId: socket.id,
              username,
              role: "host",
            },
          ],
        });

        socket.join(roomId);

        callback({
          success: true,
          roomId,
          role: "host",
        });
      } catch (error) {
        callback({
          success: false,
          message: error.message,
        });
      }
    });

    // ==========================
    // JOIN ROOM
    // ==========================
    socket.on("join-room", async ({ roomId, username }, callback) => {
      try {
        const room = await Room.findOne({ roomId });

        if (!room) {
          return callback({
            success: false,
            message: "Room not found",
          });
        }

        room.participants.push({
          socketId: socket.id,
          username,
          role: "participant",
        });

        await room.save();

        socket.join(roomId);

        io.to(roomId).emit("participants-updated", room.participants);

        callback({
          success: true,
          role: "participant",
          room,
        });
      } catch (error) {
        callback({
          success: false,
          message: error.message,
        });
      }
    });

    // ==========================
    // DISCONNECT
    // ==========================
    socket.on("disconnect", async () => {
      try {
        const room = await Room.findOne({
          "participants.socketId": socket.id,
        });

        if (!room) return;

        room.participants = room.participants.filter(
          (user) => user.socketId !== socket.id
        );

        await room.save();

        io.to(room.roomId).emit(
          "participants-updated",
          room.participants
        );

        console.log(`${socket.id} disconnected`);
      } catch (err) {
        console.log(err);
      }
    });
  });
};

module.exports = socketHandler;