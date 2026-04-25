// ================================================================
// CALENDAR APP v2.0.0 — Todo Productivity System
// ================================================================

'use strict';

// ─── State ──────────────────────────────────────────────────────
window.todoImportantTasks = [];
let todoGroups      = [];
let todoListsCache  = {}; // groupId  -> [list, ...]
let todoTasksCache  = {}; // listId   -> [task, ...]
let _currentGroupId = null; // for add-list modal

window.todoSearchQuery = '';
window.todoCategoryFilter = 'All';

// ─── API ────────────────────────────────────────────────────────
const TodoAPI = {
    async req(url, opts = {}) {
        const r = await fetch(url, {
            ...opts,
            headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
        });
        if (r.status === 401 && window.logout) { window.logout(); return {}; }
        return r.json();
    },
    getGroups:         ()         => TodoAPI.req('/api/todo/groups'),
    createGroup:       (name)     => TodoAPI.req('/api/todo/groups',                  { method: 'POST', body: JSON.stringify({ name }) }),
    deleteGroup:       (id)       => TodoAPI.req(`/api/todo/groups/${id}`,            { method: 'DELETE' }),
    getListsByGroup:   (gid)      => TodoAPI.req(`/api/todo/groups/${gid}/lists`),
    createList:        (gid, name)=> TodoAPI.req(`/api/todo/groups/${gid}/lists`,     { method: 'POST', body: JSON.stringify({ name }) }),
    deleteList:        (id)       => TodoAPI.req(`/api/todo/lists/${id}`,             { method: 'DELETE' }),
    getTasksByList:    (lid)      => TodoAPI.req(`/api/todo/lists/${lid}/tasks`),
    createTask:        (lid, t)   => TodoAPI.req(`/api/todo/lists/${lid}/tasks`,      { method: 'POST', body: JSON.stringify(t) }),
    updateTask:        (id, t)    => TodoAPI.req(`/api/todo/tasks/${id}`,             { method: 'PUT',  body: JSON.stringify(t) }),
    deleteTask:        (id)       => TodoAPI.req(`/api/todo/tasks/${id}`,             { method: 'DELETE' }),
    getImportantTasks: ()         => TodoAPI.req('/api/todo/tasks/important'),
};

// ─── Load / Reload ───────────────────────────────────────────────
async function loadTodoData() {
    try {
        todoGroups     = await TodoAPI.getGroups();
        todoListsCache = {};
        todoTasksCache = {};
        for (const g of todoGroups) {
            const lists = await TodoAPI.getListsByGroup(g._id);
            todoListsCache[g._id] = lists;
            for (const l of lists) {
                todoTasksCache[l._id] = await TodoAPI.getTasksByList(l._id);
            }
        }
        window.todoImportantTasks = await TodoAPI.getImportantTasks();
        renderTodoGroups();
        renderDueDates();
        renderStats();
        if (window.renderAllViews) window.renderAllViews(); // refresh calendar
    } catch (e) { console.error('loadTodoData:', e); }
}
window.loadTodoData = loadTodoData;

// ─── Helpers ────────────────────────────────────────────────────
function _fmt(dateStr) { // "Apr 25, 2026"
    if (!dateStr) return '';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US',
        { month: 'short', day: 'numeric', year: 'numeric' });
}
function _today() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}
function _esc(s) {
    if (!s) return '';
    return s.replace(/[&<>]/g, m => m==='&'?'&amp;':m==='<'?'&lt;':'&gt;');
}
function _groupTaskCount(gid) {
    return (todoListsCache[gid]||[]).reduce((n,l)=>n+(todoTasksCache[l._id]||[]).length, 0);
}

// ─── Render: Groups ─────────────────────────────────────────────
function renderTodoGroups() {
    const cont = document.getElementById('todoGroupsContainer');
    if (!cont) return;
    if (!todoGroups.length) {
        cont.innerHTML = `<div class="todo-empty-state"><i class="fas fa-folder-open"></i><p>No groups yet — click <strong>New Group</strong> to start!</p></div>`;
        return;
    }
    
    let html = '';
    for (const g of todoGroups) {
        const listsHtml = renderListsHtml(g._id);
        const taskCount = _groupTaskCount(g._id);
        
        if ((window.todoSearchQuery || window.todoCategoryFilter !== 'All') && !listsHtml) continue;
        
        html += `
    <div class="todo-group" data-group-id="${g._id}">
      <div class="todo-group-header">
        <div class="todo-group-title-row">
          <button class="todo-collapse-btn" onclick="todoToggleGroup('${g._id}')">
            <i class="fas fa-chevron-down" id="g-icon-${g._id}"></i>
          </button>
          <i class="fas fa-folder todo-folder-icon"></i>
          <span class="todo-group-name">${_esc(g.name)}</span>
          <span class="todo-count-badge">${taskCount}</span>
        </div>
        <div class="todo-hdr-actions">
          <button class="todo-icon-btn todo-btn-add" onclick="openAddListModal('${g._id}')" title="Add List"><i class="fas fa-plus"></i></button>
          <button class="todo-icon-btn todo-btn-del" onclick="deleteGroup('${g._id}')" title="Delete Group"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="todo-group-body" id="g-body-${g._id}">
        ${listsHtml || `<div class="todo-no-items"><i class="fas fa-list"></i> No matching lists.</div>`}
      </div>
    </div>`;
    }
    cont.innerHTML = html || `<div class="todo-empty-state"><p>No matching tasks found.</p></div>`;
}

function renderListsHtml(gid) {
    const lists = todoListsCache[gid] || [];
    if (!lists.length) {
        if (window.todoSearchQuery || window.todoCategoryFilter !== 'All') return '';
        return `<div class="todo-no-items"><i class="fas fa-list"></i> No lists — add one!</div>`;
    }
    let html = '';
    for (const l of lists) {
        const tasks = todoTasksCache[l._id] || [];
        const tasksHtml = renderTasksHtml(tasks);
        
        if ((window.todoSearchQuery || window.todoCategoryFilter !== 'All') && !tasksHtml) continue;
        
        html += `
    <div class="todo-list-item" data-list-id="${l._id}">
      <div class="todo-list-header">
        <div class="todo-list-title-row">
          <button class="todo-collapse-btn" onclick="todoToggleList('${l._id}')">
            <i class="fas fa-chevron-down" id="l-icon-${l._id}"></i>
          </button>
          <i class="fas fa-list-ul todo-list-icon"></i>
          <span class="todo-list-name">${_esc(l.name)}</span>
          <span class="todo-count-badge">${tasks.length}</span>
        </div>
        <div class="todo-hdr-actions">
          <button class="todo-icon-btn todo-btn-add" onclick="openAddTodoTask('${l._id}','${l.groupId}')" title="Add Task"><i class="fas fa-plus"></i></button>
          <button class="todo-icon-btn todo-btn-del" onclick="deleteTodoList('${l._id}')" title="Delete List"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="todo-list-body" id="l-body-${l._id}">
        ${tasksHtml || `<div class="todo-no-items"><i class="fas fa-check-circle"></i> No matching tasks.</div>`}
      </div>
    </div>`;
    }
    return html;
}

function renderTasksHtml(tasks) {
    const today = _today();
    const query = (window.todoSearchQuery || '').toLowerCase();
    const cat = window.todoCategoryFilter || 'All';
    
    let filteredTasks = tasks;
    if (query) {
        filteredTasks = filteredTasks.filter(t => (t.title || '').toLowerCase().includes(query));
    }
    if (cat !== 'All') {
        filteredTasks = filteredTasks.filter(t => t.category === cat);
    }
    
    if (!filteredTasks.length) return '';
    
    return filteredTasks.map(t => {
        const overdue = !t.completed && t.dueDate < today;
        let titleHtml = _esc(t.title);
        if (query) {
            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
            titleHtml = titleHtml.replace(regex, '<mark>$1</mark>');
        }
        
        const catDot = t.category && t.category !== 'None' ? `<span class="cat-dot cat-${t.category}" title="${t.category}"></span>` : '';
        
        return `
    <div class="todo-task-card${t.completed?' completed':''}${overdue?' overdue':''}${t.isImportant?' important':''}" data-task-id="${t._id}">
      <div class="todo-task-left">
        <input type="checkbox" class="todo-cb" ${t.completed?'checked':''} onchange="toggleTodoTask('${t._id}',this.checked)">
        <div class="todo-task-info">
          <div class="todo-task-title${t.completed?' strikethrough':''}">${catDot}${titleHtml}</div>
          <div class="todo-task-meta">
            ${t.dueDate ? `<span class="tmeta${overdue?' overdue-text':''}"><i class="fas fa-calendar-day"></i> ${_fmt(t.dueDate)}</span>` : ''}
            ${t.duration ? `<span class="tmeta"><i class="fas fa-hourglass-half"></i> ${_esc(t.duration)}</span>` : ''}
            ${t.isImportant && t.startTime ? `<span class="tmeta imp-time"><i class="fas fa-clock"></i> ${_fmtT(t.startTime)}–${_fmtT(t.endTime)}</span>` : ''}
            ${overdue ? `<span class="tmeta overdue-warn"><i class="fas fa-exclamation-triangle"></i> Overdue</span>` : ''}
          </div>
        </div>
      </div>
      <div class="todo-task-actions">
        <button class="todo-icon-btn ${t.isImportant?'todo-btn-star-on':'todo-btn-star'}" onclick="toggleTodoImportant('${t._id}',${t.isImportant})" title="Toggle Important"><i class="fas fa-star"></i></button>
        <button class="todo-icon-btn todo-btn-edit" onclick="openEditTodoTask('${t._id}')" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="todo-icon-btn todo-btn-del" onclick="deleteTodoTask('${t._id}')" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
    }).join('');
}

function _fmtT(t24) {
    if (!t24) return '';
    const [h,m] = t24.split(':');
    const hr = parseInt(h);
    return `${hr%12||12}:${m} ${hr>=12?'PM':'AM'}`;
}

// ─── Render: Due Dates ───────────────────────────────────────────
function renderDueDates() {
    const cont  = document.getElementById('dueDatesList');
    const badge = document.getElementById('dueDatesCount');
    if (!cont) return;

    let all = [];
    for (const g of todoGroups) {
        for (const l of (todoListsCache[g._id] || [])) {
            all = all.concat((todoTasksCache[l._id] || []).filter(t => !t.completed));
        }
    }
    all.sort((a,b) => a.dueDate.localeCompare(b.dueDate));
    if (badge) badge.textContent = `${all.length} task${all.length!==1?'s':''}`;

    if (!all.length) {
        cont.innerHTML = `<div class="due-dates-empty"><i class="fas fa-check-double"></i><p>All caught up!</p></div>`;
        return;
    }
    const today = _today();
    cont.innerHTML = all.map(t => {
        const ov = t.dueDate < today;
        return `
    <div class="due-date-item${ov?' overdue':''}" data-task-id="${t._id}">
      <input type="checkbox" class="todo-cb" onchange="toggleTodoTask('${t._id}',this.checked)">
      <div class="due-date-info">
        <div class="due-date-title">${t.isImportant?'<i class="fas fa-star" style="color:#f39c12;font-size:10px;"></i> ':''}${_esc(t.title)}</div>
        <div class="due-date-meta">
          <span class="${ov?'overdue-text':''}">${ov?'<i class="fas fa-exclamation-triangle"></i>':'<i class="fas fa-calendar-day"></i>'} ${_fmt(t.dueDate)}</span>
          ${t.duration?`<span><i class="fas fa-hourglass-half"></i> ${_esc(t.duration)}</span>`:''}
        </div>
      </div>
    </div>`;
    }).join('');
}
window.refreshTodoDueDates = renderDueDates;

// ─── Collapse toggles ────────────────────────────────────────────
function todoToggleGroup(gid) {
    const body = document.getElementById(`g-body-${gid}`);
    const icon = document.getElementById(`g-icon-${gid}`);
    if (!body) return;
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? '' : 'none';
    icon.className = `fas fa-chevron-${hidden ? 'down' : 'right'}`;
}
function todoToggleList(lid) {
    const body = document.getElementById(`l-body-${lid}`);
    const icon = document.getElementById(`l-icon-${lid}`);
    if (!body) return;
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? '' : 'none';
    icon.className = `fas fa-chevron-${hidden ? 'down' : 'right'}`;
}
window.todoToggleGroup = todoToggleGroup;
window.todoToggleList  = todoToggleList;

// ─── CRUD: Groups ────────────────────────────────────────────────
function openAddGroupModal() {
    document.getElementById('addGroupForm').reset();
    document.getElementById('addGroupModal').style.display = 'block';
}

async function createGroup(e) {
    e.preventDefault();
    const name = document.getElementById('groupNameInput').value.trim();
    if (!name) return;
    await TodoAPI.createGroup(name);
    closeTodoModals();
    await loadTodoData();
}

async function deleteGroup(id) {
    if (!confirm('Delete this group and ALL its lists and tasks?')) return;
    await TodoAPI.deleteGroup(id);
    await loadTodoData();
}
window.deleteGroup = deleteGroup;

// ─── CRUD: Lists ─────────────────────────────────────────────────
function openAddListModal(groupId) {
    _currentGroupId = groupId;
    document.getElementById('addListForm').reset();
    document.getElementById('addListModal').style.display = 'block';
}
window.openAddListModal = openAddListModal;

async function createList(e) {
    e.preventDefault();
    const name = document.getElementById('listNameInput').value.trim();
    if (!name || !_currentGroupId) return;
    await TodoAPI.createList(_currentGroupId, name);
    closeTodoModals();
    await loadTodoData();
}

async function deleteTodoList(id) {
    if (!confirm('Delete this list and all its tasks?')) return;
    await TodoAPI.deleteList(id);
    await loadTodoData();
}
window.deleteTodoList = deleteTodoList;

// ─── CRUD: Tasks ─────────────────────────────────────────────────
let _editingTaskId = null;
let _currentListId = null;
let _currentTaskGroupId = null;

function openAddTodoTask(listId, groupId) {
    _editingTaskId     = null;
    _currentListId     = listId;
    _currentTaskGroupId = groupId;
    document.getElementById('todoTaskForm').reset();
    document.getElementById('todoTaskModalTitle').innerHTML = '<i class="fas fa-tasks"></i> Add Todo Task';
    document.getElementById('todoTaskCategory').value = '';
    document.getElementById('todoImportantFields').style.display = 'none';
    document.getElementById('deleteTodoFromModalBtn').style.display = 'none';
    document.getElementById('todoTaskModal').style.display = 'block';
}
window.openAddTodoTask = openAddTodoTask;

function openEditTodoTask(taskId) {
    // Find the task in cache
    let found = null;
    for (const g of todoGroups) {
        for (const l of (todoListsCache[g._id] || [])) {
            const t = (todoTasksCache[l._id] || []).find(x => x._id === taskId);
            if (t) { found = t; _currentListId = l._id; _currentTaskGroupId = g._id; break; }
        }
        if (found) break;
    }
    if (!found) return;
    _editingTaskId = taskId;
    document.getElementById('todoTaskModalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Todo Task';
    document.getElementById('todoTaskTitle').value      = found.title;
    document.getElementById('todoTaskDueDate').value   = found.dueDate;
    document.getElementById('todoTaskDuration').value  = found.duration || '';
    document.getElementById('todoTaskCategory').value  = found.category || '';
    document.getElementById('todoTaskImportant').checked = found.isImportant;
    document.getElementById('todoImportantFields').style.display = found.isImportant ? '' : 'none';
    if (found.isImportant) {
        document.getElementById('todoTaskDate').value      = found.date      || '';
        document.getElementById('todoTaskStartTime').value = found.startTime || '';
        document.getElementById('todoTaskEndTime').value   = found.endTime   || '';
    }
    document.getElementById('deleteTodoFromModalBtn').style.display = 'inline-block';
    document.getElementById('todoTaskModal').style.display = 'block';
}
window.openEditTodoTask = openEditTodoTask;

async function saveTodoTask(e) {
    e.preventDefault();
    const isImp = document.getElementById('todoTaskImportant').checked;
    const data = {
        groupId:     _currentTaskGroupId,
        title:       document.getElementById('todoTaskTitle').value.trim(),
        dueDate:     document.getElementById('todoTaskDueDate').value,
        duration:    document.getElementById('todoTaskDuration').value.trim(),
        category:    document.getElementById('todoTaskCategory').value,
        isImportant: isImp,
        startTime:   isImp ? document.getElementById('todoTaskStartTime').value : null,
        endTime:     isImp ? document.getElementById('todoTaskEndTime').value   : null,
        date:        isImp ? document.getElementById('todoTaskDate').value       : null,
    };
    if (!data.title || !data.dueDate) return;
    if (isImp && (!data.startTime || !data.endTime || !data.date)) {
        alert('Important tasks require a calendar Date, Start Time, and End Time.');
        return;
    }
    if (_editingTaskId) {
        await TodoAPI.updateTask(_editingTaskId, data);
    } else {
        await TodoAPI.createTask(_currentListId, data);
    }
    closeTodoModals();
    await loadTodoData();
}

async function deleteTodoTask(id) {
    if (!confirm('Delete this task?')) return;
    await TodoAPI.deleteTask(id);
    await loadTodoData();
}
window.deleteTodoTask = deleteTodoTask;

async function toggleTodoTask(id, checked) {
    await TodoAPI.updateTask(id, { completed: checked });
    // Update cache immediately
    for (const g of todoGroups) {
        for (const l of (todoListsCache[g._id] || [])) {
            const tasks = todoTasksCache[l._id] || [];
            const t = tasks.find(x => x._id === id);
            if (t) { t.completed = checked; break; }
        }
    }
    window.todoImportantTasks = (window.todoImportantTasks || []).filter(t => !(t._id === id && checked));
    renderTodoGroups();
    renderDueDates();
    renderStats();
    if (window.renderAllViews) window.renderAllViews();
}
window.toggleTodoTask = toggleTodoTask;

async function toggleTodoImportant(id, current) {
    const nowImportant = !current;
    if (nowImportant) {
        // Need date/time — open edit modal which already has the toggle checked
        // Find task, flip isImportant and open edit
        let found = null;
        for (const g of todoGroups) {
            for (const l of (todoListsCache[g._id]||[])) {
                found = (todoTasksCache[l._id]||[]).find(t => t._id === id);
                if (found) { _currentListId = l._id; _currentTaskGroupId = g._id; break; }
            }
            if (found) break;
        }
        if (!found) return;
        // Temporarily flip isImportant to open the edit modal with fields visible
        found.isImportant = true;
        openEditTodoTask(id);
        return;
    }
    await TodoAPI.updateTask(id, { isImportant: false, startTime: null, endTime: null, date: null });
    await loadTodoData();
}
window.toggleTodoImportant = toggleTodoImportant;

// ─── Stats ───────────────────────────────────────────────────────
function renderStats() {
    const statsContainer = document.getElementById('statsContent');
    if (!statsContainer) return;

    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    let importantHrsWeek = 0;

    const n = new Date();
    const todayStr = _today();
    
    // Calculate start of week (Monday) and start of month
    const dayOfWeek = n.getDay() || 7; // 1-7 (Mon-Sun)
    const startOfWeek = new Date(n);
    startOfWeek.setDate(n.getDate() - dayOfWeek + 1);
    startOfWeek.setHours(0,0,0,0);
    
    const startOfMonth = new Date(n.getFullYear(), n.getMonth(), 1);

    for (const g of todoGroups) {
        for (const l of (todoListsCache[g._id] || [])) {
            for (const t of (todoTasksCache[l._id] || [])) {
                if (t.completed) {
                    const refDateStr = t.completedAt || t.updatedAt || t.dueDate || todayStr;
                    const refDate = new Date(refDateStr + 'T12:00:00');
                    const refStr = refDateStr.split('T')[0];

                    if (refStr === todayStr) todayCount++;
                    if (refDate >= startOfWeek && refDate <= new Date()) weekCount++;
                    if (refDate >= startOfMonth && refDate <= new Date()) monthCount++;

                    if (t.isImportant && refDate >= startOfWeek && refDate <= new Date()) {
                        let hrs = 0;
                        if (t.duration) {
                            const hrMatch = t.duration.match(/(\d+)\s*hr/i);
                            const minMatch = t.duration.match(/(\d+)\s*min/i);
                            if (hrMatch) hrs += parseInt(hrMatch[1]);
                            if (minMatch) hrs += parseInt(minMatch[1]) / 60;
                        }
                        importantHrsWeek += hrs;
                    }
                }
            }
        }
    }

    const maxVal = Math.max(todayCount, weekCount, monthCount, 1);
    const todayPct = (todayCount / maxVal) * 100;
    const weekPct = (weekCount / maxVal) * 100;
    const monthPct = (monthCount / maxVal) * 100;

    statsContainer.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">Completed Today</span>
            <span class="stat-value">${todayCount}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Completed This Week</span>
            <span class="stat-value">${weekCount}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Completed This Month</span>
            <span class="stat-value">${monthCount}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Important Hours (Week)</span>
            <span class="stat-value">${importantHrsWeek.toFixed(1)}h</span>
        </div>
        <div class="stat-chart-container">
            <div class="stat-bar-wrapper">
                <div class="stat-bar" style="height: ${todayPct}%"></div>
                <span class="stat-bar-label">TODAY</span>
            </div>
            <div class="stat-bar-wrapper">
                <div class="stat-bar" style="height: ${weekPct}%"></div>
                <span class="stat-bar-label">WEEK</span>
            </div>
            <div class="stat-bar-wrapper">
                <div class="stat-bar" style="height: ${monthPct}%"></div>
                <span class="stat-bar-label">MONTH</span>
            </div>
        </div>
    `;
}

// ─── Modal helpers ───────────────────────────────────────────────
function closeTodoModals() {
    ['todoTaskModal','addGroupModal','addListModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    _editingTaskId = null;
}

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Buttons
    const addGroupBtn = document.getElementById('addGroupBtn');
    if (addGroupBtn) addGroupBtn.addEventListener('click', openAddGroupModal);

    document.getElementById('addGroupForm')?.addEventListener('submit', createGroup);
    document.getElementById('addListForm')?.addEventListener('submit', createList);
    document.getElementById('todoTaskForm')?.addEventListener('submit', saveTodoTask);

    document.getElementById('deleteTodoFromModalBtn')?.addEventListener('click', () => {
        if (!_editingTaskId) return;
        deleteTodoTask(_editingTaskId);
        closeTodoModals();
    });

    document.getElementById('todoTaskImportant')?.addEventListener('change', (e) => {
        document.getElementById('todoImportantFields').style.display = e.target.checked ? '' : 'none';
    });

    // Close on X or backdrop click
    document.querySelectorAll('.todo-modal-close').forEach(btn => {
        btn.addEventListener('click', closeTodoModals);
    });
    window.addEventListener('click', (e) => {
        if (['todoTaskModal','addGroupModal','addListModal'].includes(e.target.id)) closeTodoModals();
    });

    // Search and Category Filters
    const searchInput = document.getElementById('todoSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            window.todoSearchQuery = e.target.value;
            renderTodoGroups();
        });
    }

    document.querySelectorAll('.cat-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.cat-filter').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            window.todoCategoryFilter = e.target.getAttribute('data-cat');
            renderTodoGroups();
        });
    });
});
