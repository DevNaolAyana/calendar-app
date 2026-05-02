const TodoGroup = require('../models/TodoGroup');
const TodoList  = require('../models/TodoList');
const TodoTask  = require('../models/TodoTask');
const { updateStreakOnCompletion } = require('./streakController');

// ─── GROUPS ─────────────────────────────────────────────────────────────────

const getGroups = async (req, res) => {
    try {
        const groups = await TodoGroup.find({ userId: req.userId }).sort({ createdAt: 1 });
        res.json(groups);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const createGroup = async (req, res) => {
    try {
        const group = new TodoGroup({ userId: req.userId, name: req.body.name });
        await group.save();
        res.status(201).json(group);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateGroup = async (req, res) => {
    try {
        const group = await TodoGroup.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { name: req.body.name },
            { new: true }
        );
        if (!group) return res.status(404).json({ message: 'Group not found' });
        res.json(group);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        // Cascade: delete all tasks and lists in this group
        const lists = await TodoList.find({ groupId: id, userId: req.userId });
        for (const list of lists) {
            await TodoTask.deleteMany({ listId: list._id, userId: req.userId });
        }
        await TodoList.deleteMany({ groupId: id, userId: req.userId });
        await TodoGroup.findOneAndDelete({ _id: id, userId: req.userId });
        res.json({ message: 'Group deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── LISTS ───────────────────────────────────────────────────────────────────

const getListsByGroup = async (req, res) => {
    try {
        const lists = await TodoList.find({ groupId: req.params.groupId, userId: req.userId }).sort({ createdAt: 1 });
        res.json(lists);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const createList = async (req, res) => {
    try {
        const list = new TodoList({ userId: req.userId, groupId: req.params.groupId, name: req.body.name });
        await list.save();
        res.status(201).json(list);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateList = async (req, res) => {
    try {
        const list = await TodoList.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { name: req.body.name },
            { new: true }
        );
        if (!list) return res.status(404).json({ message: 'List not found' });
        res.json(list);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const deleteList = async (req, res) => {
    try {
        await TodoTask.deleteMany({ listId: req.params.id, userId: req.userId });
        await TodoList.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        res.json({ message: 'List deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── TASKS ───────────────────────────────────────────────────────────────────

const getTasksByList = async (req, res) => {
    try {
        const tasks = await TodoTask.find({ listId: req.params.listId, userId: req.userId }).sort({ dueDate: 1 });
        res.json(tasks);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const createTask = async (req, res) => {
    try {
        const { title, dueDate, duration, isImportant, startTime, endTime, date } = req.body;
        const task = new TodoTask({
            userId: req.userId,
            groupId: req.body.groupId,
            listId:  req.params.listId,
            title, dueDate,
            duration:    duration    || '',
            isImportant: isImportant || false,
            startTime:   startTime   || null,
            endTime:     endTime     || null,
            date:        date        || null
        });
        await task.save();
        res.status(201).json(task);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateTask = async (req, res) => {
    try {
        const updates = req.body;
        if (updates.completed === true) {
            updates.completedAt = new Date();
        } else if (updates.completed === false) {
            updates.completedAt = null;
        }

        const task = await TodoTask.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            updates,
            { new: true }
        );
        if (!task) return res.status(404).json({ message: 'Task not found' });

        if (updates.completed === true) {
            await updateStreakOnCompletion(req.userId);
        }
        res.json(task);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const deleteTodoTask = async (req, res) => {
    try {
        await TodoTask.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        res.json({ message: 'Task deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// All important tasks (for calendar integration)
const getImportantTasks = async (req, res) => {
    try {
        const tasks = await TodoTask.find({ userId: req.userId, isImportant: true, completed: false });
        res.json(tasks);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// All pending tasks sorted by dueDate (for Due Dates panel)
const getAllDueTasks = async (req, res) => {
    try {
        const tasks = await TodoTask.find({ userId: req.userId, completed: false }).sort({ dueDate: 1 });
        res.json(tasks);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = {
    getGroups, createGroup, updateGroup, deleteGroup,
    getListsByGroup, createList, updateList, deleteList,
    getTasksByList, createTask, updateTask, deleteTodoTask,
    getImportantTasks, getAllDueTasks
};
