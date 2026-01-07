// sockets/seatSocket.js
const Show = require("../models/Show");

// showId -> { seatId: { userId, socketId, expiresAt } }
const locks = {};

function cleanupExpiredLocks(showId) {
  const now = Date.now();
  if (!locks[showId]) return false;

  let changed = false;
  for (const seatId of Object.keys(locks[showId])) {
    if (locks[showId][seatId]?.expiresAt <= now) {
      delete locks[showId][seatId];
      changed = true;
    }
  }

  // if empty, optional cleanup
  if (Object.keys(locks[showId]).length === 0) {
    // keep object or delete it (either is fine)
    // delete locks[showId];
  }

  return changed;
}

function clearLocksForSeats(showId, seats) {
  if (!locks[showId]) return;
  let changed = false;

  (seats || []).forEach((s) => {
    if (locks[showId]?.[s]) {
      delete locks[showId][s];
      changed = true;
    }
  });

  const expiredChanged = cleanupExpiredLocks(showId);
  return changed || expiredChanged;
}

// ✅ NEW: clear all locks owned by this socket/user in a show
function clearLocksForSocketOrUser(showId, { socketId, userId }) {
  if (!locks[showId]) return false;

  let changed = false;
  for (const seatId of Object.keys(locks[showId])) {
    const info = locks[showId][seatId];
    if (!info) continue;

    const bySocket = socketId && info.socketId === socketId;
    const byUser = userId && info.userId === userId;

    if (bySocket || byUser) {
      delete locks[showId][seatId];
      changed = true;
    }
  }

  const expiredChanged = cleanupExpiredLocks(showId);
  return changed || expiredChanged;
}

function initSeatSockets(io) {
  const TTL = Number(process.env.SEAT_LOCK_TTL_MS || 90000);

  io.on("connection", (socket) => {
    console.log("🔌 socket connected:", socket.id);

    // remember last joined show + user
    socket.data.showId = null;
    socket.data.userId = null;

    socket.on("joinShow", async ({ showId, userId }) => {
      try {
        if (!showId) return;

        socket.data.showId = showId;
        socket.data.userId = userId || "guest";

        socket.join(showId);

        cleanupExpiredLocks(showId);

        const show = await Show.findById(showId);
        if (!show) return socket.emit("errorMsg", { message: "Show not found" });

        socket.emit("showState", {
          bookedSeats: Array.isArray(show.bookedSeats) ? show.bookedSeats : [],
          locks: locks[showId] || {},
        });

        // optional broadcast current locks state
        io.to(showId).emit("locksUpdated", locks[showId] || {});
      } catch (e) {
        socket.emit("errorMsg", { message: e.message || "joinShow failed" });
      }
    });

    socket.on("lockSeat", async ({ showId, seatId, userId }) => {
      try {
        if (!showId || !seatId) return;

        const uid = userId || socket.data.userId || "guest";

        cleanupExpiredLocks(showId);

        const show = await Show.findById(showId);
        if (!show) return socket.emit("errorMsg", { message: "Show not found" });

        const booked = Array.isArray(show.bookedSeats) ? show.bookedSeats : [];
        if (booked.includes(seatId)) {
          return socket.emit("lockRejected", { seatId, reason: "Seat already booked" });
        }

        locks[showId] = locks[showId] || {};

        const existing = locks[showId][seatId];
        if (existing && existing.expiresAt > Date.now()) {
          // locked by another user
          if (existing.userId !== uid) {
            return socket.emit("lockRejected", {
              seatId,
              reason: "Seat locked by another user",
            });
          }
          // same user: refresh the lock
        }

        // ✅ store socketId too
        locks[showId][seatId] = {
          userId: uid,
          socketId: socket.id,
          expiresAt: Date.now() + TTL,
        };

        io.to(showId).emit("locksUpdated", locks[showId]);
      } catch (e) {
        socket.emit("errorMsg", { message: e.message || "lockSeat failed" });
      }
    });

    socket.on("unlockSeat", ({ showId, seatId, userId }) => {
      try {
        if (!showId || !seatId) return;

        const uid = userId || socket.data.userId || "guest";

        const info = locks?.[showId]?.[seatId];
        if (!info) return;

        // ✅ allow unlock if same user OR same socket
        if (info.userId === uid || info.socketId === socket.id) {
          delete locks[showId][seatId];
          io.to(showId).emit("locksUpdated", locks[showId] || {});
        }
      } catch (e) {
        socket.emit("errorMsg", { message: e.message || "unlockSeat failed" });
      }
    });

    // ✅ OPTIONAL: explicit leaveShow (client can call on Back)
    socket.on("leaveShow", ({ showId, userId }) => {
      try {
        if (!showId) return;

        const uid = userId || socket.data.userId || "guest";
        const changed = clearLocksForSocketOrUser(showId, {
          socketId: socket.id,
          userId: uid,
        });

        if (changed) {
          io.to(showId).emit("locksUpdated", locks[showId] || {});
        }

        socket.leave(showId);
        socket.data.showId = null;
      } catch (e) {
        socket.emit("errorMsg", { message: e.message || "leaveShow failed" });
      }
    });

    // ✅ MOST IMPORTANT: clear locks on disconnect
    socket.on("disconnect", () => {
      console.log("❌ socket disconnected:", socket.id);

      const showId = socket.data.showId;
      const userId = socket.data.userId;

      if (!showId) return;

      const changed = clearLocksForSocketOrUser(showId, {
        socketId: socket.id,
        userId,
      });

      if (changed) {
        io.to(showId).emit("locksUpdated", locks[showId] || {});
      }
    });
  });
}

module.exports = { initSeatSockets, clearLocksForSeats };
