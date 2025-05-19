document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const sessionList = document.getElementById('session-list');
    const logContainer = document.getElementById('log-container');
    const currentSessionName = document.getElementById('current-session-name');
    const currentSessionStatus = document.getElementById('current-session-status');
    const clearLogsBtn = document.getElementById('clear-logs-btn');
    
    // Filter controls
    const autoScrollToggle = document.getElementById('autoScroll');
    const showInfoToggle = document.getElementById('showInfo');
    const showWarningsToggle = document.getElementById('showWarnings');
    const showErrorsToggle = document.getElementById('showErrors');
    const showMessagesToggle = document.getElementById('showMessages');
    
    let currentSessionId = null;
    
    // Check URL for session parameter
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');
    
    // Request active sessions on page load
    socket.emit('getActiveSessions');
    
    // Handle active sessions response
    socket.on('activeSessions', function(sessions) {
        sessionList.innerHTML = '';
        
        if (sessions.length === 0) {
            sessionList.innerHTML = '<div class="text-center text-muted">No active sessions</div>';
        } else {
            // Sort sessions alphabetically by phone number
            sessions.sort((a, b) => a.phoneNumber.localeCompare(b.phoneNumber));
            
            sessions.forEach(session => {
                const sessionItem = document.createElement('a');
                sessionItem.href = '#';
                sessionItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
                sessionItem.dataset.sessionId = session.id;
                
                // Set status indicator color
                let statusColor = 'secondary';
                if (session.status === 'Connected') statusColor = 'success';
                else if (session.status === 'Connecting') statusColor = 'warning';
                else statusColor = 'danger';
                
                sessionItem.innerHTML = `
                    <div>
                        <strong>${session.phoneNumber}</strong>
                        <span class="badge bg-${statusColor} ms-2">${session.status}</span>
                    </div>
                `;
                
                sessionItem.addEventListener('click', function(e) {
                    e.preventDefault();
                    selectSession(session.id);
                });
                
                sessionList.appendChild(sessionItem);
                
                // If this session matches the URL parameter, select it
                if (sessionParam && session.id === sessionParam) {
                    selectSession(session.id);
                }
            });
        }
    });
    
    // Handle log messages
    socket.on('logMessage', function(data) {
        if (data.sessionId !== currentSessionId) return;
        
        // Check if we should show this type of message based on filters
        if (!shouldShowMessage(data.type)) return;
        
        addLogEntry(data);
        
        // Auto-scroll if enabled
        if (autoScrollToggle.checked) {
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    });
    
    // Handle session status updates
    socket.on('sessionStatusUpdate', function(update) {
        // Update session in list
        const sessionItem = sessionList.querySelector(`[data-session-id="${update.id}"]`);
        if (sessionItem) {
            const statusBadge = sessionItem.querySelector('.badge');
            statusBadge.textContent = update.status;
            statusBadge.className = 'badge ms-2';
            
            let statusColor = 'secondary';
            if (update.status === 'Connected') statusColor = 'success';
            else if (update.status === 'Connecting') statusColor = 'warning';
            else statusColor = 'danger';
            
            statusBadge.classList.add(`bg-${statusColor}`);
        }
        
        // Update current session status if this is the active session
        if (update.id === currentSessionId) {
            currentSessionStatus.textContent = update.status;
            currentSessionStatus.className = 'badge';
            
            let statusColor = 'secondary';
            if (update.status === 'Connected') statusColor = 'success';
            else if (update.status === 'Connecting') statusColor = 'warning';
            else statusColor = 'danger';
            
            currentSessionStatus.classList.add(`bg-${statusColor}`);
        }
    });
    
    // Handle session stopped
    socket.on('sessionStopped', function(sessionId) {
        const sessionItem = sessionList.querySelector(`[data-session-id="${sessionId}"]`);
        if (sessionItem) {
            sessionItem.remove();
        }
        
        // If this was the current session, clear the log view
        if (sessionId === currentSessionId) {
            currentSessionId = null;
            currentSessionName.textContent = 'Session disconnected';
            currentSessionStatus.textContent = 'Disconnected';
            currentSessionStatus.className = 'badge bg-danger';
            
            addLogEntry({
                type: 'error',
                message: 'Session has been disconnected.',
                timestamp: new Date().toISOString()
            });
        }
    });
    
    // Handle clear logs button
    clearLogsBtn.addEventListener('click', function() {
        logContainer.innerHTML = '';
        addLogEntry({
            type: 'info',
            message: 'Logs cleared.',
            timestamp: new Date().toISOString()
        });
    });
    
    // Handle filter toggles
    showInfoToggle.addEventListener('change', updateLogVisibility);
    showWarningsToggle.addEventListener('change', updateLogVisibility);
    showErrorsToggle.addEventListener('change', updateLogVisibility);
    showMessagesToggle.addEventListener('change', updateLogVisibility);
    
    // Function to select a session
    function selectSession(sessionId) {
        // Clear previous selection
        const sessionItems = sessionList.querySelectorAll('.list-group-item');
        sessionItems.forEach(item => item.classList.remove('active'));
        
        // Highlight selected session
        const selectedItem = sessionList.querySelector(`[data-session-id="${sessionId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
            
            // Get session details
            const sessionName = selectedItem.querySelector('strong').textContent;
            const sessionStatus = selectedItem.querySelector('.badge').textContent;
            const statusClass = selectedItem.querySelector('.badge').className.split(' ').find(c => c.startsWith('bg-'));
            
            // Update header
            currentSessionName.textContent = sessionName;
            currentSessionStatus.textContent = sessionStatus;
            currentSessionStatus.className = `badge ${statusClass}`;
            
            // Clear previous logs
            logContainer.innerHTML = '';
            
            // Set current session
            currentSessionId = sessionId;
            
            // Request logs for this session
            socket.emit('subscribeLogs', sessionId);
            
            // Add initial log entry
            addLogEntry({
                type: 'info',
                message: `Connected to logs for ${sessionName}`,
                timestamp: new Date().toISOString()
            });
            
            // Update URL without reloading
            const url = new URL(window.location);
            url.searchParams.set('session', sessionId);
            window.history.pushState({}, '', url);
        }
    }
    
    // Function to add a log entry
    function addLogEntry(data) {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${data.type}`;
        logEntry.dataset.type = data.type;
        
        // Format timestamp
        const timestamp = new Date(data.timestamp).toLocaleTimeString();
        
        // Format message based on type
        let icon = '';
        if (data.type === 'info') icon = 'ℹ️';
        else if (data.type === 'warn') icon = '⚠️';
        else if (data.type === 'error') icon = '❌';
        else if (data.type === 'incoming') icon = '📥';
        else if (data.type === 'outgoing') icon = '📤';
        
        logEntry.innerHTML = `[${timestamp}] ${icon} ${data.message}`;
        logContainer.appendChild(logEntry);
    }
    
    // Function to check if a message should be shown based on filters
    function shouldShowMessage(type) {
        if (type === 'info' && !showInfoToggle.checked) return false;
        if (type === 'warn' && !showWarningsToggle.checked) return false;
        if (type === 'error' && !showErrorsToggle.checked) return false;
        if ((type === 'incoming' || type === 'outgoing') && !showMessagesToggle.checked) return false;
        return true;
    }
    
    // Function to update log visibility based on filters
    function updateLogVisibility() {
        const logEntries = logContainer.querySelectorAll('.log-entry');
        
        logEntries.forEach(entry => {
            const type = entry.dataset.type;
            if (shouldShowMessage(type)) {
                entry.style.display = '';
            } else {
                entry.style.display = 'none';
            }
        });
    }
});
