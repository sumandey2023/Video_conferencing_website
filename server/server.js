const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server, {
  cors: {
    origin: "https://your-vercel-app-url.vercel.app", // Replace with your Vercel URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});
const mongoose = require("mongoose");
require("dotenv").config();
const cors = require("cors");
const path = require("path");

// Middleware
app.use(
  cors({
    origin: "https://your-vercel-app-url.vercel.app", // Replace with your Vercel URL
    credentials: true,
  })
);
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(
    "your_mongodb_uri", // Replace with your MongoDB URI
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Connection Error:", err));

// Room Model
const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // Room expires after 24 hours
  },
});

const Room = mongoose.model("Room", roomSchema);

// API Routes
app.post("/api/rooms", async (req, res) => {
  try {
    const { roomId } = req.body;
    const room = new Room({ roomId });
    await room.save();
    res.status(201).json({ success: true, roomId });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get("/api/rooms/:roomId", async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }
    res.status(200).json({ success: true, room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Socket.io connection handling
const users = {};
const socketToRoom = {};

io.on("connection", (socket) => {
  // Join room event
  socket.on("join-room", (roomID) => {
    if (users[roomID]) {
      users[roomID].push(socket.id);
    } else {
      users[roomID] = [socket.id];
    }
    socketToRoom[socket.id] = roomID;

    // Tell other users in the room about the new user
    const usersInThisRoom = users[roomID].filter((id) => id !== socket.id);
    socket.emit("all-users", usersInThisRoom);
  });

  // Sending signal
  socket.on("sending-signal", (payload) => {
    io.to(payload.userToSignal).emit("user-joined", {
      signal: payload.signal,
      callerID: payload.callerID,
    });
  });

  // Returning signal
  socket.on("returning-signal", (payload) => {
    io.to(payload.callerID).emit("receiving-returned-signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  // User disconnected
  socket.on("disconnect", () => {
    const roomID = socketToRoom[socket.id];
    let room = users[roomID];
    if (room) {
      room = room.filter((id) => id !== socket.id);
      users[roomID] = room;

      // Notify others that user has left
      socket.broadcast.to(roomID).emit("user-disconnected", socket.id);
    }
    delete socketToRoom[socket.id];
  });

  // Chat message handling
  socket.on("send-message", (roomID, message, userName) => {
    socket.broadcast.to(roomID).emit("receive-message", message, userName);
  });
});

const PORT = 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
