import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import fs from "fs";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  
  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Socket.io signaling logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId, userId) => {
      socket.join(roomId);
      socket.join(userId); // Join a private room for targeted signaling
      console.log(`User ${userId} joined room ${roomId}`);
      socket.to(roomId).emit("user-connected", userId);

      socket.on("disconnect", () => {
        console.log("User disconnected:", userId);
        socket.to(roomId).emit("user-disconnected", userId);
      });
    });

    socket.on("signal", (data) => {
      // data: { to: userId, from: userId, signal: signalData, roomId: roomId }
      io.to(data.to).emit("signal", {
        from: data.from,
        signal: data.signal
      });
    });

    socket.on("chat-message", (data) => {
      // data: { roomId: string, user: string, text: string }
      socket.to(data.roomId).emit("chat-message", {
        user: data.user,
        text: data.text
      });
    });

    socket.on("hand-raise", (data) => {
      // data: { roomId: string, userId: string, isRaised: boolean }
      socket.to(data.roomId).emit("hand-raise", {
        userId: data.userId,
        isRaised: data.isRaised
      });
    });

    socket.on("whiteboard-draw", (data) => {
      // data: { roomId: string, drawData: any }
      socket.to(data.roomId).emit("whiteboard-draw", data.drawData);
    });

    socket.on("whiteboard-clear", (data) => {
      // data: { roomId: string }
      socket.to(data.roomId).emit("whiteboard-clear");
    });

    socket.on("poll-create", (data) => {
      // data: { roomId: string, poll: any }
      socket.to(data.roomId).emit("poll-create", data.poll);
    });

    socket.on("poll-vote", (data) => {
      // data: { roomId: string, pollId: string, optionIndex: number, userId: string }
      socket.to(data.roomId).emit("poll-vote", {
        pollId: data.pollId,
        optionIndex: data.optionIndex,
        userId: data.userId
      });
    });

    socket.on("poll-close", (data) => {
      // data: { roomId: string, pollId: string }
      socket.to(data.roomId).emit("poll-close", data.pollId);
    });

    socket.on("mute-user", (data) => {
      // data: { roomId: string, userId: string, mute: boolean }
      socket.to(data.roomId).emit("mute-user", {
        userId: data.userId,
        mute: data.mute
      });
    });

    socket.on("kick-user", (data) => {
      // data: { roomId: string, userId: string }
      socket.to(data.roomId).emit("kick-user", {
        userId: data.userId
      });
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Multer configuration for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
  });

  app.post("/api/upload", (req, res, next) => {
    console.log("POST /api/upload request received");
    next();
  }, upload.single('file'), (req, res) => {
    console.log("File upload processed");
    if (!req.file) {
      console.log("No file in request");
      return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log("File uploaded successfully:", req.file.filename);
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });

  // Error handler for multer and other routes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Server Error:", err);
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Multer error: ${err.message}` });
    }
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  // Serve uploaded files statically
  app.use('/uploads', express.static(uploadsDir));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
