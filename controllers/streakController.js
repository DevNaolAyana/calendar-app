const Task = require('../models/Task');
const TodoTask = require('../models/TodoTask');
const User = require('../models/User');

// Helper: Get date string in YYYY-MM-DD format for GMT+3
const getTodayStr = () => {
    const now = new Date();
    const gmt3Offset = 3 * 60; // 3 hours in minutes
    const localTime = new Date(now.getTime() + (gmt3Offset + now.getTimezoneOffset()) * 60000);
    return localTime.toISOString().split('T')[0];
};

const getYesterdayStr = () => {
    const d = new Date();
    const gmt3Offset = 3 * 60;
    const localTime = new Date(d.getTime() + (gmt3Offset + d.getTimezoneOffset()) * 60000);
    localTime.setDate(localTime.getDate() - 1);
    return localTime.toISOString().split('T')[0];
};

// Update streak when a task is completed
const updateStreakOnCompletion = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        const today = getTodayStr();
        const yesterday = getYesterdayStr();

        if (user.lastActiveDate === today) {
            // Already active today
            return;
        }

        if (user.lastActiveDate === yesterday) {
            user.currentStreak += 1;
            if (user.currentStreak > user.bestStreak) {
                user.bestStreak = user.currentStreak;
            }
        } else {
            user.currentStreak = 1;
            if (user.currentStreak > user.bestStreak) {
                user.bestStreak = user.currentStreak;
            }
        }

        user.lastActiveDate = today;
        await user.save();
    } catch (e) {
        console.error('Error updating streak:', e);
    }
};

const getStreakStats = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);
        
        const today = getTodayStr();
        const yesterday = getYesterdayStr();

        // Check for streak reset
        if (user.lastActiveDate && user.lastActiveDate !== today && user.lastActiveDate !== yesterday) {
            user.currentStreak = 0;
            await user.save();
        }

        // Weekly Progress: Completed vs Total this week (Sun-Sat)
        const now = new Date();
        const gmt3Offset = 3 * 60;
        const localNow = new Date(now.getTime() + (gmt3Offset + now.getTimezoneOffset()) * 60000);
        
        const dayOfWeek = localNow.getDay(); // 0 (Sun) to 6 (Sat)
        const startOfWeek = new Date(localNow);
        startOfWeek.setDate(localNow.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
        const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

        // 1. Total tasks due this week
        const totalTasksQuery = {
            userId,
            date: { $gte: startOfWeekStr, $lte: endOfWeekStr }
        };
        const totalTodoTasksQuery = {
            userId,
            dueDate: { $gte: startOfWeekStr, $lte: endOfWeekStr }
        };

        const count1 = await Task.countDocuments(totalTasksQuery);
        const count2 = await TodoTask.countDocuments(totalTodoTasksQuery);
        const totalThisWeek = count1 + count2;

        // 2. Completed tasks this week (regardless of when they were due, or due this week?)
        // User said: "tasks completed this week". Usually means completion date is this week.
        const completedTasksQuery = {
            userId,
            completed: true,
            completedAt: { $gte: startOfWeek, $lte: endOfWeek }
        };
        
        const comp1 = await Task.countDocuments(completedTasksQuery);
        const comp2 = await TodoTask.countDocuments(completedTasksQuery);
        const completedThisWeek = comp1 + comp2;

        // 3. Last 7 days activity (for mini calendar)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(localNow);
            d.setDate(localNow.getDate() - i);
            const dStr = d.toISOString().split('T')[0];
            
            const startD = new Date(d);
            startD.setHours(0,0,0,0);
            const endD = new Date(d);
            endD.setHours(23,59,59,999);

            const hasCompletion = await Task.exists({ userId, completed: true, completedAt: { $gte: startD, $lte: endD } }) ||
                                 await TodoTask.exists({ userId, completed: true, completedAt: { $gte: startD, $lte: endD } });
            
            last7Days.push({ date: dStr, active: !!hasCompletion });
        }

        res.json({
            currentStreak: user.currentStreak,
            weeklyProgress: {
                completed: completedThisWeek,
                total: totalThisWeek
            },
            last7Days
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

module.exports = { updateStreakOnCompletion, getStreakStats };
