// Global Configuration
const API_URL = 'http://localhost:5000/api';

// Global State - Using appropriate data structures
let roomsGraph = new Map(); // Map for O(1) room lookups
let schedulesArray = []; // Array for schedules
let logsQueue = []; // Queue for logs (FIFO)
let allRooms = [];

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    setupNavigation();
    setMinDates();
});

// Initialize the application
async function initializeApp() {
    showToast('Initializing system...', 'info');
    
    try {
        await loadRooms();
        await loadSchedule();
        await loadLogs();
        updateDashboard();
        buildRoomsGraph();
        
        // Initialize with sample data if no rooms exist
        if (allRooms.length === 0) {
            await initializeSampleData();
        }
        
        updateConnectionStatus(true);
        showToast('System initialized successfully', 'success');
    } catch (error) {
        console.error('Initialization error:', error);
        updateConnectionStatus(false);
        showToast('Failed to connect to backend. Using offline mode.', 'warning');
        initializeOfflineMode();
    }
}

// Initialize offline mode with localStorage
function initializeOfflineMode() {
    const savedRooms = localStorage.getItem('rooms');
    const savedSchedules = localStorage.getItem('schedules');
    const savedLogs = localStorage.getItem('logs');
    
    if (savedRooms) {
        allRooms = JSON.parse(savedRooms);
        buildRoomsGraph();
        displayRooms();
    } else {
        initializeSampleDataOffline();
    }
    
    if (savedSchedules) {
        schedulesArray = JSON.parse(savedSchedules);
        displaySchedule();
    }
    
    if (savedLogs) {
        logsQueue = JSON.parse(savedLogs);
        displayLogs();
    }
    
    updateDashboard();
}

// Initialize sample data (offline)
function initializeSampleDataOffline() {
    allRooms = [
        {
            room_id: '101',
            building: 'Main',
            capacity: 50,
            floor: 1,
            facilities: { projector: true, lab: false, accessible: true, whiteboard: true, audio: true, smartboard: false }
        },
        {
            room_id: '102',
            building: 'Main',
            capacity: 30,
            floor: 1,
            facilities: { projector: true, lab: false, accessible: true, whiteboard: true, audio: false, smartboard: true }
        },
        {
            room_id: '201',
            building: 'Science',
            capacity: 40,
            floor: 2,
            facilities: { projector: true, lab: true, accessible: false, whiteboard: true, audio: true, smartboard: false }
        },
        {
            room_id: '301',
            building: 'Engineering',
            capacity: 60,
            floor: 3,
            facilities: { projector: true, lab: true, accessible: true, whiteboard: true, audio: true, smartboard: true }
        },
        {
            room_id: 'LAB-A',
            building: 'Science',
            capacity: 25,
            floor: 1,
            facilities: { projector: true, lab: true, accessible: true, whiteboard: false, audio: false, smartboard: true }
        },
        {
            room_id: '401',
            building: 'Engineering',
            capacity: 100,
            floor: 4,
            facilities: { projector: true, lab: false, accessible: true, whiteboard: true, audio: true, smartboard: true }
        },
        {
            room_id: 'AUD-1',
            building: 'Arts',
            capacity: 200,
            floor: 1,
            facilities: { projector: true, lab: false, accessible: true, whiteboard: false, audio: true, smartboard: false }
        }
    ];
    
    localStorage.setItem('rooms', JSON.stringify(allRooms));
    buildRoomsGraph();
    displayRooms();
    addLog('info', 'Initialized with sample classroom data (offline mode)');
}

// Build graph data structure from rooms
function buildRoomsGraph() {
    roomsGraph.clear();
    
    // Add all rooms as nodes
    allRooms.forEach(room => {
        roomsGraph.set(room.room_id, {
            ...room,
            adjacentRooms: []
        });
    });
    
    // Create edges based on adjacency rules
    allRooms.forEach((room1, i) => {
        allRooms.forEach((room2, j) => {
            if (i >= j) return;
            
            const node1 = roomsGraph.get(room1.room_id);
            const node2 = roomsGraph.get(room2.room_id);
            
            // Connect rooms in same building
            if (room1.building === room2.building) {
                node1.adjacentRooms.push(room2.room_id);
                node2.adjacentRooms.push(room1.room_id);
            }
            
            // Connect rooms with similar capacity (within 25%)
            const capacityDiff = Math.abs(room1.capacity - room2.capacity);
            const maxCapacity = Math.max(room1.capacity, room2.capacity);
            if (capacityDiff / maxCapacity <= 0.25) {
                if (!node1.adjacentRooms.includes(room2.room_id)) {
                    node1.adjacentRooms.push(room2.room_id);
                }
                if (!node2.adjacentRooms.includes(room1.room_id)) {
                    node2.adjacentRooms.push(room1.room_id);
                }
            }
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    // Allocation form
    const allocationForm = document.getElementById('allocation-form');
    if (allocationForm) {
        allocationForm.addEventListener('submit', handleAllocationSubmit);
    }
    
    // Add room form
    const addRoomForm = document.getElementById('add-room-form');
    if (addRoomForm) {
        addRoomForm.addEventListener('submit', handleAddRoomSubmit);
    }
}

// Setup navigation
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            showSection(section);
            
            // Update active link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

// Show section
function showSection(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Refresh data when switching to certain sections
        if (sectionId === 'dashboard') updateDashboard();
        if (sectionId === 'schedule') loadSchedule();
        if (sectionId === 'rooms') displayRooms();
        if (sectionId === 'graph') regenerateGraph();
        if (sectionId === 'logs') displayLogs();
    }
}

// Set minimum dates
function setMinDates() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        input.setAttribute('min', today);
    });
}

// Handle allocation form submission
async function handleAllocationSubmit(e) {
    e.preventDefault();
    
    const formData = {
        course_name: document.getElementById('course-name').value,
        instructor: document.getElementById('instructor-name').value,
        date: document.getElementById('date').value,
        start_time: document.getElementById('start-time').value,
        end_time: document.getElementById('end-time').value,
        capacity: parseInt(document.getElementById('capacity').value),
        building: document.getElementById('building').value,
        facilities: {
            projector: document.getElementById('projector').checked,
            lab: document.getElementById('lab').checked,
            accessible: document.getElementById('accessible').checked,
            whiteboard: document.getElementById('whiteboard').checked,
            audio: document.getElementById('audio').checked,
            smartboard: document.getElementById('smartboard').checked
        }
    };
    
    // Validate time
    if (formData.start_time >= formData.end_time) {
        showResult('error', 'Invalid Time', 'End time must be after start time.');
        return;
    }
    
    // Show loading
    const resultContainer = document.getElementById('allocation-result');
    resultContainer.innerHTML = '<div class="loading">🔄 Finding available rooms...</div>';
    resultContainer.className = 'result-container';
    resultContainer.style.display = 'block';
    
    try {
        const result = await allocateRoom(formData);
        
        if (result.success) {
            showResult('success', 'Room Allocated Successfully! 🎉', 
                `<strong>Room:</strong> ${result.room.building} ${result.room.room_id}<br>
                <strong>Capacity:</strong> ${result.room.capacity} students<br>
                <strong>Date:</strong> ${formData.date}<br>
                <strong>Time:</strong> ${formData.start_time} - ${formData.end_time}<br>
                <strong>Booking ID:</strong> ${result.booking_id}`
            );
            
            // Add to schedules
            schedulesArray.push({
                ...formData,
                room: result.room,
                booking_id: result.booking_id,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('schedules', JSON.stringify(schedulesArray));
            
            // Log success
            addLog('success', `Successfully allocated ${result.room.building} ${result.room.room_id} for ${formData.course_name}`);
            
            // Update dashboard
            updateDashboard();
            
            // Clear form
            document.getElementById('allocation-form').reset();
            
            showToast('Room allocated successfully!', 'success');
        } else {
            showResult('error', 'Allocation Failed', result.message);
            addLog('error', `Failed to allocate room for ${formData.course_name}: ${result.message}`);
            showToast('Failed to allocate room', 'error');
        }
    } catch (error) {
        showResult('error', 'Error', 'An error occurred while processing your request.');
        addLog('error', `System error: ${error.message}`);
        showToast('System error occurred', 'error');
    }
}

// Room allocation algorithm using graph structure
async function allocateRoom(requirements) {
    addLog('info', `Processing allocation request for ${requirements.course_name}`);
    
    // Filter rooms using graph
    let suitableRooms = [];
    
    for (let [roomId, room] of roomsGraph) {
        // Check capacity
        if (room.capacity < requirements.capacity) {
            continue;
        }
        
        // Check building preference
        if (requirements.building && room.building !== requirements.building) {
            continue;
        }
        
        // Check facilities
        let facilitiesMatch = true;
        for (let [facility, required] of Object.entries(requirements.facilities)) {
            if (required && !room.facilities[facility]) {
                facilitiesMatch = false;
                break;
            }
        }
        
        if (!facilitiesMatch) {
            continue;
        }
        
        // Check availability (no time conflicts)
        if (!checkAvailability(roomId, requirements.date, requirements.start_time, requirements.end_time)) {
            continue;
        }
        
        suitableRooms.push(room);
    }
    
    if (suitableRooms.length === 0) {
        return {
            success: false,
            message: 'No rooms available matching your requirements. Try adjusting your criteria or selecting a different time slot.'
        };
    }
    
    // Select best room (closest capacity match to avoid waste)
    const bestRoom = suitableRooms.reduce((best, current) => {
        const bestDiff = Math.abs(best.capacity - requirements.capacity);
        const currentDiff = Math.abs(current.capacity - requirements.capacity);
        return currentDiff < bestDiff ? current : best;
    });
    
    // Generate booking ID
    const bookingId = generateBookingId();
    
    return {
        success: true,
        room: bestRoom,
        booking_id: bookingId
    };
}

// Check room availability (conflict detection)
function checkAvailability(roomId, date, startTime, endTime) {
    return !schedulesArray.some(booking => {
        if (booking.room.room_id !== roomId) return false;
        if (booking.date !== date) return false;
        
        // Check for time overlap
        return !(endTime <= booking.start_time || startTime >= booking.end_time);
    });
}

// Generate unique booking ID
function generateBookingId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `BK${timestamp}${random}`;
}

// Show result
function showResult(type, title, message) {
    const resultContainer = document.getElementById('allocation-result');
    resultContainer.className = `result-container ${type}`;
    resultContainer.innerHTML = `
        <h3>${title}</h3>
        <div>${message}</div>
    `;
    resultContainer.style.display = 'block';
}

// Reset form
function resetForm() {
    document.getElementById('allocation-form').reset();
    document.getElementById('allocation-result').style.display = 'none';
}

// Load rooms from API or localStorage
async function loadRooms() {
    try {
        const response = await fetch(`${API_URL}/rooms`);
        const data = await response.json();
        allRooms = data.rooms || [];
        localStorage.setItem('rooms', JSON.stringify(allRooms));
    } catch (error) {
        const savedRooms = localStorage.getItem('rooms');
        if (savedRooms) {
            allRooms = JSON.parse(savedRooms);
        }
    }
    buildRoomsGraph();
    displayRooms();
    updateRoomFilters();
}

// Display rooms
function displayRooms() {
    const container = document.getElementById('rooms-container');
    
    if (allRooms.length === 0) {
        container.innerHTML = '<p class="empty-state">No rooms available. Add rooms to get started.</p>';
        return;
    }
    
    container.innerHTML = allRooms.map(room => `
        <div class="room-card">
            <h3>${room.building} ${room.room_id}</h3>
            <p><strong>Capacity:</strong> ${room.capacity} students</p>
            <p><strong>Floor:</strong> ${room.floor || 'N/A'}</p>
            <div class="room-facilities">
                ${room.facilities.projector ? '<span class="facility-badge">📽️ Projector</span>' : ''}
                ${room.facilities.lab ? '<span class="facility-badge">💻 Lab</span>' : ''}
                ${room.facilities.accessible ? '<span class="facility-badge">♿ Accessible</span>' : ''}
                ${room.facilities.whiteboard ? '<span class="facility-badge">📝 Whiteboard</span>' : ''}
                ${room.facilities.audio ? '<span class="facility-badge">🔊 Audio</span>' : ''}
                ${room.facilities.smartboard ? '<span class="facility-badge">📱 Smart Board</span>' : ''}
            </div>
        </div>
    `).join('');
}

// Load schedule
async function loadSchedule() {
    try {
        const response = await fetch(`${API_URL}/schedule`);
        const data = await response.json();
        schedulesArray = data.schedules || [];
        localStorage.setItem('schedules', JSON.stringify(schedulesArray));
    } catch (error) {
        const savedSchedules = localStorage.getItem('schedules');
        if (savedSchedules) {
            schedulesArray = JSON.parse(savedSchedules);
        }
    }
    displaySchedule();
}

// Display schedule
function displaySchedule() {
    const container = document.getElementById('schedule-container');
    
    if (schedulesArray.length === 0) {
        container.innerHTML = '<p class="empty-state">No bookings yet.</p>';
        return;
    }
    
    // Sort by date and time
    const sorted = [...schedulesArray].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
    });
    
    container.innerHTML = sorted.map(booking => `
        <div class="schedule-item">
            <h4>${booking.course_name}</h4>
            ${booking.instructor ? `<p><strong>Instructor:</strong> ${booking.instructor}</p>` : ''}
            <p><strong>Room:</strong> ${booking.room.building} ${booking.room.room_id}</p>
            <p><strong>Date:</strong> ${formatDate(booking.date)}</p>
            <p><strong>Time:</strong> ${booking.start_time} - ${booking.end_time}</p>
            <p><strong>Capacity:</strong> ${booking.capacity} students</p>
            <p><strong>Booking ID:</strong> ${booking.booking_id}</p>
        </div>
    `).join('');
}

// Clear filters
function clearFilters() {
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-room').value = '';
    document.getElementById('filter-building').value = '';
    loadSchedule();
}

// Update room filters
function updateRoomFilters() {
    const select = document.getElementById('filter-room');
    select.innerHTML = '<option value="">All Rooms</option>' +
        allRooms.map(room => `<option value="${room.room_id}">${room.building} ${room.room_id}</option>`).join('');
}

// Add log entry (using queue structure)
function addLog(type, message) {
    const log = {
        type,
        message,
        timestamp: new Date().toISOString()
    };
    
    logsQueue.unshift(log); // Add to front of queue
    
    // Keep only last 100 logs
    if (logsQueue.length > 100) {
        logsQueue.pop(); // Remove from back
    }
    
    localStorage.setItem('logs', JSON.stringify(logsQueue));
}

// Load and display logs
async function loadLogs() {
    try {
        const response = await fetch(`${API_URL}/logs`);
        const data = await response.json();
        logsQueue = data.logs || [];
        localStorage.setItem('logs', JSON.stringify(logsQueue));
    } catch (error) {
        const savedLogs = localStorage.getItem('logs');
        if (savedLogs) {
            logsQueue = JSON.parse(savedLogs);
        }
    }
    displayLogs();
}

// Display logs
function displayLogs() {
    const container = document.getElementById('logs-container');
    
    if (logsQueue.length === 0) {
        container.innerHTML = '<div class="log-entry info">[SYSTEM] No logs available</div>';
        return;
    }
    
    container.innerHTML = logsQueue.map(log => `
        <div class="log-entry ${log.type}">
            [${formatTimestamp(log.timestamp)}] [${log.type.toUpperCase()}] ${log.message}
        </div>
    `).join('');
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Filter logs
function filterLogs() {
    const filter = document.getElementById('log-filter').value;
    const container = document.getElementById('logs-container');
    
    let filtered = logsQueue;
    if (filter !== 'all') {
        filtered = logsQueue.filter(log => log.type === filter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="log-entry info">[SYSTEM] No logs match filter</div>';
        return;
    }
    
    container.innerHTML = filtered.map(log => `
        <div class="log-entry ${log.type}">
            [${formatTimestamp(log.timestamp)}] [${log.type.toUpperCase()}] ${log.message}
        </div>
    `).join('');
}

// Clear logs
function clearLogs() {
    if (confirm('Are you sure you want to clear all logs?')) {
        logsQueue = [];
        localStorage.setItem('logs', JSON.stringify(logsQueue));
        displayLogs();
        addLog('info', 'Logs cleared by user');
        showToast('Logs cleared', 'success');
    }
}

// Export logs
function exportLogs() {
    const logText = logsQueue.map(log => 
        `[${formatTimestamp(log.timestamp)}] [${log.type.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Logs exported successfully', 'success');
}

// Export rooms
function exportRooms() {
    const csv = 'Room ID,Building,Capacity,Floor,Projector,Lab,Accessible,Whiteboard,Audio,Smart Board\n' +
        allRooms.map(room => 
            `${room.room_id},${room.building},${room.capacity},${room.floor || 'N/A'},` +
            `${room.facilities.projector},${room.facilities.lab},${room.facilities.accessible},` +
            `${room.facilities.whiteboard},${room.facilities.audio},${room.facilities.smartboard}`
        ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rooms_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Rooms data exported successfully', 'success');
}

// Update dashboard statistics
function updateDashboard() {
    // Update stats
    document.getElementById('total-rooms').textContent = allRooms.length;
    document.getElementById('total-bookings').textContent = schedulesArray.length;
    
    // Calculate utilization
    const roomsWithBookings = new Set(schedulesArray.map(s => s.room.room_id)).size;
    const utilization = allRooms.length > 0 ? Math.round((roomsWithBookings / allRooms.length) * 100) : 0;
    document.getElementById('utilization-rate').textContent = `${utilization}%`;
    
    // Detect conflicts
    const conflicts = detectConflicts();
    document.getElementById('conflicts-count').textContent = conflicts.length;
    
    // Update recent allocations
    const recentContainer = document.getElementById('recent-allocations');
    const recent = schedulesArray.slice(-5).reverse();
    
    if (recent.length === 0) {
        recentContainer.innerHTML = '<p class="empty-state">No recent allocations</p>';
    } else {
        recentContainer.innerHTML = recent.map(booking => `
            <div class="schedule-item">
                <h4>${booking.course_name}</h4>
                <p>${booking.room.building} ${booking.room.room_id} | ${booking.date} | ${booking.start_time}-${booking.end_time}</p>
            </div>
        `).join('');
    }
    
    // Update system activity
    const activityContainer = document.getElementById('system-activity');
    const recentLogs = logsQueue.slice(0, 5);
    
    if (recentLogs.length === 0) {
        activityContainer.innerHTML = '<p class="empty-state">No recent activity</p>';
    } else {
        activityContainer.innerHTML = recentLogs.map(log => `
            <div class="log-entry ${log.type}">
                [${formatTimestamp(log.timestamp)}] ${log.message}
            </div>
        `).join('');
    }
}

// Detect scheduling conflicts
function detectConflicts() {
    const conflicts = [];
    
    for (let i = 0; i < schedulesArray.length; i++) {
        for (let j = i + 1; j < schedulesArray.length; j++) {
            const b1 = schedulesArray[i];
            const b2 = schedulesArray[j];
            
            if (b1.room.room_id === b2.room.room_id && b1.date === b2.date) {
                // Check for time overlap
                if (!(b1.end_time <= b2.start_time || b2.end_time <= b1.start_time)) {
                    conflicts.push({ booking1: b1, booking2: b2 });
                }
            }
        }
    }
    
    return conflicts;
}

// Modal functions
function showAddRoomModal() {
    document.getElementById('add-room-modal').classList.add('active');
}

function closeAddRoomModal() {
    document.getElementById('add-room-modal').classList.remove('active');
    document.getElementById('add-room-form').reset();
}

// Handle add room
async function handleAddRoomSubmit(e) {
    e.preventDefault();
    
    const newRoom = {
        room_id: document.getElementById('room-number').value,
        building: document.getElementById('room-building').value,
        capacity: parseInt(document.getElementById('room-capacity').value),
        floor: parseInt(document.getElementById('room-floor').value) || 0,
        facilities: {
            projector: document.getElementById('room-projector').checked,
            lab: document.getElementById('room-lab').checked,
            accessible: document.getElementById('room-accessible').checked,
            whiteboard: document.getElementById('room-whiteboard').checked,
            audio: document.getElementById('room-audio').checked,
            smartboard: document.getElementById('room-smartboard').checked
        }
    };
    
    // Check for duplicates
    if (allRooms.some(r => r.room_id === newRoom.room_id && r.building === newRoom.building)) {
        showToast('Room already exists!', 'error');
        return;
    }
    
    allRooms.push(newRoom);
    localStorage.setItem('rooms', JSON.stringify(allRooms));
    buildRoomsGraph();
    displayRooms();
    updateRoomFilters();
    closeAddRoomModal();
    
    addLog('success', `Added new room: ${newRoom.building} ${newRoom.room_id}`);
    showToast('Room added successfully!', 'success');
    updateDashboard();
}

// Initialize sample data via API
async function initializeSampleData() {
    try {
        const response = await fetch(`${API_URL}/reset`, { method: 'POST' });
        if (response.ok) {
            await loadRooms();
            addLog('info', 'Initialized with sample data from server');
            showToast('Sample data loaded', 'success');
        }
    } catch (error) {
        initializeSampleDataOffline();
    }
}

// Update connection status
function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('connection-status');
    const statusText = document.querySelector('.status-text');
    
    if (connected) {
        statusDot.style.background = 'var(--success)';
        statusText.textContent = 'Connected';
    } else {
        statusDot.style.background = 'var(--warning)';
        statusText.textContent = 'Offline';
    }
}

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}
