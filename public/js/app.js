// Global variables
let currentDate = new Date();
let currentViewDate = new Date();
let tasks = [];
let reminders = [];
let notificationCheckInterval = null;
let clockInterval = null;
let currentEditingTaskId = null;

// Helper: Format date as YYYY-MM-DD
function formatDate(date) {
    let d = new Date(date);
    let year = d.getFullYear();
    let month = String(d.getMonth() + 1).padStart(2, '0');
    let day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper: Format time for display (12-hour GMT+3)
function formatTime(time24) {
    if (!time24) return '';
    let [hours, minutes] = time24.split(':');
    let h = parseInt(hours);
    let ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
}

// Helper: Calculate duration between start and end time
function calculateDuration(startTime, endTime) {
    let [startH, startM] = startTime.split(':').map(Number);
    let [endH, endM] = endTime.split(':').map(Number);
    let startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;
    let diff = endTotal - startTotal;
    if (diff < 0) diff += 24 * 60;
    let hours = Math.floor(diff / 60);
    let minutes = diff % 60;
    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} hr`;
    return `${hours} hr ${minutes} min`;
}

// Helper: Check if task has passed based on date and time
function isTaskPast(dateStr, startTime) {
    if (!dateStr || !startTime) return false;
    let [year, month, day] = dateStr.split('-');
    let [hours, minutes] = startTime.split(':');
    let taskTime = new Date(year, month - 1, day, hours, minutes);
    return taskTime < new Date();
}

// Helper: Check if a reminder has passed
function isReminderPast(r) {
    const t = new Date(`${r.date}T${r.time || '00:00'}:00`);
    return t < new Date();
}

// Helper: Format countdown string for a reminder
function formatReminderCountdown(r) {
    const now = new Date();
    const t = new Date(`${r.date}T${r.time || '00:00'}:00`);
    const diff = t - now;
    if (diff <= 0) return '<span class="countdown-past"><i class="fas fa-history"></i> Passed</span>';
    const totalMin  = Math.floor(diff / 60000);
    const totalHr   = Math.floor(totalMin / 60);
    const totalDays = Math.floor(totalHr / 24);
    const months    = Math.floor(totalDays / 30);
    const icon = '<i class="fas fa-hourglass-half"></i>';
    if (months >= 1) {
        const rd = totalDays - months * 30;
        return `<span class="countdown">${icon} ${months}mo${rd > 0 ? ' ' + rd + 'd' : ''}</span>`;
    } else if (totalDays >= 1) {
        const rh = totalHr - totalDays * 24;
        return `<span class="countdown">${icon} ${totalDays}d${rh > 0 ? ' ' + rh + 'h' : ''}</span>`;
    } else if (totalHr >= 1) {
        const rm = totalMin - totalHr * 60;
        return `<span class="countdown">${icon} ${totalHr}h${rm > 0 ? ' ' + rm + 'm' : ''}</span>`;
    } else {
        return `<span class="countdown">${icon} ${totalMin}m</span>`;
    }
}

// Update current date and time display
function updateDateTimeDisplay() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Africa/Addis_Ababa'
    };
    const formatted = now.toLocaleString('en-US', options);
    const display = document.getElementById('currentDateTime');
    if (display) {
        display.innerHTML = `<i class="fas fa-clock"></i> ${formatted} (GMT+3)`;
    }
}

// Start clock update
function startClock() {
    updateDateTimeDisplay();
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(updateDateTimeDisplay, 1000);
}

// API Calls
const API = {
    async request(url, options = {}) {
        const res = await fetch(url, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers }
        });
        if (res.status === 401) {
            logout();
            throw new Error('Not authenticated');
        }
        return res.json();
    },

    async signup(email, password) {
        return this.request('/api/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },

    async login(email, password) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },

    async logout() {
        return this.request('/api/auth/logout', { method: 'POST' });
    },

    async checkAuth() {
        try {
            return await this.request('/api/auth/check');
        } catch {
            return { authenticated: false };
        }
    },

    async getTasks() {
        return this.request('/api/tasks');
    },

    async getTasksByDate(date) {
        return this.request(`/api/tasks/date/${date}`);
    },

    async createTask(task) {
        return this.request('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(task)
        });
    },

    async updateTask(id, task) {
        return this.request(`/api/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(task)
        });
    },

    async deleteTask(id) {
        return this.request(`/api/tasks/${id}`, { method: 'DELETE' });
    },

    async getReminders() {
        return this.request('/api/reminders');
    },

    async createReminder(reminder) {
        return this.request('/api/reminders', {
            method: 'POST',
            body: JSON.stringify(reminder)
        });
    },

    async updateReminder(id, reminder) {
        return this.request(`/api/reminders/${id}`, {
            method: 'PUT',
            body: JSON.stringify(reminder)
        });
    },

    async deleteReminder(id) {
        return this.request(`/api/reminders/${id}`, { method: 'DELETE' });
    }
};

// Auth Functions
async function signup(email, password) {
    try {
        await API.signup(email, password);
        showNotification('Account created! Logging you in...', 'success');
        await login(email, password);
    } catch (err) {
        document.getElementById('signupError').innerText = err.message || 'Signup failed';
    }
}

async function login(email, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (response.ok) {
            // Store flag in localStorage for persistence
            localStorage.setItem('isAuthenticated', 'true');

            document.getElementById('authScreen').style.display = 'none';
            document.getElementById('appScreen').style.display = 'block';
            await loadAllData();
            startNotificationChecker();
            startClock();
        } else {
            document.getElementById('loginError').innerText = data.message || 'Login failed';
        }
    } catch (err) {
        document.getElementById('loginError').innerText = err.message || 'Login failed';
    }
}

async function logout() {
    await API.logout();
    localStorage.removeItem('isAuthenticated');
    if (clockInterval) clearInterval(clockInterval);
    if (notificationCheckInterval) clearInterval(notificationCheckInterval);
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appScreen').style.display = 'none';
}

// Load Data
async function loadAllData() {
    tasks = await API.getTasks();
    reminders = await API.getReminders();
    renderAllViews();
    renderRemindersTable();
    checkAndNotifyReminders();
}

// NEW FUNCTION: Toggle task completion
async function toggleTaskComplete(taskId, isCompleted) {
    try {
        const task = tasks.find(t => t._id === taskId);
        if (task) {
            const updatedTask = { ...task, completed: isCompleted };
            await API.updateTask(taskId, updatedTask);
            tasks = await API.getTasks();
            renderAllViews(); // Refresh current view
            showNotification(isCompleted ? 'Task completed! ✓' : 'Task uncompleted', 'success');
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showNotification('Failed to update task', 'error');
    }
}

// Render Day View (WITHOUT delete button, WITH checkbox)
// function renderDayView(date) {
//     const dateStr = formatDate(date);
//     const dayTasks = tasks.filter(t => t.date === dateStr);
//     const container = document.getElementById('dayView');
//     document.getElementById('dayTitle').innerText = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

//     let html = '';
//     for (let hour = 0; hour < 24; hour++) {
//         let hourLabel = formatTime(`${hour.toString().padStart(2, '0')}:00`);
//         let tasksInHour = dayTasks.filter(t => {
//             let startHour = parseInt(t.startTime.split(':')[0]);
//             return startHour === hour;
//         });

//         let tasksHtml = tasksInHour.map(t => `
//             <div class="task-block ${new Date(dateStr) < new Date() ? 'past' : ''}">
//                 <div class="task-title">
//                     <input type="checkbox" class="task-checkbox" data-id="${t._id}" ${t.completed ? 'checked' : ''}>
//                     <span class="${t.completed ? 'completed' : ''}" onclick="editTask('${t._id}')">${escapeHtml(t.title)}</span>
//                 </div>
//                 <div class="task-time">${formatTime(t.startTime)} - ${formatTime(t.endTime)}</div>
//                 <div class="task-time">Duration: ${calculateDuration(t.startTime, t.endTime)}</div>
//             </div>
//         `).join('');

//         html += `
//             <div class="hour-slot">
//                 <div class="hour-label">${hourLabel}</div>
//                 <div class="hour-content" onclick="openAddTaskModal('${dateStr}', '${hour.toString().padStart(2, '0')}:00')">
//                     ${tasksHtml}
//                 </div>
//             </div>
//         `;
//     }
//     container.innerHTML = html;

//     // Add event listeners to checkboxes
//     document.querySelectorAll('.task-checkbox').forEach(cb => {
//         cb.addEventListener('change', (e) => {
//             e.stopPropagation();
//             const taskId = cb.getAttribute('data-id');
//             toggleTaskComplete(taskId, cb.checked);
//         });
//     });
// }
// Render Day View - Timeline with visual task spanning + overlap detection
function renderDayView(date) {
    const dateStr = formatDate(date);
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = formatDate(prevDate);

    // Identify overnight tasks from yesterday that spill into today
    const yesterdayOvernightTasks = tasks.filter(t => t.date === prevDateStr && t.endTime < t.startTime);

    const dayTasksOriginal = tasks.filter(t => t.date === dateStr);
    
    // Create rendering objects for everything that should be visible today
    const renderingTasks = [];
    
    for (const t of yesterdayOvernightTasks) {
        renderingTasks.push({
            ...t,
            renderStart: '00:00',
            renderEnd: t.endTime,
            isOverflowEnd: false,
            isOverflowStart: true
        });
    }

    for (const t of dayTasksOriginal) {
        if (t.endTime < t.startTime) {
            renderingTasks.push({
                ...t,
                renderStart: t.startTime,
                renderEnd: '24:00',
                isOverflowEnd: true,
                isOverflowStart: false
            });
        } else {
            renderingTasks.push({
                ...t,
                renderStart: t.startTime,
                renderEnd: t.endTime,
                isOverflowEnd: false,
                isOverflowStart: false
            });
        }
    }

    const container = document.getElementById('dayView');
    document.getElementById('dayTitle').innerText = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const HOUR_HEIGHT = 60; // px per hour

    // Build hour grid background
    let slotsHtml = '';
    for (let hour = 0; hour < 24; hour++) {
        const hourLabel = formatTime(`${hour.toString().padStart(2, '0')}:00`);
        slotsHtml += `<div class="hour-slot" onclick="openAddTaskModal('${dateStr}', '${hour.toString().padStart(2, '0')}:00')"><div class="hour-label">${hourLabel}</div><div class="hour-content"></div></div>`;
    }

    // Assign columns to overlapping tasks
    const sorted = renderingTasks.sort((a, b) => a.renderStart.localeCompare(b.renderStart));
    const colEnds = [];
    const taskCol = new Map();
    for (const t of sorted) {
        let placed = false;
        for (let c = 0; c < colEnds.length; c++) {
            if (colEnds[c] <= t.renderStart) { colEnds[c] = t.renderEnd; taskCol.set(t._id, c); placed = true; break; }
        }
        if (!placed) { taskCol.set(t._id, colEnds.length); colEnds.push(t.renderEnd); }
    }
    const numCols = Math.max(1, colEnds.length);

    // Build task overlay blocks
    const tasksHtml = sorted.map(t => {
        const [sh, sm] = t.renderStart.split(':').map(Number);
        const startMin = sh * 60 + (sm || 0);
        let endMin;
        if (t.renderEnd === '24:00') {
            endMin = 1440;
        } else {
            const [eh, em] = t.renderEnd.split(':').map(Number);
            endMin = eh * 60 + em;
        }

        const top    = startMin * (HOUR_HEIGHT / 60);
        const calcHeight = (endMin - startMin) * (HOUR_HEIGHT / 60);
        const height = Math.max(calcHeight, 28);
        const col    = taskCol.get(t._id) || 0;
        const pct    = 100 / numCols;
        const isPast = isTaskPast(dateStr, t.startTime);
        const dur    = calculateDuration(t.startTime, t.endTime);
        const inlineClass = calcHeight <= 35 ? ' inline-layout' : '';

        let metaHtml = `${formatTime(t.startTime)}–${formatTime(t.endTime)}`;
        if (t.isOverflowStart) metaHtml = `From yesterday, ends ${formatTime(t.endTime)}`;
        if (t.isOverflowEnd) metaHtml = `Starts ${formatTime(t.startTime)}, into tomorrow`;

        return `<div class="task-block-overlay${isPast ? ' past' : ''}${inlineClass}" style="top:${top}px;height:${height}px;left:calc(${col * pct}% + 2px);width:calc(${pct}% - 4px);" onclick="event.stopPropagation();editTask('${t._id}')"><div class="task-block-inner"><div style="display: flex; gap: 5px; align-items: baseline; flex-wrap: wrap;"><span class="task-block-title">${escapeHtml(t.title)}</span><span class="task-block-meta">${metaHtml}</span></div><span class="task-block-duration">${dur}</span></div><input type="checkbox" class="task-checkbox-right" data-id="${t._id}" ${t.completed ? 'checked' : ''} onclick="event.stopPropagation()"></div>`;
    }).join('');

    container.innerHTML = `<div class="day-timeline-wrapper">${slotsHtml}<div class="day-tasks-overlay">${tasksHtml}</div></div>`;

    // Bind checkbox events
    container.querySelectorAll('.task-checkbox-right').forEach(cb => {
        cb.addEventListener('change', (e) => {
            e.stopPropagation();
            toggleTaskComplete(cb.getAttribute('data-id'), cb.checked);
        });
    });
}





// Render Week View (KEEP delete button)
function renderWeekView(date) {
    const startOfWeek = new Date(date);
    const dayIndex = startOfWeek.getDay();
    const offsetToMonday = dayIndex === 0 ? 6 : dayIndex - 1;
    startOfWeek.setDate(startOfWeek.getDate() - offsetToMonday);
    const container = document.getElementById('weekView');

    let html = '<div class="week-view-container">';
    for (let i = 0; i < 7; i++) {
        let day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        let dateStr = formatDate(day);
        let dayTasks = tasks.filter(t => t.date === dateStr);
        let isToday = dateStr === formatDate(new Date());

        html += `
            <div class="week-day ${isToday ? 'today' : ''}" onclick="goToDate('${dateStr}')">
                <div class="week-day-header">${day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                ${dayTasks.map(t => `
                    <div class="week-task ${isTaskPast(dateStr, t.startTime) ? 'past' : ''}" onclick="event.stopPropagation(); editTask('${t._id}')">
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" class="week-checkbox" data-id="${t._id}" ${t.completed ? 'checked' : ''} onclick="event.stopPropagation()">
                            <span class="${t.completed ? 'completed' : ''}">${escapeHtml(t.title)}</span>
                        </div>
                        <small>${formatTime(t.startTime)} - ${formatTime(t.endTime)}</small>
                        <button class="delete-week-task-btn" data-id="${t._id}"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                `).join('')}
                ${dayTasks.length === 0 ? '<div class="week-task empty">No tasks</div>' : ''}
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;

    // Add event listeners to week delete buttons
    document.querySelectorAll('.delete-week-task-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const taskId = this.getAttribute('data-id');
            deleteTaskById(taskId);
        });
    });

    // Add event listeners to week checkboxes
    document.querySelectorAll('.week-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            e.stopPropagation();
            const taskId = cb.getAttribute('data-id');
            toggleTaskComplete(taskId, cb.checked);
        });
    });
}

// Render Month View (WITH checkbox)
function renderMonthView(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const container = document.getElementById('monthView');
    document.getElementById('monthTitle').innerText = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    let html = '';
    for (let i = 0; i < startDay; i++) {
        let prevMonthDate = new Date(year, month, -startDay + i + 1);
        html += `<div class="month-day other-month" onclick="goToDate('${formatDate(prevMonthDate)}')"><div class="month-day-number">${prevMonthDate.getDate()}</div></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        let dateStr = formatDate(new Date(year, month, d));
        let dayTasks = tasks.filter(t => t.date === dateStr);
        let isToday = dateStr === formatDate(new Date());

        html += `
            <div class="month-day ${isToday ? 'today' : ''}" onclick="goToDate('${dateStr}')">
                <div class="month-day-number">${d}</div>
                ${dayTasks.slice(0, 3).map(t => `
                    <div class="month-task ${isTaskPast(dateStr, t.startTime) ? 'past' : ''}" style="display: flex; align-items: center; gap: 3px;" onclick="event.stopPropagation(); editTask('${t._id}')">
                        <input type="checkbox" class="month-checkbox" data-id="${t._id}" ${t.completed ? 'checked' : ''} onclick="event.stopPropagation()">
                        <span class="${t.completed ? 'completed' : ''}">${escapeHtml(t.title)}</span>
                    </div>
                `).join('')}
                ${dayTasks.length > 3 ? `<div class="month-task" onclick="event.stopPropagation(); goToDate('${dateStr}')">+${dayTasks.length - 3} more</div>` : ''}
            </div>
        `;
    }

    let remaining = 42 - (startDay + daysInMonth);
    for (let i = 1; i <= remaining; i++) {
        let nextMonthDate = new Date(year, month + 1, i);
        html += `<div class="month-day other-month" onclick="goToDate('${formatDate(nextMonthDate)}')"><div class="month-day-number">${i}</div></div>`;
    }
    container.innerHTML = html;

    // Add event listeners to month checkboxes
    document.querySelectorAll('.month-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            e.stopPropagation();
            const taskId = cb.getAttribute('data-id');
            toggleTaskComplete(taskId, cb.checked);
        });
    });
}

// Render All Views
function renderAllViews() {
    renderDayView(currentDate);
    renderWeekView(currentDate);
    renderMonthView(currentDate);
}

// Render Reminders Table
function renderRemindersTable() {
    const tbody = document.querySelector('#remindersTable tbody');
    tbody.innerHTML = reminders.map(r => {
        const past = isReminderPast(r);
        const countdown = formatReminderCountdown(r);
        const dateDisplay = new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `
        <tr class="${past ? 'reminder-past' : ''}">
            <td>${escapeHtml(r.title)}</td>
            <td><div class="reminder-date-disp">${dateDisplay}</div><div>${countdown}</div></td>
            <td>${formatTime(r.time)}</td>
            <td class="reminder-notes-cell">${escapeHtml(r.notes || '')}</td>
            <td class="reminder-actions">
                <button class="edit-btn icon-only" onclick="editReminder('${r._id}')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="snooze-btn icon-only" onclick="openSnoozeModal('${r._id}')" title="Snooze"><i class="fas fa-bed"></i></button>
                <button class="delete-btn icon-only" onclick="deleteReminderById('${r._id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

// Check and Notify Reminders
function checkAndNotifyReminders() {
    const now = new Date();

    reminders.forEach(async r => {
        const reminderDate = new Date(`${r.date}T${r.time || '00:00'}:00`);
        const diffMs = reminderDate - now;
        const diffMinutes = Math.floor(diffMs / 60000);

        if (diffMinutes > 0) {
            if (diffMinutes <= 360 && diffMinutes > 240 && !r.isNotified6Hours) {
                showNotification(`Reminder: ${r.title} in 6 hours`, 'reminder');
                await API.updateReminder(r._id, { isNotified6Hours: true });
            }
            if (diffMinutes <= 240 && diffMinutes > 120 && !r.isNotified4Hours) {
                showNotification(`Reminder: ${r.title} in 4 hours`, 'reminder');
                await API.updateReminder(r._id, { isNotified4Hours: true });
            }
            if (diffMinutes <= 120 && diffMinutes > 60 && !r.isNotified2Hours) {
                showNotification(`Reminder: ${r.title} in 2 hours`, 'reminder');
                await API.updateReminder(r._id, { isNotified2Hours: true });
            }
            if (diffMinutes <= 60 && diffMinutes > 0 && !r.isNotified1Hour) {
                showNotification(`Reminder: ${r.title} in 1 hour`, 'reminder');
                await API.updateReminder(r._id, { isNotified1Hour: true });
            }
            if (diffMinutes === 0 && !r.isNotifiedAtTime) {
                showNotification(`Reminder: ${r.title} now!`, 'warning', true, async () => {
                    await API.updateReminder(r._id, { isAcknowledgedPassed: true });
                });
                await API.updateReminder(r._id, { isNotifiedAtTime: true });
            }
        } else if (diffMinutes < 0 && !r.isAcknowledgedPassed) {
            if (!document.querySelector(`[data-reminder-id="${r._id}"]`)) {
                const passedMin = Math.abs(diffMinutes);
                let passedStr = `${passedMin} min`;
                if (passedMin >= 60) {
                    passedStr = `${Math.floor(passedMin / 60)} hr ${passedMin % 60} min`;
                }
                const msg = `Reminder: ${r.title} has passed by ${passedStr}`;
                
                const notif = document.createElement('div');
                notif.className = `notification warning persistent`;
                notif.dataset.reminderId = r._id;
                notif.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i> ${msg}
                    <span class="close-notif" onclick="
                        this.parentElement.remove();
                        fetch('/api/reminders/${r._id}', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ isAcknowledgedPassed: true })
                        });
                    ">&times;</span>
                `;
                document.body.appendChild(notif);
            }
        }
    });
}

function startNotificationChecker() {
    if (notificationCheckInterval) clearInterval(notificationCheckInterval);
    notificationCheckInterval = setInterval(() => {
        checkAndNotifyReminders();
        renderRemindersTable(); // refresh countdown timers
    }, 60000);
}

// Task CRUD
async function openAddTaskModal(date, startTime) {
    document.getElementById('taskModalTitle').innerText = 'Add Task';
    document.getElementById('taskForm').reset();
    // Enforce minimum date = today (no tasks in the past)
    document.getElementById('taskDate').min = formatDate(new Date());
    if (date) document.getElementById('taskDate').value = date;
    if (startTime) document.getElementById('taskStartTime').value = startTime;
    document.getElementById('taskModal').style.display = 'block';
    document.getElementById('isRecurring').checked = false;
    document.getElementById('recurringType').style.display = 'none';
    document.getElementById('deleteFromModalBtn').style.display = 'none';
    delete document.getElementById('taskModal').dataset.editId;
    delete document.getElementById('taskModal').dataset.isEdit;
}

async function editTask(id) {
    const task = tasks.find(t => t._id === id);
    if (!task) return;

    currentEditingTaskId = id;

    document.getElementById('taskModalTitle').innerText = 'Edit Task';
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDesc').value = task.description || '';
    document.getElementById('taskLocation').value = task.location || '';
    document.getElementById('taskDate').value = task.date;
    document.getElementById('taskStartTime').value = task.startTime;
    document.getElementById('taskEndTime').value = task.endTime;
    document.getElementById('isRecurring').checked = task.isRecurring || false;
    if (task.isRecurring) {
        document.getElementById('recurringType').style.display = 'block';
        document.getElementById('recurringType').value = task.recurringType;
    }
    document.getElementById('deleteFromModalBtn').style.display = 'block';
    document.getElementById('taskModal').dataset.editId = id;
    document.getElementById('taskModal').dataset.isEdit = 'true';
    document.getElementById('taskModal').style.display = 'block';
}

async function saveTask() {
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDesc').value,
        location: document.getElementById('taskLocation').value,
        date: document.getElementById('taskDate').value,
        startTime: document.getElementById('taskStartTime').value,
        endTime: document.getElementById('taskEndTime').value,
        isRecurring: document.getElementById('isRecurring').checked,
        recurringType: document.getElementById('isRecurring').checked ? document.getElementById('recurringType').value : null
    };

    // Block setting backward UNLESS overnight
    if (taskData.endTime < taskData.startTime) {
        const [sh] = taskData.startTime.split(':').map(Number);
        const [eh] = taskData.endTime.split(':').map(Number);
        const isOvernight = sh >= 12 && eh < 12;
        if (!isOvernight) {
            showNotification('setting to back ward is not possible', 'warning');
            return;
        }
    }

    // Check overlap
    const existingTasks = tasks.filter(t => t.date === taskData.date && t._id !== document.getElementById('taskModal').dataset.editId);
    
    // Disallow more than 2 tasks overlapping at any given time
    const overlapping = existingTasks.filter(t => taskData.startTime < t.endTime && taskData.endTime > t.startTime);
    let makesThree = false;
    for (let i = 0; i < overlapping.length; i++) {
        for (let j = i + 1; j < overlapping.length; j++) {
            let t1 = overlapping[i];
            let t2 = overlapping[j];
            if (t1.startTime < t2.endTime && t1.endTime > t2.startTime) {
                makesThree = true;
                break;
            }
        }
    }

    if (makesThree) {
        showNotification('⚠️ Cannot have more than 2 tasks overlapping at the same time!', 'warning');
        return;
    }

    const overlap = overlapping.length > 0;
    if (overlap) {
        if (!confirm('⚠️ This task overlaps with another task! Save anyway?')) return;
    }

    // Block new tasks scheduled in the past, UNLESS recurring
    const editIdForPastCheck = document.getElementById('taskModal').dataset.editId;
    if (!editIdForPastCheck && !taskData.isRecurring && isTaskPast(taskData.date, taskData.startTime)) {
        showNotification('⚠️ Cannot schedule a task in the past!', 'warning');
        return;
    }

    try {
        const editId = document.getElementById('taskModal').dataset.editId;
        if (editId) {
            await API.updateTask(editId, taskData);
            tasks = await API.getTasks();
            showNotification('Task updated!', 'success');
        } else {
            const tasksToCreate = [taskData];
            if (taskData.isRecurring && taskData.recurringType) {
                const baseDate = new Date(taskData.date);
                if (taskData.recurringType === 'daily') {
                    // Until end of week (Sunday). Week is Mon-Sun
                    const baseDay = baseDate.getDay(); // 0 is Sunday
                    if (baseDay !== 0) {
                        const daysLeft = 7 - baseDay; // Mon=1 -> 6 days left
                        for (let i = 1; i <= daysLeft; i++) {
                            const nextDate = new Date(baseDate);
                            nextDate.setDate(baseDate.getDate() + i);
                            tasksToCreate.push({ ...taskData, date: formatDate(nextDate) });
                        }
                    }
                } else if (taskData.recurringType === 'weekly') {
                    // Until end of month
                    const currentMonth = baseDate.getMonth();
                    for (let i = 1; i <= 5; i++) {
                        const nextDate = new Date(baseDate);
                        nextDate.setDate(baseDate.getDate() + (i * 7));
                        if (nextDate.getMonth() === currentMonth) {
                            tasksToCreate.push({ ...taskData, date: formatDate(nextDate) });
                        } else {
                            break;
                        }
                    }
                } else if (taskData.recurringType === 'monthly') {
                    // Until end of year
                    const currentYear = baseDate.getFullYear();
                    for (let i = 1; i <= 11; i++) {
                        const nextDate = new Date(baseDate);
                        nextDate.setMonth(baseDate.getMonth() + i);
                        if (nextDate.getFullYear() === currentYear) {
                            tasksToCreate.push({ ...taskData, date: formatDate(nextDate) });
                        } else {
                            break;
                        }
                    }
                }
            }
            
            await Promise.all(tasksToCreate.map(t => API.createTask(t)));

            tasks = await API.getTasks();
            showNotification(`Task${tasksToCreate.length > 1 ? 's' : ''} created!`, 'success');
        }
        closeModals();
        renderAllViews();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

// DELETE TASK - Working version (KEPT for weekly view)
async function deleteTaskById(id) {
    console.log('Delete function called for task:', id);
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        await API.deleteTask(id);
        tasks = await API.getTasks();
        renderAllViews();
        renderRemindersTable();
        showNotification('Task deleted successfully!', 'success');
    } catch (err) {
        console.error('Delete error:', err);
        showNotification('Failed to delete task: ' + err.message, 'error');
    }
}

// Reminder CRUD
async function openAddReminderModal() {
    document.getElementById('reminderForm').reset();
    document.getElementById('reminderDate').min = formatDate(new Date());
    document.getElementById('reminderModal').style.display = 'block';
    delete document.getElementById('reminderModal').dataset.editId;
}

async function editReminder(id) {
    const reminder = reminders.find(r => r._id === id);
    if (!reminder) return;

    document.getElementById('reminderTitle').value = reminder.title;
    document.getElementById('reminderDate').value = reminder.date;
    document.getElementById('reminderTime').value = reminder.time;
    document.getElementById('reminderNotes').value = reminder.notes || '';
    document.getElementById('reminderModal').dataset.editId = id;
    document.getElementById('reminderModal').style.display = 'block';
}

async function saveReminder() {
    const reminderData = {
        title: document.getElementById('reminderTitle').value,
        date: document.getElementById('reminderDate').value,
        time: document.getElementById('reminderTime').value,
        notes: document.getElementById('reminderNotes').value
    };

    // Block saving reminders in the past
    const editId = document.getElementById('reminderModal').dataset.editId;
    if (!editId && isReminderPast(reminderData)) {
        showNotification('⚠️ Cannot schedule a reminder in the past!', 'warning');
        return;
    }

    try {
        const editId = document.getElementById('reminderModal').dataset.editId;
        if (editId) {
            await API.updateReminder(editId, reminderData);
            reminders = await API.getReminders();
            showNotification('Reminder updated!', 'success');
        } else {
            await API.createReminder(reminderData);
            reminders = await API.getReminders();
            showNotification('Reminder created!', 'success');
        }
        closeModals();
        renderRemindersTable();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

async function deleteReminderById(id) {
    if (!confirm('Delete this reminder?')) return;
    await API.deleteReminder(id);
    reminders = await API.getReminders();
    renderRemindersTable();
    showNotification('Reminder deleted', 'success');
}

// Snooze functionality
async function openSnoozeModal(id) {
    document.getElementById('snoozeForm').reset();
    document.getElementById('snoozeModal').dataset.snoozeId = id;
    document.getElementById('snoozeModal').style.display = 'block';
}

async function saveSnooze() {
    const id = document.getElementById('snoozeModal').dataset.snoozeId;
    const hours = parseInt(document.getElementById('snoozeHours').value);
    const reminder = reminders.find(r => r._id === id);
    if (!reminder) return;

    // Add selected hours to the current time
    const newTime = new Date();
    newTime.setHours(newTime.getHours() + hours);

    const reminderData = {
        title: reminder.title,
        notes: reminder.notes,
        date: formatDate(newTime),
        time: `${String(newTime.getHours()).padStart(2, '0')}:${String(newTime.getMinutes()).padStart(2, '0')}`,
        isNotifiedAtTime: false,
        isNotifiedAfter: false,
        isNotified2Hours: false,
        isNotified6Hours: false,
        isNotified3Days: false
    };

    try {
        await API.updateReminder(id, reminderData);
        reminders = await API.getReminders();
        showNotification(`Reminder snoozed for ${hours} hour(s)!`, 'success');
        closeModals();
        renderRemindersTable();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

// Navigation
function goToDate(dateStr) {
    currentDate = new Date(dateStr);
    renderAllViews();
}

function prevDay() {
    currentDate.setDate(currentDate.getDate() - 1);
    renderAllViews();
}

function nextDay() {
    currentDate.setDate(currentDate.getDate() + 1);
    renderAllViews();
}

function prevWeek() {
    currentDate.setDate(currentDate.getDate() - 7);
    renderAllViews();
}

function nextWeek() {
    currentDate.setDate(currentDate.getDate() + 7);
    renderAllViews();
}

function prevMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderAllViews();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderAllViews();
}

// UI Helpers
function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    delete document.getElementById('taskModal').dataset.editId;
    delete document.getElementById('taskModal').dataset.isEdit;
    delete document.getElementById('reminderModal').dataset.editId;
    delete document.getElementById('snoozeModal').dataset.snoozeId;
}

function showNotification(message, type = 'info', persistent = false, onCloseCallback = null) {
    const notif = document.createElement('div');
    notif.className = `notification ${type}${persistent ? ' persistent' : ''}`;
    let html = `<i class="fas ${type === 'warning' ? 'fa-exclamation-triangle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i> ${message}`;
    if (persistent) {
        const id = 'notif_' + Math.random().toString(36).substr(2, 9);
        notif.id = id;
        html += `<span class="close-notif" onclick="document.getElementById('${id}').remove(); if(window.${id}Callback) window.${id}Callback();">&times;</span>`;
        if (onCloseCallback) {
            window[`${id}Callback`] = onCloseCallback;
        }
    }
    notif.innerHTML = html;
    document.body.appendChild(notif);
    if (!persistent) {
        setTimeout(() => notif.remove(), 4000);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('darkModeToggle');
    if (document.body.classList.contains('dark-mode')) {
        btn.innerHTML = '<i class="fas fa-sun"></i> Light';
    } else {
        btn.innerHTML = '<i class="fas fa-moon"></i> Dark';
    }
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Check saved dark mode
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeToggle').innerHTML = '<i class="fas fa-sun"></i> Light';
    }

    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}Form`).classList.add('active');
        });
    });

    // Forms
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
    });

    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await signup(document.getElementById('signupEmail').value, document.getElementById('signupPassword').value);
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

    // Navigation
    document.getElementById('prevDay').addEventListener('click', prevDay);
    document.getElementById('nextDay').addEventListener('click', nextDay);
    document.getElementById('prevWeek').addEventListener('click', prevWeek);
    document.getElementById('nextWeek').addEventListener('click', nextWeek);
    document.getElementById('prevMonth').addEventListener('click', prevMonth);
    document.getElementById('nextMonth').addEventListener('click', nextMonth);

    // Modals
    document.getElementById('addReminderBtn').addEventListener('click', openAddReminderModal);
    document.getElementById('taskForm').addEventListener('submit', (e) => { e.preventDefault(); saveTask(); });
    document.getElementById('reminderForm').addEventListener('submit', (e) => { e.preventDefault(); saveReminder(); });
    document.getElementById('snoozeForm').addEventListener('submit', (e) => { e.preventDefault(); saveSnooze(); });
    document.getElementById('deleteFromModalBtn').addEventListener('click', () => {
        const editId = document.getElementById('taskModal').dataset.editId;
        if (editId) {
            deleteTaskById(editId);
            closeModals();
        }
    });
    document.querySelectorAll('.close').forEach(close => {
        close.addEventListener('click', closeModals);
    });
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) closeModals();
    });

    // Recurring checkbox
    document.getElementById('isRecurring').addEventListener('change', (e) => {
        document.getElementById('recurringType').style.display = e.target.checked ? 'block' : 'none';
    });

    // Check auth with persistence flag
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (isAuthenticated) {
        // Try to restore session
        try {
            const auth = await API.checkAuth();
            if (auth.authenticated) {
                document.getElementById('authScreen').style.display = 'none';
                document.getElementById('appScreen').style.display = 'block';
                await loadAllData();
                startNotificationChecker();
                startClock();
            } else {
                localStorage.removeItem('isAuthenticated');
                document.getElementById('authScreen').style.display = 'flex';
                document.getElementById('appScreen').style.display = 'none';
            }
        } catch (err) {
            localStorage.removeItem('isAuthenticated');
            document.getElementById('authScreen').style.display = 'flex';
            document.getElementById('appScreen').style.display = 'none';
        }
    } else {
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('appScreen').style.display = 'none';
    }

    // Make functions global for onclick
    window.goToDate = goToDate;
    window.editTask = editTask;
    window.editReminder = editReminder;
    window.deleteTaskById = deleteTaskById;
    window.deleteReminderById = deleteReminderById;
    window.openAddTaskModal = openAddTaskModal;
    window.toggleTaskComplete = toggleTaskComplete;
    window.openSnoozeModal = openSnoozeModal;
});