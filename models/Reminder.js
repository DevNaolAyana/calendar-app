const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    date: {
        type: String,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    notes: String,
    isNotified3Days: { type: Boolean, default: false },
    isNotified6Hours: { type: Boolean, default: false },
    isNotified2Hours: { type: Boolean, default: false },
    isNotifiedAtTime: { type: Boolean, default: false },
    isNotifiedAfter: { type: Boolean, default: false },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Reminder', reminderSchema);