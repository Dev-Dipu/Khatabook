const mongoose = require('mongoose')

const hisaab = mongoose.Schema({
    title: {
        type: String,
        minlength: 3,
        required: true
    },
    desc: {
        type: String,
        required: true
    },
    encrypt: Boolean,
    passcode: {
        type: String,
        default: '',
        validate: {
          validator: function(v) {
            // If encryption is enabled, passcode must be at least 6 characters long
            if (this.encrypt) {
              return v && v.length >= 6;
            }
            // If encryption is not enabled, passcode can be empty
            return true;
          },
          message: 'Passcode must be at least 6 characters long when encryption is enabled.'
        }
      },
    canshare: Boolean,
    shareable: [
        {
            type: String
        }
    ],
    canedit: Boolean,
    created: {
        type: Date,
        default: Date.now
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    }
})

module.exports = mongoose.model('hisaab', hisaab)