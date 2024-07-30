const mongoose = require('mongoose')

const user = mongoose.Schema({
    name: {
        type: String,
        required: true,
        minlength: 3
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    hisaabs: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'hisaab'
        }
    ]
})

module.exports = mongoose.model('user', user)