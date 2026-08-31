const mongoose = require('mongoose');

const monitorStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  minimize: false
});

module.exports = mongoose.model('MonitorState', monitorStateSchema);
