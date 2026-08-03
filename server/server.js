const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const socketHandler = require("./socket/socketHandler");
const app = require("./app");

require("dotenv").config();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

socketHandler(io);

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

io.on("connection", (socket) => {
    console.log("User Connected :", socket.id);

    socket.on("disconnect", () => {
        console.log("User Disconnected :", socket.id);
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});