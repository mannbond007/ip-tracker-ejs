const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const dotenv = require("dotenv");
const Search = require("./models/Search");

dotenv.config();
const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

// Private IP detection
function isPrivateIP(ip) {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
    ip === "127.0.0.1" ||
    ip === "::1"
  );
}

// Fetch IP details
async function getIPDetails(ip) {
  const response = await axios.get(`http://ip-api.com/json/${ip}`);
  return response.data;
}

// Home route
app.get("/", async (req, res) => {
  try {
    let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    if (ip === "::1" || ip.startsWith("::ffff:127")) {
      ip = "8.8.8.8"; // local dev fallback
    } else if (ip.includes(",")) {
      ip = ip.split(",")[0];
    }

    let visitorData;
    if (isPrivateIP(ip)) {
      visitorData = {
        query: ip,
        country: "Private IP Address",
        city: "Not Available",
        isp: "Not Available",
        note: "This is a private IP address used inside local networks.",
      };
    } else {
      visitorData = await getIPDetails(ip);

      // Check if this IP already exists before inserting
      const existing = await Search.findOne({ ip: visitorData.query });
      if (!existing) {
        await Search.create({
          ip: visitorData.query,
          country: visitorData.country,
          city: visitorData.city,
          isp: visitorData.isp,
        });
      }
    }

    const history = await Search.find().sort({ searchedAt: -1 }).limit(10);
    res.render("index", { visitorData, history });
  } catch (error) {
    console.error("Error fetching visitor IP info:", error.message);
    res.send("Error fetching visitor IP info");
  }
});

// Track manually
app.post("/track", async (req, res) => {
  const ip = req.body.ip;

  if (isPrivateIP(ip)) {
    return res.render("result", {
      data: {
        query: ip,
        country: "Private IP Address",
        city: "Not Available",
        isp: "Not Available",
        note: "This is a private IP address used inside local networks.",
      },
    });
  }

  try {
    const data = await getIPDetails(ip);
    await Search.create({
      ip: data.query,
      country: data.country,
      city: data.city,
      isp: data.isp,
    });
    res.render("result", { data });
  } catch (error) {
    console.error("Error fetching IP info:", error.message);
    res.send("Error fetching IP info");
  }
});

// Test mode
app.get("/test", async (req, res) => {
  try {
    const testIPs = ["8.8.8.8", "1.1.1.1", "208.80.154.224", "142.250.72.14", "151.101.1.69"];
    const randomIP = testIPs[Math.floor(Math.random() * testIPs.length)];
    const data = await getIPDetails(randomIP);

    await Search.create({
      ip: data.query,
      country: data.country,
      city: data.city,
      isp: data.isp,
    });

    res.render("result", { data });
  } catch (error) {
    console.error("Error in test mode:", error.message);
    res.send("Error running test mode");
  }
});

// Delete single history entry
app.post("/delete-history", async (req, res) => {
  try {
    const ipToDelete = req.body.ip;
    await Search.deleteOne({ ip: ipToDelete });
    console.log(`✅ Deleted IP: ${ipToDelete}`);
    res.redirect("/");
  } catch (error) {
    console.error("❌ Error deleting IP:", error.message);
    res.redirect("/");
  }
});

// Clear all history
app.post("/clear-history", async (req, res) => {
  try {
    await Search.deleteMany({});
    console.log("✅ All history cleared");
    res.redirect("/");
  } catch (error) {
    console.error("❌ Error clearing history:", error.message);
    res.redirect("/");
  }
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});
