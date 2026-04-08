const Reminder = require('../models/Reminder');

// Get all reminders for a user
const getReminders = async (req, res) => {
    try {
        const reminders = await Reminder.find({ userId: req.userId });
        res.json(reminders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new reminder
const createReminder = async (req, res) => {
    try {
        const { title, date, time, notes } = req.body;
        
        const reminder = new Reminder({
            userId: req.userId,
            title,
            date,
            time,
            notes
        });
        
        await reminder.save();
        res.status(201).json(reminder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update a reminder
const updateReminder = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const reminder = await Reminder.findOneAndUpdate(
            { _id: id, userId: req.userId },
            updates,
            { new: true }
        );
        
        if (!reminder) {
            return res.status(404).json({ message: 'Reminder not found' });
        }
        
        res.json(reminder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete a reminder
const deleteReminder = async (req, res) => {
    try {
        const { id } = req.params;
        
        const reminder = await Reminder.findOneAndDelete({ _id: id, userId: req.userId });
        
        if (!reminder) {
            return res.status(404).json({ message: 'Reminder not found' });
        }
        
        res.json({ message: 'Reminder deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Mark notification as sent
const markNotificationSent = async (req, res) => {
    try {
        const { id, type } = req.body;
        const updateField = {};
        
        switch(type) {
            case '3days': updateField.isNotified3Days = true; break;
            case '6hours': updateField.isNotified6Hours = true; break;
            case '2hours': updateField.isNotified2Hours = true; break;
            case 'attime': updateField.isNotifiedAtTime = true; break;
            case 'after': updateField.isNotifiedAfter = true; break;
        }
        
        const reminder = await Reminder.findOneAndUpdate(
            { _id: id, userId: req.userId },
            updateField,
            { new: true }
        );
        
        res.json(reminder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getReminders, createReminder, updateReminder, deleteReminder, markNotificationSent };