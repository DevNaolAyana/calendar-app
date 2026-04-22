const mongoose = require('mongoose');

const todoListSchema = new mongoose.Schema({
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',      required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'TodoGroup', required: true },
    name:    { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TodoList', todoListSchema);
