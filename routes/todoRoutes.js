const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/todoController');
const auth    = require('../middleware/auth');

router.use(auth);

// Groups
router.get('/groups',            ctrl.getGroups);
router.post('/groups',           ctrl.createGroup);
router.delete('/groups/:id',     ctrl.deleteGroup);

// Lists
router.get('/groups/:groupId/lists',  ctrl.getListsByGroup);
router.post('/groups/:groupId/lists', ctrl.createList);
router.delete('/lists/:id',           ctrl.deleteList);

// Tasks — special routes BEFORE parameterized :listId routes
router.get('/tasks/important', ctrl.getImportantTasks);
router.get('/tasks/due',       ctrl.getAllDueTasks);

router.get('/lists/:listId/tasks',  ctrl.getTasksByList);
router.post('/lists/:listId/tasks', ctrl.createTask);
router.put('/tasks/:id',            ctrl.updateTask);
router.delete('/tasks/:id',         ctrl.deleteTodoTask);

module.exports = router;
