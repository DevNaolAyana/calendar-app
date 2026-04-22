const mongoose = require('mongoose');

const todoTaskSchema = new mongoose.Schema({
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',      required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'TodoGroup', required: true },
    listId:  { type: mongoose.Schema.Types.ObjectId, ref: 'TodoList',  required: true },

    title:       { type: String, required: true },
    dueDate:     { type: String, required: true }, // YYYY-MM-DD
    duration:    { type: String, default: '' },    // free text e.g. "2hr 30min"
    completed:   { type: Boolean, default: false },
    isImportant: { type: Boolean, default: false },

    // Only populated when isImportant === true (appears in main calendar)
    startTime: { type: String, default: null },
    endTime:   { type: String, default: null },
    date:      { type: String, default: null }, // YYYY-MM-DD calendar date

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TodoTask', todoTaskSchema);
