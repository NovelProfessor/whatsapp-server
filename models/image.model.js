const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  mediaFilename: {
    type: String,
    required: false,
  },
  mediaMimetype: {
    type: String,
    required: true,
  },
  mediaData: {
    type: Buffer,
    required: true,
  },
  mediaFilesize: {
    type: Number,
    required: false,
  },
});
module.exports = mongoose.model("Image", imageSchema);