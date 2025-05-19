document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const commandForm = document.getElementById('command-form');
    const commandType = document.getElementById('command-type');
    const packageManager = document.getElementById('package-manager');
    const packageName = document.getElementById('package-name');
    const globalInstall = document.getElementById('global-install');
    const systemCommand = document.getElementById('system-command');
    const networkCommand = document.getElementById('network-command');
    const networkTarget = document.getElementById('network-target');
    const customCommand = document.getElementById('custom-command');
    const commandOutput = document.getElementById('command-output');
    
    // Show/hide command options based on selected type
    commandType.addEventListener('change', function() {
        // Hide all option groups
        document.querySelectorAll('.command-options').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show the selected option group
        const selectedType = commandType.value;
        document.getElementById(`${selectedType}-options`).style.display = 'block';
        
        // Special case for network commands
        if (selectedType === 'network') {
            updateNetworkTargetVisibility();
        }
    });
    
    // Update network target visibility based on selected network command
    networkCommand.addEventListener('change', updateNetworkTargetVisibility);
    
    function updateNetworkTargetVisibility() {
        const cmd = networkCommand.value;
        const needsTarget = ['ping', 'tracert'].includes(cmd);
        document.getElementById('network-target-group').style.display = needsTarget ? 'block' : 'none';
    }
    
    // Handle command form submission
    commandForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Clear previous output
        commandOutput.innerHTML = '';
        
        // Get the command based on the selected type
        let command = '';
        const selectedType = commandType.value;
        
        switch (selectedType) {
            case 'package':
                const manager = packageManager.value;
                const name = packageName.value.trim();
                const global = globalInstall.checked;
                
                if (!name) {
                    addOutput('error', 'Please enter a package name.');
                    return;
                }
                
                // Show loading message
                addOutput('info', `Installing ${name} using ${manager}...`);
                
                // Build the command based on the package manager with auto-yes flags
                switch (manager) {
                    case 'npm':
                        command = `npm install ${global ? '-g ' : ''}${name} --yes`;
                        break;
                    case 'pip':
                        command = `python -m pip install ${global ? '--user ' : ''}${name} --yes`;
                        break;
                    case 'choco':
                        command = `choco install ${name} -y --confirm`;
                        break;
                    case 'winget':
                        command = `winget install --id ${name} --accept-package-agreements --accept-source-agreements -h`;
                        break;
                    default:
                        command = `npm install ${name} --yes`;
                }
                break;
                
            case 'system':
                command = systemCommand.value;
                addOutput('info', `Executing system command: ${command}...`);
                break;
                
            case 'network':
                command = networkCommand.value;
                if (['ping', 'tracert'].includes(command)) {
                    const target = networkTarget.value.trim();
                    if (!target) {
                        addOutput('error', 'Please enter a target for the network command.');
                        return;
                    }
                    command = `${command} ${target}`;
                }
                addOutput('info', `Executing network command: ${command}...`);
                break;
                
            case 'custom':
                command = customCommand.value.trim();
                if (!command) {
                    addOutput('error', 'Please enter a command.');
                    return;
                }
                addOutput('info', `Executing custom command: ${command}...`);
                break;
        }
        
        // Send the command to the server
        socket.emit('runSystemCommand', { command });
    });
    
    // Handle command output from server
    socket.on('commandOutput', function(data) {
        addOutput(data.type, data.message);
    });
    
    // Handle command completion
    socket.on('commandComplete', function(data) {
        if (data.success) {
            addOutput('success', `Command completed successfully with exit code ${data.exitCode}`);
        } else {
            addOutput('error', `Command failed with exit code ${data.exitCode}`);
        }
    });
    
    // Function to add output to the command output div
    function addOutput(type, message) {
        const outputLine = document.createElement('div');
        outputLine.className = type === 'error' ? 'text-danger' : 
                              type === 'success' ? 'text-success' : 
                              type === 'warning' ? 'text-warning' : 'text-light';
        
        // Format the message
        let formattedMessage = message;
        
        // Add timestamp
        const timestamp = new Date().toLocaleTimeString();
        outputLine.innerHTML = `<span class="text-muted">[${timestamp}]</span> ${formattedMessage}`;
        
        // Add to output
        commandOutput.appendChild(outputLine);
        
        // Scroll to bottom
        commandOutput.scrollTop = commandOutput.scrollHeight;
    }
    
    // Update sidebar navigation to show the active page
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === window.location.pathname) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});
