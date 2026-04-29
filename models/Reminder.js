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
    category: { type: String, enum: ['Study', 'Personal', null], default: null },
    completed: { type: Boolean, default: false },
    isRecurring: { type: Boolean, default: false },
    recurringType: { type: String, enum: ['daily', 'weekly', 'monthly', null], default: null },
    isAcknowledgedPassed: { type: Boolean, default: false },
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