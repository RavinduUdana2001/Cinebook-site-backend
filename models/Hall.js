const mongoose = require("mongoose");

const hallSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    rows: { type: Number, required: true },
    cols: { type: Number, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Hall", hallSchema);
