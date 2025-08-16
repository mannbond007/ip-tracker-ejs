const mongoose = require('mongoose');

const searchSchema = new mongoose.Schema({
  ip: String,
  country: String,
  city: String,
  isp: String,
  searchedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Search', searchSchema);
