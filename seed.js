require("dotenv").config();
const bcrypt = require("bcrypt");
const { connectDB } = require("./config/db");

const User = require("./models/User");
const Hall = require("./models/Hall");

async function seed() {
  await connectDB(process.env.MONGO_URI);

  const adminEmail = "admin@cinema.com";
  const adminPass = "Admin@123";

  // Delete existing admin with same email (so password is guaranteed)
  await User.deleteOne({ email: adminEmail });

  const admin = await User.create({
    name: "Admin",
    email: adminEmail,
    passwordHash: await bcrypt.hash(adminPass, 12),
    role: "admin"
  });

  // Ensure at least one hall exists
  const hallName = "Hall 1";
  const existingHall = await Hall.findOne({ name: hallName });
  if (!existingHall) {
    await Hall.create({ name: hallName, rows: 10, cols: 12 });
  }

  console.log("✅ Seed complete");
  console.log("Admin email:", adminEmail);
  console.log("Admin password:", adminPass);
  console.log("Admin id:", admin._id);

  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
