// Global variables
let currentDate = new Date();
const HOUR_HEIGHT = 60; // 60px per hour for daily view
let currentViewDate = new Date();
let tasks = [];
let reminders = [];
let notificationCheckInterval = null;
let clockInterval = null;
let currentEditingTaskId = null;
let remindersViewMode = 'active'; // 'active' or 'history'
let remindersFilter = 'All'; 

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

// Helper: Check if task end time has passed
function isTaskPast(dateStr, endTime) {
    if (!dateStr || !endTime) return false;
    let [year, month, day] = dateStr.split('-');
    let hoursVal = endTime === '24:00' ? '23' : endTime.split(':')[0];
    let minutesVal = endTime === '24:00' ? '59' : endTime.split(':')[1];
    let taskTime = new Date(year, month - 1, day, hoursVal, minutesVal);
    if (endTime === '24:00') taskTime.setSeconds(59);
    return taskTime < new Date();
}

// Helper: Check if task is currently ongoing (started but not ended)
function isTaskOngoing(dateStr, startTime, endTime) {
    if (!dateStr || !startTime || !endTime) return false;
    let [year, month, day] = dateStr.split('-');
    let start = new Date(year, month - 1, day, startTime.split(':')[0], startTime.split(':')[1]);
    let hoursVal = endTime === '24:00' ? '23' : endTime.split(':')[0];
    let minutesVal = endTime === '24:00' ? '59' : endTime.split(':')[1];
    let end = new Date(year, month - 1, day, hoursVal, minutesVal);
    if (endTime === '24:00') end.setSeconds(59);
    let now = new Date();
    return now >= start && now <= end;
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

    // Update current time indicator (Vertical Progress Bar v2.4.1)
    if (formatDate(now) === formatDate(currentDate)) {
        const fill = document.getElementById('timeProgressFill');
        if (fill) {
            // Percentage of the day passed (0-100%)
            const totalMinutes = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() / 60);
            const percentage = (totalMinutes / 1440) * 100;
            fill.style.height = `${percentage}%`;
        }
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
    renderReminders();
    checkAndNotifyReminders();
    // Load todo system
    if (window.loadTodoData) await window.loadTodoData();
}

// Toggle task completion (handles both calendar tasks AND important todo tasks)
async function toggleTaskComplete(taskId, isCompleted) {
    try {
        // Check if it's a todo task
        const isTodo = (window.todoImportantTasks || []).some(t => String(t._id) === String(taskId));
        if (isTodo) {
            if (window.toggleTodoTask) await window.toggleTodoTask(taskId, isCompleted);
            return;
        }
        const task = tasks.find(t => t._id === taskId);
        if (task) {
            const updatedTask = { ...task, completed: isCompleted };
            await API.updateTask(taskId, updatedTask);
            tasks = await API.getTasks();
            renderAllViews();
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

    // FIX 2: Header Badges calculation
    const totalTasks = renderingTasks.length;
    const completedTasks = renderingTasks.filter(t => t.completed).length;

    const container = document.getElementById('dayView');
    const dayTitleEl = document.getElementById('dayTitle');
    dayTitleEl.innerText = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // Inject Badges
    let badgesHtml = `
        <div class="header-badges">
            <span class="badge-pill">📋 ${totalTasks} task${totalTasks !== 1 ? 's' : ''}</span>
            <span class="badge-pill">✅ ${completedTasks} completed</span>
        </div>`;
    
    // Remove existing badges if any and re-append
    const existingBadges = dayTitleEl.parentElement.querySelector('.header-badges');
    if (existingBadges) existingBadges.remove();
    dayTitleEl.insertAdjacentHTML('afterend', badgesHtml);

    // Build hour grid background
    let slotsHtml = '';
    for (let hour = 0; hour < 24; hour++) {
        const hourLabel = formatTime(`${hour.toString().padStart(2, '0')}:00`);
        slotsHtml += `<div class="hour-slot" onclick="openAddTaskModal('${dateStr}', '${hour.toString().padStart(2, '0')}:00')"><div class="hour-label">${hourLabel}</div><div class="hour-content"></div></div>`;
    }

    // FIX 3: Smart Sorting
    // Priority order:
    // 1. Unchecked + Past (overdue)
    // 2. Unchecked + Ongoing (pending)
    // 3. Checked + Ongoing
    // 4. Unchecked + Future
    // 5. Checked + Past
    const getPriority = (t) => {
        const past = isTaskPast(dateStr, t.renderEnd);
        const ongoing = isTaskOngoing(dateStr, t.renderStart, t.renderEnd);
        if (!t.completed && past) return 1;
        if (!t.completed && ongoing) return 2;
        if (t.completed && ongoing) return 3;
        if (!t.completed && !past && !ongoing) return 4;
        return 5;
    };

    const sorted = renderingTasks.sort((a, b) => {
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        return a.renderStart.localeCompare(b.renderStart);
    });

    // Assign columns to overlapping tasks (for visual layout)
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
    const tasksHtml = sorted.map((t, index) => {
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
        
        // FIX 1 & 4: Logic updates
        const isPast = isTaskPast(dateStr, t.renderEnd);
        const isOngoing = isTaskOngoing(dateStr, t.renderStart, t.renderEnd);
        const isOverdue = !t.completed && isPast;
        
        const inlineClass = calcHeight <= 35 ? ' inline-layout' : '';
        const overdueClass = isOverdue ? ' overdue' : '';
        const pastClass = (isPast && t.completed) || (isPast && !isOverdue) ? ' past' : ''; // Fading logic

        // For overflow tasks, show the VISIBLE portion's time range and duration
        let metaHtml;
        let durDisplay;
        if (t.isOverflowStart) {
            metaHtml = `12:00 AM – ${formatTime(t.renderEnd)} <span style="opacity:0.75;font-size:10px">(↑ from yesterday)</span>`;
            durDisplay = calculateDuration('00:00', t.renderEnd);
        } else if (t.isOverflowEnd) {
            metaHtml = `${formatTime(t.startTime)} – midnight <span style="opacity:0.75;font-size:10px">(↓ cont. tomorrow)</span>`;
            durDisplay = calculateDuration(t.startTime, '00:00') || calculateDuration(t.startTime, t.endTime);
        } else {
            metaHtml = `${formatTime(t.startTime)}–${formatTime(t.endTime)}`;
            durDisplay = calculateDuration(t.startTime, t.endTime);
        }

        const cautionIcon = isOverdue ? '<i class="fas fa-exclamation-triangle" style="color: #e74c3c; margin-right: 5px;"></i>' : '';
        const pendingLabel = (!t.completed && isOngoing) ? '<span class="pending-badge">Pending</span>' : '';

        return `<div class="task-block-overlay${pastClass}${overdueClass}${inlineClass}" 
                     id="task-${t._id}"
                     style="top:${top}px;height:${height}px;left:calc(${col * pct}% + 2px);width:calc(${pct}% - 4px);" 
                     onclick="event.stopPropagation();editTask('${t._id}')">
                    <div class="task-block-inner">
                        <div style="display: flex; gap: 5px; align-items: baseline; flex-wrap: wrap;">
                            ${cautionIcon}
                            <span class="task-block-title">${escapeHtml(t.title)}</span>
                            ${pendingLabel}
                            <span class="task-block-meta">${metaHtml}</span>
                        </div>
                        <span class="task-block-duration">${durDisplay}</span>
                    </div>
                    <input type="checkbox" class="task-checkbox-right" data-id="${t._id}" ${t.completed ? 'checked' : ''} onclick="event.stopPropagation()">
                </div>`;
    }).join('');

    const now = new Date();
    const todayStr = formatDate(now);
    let progressHtml = '';
    if (dateStr === todayStr) {
        const totalMinutes = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() / 60);
        const percentage = (totalMinutes / 1440) * 100;
        progressHtml = `
            <div class="time-progress-track">
                <div id="timeProgressFill" class="time-progress-fill" style="height: ${percentage}%;"></div>
            </div>`;
    }

    container.innerHTML = `<div class="day-timeline-wrapper">${progressHtml}${slotsHtml}<div class="day-tasks-overlay">${tasksHtml}</div></div>`;

    // FIX 3: Auto-scroll to first task
    if (sorted.length > 0) {
        setTimeout(() => {
            const firstTaskEl = document.getElementById(`task-${sorted[0]._id}`);
            if (firstTaskEl && container) {
                const topPos = firstTaskEl.offsetTop;
                container.scrollTo({ top: Math.max(0, topPos - 50), behavior: 'smooth' });
            }
        }, 100);
    }

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
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1; // Adjust for Monday start
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const container = document.getElementById('monthView');
    document.getElementById('monthTitle').innerText = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    let html = '';
    
    // Add Day Headers
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayNames.forEach(day => {
        html += `<div class="month-day-header">${day}</div>`;
    });

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

// Render All Views (merges important todo tasks into calendar for rendering)
function renderAllViews() {
    // Temporarily augment tasks with important todo tasks that have full time/date
    const importantForCalendar = (window.todoImportantTasks || [])
        .filter(t => t.isImportant && t.date && t.startTime && t.endTime && !t.completed)
        .map(t => ({ ...t, _isTodoTask: true }));
    const savedTasks = tasks;
    tasks = [...tasks, ...importantForCalendar];
    renderDayView(currentDate);
    renderWeekView(currentDate);
    renderMonthView(currentDate);
    tasks = savedTasks;
}

// Render Reminders Cards v2.7.0
function renderReminders() {
    const list = document.getElementById('remindersList');
    if (!list) return;

    // Sort reminders: closest first
    const sorted = [...reminders].sort((a, b) => {
        const tA = new Date(`${a.date}T${a.time || '00:00'}:00`);
        const tB = new Date(`${b.date}T${b.time || '00:00'}:00`);
        return tA - tB;
    });

    // Filter based on view mode
    let displayReminders = [];
    if (remindersViewMode === 'active') {
        displayReminders = sorted.filter(r => !r.completed);
    } else {
        // History: finished, edited (handled as updated), snoozed (time changed), passed
        // For simplicity, we'll show completed and passed unchecked reminders
        displayReminders = sorted.filter(r => r.completed || isReminderPast(r));
    }

    // Filter based on category
    if (remindersFilter !== 'All') {
        displayReminders = displayReminders.filter(r => r.category === remindersFilter);
    }

    list.innerHTML = displayReminders.map(r => {
        const past = isReminderPast(r);
        const countdown = formatReminderCountdown(r);
        const dateDisplay = new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        const isHistoryItem = r.completed || (remindersViewMode === 'history' && past);
        const historyClass = isHistoryItem ? ' history' : '';
        const pastClass = past ? ' past' : '';
        const missedAlert = (!r.completed && past) ? '<div class="reminder-missed-alert"><i class="fas fa-exclamation-triangle"></i> ⚠️ Missed</div>' : '';
        const categoryLabel = r.category ? `<span class="reminder-category-label" style="font-size:10px; background:#667eea; color:white; padding:1px 6px; border-radius:10px; margin-left:8px;">${r.category}</span>` : '';

        return `
        <div class="reminder-card${pastClass}${historyClass}">
            <input type="checkbox" class="reminder-checkbox" data-id="${r._id}" ${r.completed ? 'checked' : ''} title="Mark as finished">
            <div class="reminder-details">
                <div class="reminder-title">${escapeHtml(r.title)}${categoryLabel}</div>
                <div class="reminder-meta">
                    <span><i class="fas fa-calendar-day"></i> ${dateDisplay}</span>
                    <span><i class="fas fa-clock"></i> ${formatTime(r.time)}</span>
                    ${countdown}
                </div>
                ${missedAlert}
                ${r.notes ? `<div class="reminder-notes-preview">${escapeHtml(r.notes)}</div>` : ''}
            </div>
            <div class="reminder-actions">
                <button class="edit-btn icon-only" onclick="editReminder('${r._id}')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="snooze-btn icon-only" onclick="openSnoozeModal('${r._id}')" title="Snooze"><i class="fas fa-clock"></i></button>
            </div>
        </div>`;
    }).join('');

    if (displayReminders.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:20px; opacity:0.5;">No ${remindersViewMode} reminders</div>`;
    }

    // Bind checkboxes
    list.querySelectorAll('.reminder-checkbox').forEach(cb => {
        cb.addEventListener('change', async (e) => {
            e.stopPropagation();
            const id = cb.getAttribute('data-id');
            await toggleReminderComplete(id, cb.checked);
        });
    });
}

async function toggleReminderComplete(id, isCompleted) {
    try {
        await API.updateReminder(id, { completed: isCompleted });
        reminders = await API.getReminders();
        renderReminders();
        showNotification(isCompleted ? 'Reminder finished! ✓' : 'Reminder restored', 'success');
    } catch (err) {
        showNotification('Failed to update reminder', 'error');
    }
}

function toggleRemindersView() {
    remindersViewMode = remindersViewMode === 'active' ? 'history' : 'active';
    const btn = document.getElementById('toggleRemindersHistory');
    btn.classList.toggle('active');
    btn.innerHTML = remindersViewMode === 'active' ? '<i class="fas fa-history"></i> History' : '<i class="fas fa-bell"></i> Active';
    renderReminders();
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
                    const hrs = Math.floor(passedMin / 60);
                    const mins = passedMin % 60;
                    passedStr = mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
                }
                const msg = `Reminder: ${r.title} has passed by ${passedStr}`;
                
                const notif = document.createElement('div');
                notif.className = `notification warning persistent`;
                notif.dataset.reminderId = r._id;
                notif.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i> ${msg}
                    <span class="close-notif" onclick="acknowledgePassedReminder('${r._id}', this.parentElement)">&times;</span>
                `;
                document.body.appendChild(notif);
            }
        }
    });
}

// Acknowledge a passed reminder: update in-memory array + API so it never re-fires
function acknowledgePassedReminder(id, element) {
    if (element) element.remove();
    // Mark in local memory immediately so the next interval check won't re-show it
    const r = reminders.find(r => r._id === id);
    if (r) r.isAcknowledgedPassed = true;
    // Persist to server
    fetch(`/api/reminders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAcknowledgedPassed: true })
    });
}

function startNotificationChecker() {
    if (notificationCheckInterval) clearInterval(notificationCheckInterval);
    notificationCheckInterval = setInterval(() => {
        checkAndNotifyReminders();
        renderReminders(); // refresh countdown timers
    }, 60000);
}

// Task CRUD
async function openAddTaskModal(date, startTime) {
    document.getElementById('taskModalTitle').innerText = 'Add Task';
    document.getElementById('taskForm').reset();
    // Enforce minimum date = today (no tasks in the past)
    document.getElementById('taskDate').min = formatDate(new Date());
    
    const todayStr = formatDate(new Date());
    const targetDate = date || todayStr;
    
    if (date) document.getElementById('taskDate').value = date;
    
    // Feature 1: Auto-start time based on current time for TODAY
    if (targetDate === todayStr) {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        document.getElementById('taskStartTime').value = currentTime;
    } else if (startTime) {
        document.getElementById('taskStartTime').value = startTime;
    }

    // Feature 2: Auto end time (start time + 1 minute)
    if (document.getElementById('taskStartTime').value) {
        updateEndTimeFromStart();
    }

    document.getElementById('taskModal').style.display = 'block';
    document.getElementById('isRecurring').checked = false;
    document.getElementById('recurringType').style.display = 'none';
    document.getElementById('recurringEndOptions').style.display = 'none';
    document.getElementById('recurringEndDate').value = '';
    document.getElementById('recurringOccurrences').value = '';
    document.getElementById('deleteFromModalBtn').style.display = 'none';
    delete document.getElementById('taskModal').dataset.editId;
    delete document.getElementById('taskModal').dataset.isEdit;
}

// Helper: Update end time to start time + 1 minute
function updateEndTimeFromStart() {
    const startVal = document.getElementById('taskStartTime').value;
    if (!startVal) return;
    
    let [h, m] = startVal.split(':').map(Number);
    m += 1;
    if (m >= 60) {
        m = 0;
        h += 1;
    }
    if (h >= 24) h = 0;
    
    const endVal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    document.getElementById('taskEndTime').value = endVal;
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
        document.getElementById('recurringEndOptions').style.display = 'block';
        document.getElementById('recurringEndDate').value = task.recurringEndDate || '';
        document.getElementById('recurringOccurrences').value = task.recurringOccurrences || '';
    } else {
        document.getElementById('recurringEndOptions').style.display = 'none';
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
        recurringType: document.getElementById('isRecurring').checked ? document.getElementById('recurringType').value : null,
        recurringEndDate: document.getElementById('isRecurring').checked ? document.getElementById('recurringEndDate').value : null,
        recurringOccurrences: document.getElementById('isRecurring').checked ? document.getElementById('recurringOccurrences').value : null
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
                const baseDate = new Date(taskData.date + 'T12:00:00');
                const endDateVal = document.getElementById('recurringEndDate').value;
                const occurrencesVal = parseInt(document.getElementById('recurringOccurrences').value);
                
                let count = 1;
                let currentDateLoop = new Date(baseDate);
                
                // Max iterations to prevent infinite loops (safety)
                const MAX_ITER = 365; 

                while (count < MAX_ITER) {
                    if (occurrencesVal && count >= occurrencesVal) break;
                    
                    if (taskData.recurringType === 'daily') {
                        currentDateLoop.setDate(currentDateLoop.getDate() + 1);
                    } else if (taskData.recurringType === 'weekly') {
                        currentDateLoop.setDate(currentDateLoop.getDate() + 7);
                    } else if (taskData.recurringType === 'monthly') {
                        currentDateLoop.setMonth(currentDateLoop.getMonth() + 1);
                    }

                    if (endDateVal && currentDateLoop > new Date(endDateVal + 'T23:59:59')) break;
                    
                    // If no end condition specified, use old defaults
                    if (!endDateVal && !occurrencesVal) {
                        if (taskData.recurringType === 'daily' && currentDateLoop.getDay() === 1) break; // End of week
                        if (taskData.recurringType === 'weekly' && currentDateLoop.getMonth() !== baseDate.getMonth()) break; // End of month
                        if (taskData.recurringType === 'monthly' && currentDateLoop.getFullYear() !== baseDate.getFullYear()) break; // End of year
                    }

                    tasksToCreate.push({ ...taskData, date: formatDate(currentDateLoop) });
                    count++;
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
    document.getElementById('isRecurringReminder').checked = false;
    document.getElementById('recurringTypeReminder').style.display = 'none';
    document.getElementById('recurringEndOptionsReminder').style.display = 'none';
    document.getElementById('reminderCategory').value = '';
    document.getElementById('recurringEndDateReminder').value = '';
    document.getElementById('recurringOccurrencesReminder').value = '';
    document.getElementById('deleteReminderFromModalBtn').style.display = 'none';
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
    document.getElementById('reminderCategory').value = reminder.category || '';
    
    document.getElementById('isRecurringReminder').checked = reminder.isRecurring || false;
    if (reminder.isRecurring) {
        document.getElementById('recurringTypeReminder').style.display = 'block';
        document.getElementById('recurringTypeReminder').value = reminder.recurringType;
        document.getElementById('recurringEndOptionsReminder').style.display = 'block';
        document.getElementById('recurringEndDateReminder').value = reminder.recurringEndDate || '';
        document.getElementById('recurringOccurrencesReminder').value = reminder.recurringOccurrences || '';
    } else {
        document.getElementById('recurringTypeReminder').style.display = 'none';
        document.getElementById('recurringEndOptionsReminder').style.display = 'none';
    }

    document.getElementById('deleteReminderFromModalBtn').style.display = 'block';
    document.getElementById('reminderModal').dataset.editId = id;
    document.getElementById('reminderModal').style.display = 'block';
}

async function saveReminder() {
    const reminderData = {
        title: document.getElementById('reminderTitle').value,
        date: document.getElementById('reminderDate').value,
        time: document.getElementById('reminderTime').value,
        notes: document.getElementById('reminderNotes').value,
        category: document.getElementById('reminderCategory').value || null,
        isRecurring: document.getElementById('isRecurringReminder').checked,
        recurringType: document.getElementById('isRecurringReminder').checked ? document.getElementById('recurringTypeReminder').value : null,
        recurringEndDate: document.getElementById('isRecurringReminder').checked ? document.getElementById('recurringEndDateReminder').value : null,
        recurringOccurrences: document.getElementById('isRecurringReminder').checked ? document.getElementById('recurringOccurrencesReminder').value : null
    };

    // Block saving reminders in the past
    const editId = document.getElementById('reminderModal').dataset.editId;
    if (!editId && !reminderData.isRecurring && isReminderPast(reminderData)) {
        showNotification('⚠️ Cannot schedule a reminder in the past!', 'warning');
        return;
    }

    try {
        if (editId) {
            await API.updateReminder(editId, reminderData);
            reminders = await API.getReminders();
            showNotification('Reminder updated!', 'success');
        } else {
            const remindersToCreate = [reminderData];
            if (reminderData.isRecurring && reminderData.recurringType) {
                const baseDate = new Date(reminderData.date + 'T12:00:00');
                const endDateVal = document.getElementById('recurringEndDateReminder').value;
                const occurrencesVal = parseInt(document.getElementById('recurringOccurrencesReminder').value);
                
                let count = 1;
                let currentDateLoop = new Date(baseDate);
                const MAX_ITER = 365;

                while (count < MAX_ITER) {
                    if (occurrencesVal && count >= occurrencesVal) break;
                    
                    if (reminderData.recurringType === 'daily') {
                        currentDateLoop.setDate(currentDateLoop.getDate() + 1);
                    } else if (reminderData.recurringType === 'weekly') {
                        currentDateLoop.setDate(currentDateLoop.getDate() + 7);
                    } else if (reminderData.recurringType === 'monthly') {
                        currentDateLoop.setMonth(currentDateLoop.getMonth() + 1);
                    }

                    if (endDateVal && currentDateLoop > new Date(endDateVal + 'T23:59:59')) break;
                    
                    if (!endDateVal && !occurrencesVal) {
                        if (reminderData.recurringType === 'daily' && currentDateLoop.getDay() === 1) break;
                        if (reminderData.recurringType === 'weekly' && currentDateLoop.getMonth() !== baseDate.getMonth()) break;
                        if (reminderData.recurringType === 'monthly' && currentDateLoop.getFullYear() !== baseDate.getFullYear()) break;
                    }

                    remindersToCreate.push({ ...reminderData, date: formatDate(currentDateLoop) });
                    count++;
                }
            }
            
            await Promise.all(remindersToCreate.map(r => API.createReminder(r)));
            reminders = await API.getReminders();
            showNotification(`Reminder${remindersToCreate.length > 1 ? 's' : ''} created!`, 'success');
        }
        closeModals();
        renderReminders();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

async function deleteReminderById(id) {
    if (!confirm('Delete this reminder?')) return;
    await API.deleteReminder(id);
    reminders = await API.getReminders();
    renderReminders();
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
        renderReminders();
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
    document.getElementById('toggleRemindersHistory').addEventListener('click', toggleRemindersView);
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
    document.getElementById('deleteReminderFromModalBtn').addEventListener('click', () => {
        const editId = document.getElementById('reminderModal').dataset.editId;
        if (editId) {
            deleteReminderById(editId);
            closeModals();
        }
    });
    document.querySelectorAll('.close').forEach(close => {
        close.addEventListener('click', closeModals);
    });
    // Reminder Filters
    document.querySelectorAll('.rem-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rem-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            remindersFilter = btn.dataset.cat;
            renderReminders();
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) closeModals();
    });

    // Recurring checkbox
    document.getElementById('isRecurring').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.getElementById('recurringType').style.display = isChecked ? 'block' : 'none';
        document.getElementById('recurringEndOptions').style.display = isChecked ? 'block' : 'none';
    });
    document.getElementById('isRecurringReminder').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.getElementById('recurringTypeReminder').style.display = isChecked ? 'block' : 'none';
        document.getElementById('recurringEndOptionsReminder').style.display = isChecked ? 'block' : 'none';
    });

    // Feature 2: Auto end time listener
    document.getElementById('taskStartTime').addEventListener('input', updateEndTimeFromStart);

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
    window.acknowledgePassedReminder = acknowledgePassedReminder;
    window.renderReminders = renderReminders;
    window.toggleRemindersView = toggleRemindersView;
    window.toggleReminderComplete = toggleReminderComplete;
    window.openSnoozeModal = openSnoozeModal;
    window.acknowledgePassedReminder = acknowledgePassedReminder;

    // ── Quick Navigation ──────────────────────────────────────────
    window.qnavScroll = function qnavScroll(sectionId, linkEl) {
        const target = document.getElementById(sectionId);
        if (!target) return;
        // Prevent default href jump; use smooth scroll instead
        setTimeout(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 10);
        // Immediately highlight the clicked link
        setActiveNavLink(sectionId);
    };

    // Map section ID → which nav links to activate (desktop + mobile share same IDs)
    const SECTION_IDS = [
        'section-daily',
        'section-reminders',
        'section-todo',
        'section-due-dates',
        'section-weekly',
        'section-monthly'
    ];

    function setActiveNavLink(activeSectionId) {
        document.querySelectorAll('.qnav-link').forEach(a => {
            const href = a.getAttribute('href'); // e.g. "#section-daily"
            const id   = href ? href.replace('#', '') : '';
            a.classList.toggle('qnav-active', id === activeSectionId);
        });
    }

    // Scroll-spy: use IntersectionObserver on each section
    const spyOptions = {
        root: null,
        rootMargin: '-20% 0px -60% 0px', // fire when section is ~top-quarter of viewport
        threshold: 0
    };

    const spyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                setActiveNavLink(entry.target.id);
            }
        });
    }, spyOptions);

    // Observe all sections (some may not exist on mobile layout — that's fine)
    SECTION_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) spyObserver.observe(el);
    });

    // Highlight "Daily View" by default on load
    setActiveNavLink('section-daily');

    // Register Service Worker for PWA (with auto-update v2.4.1)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
            .then(reg => {
                console.log('Service Worker registered', reg);
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            window.location.reload();
                        }
                    });
                });
            })
            .catch(err => console.error('Service Worker registration failed', err));
    }
});