 /*   require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");

const { connectDB } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/error");

const authRoutes = require("./routes/auth.routes");
const movieRoutes = require("./routes/movies.routes");
const hallRoutes = require("./routes/halls.routes");
const showRoutes = require("./routes/shows.routes");
const bookingRoutes = require("./routes/bookings.routes");

const { initSeatSockets } = require("./sockets/seatSocket");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked: " + origin));
    },
    credentials: true,
  })
);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Cinema Booking API" });
});

// ✅ SOCKET.IO
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

// ✅ make io available in routes/controllers
app.set("io", io);

// ✅ init seat sockets
initSeatSockets(io);

// routes
app.use("/api/auth", authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/halls", hallRoutes);
app.use("/api/shows", showRoutes);
app.use("/api/bookings", bookingRoutes);

// 404 + error handler
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB(process.env.MONGO_URI);
  server.listen(PORT, () =>
    console.log(`✅ Server running on http://localhost:${PORT}`)
  );
})();

*/

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");

const { connectDB } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/error");

const authRoutes = require("./routes/auth.routes");
const movieRoutes = require("./routes/movies.routes");
const hallRoutes = require("./routes/halls.routes");
const showRoutes = require("./routes/shows.routes");
const bookingRoutes = require("./routes/bookings.routes");

const { initSeatSockets } = require("./sockets/seatSocket");

const app = express();
const server = http.createServer(app);

// ✅ CORS FIRST
const FRONTEND_ORIGIN = process.env.CLIENT_ORIGIN;

app.use(
  cors({
    origin: FRONTEND_ORIGIN, 
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Express 5 safe preflight handler (NOT "*")
app.options(/.*/, cors());

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Cinema Booking API" });
});

// ✅ SOCKET.IO
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);
initSeatSockets(io);

// routes
app.use("/api/auth", authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/halls", hallRoutes);
app.use("/api/shows", showRoutes);
app.use("/api/bookings", bookingRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
})();
