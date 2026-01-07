const mongoose = require("mongoose");

const showSchema = new mongoose.Schema(
  {
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: "Movie", required: true },
    hallId: { type: mongoose.Schema.Types.ObjectId, ref: "Hall", required: true },
    startTime: { type: Date, required: true },
    price: { type: Number, required: true },
    bookedSeats: { type: [String], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Show", showSchema);
