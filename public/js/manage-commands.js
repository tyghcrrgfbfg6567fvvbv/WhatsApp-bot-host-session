document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const commandList = document.getElementById('command-list');
    const commandForm = document.getElementById('command-form');
    const editorTitle = document.getElementById('editor-title');
    const statusContainer = document.getElementById('status-container');
    const newCommandBtn = document.getElementById('new-command-btn');
    const deleteBtn = document.getElementById('delete-btn');
    
    let currentCommand = null;
    let codeEditor = null;
    
    // Initialize CodeMirror editor
    codeEditor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
        mode: 'javascript',
        lineNumbers: true,
        theme: 'default',
        indentUnit: 2,
        tabSize: 2,
        lineWrapping: true,
        autoCloseBrackets: true,
        matchBrackets: true
    });
    
    // Request commands on page load
    socket.emit('getCommands');
    
    // Handle commands list response
    socket.on('commandsList', function(commands) {
        commandList.innerHTML = '';
        
        if (commands.length === 0) {
            commandList.innerHTML = '<div class="text-center text-muted">No commands found</div>';
        } else {
            // Sort commands alphabetically
            commands.sort((a, b) => a.name.localeCompare(b.name));
            
            commands.forEach(command => {
                const commandItem = document.createElement('a');
                commandItem.href = '#';
                commandItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
                commandItem.innerHTML = `
                    <div>
                        <strong>.${command.name}</strong>
                        <div class="small text-muted">${command.description || 'No description'}</div>
                    </div>
                `;
                
                commandItem.addEventListener('click', function(e) {
                    e.preventDefault();
                    loadCommand(command.name);
                });
                
                commandList.appendChild(commandItem);
            });
        }
    });
    
    // Handle command load response
    socket.on('commandDetails', function(command) {
        currentCommand = command;
        
        // Update form fields
        document.getElementById('commandName').value = command.name;
        document.getElementById('commandTitle').value = command.title || '';
        document.getElementById('commandDescription').value = command.description || '';
        document.getElementById('commandExample').value = command.example || '';
        
        // Update code editor
        codeEditor.setValue(command.code || '');
        
        // Update editor title
        editorTitle.textContent = `Editing Command: .${command.name}`;
        
        // Show delete button
        deleteBtn.style.display = 'block';
        
        // Enable command name field if it's a new command
        document.getElementById('commandName').disabled = command.isNew ? false : true;
    });
    
    // Handle new command button
    newCommandBtn.addEventListener('click', function() {
        currentCommand = {
            name: '',
            title: '',
            description: '',
            example: '',
            code: getCommandTemplate(),
            isNew: true
        };
        
        // Update form fields
        document.getElementById('commandName').value = '';
        document.getElementById('commandName').disabled = false;
        document.getElementById('commandTitle').value = '';
        document.getElementById('commandDescription').value = '';
        document.getElementById('commandExample').value = '';
        
        // Update code editor
        codeEditor.setValue(currentCommand.code);
        
        // Update editor title
        editorTitle.textContent = 'Create New Command';
        
        // Hide delete button for new commands
        deleteBtn.style.display = 'none';
    });
    
    // Handle command form submission
    commandForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const commandName = document.getElementById('commandName').value;
        const commandTitle = document.getElementById('commandTitle').value;
        const commandDescription = document.getElementById('commandDescription').value;
        const commandExample = document.getElementById('commandExample').value;
        const commandCode = codeEditor.getValue();
        
        if (!commandName) {
            addStatusMessage('error', 'Command name is required');
            return;
        }
        
        if (!commandCode) {
            addStatusMessage('error', 'Command code is required');
            return;
        }
        
        // Create command object
        const command = {
            name: commandName,
            title: commandTitle,
            description: commandDescription,
            example: commandExample,
            code: commandCode,
            isNew: currentCommand ? currentCommand.isNew : true
        };
        
        // Send command to server
        socket.emit('saveCommand', command);
    });
    
    // Handle delete button
    deleteBtn.addEventListener('click', function() {
        if (!currentCommand || !currentCommand.name) {
            return;
        }
        
        if (confirm(`Are you sure you want to delete the command "${currentCommand.name}"?`)) {
            socket.emit('deleteCommand', currentCommand.name);
        }
    });
    
    // Handle save command response
    socket.on('commandSaved', function(response) {
        if (response.success) {
            addStatusMessage('success', `Command "${response.name}" saved successfully`);
            
            // Refresh commands list
            socket.emit('getCommands');
            
            // If it was a new command, load it
            if (currentCommand && currentCommand.isNew) {
                loadCommand(response.name);
            }
        } else {
            addStatusMessage('error', `Error saving command: ${response.message}`);
        }
    });
    
    // Handle delete command response
    socket.on('commandDeleted', function(response) {
        if (response.success) {
            addStatusMessage('success', `Command "${response.name}" deleted successfully`);
            
            // Refresh commands list
            socket.emit('getCommands');
            
            // Reset form
            newCommandBtn.click();
        } else {
            addStatusMessage('error', `Error deleting command: ${response.message}`);
        }
    });
    
    // Function to load a command
    function loadCommand(name) {
        socket.emit('getCommand', name);
        
        // Highlight selected command
        const commandItems = commandList.querySelectorAll('.list-group-item');
        commandItems.forEach(item => {
            item.classList.remove('active');
            if (item.querySelector('strong').textContent === `.${name}`) {
                item.classList.add('active');
            }
        });
    }
    
    // Helper function to add status messages
    function addStatusMessage(type, message) {
        const alertClass = type === 'error' ? 'alert-danger' : 
                          type === 'success' ? 'alert-success' : 'alert-info';
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${alertClass} alert-dismissible fade show`;
        alertDiv.innerHTML = message;
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'btn-close';
        closeButton.setAttribute('data-bs-dismiss', 'alert');
        closeButton.setAttribute('aria-label', 'Close');
        alertDiv.appendChild(closeButton);
        
        statusContainer.appendChild(alertDiv);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            const dismissButton = new bootstrap.Alert(alertDiv);
            dismissButton.close();
        }, 5000);
    }
    
    // Function to get command template
    function getCommandTemplate() {
        return `/**
 * @command
 * name: command_name
 * title: Command Title
 * description: Description of what this command does
 * example: .command_name
 * subcommands:
 *   - cmd: parameter
 *     desc: Description of parameter
 */

module.exports = {
  name: 'command_name',
  description: 'Description of what this command does',
  async execute(XeonBotInc, msg) {
    try {
      // Get the sender's details
      const sender = msg.key.remoteJid;
      
      // Your command logic here
      await XeonBotInc.sendMessage(sender, { 
        text: 'Hello from your new command!' 
      });
      
    } catch (error) {
      console.error('Error in command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { 
        text: 'An error occurred while processing the command.' 
      });
    }
  },
};`;
    }
});
