document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const pairForm = document.getElementById('pair-form');
    const uploadForm = document.getElementById('upload-form');
    const pairingStatus = document.getElementById('pairing-status');
    const pairingCode = document.getElementById('pairing-code');
    const statusContainer = document.getElementById('status-container');
    
    // Handle pairing form submission
    pairForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const phoneNumber = document.getElementById('phoneNumber').value;
        const sessionName = document.getElementById('sessionName').value || phoneNumber;
        
        // Show loading state
        addStatusMessage('info', 'Starting pairing process for ' + phoneNumber + '...');
        
        // Send pairing request to server
        socket.emit('startPairing', {
            phoneNumber: phoneNumber,
            sessionName: sessionName
        });
    });
    
    // Handle credentials upload form submission
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const phoneNumber = document.getElementById('phoneNumberUpload').value;
        const sessionName = document.getElementById('sessionNameUpload').value || phoneNumber;
        const fileInput = document.getElementById('credentialsFile');
        
        if (!phoneNumber) {
            addStatusMessage('error', 'Please enter a phone number.');
            return;
        }
        
        if (fileInput.files.length === 0) {
            addStatusMessage('error', 'Please select a credentials file to upload.');
            return;
        }
        
        const file = fileInput.files[0];
        
        // Check file size
        if (file.size > 1024 * 1024) { // 1MB max
            addStatusMessage('error', 'File is too large. Please upload a smaller file.');
            return;
        }
        
        // Check file type
        if (!file.name.endsWith('.json')) {
            addStatusMessage('warning', 'File does not have a .json extension. Make sure this is a valid credentials file.');
        }
        
        const reader = new FileReader();
        
        reader.onload = function(event) {
            try {
                // Parse JSON to validate it
                let credentials;
                try {
                    credentials = JSON.parse(event.target.result);
                } catch (parseError) {
                    addStatusMessage('error', 'Invalid JSON file. Please upload a valid credentials file.');
                    return;
                }
                
                // Basic validation of credentials format
                if (!credentials || typeof credentials !== 'object') {
                    addStatusMessage('error', 'Invalid credentials format. Please upload a valid creds.json file.');
                    return;
                }
                
                // Show loading state
                addStatusMessage('info', 'Uploading credentials for ' + phoneNumber + '...');
                
                // Send credentials to server
                socket.emit('uploadCredentials', {
                    phoneNumber: phoneNumber,
                    sessionName: sessionName,
                    credentials: credentials
                });
            } catch (error) {
                addStatusMessage('error', 'Error processing file: ' + error.message);
            }
        };
        
        reader.onerror = function() {
            addStatusMessage('error', 'Error reading file. Please try again.');
        };
        
        reader.readAsText(file);
    });
    
    // Handle pairing code from server
    socket.on('pairingCode', function(data) {
        pairingStatus.classList.remove('d-none');
        pairingCode.textContent = data.code;
        addStatusMessage('info', 'Pairing code generated. Enter this code in WhatsApp on your phone.');
    });
    
    // Handle session status updates
    socket.on('sessionStatus', function(data) {
        if (data.status === 'connected') {
            pairingStatus.classList.add('d-none');
            addStatusMessage('success', `WhatsApp session for ${data.phoneNumber} connected successfully!`);
            
            // Add redirect button
            const redirectBtn = document.createElement('button');
            redirectBtn.className = 'btn btn-primary mt-2';
            redirectBtn.textContent = 'Go to Dashboard';
            redirectBtn.addEventListener('click', function() {
                window.location.href = '/';
            });
            
            statusContainer.querySelector('.alert:last-child').appendChild(document.createElement('br'));
            statusContainer.querySelector('.alert:last-child').appendChild(redirectBtn);
        } else if (data.status === 'connecting') {
            addStatusMessage('info', `Connecting to WhatsApp for ${data.phoneNumber}...`);
        } else if (data.status === 'error') {
            pairingStatus.classList.add('d-none');
            addStatusMessage('error', `Error connecting to WhatsApp: ${data.message}`);
        }
    });
    
    // Handle credentials upload response
    socket.on('credentialsUploaded', function(data) {
        if (data.success) {
            addStatusMessage('success', `Credentials for ${data.phoneNumber} uploaded successfully!`);
            
            // Add redirect button
            const redirectBtn = document.createElement('button');
            redirectBtn.className = 'btn btn-primary mt-2';
            redirectBtn.textContent = 'Go to Dashboard';
            redirectBtn.addEventListener('click', function() {
                window.location.href = '/';
            });
            
            statusContainer.querySelector('.alert:last-child').appendChild(document.createElement('br'));
            statusContainer.querySelector('.alert:last-child').appendChild(redirectBtn);
        } else {
            addStatusMessage('error', `Error uploading credentials: ${data.message}`);
        }
    });
    
    // Helper function to add status messages
    function addStatusMessage(type, message) {
        const alertClass = type === 'error' ? 'alert-danger' : 
                          type === 'success' ? 'alert-success' : 'alert-info';
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${alertClass}`;
        alertDiv.innerHTML = message;
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'btn-close';
        closeButton.setAttribute('data-bs-dismiss', 'alert');
        closeButton.setAttribute('aria-label', 'Close');
        alertDiv.appendChild(closeButton);
        
        statusContainer.appendChild(alertDiv);
        
        // Scroll to the message
        alertDiv.scrollIntoView({ behavior: 'smooth' });
    }
});
