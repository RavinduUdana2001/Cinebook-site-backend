// routes/bookings.routes.js
const router = require("express").Router();
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const { authRequired, adminOnly } = require("../middleware/auth"); // ✅ UPDATED
const Booking = require("../models/Booking");
const Show = require("../models/Show");
const { clearLocksForSeats } = require("../sockets/seatSocket");

function calcTotal(show, seats) {
  // ✅ Option 1 (default): flat pricing
  if (!show?.seatPricing || typeof show.seatPricing !== "object") {
    return seats.length * (show.price || 0);
  }

  // ✅ Option 2 (tier by row)
  // show.seatPricing example: { "A": 1500, "B": 1500, "C": 1200, "DEFAULT": 1000 }
  const pricing = show.seatPricing;
  const def = pricing.DEFAULT ?? show.price ?? 0;

  return seats.reduce((sum, seatId) => {
    const row = String(seatId || "").charAt(0); // A, B, C...
    const p = pricing[row] ?? def;
    return sum + p;
  }, 0);
}

// ✅ CREATE BOOKING
router.post(
  "/",
  authRequired,
  [body("showId").notEmpty(), body("seats").isArray({ min: 1 })],
  validate,
  async (req, res) => {
    const { showId, seats } = req.body;

    // normalize seats: trim + unique + uppercase
    const uniqueSeats = Array.from(
      new Set(seats.map((s) => String(s).trim().toUpperCase()))
    );

    // 🔒 ATOMIC update: only succeeds if no seat in uniqueSeats is already in bookedSeats
    const updatedShow = await Show.findOneAndUpdate(
      {
        _id: showId,
        bookedSeats: { $not: { $elemMatch: { $in: uniqueSeats } } }, // ✅ no overlap
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

    // ✅ realtime emit (and clear locks)
    try {
      clearLocksForSeats(showId, uniqueSeats);

      const io = req.app.get("io");
      if (io) {
        io.to(showId).emit("showState", {
          bookedSeats: updatedShow.bookedSeats || [],
          locks: {},
        });
        io.to(showId).emit("locksUpdated", {});
      }
    } catch (e) {
      console.log("Socket emit error:", e?.message);
    }

    res.status(201).json({ bookingId: booking._id, total });
  }
);

// ✅ USER: MY BOOKINGS
router.get("/my", authRequired, async (req, res) => {
  const bookings = await Booking.find({ userId: req.user.id })
    .populate({
      path: "showId",
      populate: [{ path: "movieId" }, { path: "hallId" }],
    })
    .sort({ createdAt: -1 });

  res.json(bookings);
});

// ✅ ADMIN: ALL BOOKINGS (THIS FIXES YOUR 404)
router.get("/", authRequired, adminOnly, async (req, res) => {
  const bookings = await Booking.find()
    .populate({
      path: "showId",
      populate: [{ path: "movieId" }, { path: "hallId" }],
    })
    .sort({ createdAt: -1 });

  res.json(bookings);
});

module.exports = router;
