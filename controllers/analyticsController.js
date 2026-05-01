const Task = require('../models/Task');
const TodoTask = require('../models/TodoTask');
const TodoGroup = require('../models/TodoGroup');
const User = require('../models/User');

// Helper: Parse duration string to hours
const parseDuration = (dur) => {
    if (!dur) return 0;
    let totalMin = 0;
    const hrMatch = dur.match(/(\d+)\s*hr/i);
    const minMatch = dur.match(/(\d+)\s*min/i);
    if (hrMatch) totalMin += parseInt(hrMatch[1]) * 60;
    if (minMatch) totalMin += parseInt(minMatch[1]);
    if (!hrMatch && !minMatch) {
        // Try fallback for just numbers or "2h 30m"
        const hMatch = dur.match(/(\d+)\s*h/i);
        const mMatch = dur.match(/(\d+)\s*m/i);
        if (hMatch) totalMin += parseInt(hMatch[1]) * 60;
        if (mMatch) totalMin += parseInt(mMatch[1]);
    }
    return totalMin / 60;
};

// Helper: Get date range (30 days ago to today)
const getHeatmapRange = () => {
    const dates = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
};

const getAnalyticsData = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);

        // 1. Total Study Time & Completion Stats
        const completedTasks = await Task.find({ userId, completed: true });
        const completedTodoTasks = await TodoTask.find({ userId, completed: true });

        let totalHours = 0;
        completedTasks.forEach(t => {
            // Task model doesn't have duration? Oh, it has startTime/endTime.
            // I should calculate from startTime/endTime for Task.js if duration is missing.
            if (t.startTime && t.endTime) {
                const [sh, sm] = t.startTime.split(':').map(Number);
                const [eh, em] = t.endTime.split(':').map(Number);
                let diff = (eh * 60 + em) - (sh * 60 + sm);
                if (diff < 0) diff += 1440;
                totalHours += diff / 60;
            }
        });
        completedTodoTasks.forEach(t => {
            totalHours += parseDuration(t.duration);
        });

        // 2. Daily Average
        // Count unique days with completions
        const activeDaysSet = new Set();
        completedTasks.forEach(t => activeDaysSet.add(t.date));
        completedTodoTasks.forEach(t => {
            if (t.completedAt) activeDaysSet.add(t.completedAt.toISOString().split('T')[0]);
            else if (t.dueDate) activeDaysSet.add(t.dueDate);
        });
        const activeDaysCount = activeDaysSet.size || 1;
        const dailyAverage = totalHours / activeDaysCount;

        // 3. Category Breakdown
        const groups = await TodoGroup.find({ userId });
        const categoryBreakdown = {};
        groups.forEach(g => categoryBreakdown[g.name] = 0);

        completedTodoTasks.forEach(t => {
            const group = groups.find(g => String(g._id) === String(t.groupId));
            if (group) {
                categoryBreakdown[group.name] += parseDuration(t.duration);
            }
        });

        // 4. Heatmap (30 days)
        const heatmapRange = getHeatmapRange();
        const heatmapData = {};
        heatmapRange.forEach(d => heatmapData[d] = 0);

        completedTasks.forEach(t => {
            if (heatmapData[t.date] !== undefined) heatmapData[t.date]++;
        });
        completedTodoTasks.forEach(t => {
            const d = t.completedAt ? t.completedAt.toISOString().split('T')[0] : t.dueDate;
            if (heatmapData[d] !== undefined) heatmapData[d]++;
        });

        // 5. Completion Rate (This Month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0,0,0,0);
        
        const totalThisMonth = await Task.countDocuments({ userId, date: { $gte: startOfMonth.toISOString().split('T')[0] } }) +
                              await TodoTask.countDocuments({ userId, dueDate: { $gte: startOfMonth.toISOString().split('T')[0] } });
        
        const completedThisMonth = await Task.countDocuments({ userId, completed: true, completedAt: { $gte: startOfMonth } }) +
                                  await TodoTask.countDocuments({ userId, completed: true, completedAt: { $gte: startOfMonth } });
        
        const completionRate = totalThisMonth > 0 ? (completedThisMonth / totalThisMonth) * 100 : 0;

        res.json({
            totalHours: totalHours.toFixed(1),
            dailyAverage: dailyAverage.toFixed(1),
            bestStreak: user.bestStreak || 0,
            currentStreak: user.currentStreak || 0,
            completionRate: completionRate.toFixed(1),
            categoryBreakdown,
            heatmap: heatmapData
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

const exportAnalyticsData = async (req, res) => {
    try {
        const userId = req.userId;
        const tasks = await Task.find({ userId });
        const todoTasks = await TodoTask.find({ userId });
        const groups = await TodoGroup.find({ userId });

        const exportData = {
            user: { userId },
            studyHistory: {
                calendarTasks: tasks.map(t => ({
                    title: t.title,
                    date: t.date,
                    startTime: t.startTime,
                    endTime: t.endTime,
                    completed: t.completed,
                    completedAt: t.completedAt
                })),
                todoTasks: todoTasks.map(t => ({
                    title: t.title,
                    group: groups.find(g => String(g._id) === String(t.groupId))?.name || 'Unknown',
                    dueDate: t.dueDate,
                    duration: t.duration,
                    completed: t.completed,
                    completedAt: t.completedAt,
                    isImportant: t.isImportant
                }))
            },
            exportedAt: new Date()
        };

        res.json(exportData);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

module.exports = { getAnalyticsData, exportAnalyticsData };
