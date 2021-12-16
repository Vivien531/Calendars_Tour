const mongoose = require('mongoose');

const HabitantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: false
  },
  lastName: {
    type: String
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  cp: {
    type: String,
    required: true
  },
  geolocation: {
    type: Object,
    required: true
  },
  addBy: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  given: {
    type: String,
    default: "notSeen"
  },
  visits: {
    type: Number,
    default: 0
  }
});

const Habitant = mongoose.model('Habitant', HabitantSchema);

module.exports = Habitant;
