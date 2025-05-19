document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const sessionsContainer = document.getElementById('sessions-container');
    const statusMessage = document.getElementById('status-message');
    const sessionTemplate = document.getElementById('session-template');
    
    // Request active sessions on page load
    socket.emit('getActiveSessions');
    
    // Handle active sessions response
    socket.on('activeSessions', function(sessions) {
        sessionsContainer.innerHTML = '';
        statusMessage.classList.remove('alert-info', 'alert-warning');
        
        if (sessions.length === 0) {
            statusMessage.classList.add('alert-warning');
            statusMessage.innerHTML = `
                <i class="bi bi-exclamation-triangle me-2"></i>
                No active WhatsApp sessions found. <a href="/add-session.html">Add a new session</a> to get started.
            `;
        } else {
            statusMessage.classList.add('alert-info');
            statusMessage.innerHTML = `
                <i class="bi bi-info-circle me-2"></i>
                ${sessions.length} active WhatsApp ${sessions.length === 1 ? 'session' : 'sessions'} found.
            `;
            
            // Clear the existing sessions container first
            sessionsContainer.innerHTML = '';
            
            // Debug: Log the sessions received from server
            console.log('Received sessions:', sessions);
            
            // Add each session to the container
            sessions.forEach(session => {
                console.log('Processing session:', session.id, session.phoneNumber);
                
                const sessionElement = sessionTemplate.content.cloneNode(true);
                const sessionCard = sessionElement.querySelector('.col-md-4');
                
                // Add session ID as a data attribute for easy reference
                sessionCard.setAttribute('data-session-id', session.id);
                
                // Fill in session details
                sessionElement.querySelector('.session-phone').textContent = session.phoneNumber;
                sessionElement.querySelector('.session-id').textContent = session.id;
                sessionElement.querySelector('.session-started').textContent = new Date(session.startTime).toLocaleString();
                sessionElement.querySelector('.session-messages').textContent = session.messageCount || 0;
                
                // Set status badge
                const statusBadge = sessionElement.querySelector('.session-status');
                statusBadge.textContent = session.status;
                if (session.status === 'Connected') {
                    statusBadge.classList.add('bg-success');
                } else if (session.status === 'Connecting') {
                    statusBadge.classList.add('bg-warning');
                } else {
                    statusBadge.classList.add('bg-danger');
                }
                
                // Add event listeners
                sessionElement.querySelector('.view-logs-btn').addEventListener('click', function() {
                    window.location.href = `/logs.html?session=${session.id}`;
                });
                
                sessionElement.querySelector('.stop-session-btn').addEventListener('click', function() {
                    if (confirm(`Are you sure you want to stop the session for ${session.phoneNumber}?`)) {
                        socket.emit('stopSession', session.id);
                    }
                });
                
                sessionsContainer.appendChild(sessionElement);
                console.log('Added session to container:', session.id);
            });
        }
    });
    
    // Handle session status updates
    socket.on('sessionStatusUpdate', function(update) {
        const sessionElement = document.querySelector(`[data-session-id="${update.id}"]`);
        if (sessionElement) {
            const statusBadge = sessionElement.querySelector('.session-status');
            statusBadge.textContent = update.status;
            statusBadge.className = 'badge session-status';
            
            if (update.status === 'Connected') {
                statusBadge.classList.add('bg-success');
            } else if (update.status === 'Connecting') {
                statusBadge.classList.add('bg-warning');
            } else {
                statusBadge.classList.add('bg-danger');
            }
            
            // Update message count if provided
            if (update.messageCount !== undefined) {
                sessionElement.querySelector('.session-messages').textContent = update.messageCount;
            }
        }
    });
    
    // Handle session stopped
    socket.on('sessionStopped', function(sessionId) {
        const sessionElement = document.querySelector(`[data-session-id="${sessionId}"]`);
        if (sessionElement) {
            sessionElement.remove();
            
            // Update status message if no sessions left
            if (sessionsContainer.children.length === 0) {
                statusMessage.classList.remove('alert-info');
                statusMessage.classList.add('alert-warning');
                statusMessage.innerHTML = `
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    No active WhatsApp sessions found. <a href="/add-session.html">Add a new session</a> to get started.
                `;
            } else {
                statusMessage.innerHTML = `
                    <i class="bi bi-info-circle me-2"></i>
                    ${sessionsContainer.children.length} active WhatsApp ${sessionsContainer.children.length === 1 ? 'session' : 'sessions'} found.
                `;
            }
        }
    });
    
    // Refresh sessions every 30 seconds
    setInterval(function() {
        socket.emit('getActiveSessions');
    }, 30000);
});
