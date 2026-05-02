const TodoTask = require('../models/TodoTask');

function parseDuration(str) {
    if (!str) return 0;
    let totalMinutes = 0;
    
    // Normalize string
    str = str.toLowerCase().replace(/,/g, '');
    
    // Handle decimals like 2.5hr
    const decimalHrMatch = str.match(/(\d+\.?\d*)\s*(h|hr|hour)s?/);
    if (decimalHrMatch && str.indexOf('min') === -1 && str.indexOf('m') === -1) {
        return Math.round(parseFloat(decimalHrMatch[1]) * 60);
    }

    const hrMatch = str.match(/(\d+)\s*(h|hr|hour)s?/);
    const minMatch = str.match(/(\d+)\s*(m|min|minute)s?/);

    if (hrMatch) totalMinutes += parseInt(hrMatch[1]) * 60;
    if (minMatch) totalMinutes += parseInt(minMatch[1]);
    
    return totalMinutes;
}

function formatDuration(totalMinutes) {
    if (totalMinutes <= 0) return '';
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    let parts = [];
    if (hrs > 0) parts.push(`${hrs} hr`);
    if (mins > 0) parts.push(`${mins} min`);
    
    return parts.join(' ');
}

async function runDurationMigration() {
    console.log('⏳ Starting Duration Migration (v2.7.9)...');
    try {
        const tasks = await TodoTask.find({});
        let updatedCount = 0;
        
        for (const task of tasks) {
            if (!task.duration) continue;
            
            const totalMins = parseDuration(task.duration);
            const normalized = formatDuration(totalMins);
            
            if (task.duration !== normalized) {
                task.duration = normalized;
                await task.save();
                updatedCount++;
            }
        }
        
        console.log(`✅ Duration Migration complete. Updated ${updatedCount} tasks.`);
    } catch (error) {
        console.error('❌ Duration Migration failed:', error);
    }
}

module.exports = { runDurationMigration };
