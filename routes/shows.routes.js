const router = require("express").Router();
const mongoose = require("mongoose");
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const { authRequired, adminOnly } = require("../middleware/auth");
const Show = require("../models/Show");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ✅ GET /api/shows/by-movie/:movieId (public)
router.get("/by-movie/:movieId", async (req, res, next) => {
  try {
    const { movieId } = req.params;
    if (!isValidId(movieId)) return res.status(400).json({ message: "Invalid movie id" });

    const shows = await Show.find({ movieId })
      .populate("hallId")
      .sort({ startTime: 1 });

    res.json(shows);
  } catch (e) {
    next(e);
  }
});

// ✅ GET /api/shows/:id (public)
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid show id" });

    const show = await Show.findById(id).populate("movieId").populate("hallId");
    if (!show) return res.status(404).json({ message: "Show not found" });

    res.json(show);
  } catch (e) {
    next(e);
  }
});

// ✅ GET /api/shows (admin)
router.get("/", authRequired, adminOnly, async (req, res, next) => {
  try {
    const shows = await Show.find()
      .populate("movieId")
      .populate("hallId")
      .sort({ startTime: 1 });

    res.json(shows);
  } catch (e) {
    next(e);
  }
});

// ✅ POST /api/shows (admin)
router.post(
  "/",
  authRequired,
  adminOnly,
  [
    body("movieId").notEmpty().withMessage("movieId required"),
    body("hallId").notEmpty().withMessage("hallId required"),
    body("startTime").notEmpty().withMessage("startTime required"),
    body("price").isFloat({ min: 0 }).withMessage("price must be number"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { movieId, hallId, startTime, price } = req.body;

      if (!isValidId(movieId)) return res.status(400).json({ message: "Invalid movieId" });
      if (!isValidId(hallId)) return res.status(400).json({ message: "Invalid hallId" });

      const show = await Show.create({
        movieId,
        hallId,
        startTime: new Date(startTime),
        price: Number(price),
      });

      res.status(201).json(show);
    } catch (e) {
      next(e);
    }
  }
);

router.delete("/:id", authRequired, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid show id" });

    const deleted = await Show.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Show not found" });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ✅ PUT /api/shows/:id (admin) - update show
router.put(
  "/:id",
  authRequired,
  adminOnly,
  [
    body("movieId").optional().custom(isValidId).withMessage("Invalid movieId"),
    body("hallId").optional().custom(isValidId).withMessage("Invalid hallId"),
    body("startTime").optional().notEmpty().withMessage("startTime required"),
    body("price").optional().isFloat({ min: 0 }).withMessage("price must be number"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return res.status(400).json({ message: "Invalid show id" });

      const show = await Show.findById(id);
      if (!show) return res.status(404).json({ message: "Show not found" });

      const { movieId, hallId, startTime, price } = req.body;

      if (movieId) show.movieId = movieId;
      if (hallId) show.hallId = hallId;
      if (startTime) show.startTime = new Date(startTime);
      if (price !== undefined) show.price = Number(price);

      await show.save();
      res.json(show);
    } catch (e) {
      next(e);
    }
  }
);


module.exports = router;
