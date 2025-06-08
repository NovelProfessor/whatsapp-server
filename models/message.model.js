const mongoose = require('mongoose');

const MessageSchema = mongoose.Schema(    
{

    sender: {type: String, required: true},
    receiver: {type: String, required: true},
    message: {type: String, required: true},
    status: {type:Number, required: true, default: 0},
    senderName: {type: String},
    chatType: {type: String},
    deviceType: {type: String},

    image: {type: mongoose.Types.ObjectId, ref: "Image"}

},
{
    timestamps: true
}
)

const Message = mongoose.model("Message", MessageSchema);
module.exports = Message

