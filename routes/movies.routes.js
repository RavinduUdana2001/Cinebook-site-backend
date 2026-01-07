const router = require("express").Router();
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const { authRequired, adminOnly } = require("../middleware/auth");
const Movie = require("../models/Movie");

// Public list
router.get("/", async (req, res) => {
  const movies = await Movie.find({ isActive: true }).sort({ createdAt: -1 });
  res.json(movies);
});

// ✅ Admin list movies (includes active + inactive)
router.get("/admin", authRequired, adminOnly, async (req, res) => {
  const movies = await Movie.find().sort({ createdAt: -1 });
  res.json(movies);
});


// Admin create
router.post(
  "/",
  authRequired,
  adminOnly,
  [
    body("title").trim().notEmpty().withMessage("Title required"),
    body("durationMins").optional().isInt({ min: 1 }).withMessage("durationMins must be integer")
  ],
  validate,
  async (req, res) => {
    const movie = await Movie.create(req.body);
    res.status(201).json(movie);
  }
);

// Admin update
router.put("/:id", authRequired, adminOnly, async (req, res) => {
  const updated = await Movie.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) return res.status(404).json({ message: "Movie not found" });
  res.json(updated);
});

// Admin soft delete
// Admin soft delete (deactivate)
router.delete("/:id", authRequired, adminOnly, async (req, res) => {
  try {
    const updated = await Movie.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Movie not found" });

    // ✅ return updated movie so frontend can update UI
    res.json({ ok: true, movie: updated });
  } catch (err) {
    // ✅ handles invalid ObjectId + other errors
    console.error("DELETE /api/movies/:id error:", err);
    res.status(400).json({ message: "Invalid movie id" });
  }
});


module.exports = router;
