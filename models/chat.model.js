const mongoose = require('mongoose');

const ChatSchema = mongoose.Schema(    
{

    sender: {type: String, required: true},
    receiver: {type: String, required: true},
    message: {type: String, required: true},
    status: {type:Number, required: true, default: 0},
    senderName: {type: String},
    chatType: {type: String},
    deviceType: {type: String}

},
{
    timestamps: true
}
)

const Chat = mongoose.model("Chat", ChatSchema);
module.exports = Chat

