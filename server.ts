import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import session from "express-session";

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // Adjust for production
      methods: ["GET", "POST"],
    },
  });

  const PORT = 3000;

  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || "a-very-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // Required for SameSite=None
      sameSite: 'none', // Required for cross-origin iframe
      httpOnly: true, // Security best practice
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    }
  }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Socket.io setup
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("bargain:propose", (data) => {
      console.log("New bargain proposal:", data);
      io.emit("bargain:new", data);
    });

    socket.on("bargain:update", (data) => {
      console.log("Bargain update:", data);
      io.emit("bargain:updated", data);
    });

    socket.on("admin:alert", (data) => {
      console.log("Admin alert:", data);
      io.emit("admin:new_alert", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
