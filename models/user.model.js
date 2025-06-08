const mongoose = require('mongoose');

const UserSchema = mongoose.Schema(    
{
    uuid: {type: String, required: true},
    ip: {type: String, required: true},
    pushname: {type: String, required: true},
    user: {type: String, required: true},
    platform: {type: String, required: true},
    
},
{
    timestamps: true
}
)

const User = mongoose.model("User", UserSchema);
module.exports = User

