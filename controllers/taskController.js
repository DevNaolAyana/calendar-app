const Task = require('../models/Task');

// Get all tasks for a user
const getTasks = async (req, res) => {
    try {
        const tasks = await Task.find({ userId: req.userId });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get tasks for a specific date
const getTasksByDate = async (req, res) => {
    try {
        const { date } = req.params;
        const tasks = await Task.find({ userId: req.userId, date });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new task
const createTask = async (req, res) => {
    try {
        const { title, description, location, date, startTime, endTime, isRecurring, recurringType, parentTaskId } = req.body;
        
        const task = new Task({
            userId: req.userId,
            title,
            description,
            location,
            date,
            startTime,
            endTime,
            isRecurring: isRecurring || false,
            recurringType: recurringType || null,
            parentTaskId: parentTaskId || null
        });
        
        await task.save();
        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update a task
const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const task = await Task.findOneAndUpdate(
            { _id: id, userId: req.userId },
            updates,
            { new: true }
        );
        
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete a task
const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        
        const task = await Task.findOneAndDelete({ _id: id, userId: req.userId });
        
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all recurring tasks
const getRecurringTasks = async (req, res) => {
    try {
        const tasks = await Task.find({ userId: req.userId, isRecurring: true });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getTasks, getTasksByDate, createTask, updateTask, deleteTask, getRecurringTasks };