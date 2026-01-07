const router = require("express").Router();
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const { authRequired, adminOnly } = require("../middleware/auth");
const Hall = require("../models/Hall");

router.get("/", async (req, res) => {
  const halls = await Hall.find().sort({ createdAt: -1 });
  res.json(halls);
});

router.post(
  "/",
  authRequired,
  adminOnly,
  [
    body("name").trim().notEmpty().withMessage("Name required"),
    body("rows").isInt({ min: 1, max: 26 }).withMessage("rows 1-26"),
    body("cols").isInt({ min: 1, max: 30 }).withMessage("cols 1-30")
  ],
  validate,
  async (req, res) => {
    const hall = await Hall.create(req.body);
    res.status(201).json(hall);
  }
);

router.put("/:id", authRequired, adminOnly, async (req, res) => {
  const updated = await Hall.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) return res.status(404).json({ message: "Hall not found" });
  res.json(updated);
});

router.delete("/:id", authRequired, adminOnly, async (req, res) => {
  const deleted = await Hall.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Hall not found" });
  res.json({ ok: true });
});

module.exports = router;
