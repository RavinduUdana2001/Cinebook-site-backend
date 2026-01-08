// routes/bookings.routes.js
const router = require("express").Router();
const mongoose = require("mongoose");
const { body } = require("express-validator");

const validate = require("../middleware/validate");
const { authRequired, adminOnly } = require("../middleware/auth");

const Booking = require("../models/Booking");
const Show = require("../models/Show");
const { clearLocksForSeats } = require("../sockets/seatSocket");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

function calcTotal(show, seats) {
  // ✅ Option 1: flat pricing
  if (!show?.seatPricing || typeof show.seatPricing !== "object") {
    return seats.length * (Number(show?.price || 0));
  }

  // ✅ Option 2: tier by row
  // seatPricing example: { "A": 1500, "B": 1500, "C": 1200, "DEFAULT": 1000 }
  const pricing = show.seatPricing;
  const def = pricing.DEFAULT ?? show.price ?? 0;

  return seats.reduce((sum, seatId) => {
    const row = String(seatId || "").charAt(0); // A, B, C...
    const p = pricing[row] ?? def;
    return sum + Number(p || 0);
  }, 0);
}

// ✅ CREATE BOOKING (user)
router.post(
  "/",
  authRequired,
  [
    body("showId").notEmpty().withMessage("showId is required"),
    body("seats").isArray({ min: 1 }).withMessage("seats must be an array with at least 1 seat"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { showId, seats } = req.body;

      if (!isValidId(showId)) {
        return res.status(400).json({ message: "Invalid showId" });
      }

      // normalize seats: trim + uppercase + unique
      const uniqueSeats = Array.from(
        new Set(
          (Array.isArray(seats) ? seats : [])
            .map((s) => String(s).trim().toUpperCase())
            .filter(Boolean)
        )
      );

      if (!uniqueSeats.length) {
        return res.status(400).json({ message: "No valid seats provided" });
      }

      // 🔒 ATOMIC update: only succeeds if NO overlap with already-booked seats
      const updatedShow = await Show.findOneAndUpdate(
        {
          _id: showId,
          bookedSeats: { $not: { $elemMatch: { $in: uniqueSeats } } },
        },
        { $addToSet: { bookedSeats: { $each: uniqueSeats } } },
        { new: true }
      );

      if (!updatedShow) {
        return res.status(409).json({
          message: "Some seats already booked",
          clashes: uniqueSeats,
        });
      }

      const total = calcTotal(updatedShow, uniqueSeats);

      const booking = await Booking.create({
        userId: req.user.id,
        showId,
        seats: uniqueSeats,
        total,
      });

      // ✅ realtime emit + clear locks
      try {
        clearLocksForSeats(showId, uniqueSeats);

        const io = req.app.get("io");
        if (io) {
          io.to(showId).emit("showState", {
            bookedSeats: Array.isArray(updatedShow.bookedSeats) ? updatedShow.bookedSeats : [],
            locks: {}, // locks cleared (your clearLocksForSeats should already handle it)
          });
          io.to(showId).emit("locksUpdated", {});
        }
      } catch (e) {
        console.log("Socket emit error:", e?.message);
      }

      return res.status(201).json({
        bookingId: booking._id,
        total,
        seats: uniqueSeats,
      });
    } catch (e) {
      next(e);
    }
  }
);

// ✅ USER: MY BOOKINGS
router.get("/my", authRequired, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id })
      .populate({
        path: "showId",
        populate: [{ path: "movieId" }, { path: "hallId" }],
      })
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (e) {
    next(e);
  }
});

// ✅ ADMIN: ALL BOOKINGS (includes user name/email)
router.get("/", authRequired, adminOnly, async (req, res, next) => {
  try {
    const bookings = await Booking.find()
      .populate({
        path: "userId",
        select: "name email role", // ✅ SAFE: do not leak passwordHash
      })
      .populate({
        path: "showId",
        populate: [{ path: "movieId" }, { path: "hallId" }],
      })
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
