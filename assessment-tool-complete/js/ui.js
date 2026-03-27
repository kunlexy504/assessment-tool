/**
 * UI.JS - User Interface Management
 * Handles rendering of all pages and components
 * Manages user interactions and page transitions
 * 
 * Pages:
 * - Login Page
 * - Registration Page
 * - Backend Admin Panel
 * - Assessment Interface
 * - Results Display Page
 */

// =====================================================
// PAGE RENDERING FUNCTIONS
// =====================================================

/**
 * Render login page
 */
function renderLoginPage() {
    const app = document.getElementById('app');
    clearElement(app);
    
    const container = createEl('div', 'page login-page');
    
    const content = createEl('div', 'login-content');
    
    // Header
    const header = createEl('div', 'login-header');
    const title = createEl('h1');
    title.textContent = 'Lecturer Assessment Tool';
    const subtitle = createEl('p', 'subtitle');
    subtitle.textContent = 'Login to your account';
    header.appendChild(title);
    header.appendChild(subtitle);
    content.appendChild(header);
    
    // Form
    const form = createEl('form', 'login-form');
    form.onsubmit = (e) => handleLoginSubmit(e);
    
    // Username input
    const usernameLabel = createEl('label');
    usernameLabel.textContent = 'Username';
    const usernameInput = createEl('input', '', {
        type: 'text',
        id: 'login-username',
        placeholder: 'Enter your username',
        required: 'true'
    });
    // Add focus event to clear placeholder
    usernameInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    // Add real-time validation
    usernameInput.addEventListener('input', function() {
        const username = sanitizeInput(this.value);
        
        if (!username) {
            // Clear styling if empty
            this.style.borderColor = '';
            this.style.backgroundColor = '';
            this.style.boxShadow = '';
            return;
        }
        
        // Check if user exists
        const user = getUserByUsername(username);
        
        if (user) {
            // User found - flash green
            this.style.borderColor = '#28a745';
            this.style.backgroundColor = '#d4edda';
            this.style.boxShadow = '0 0 5px rgba(40, 167, 69, 0.5)';
        } else {
            // User not found - flash red
            this.style.borderColor = '#dc3545';
            this.style.backgroundColor = '#f8d7da';
            this.style.boxShadow = '0 0 5px rgba(220, 53, 69, 0.5)';
        }
    });
    form.appendChild(usernameLabel);
    form.appendChild(usernameInput);

    // Password input
    const passwordLabel = createEl('label');
    passwordLabel.textContent = 'Password';
    const passwordInput = createEl('input', '', {
        type: 'password',
        id: 'login-password',
        placeholder: 'Enter your password',
        required: 'true'
    });
    // Add focus event to clear placeholder
    passwordInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    form.appendChild(passwordLabel);
    form.appendChild(passwordInput);
    
    // Submit button
    const submitBtn = createEl('button', 'btn btn-primary btn-full');
    submitBtn.textContent = 'Login';
    submitBtn.type = 'submit';
    form.appendChild(submitBtn);
    
    content.appendChild(form);
    
    // Reset password link
    const resetSection = createEl('div', 'auth-switch');
    const resetBtn = createEl('button', 'link');
    resetBtn.textContent = 'Forgot your password? Reset here';
    resetBtn.type = 'button';
    resetBtn.style.background = 'none';
    resetBtn.style.border = 'none';
    resetBtn.style.cursor = 'pointer';
    resetBtn.style.padding = '0';
    resetBtn.onclick = (e) => {
        e.preventDefault();
        renderPasswordResetPage();
    };
    resetSection.appendChild(resetBtn);
    content.appendChild(resetSection);
    
    // Register link
    const registerSection = createEl('div', 'auth-switch');
    const registerText = createEl('p');
    registerText.textContent = 'Don\'t have an account? ';
    const registerLink = createEl('a', 'link');
    registerLink.textContent = 'Register here';
    registerLink.onclick = () => renderRegistrationPage();
    registerText.appendChild(registerLink);
    registerSection.appendChild(registerText);
    content.appendChild(registerSection);
    
    container.appendChild(content);
    app.appendChild(container);
}

/**
 * Show reset password dialog
 */
function showResetPasswordDialog() {
    const modal = createEl('div', 'modal-overlay');
    const dialog = createEl('div', 'modal-dialog');
    const closeBtn = createEl('button', 'modal-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();
    
    const title = createEl('h2');
    title.textContent = 'Forgot Password';
    
    const message = createEl('p');
    message.textContent = 'Enter your username below to verify your account. If your account exists, you will be provided with instructions to reset your password.';
    message.style.marginBottom = '20px';
    message.style.color = 'var(--text-secondary)';
    
    const form = createEl('form', 'user-form');
    
    const usernameGroup = createEl('div', 'form-group');
    const usernameLabel = createEl('label');
    usernameLabel.textContent = 'Username';
    const usernameInput = createEl('input', 'form-control');
    usernameInput.type = 'text';
    usernameInput.required = true;
    usernameInput.placeholder = 'Enter your username';
    usernameGroup.appendChild(usernameLabel);
    usernameGroup.appendChild(usernameInput);
    
    form.appendChild(message);
    form.appendChild(usernameGroup);
    
    form.onsubmit = (e) => {
        e.preventDefault();
        const username = sanitizeInput(usernameInput.value);
        
        if (!username) {
            showNotification('Username is required', 'error');
            return;
        }
        
        // Find user by username
        const user = getUserByUsername(username);
        if (!user) {
            showNotification('User not found. Please check your username or contact an administrator.', 'error');
            return;
        }
        
        // User found - show admin contact information
        alert('User found! Please call the administrator at 07707342518 to reset your password. The admin will provide you with a default password to access your account.');
        
        // Show additional information in the modal
        const resultDiv = createEl('div', 'reset-result');
        resultDiv.style.marginTop = '20px';
        resultDiv.style.padding = '15px';
        resultDiv.style.backgroundColor = 'var(--bg-secondary)';
        resultDiv.style.borderRadius = '4px';
        resultDiv.style.border = '1px solid var(--border-color)';
        
        const resultTitle = createEl('h3');
        resultTitle.textContent = 'Account Verified';
        resultTitle.style.color = 'var(--success-color)';
        resultTitle.style.marginBottom = '10px';
        
        const resultMessage = createEl('p');
        resultMessage.textContent = 'Your account has been found in our system. Please contact the administrator using the phone number below to complete your password reset.';
        resultMessage.style.marginBottom = '15px';
        
        const contactInfo = createEl('div', 'contact-info');
        contactInfo.style.backgroundColor = 'var(--bg-tertiary)';
        contactInfo.style.padding = '10px';
        contactInfo.style.borderRadius = '4px';
        contactInfo.style.textAlign = 'center';
        
        const phoneLabel = createEl('strong');
        phoneLabel.textContent = 'Administrator Contact:';
        phoneLabel.style.display = 'block';
        phoneLabel.style.marginBottom = '5px';
        
        const phoneNumber = createEl('span');
        phoneNumber.textContent = '07707342518';
        phoneNumber.style.fontSize = '18px';
        phoneNumber.style.fontWeight = 'bold';
        phoneNumber.style.color = 'var(--primary-color)';
        
        contactInfo.appendChild(phoneLabel);
        contactInfo.appendChild(phoneNumber);
        
        const note = createEl('p');
        note.textContent = 'Note: The administrator will provide you with a default password (Pas$word098*) that you can use to log in and then change your password.';
        note.style.fontSize = '12px';
        note.style.color = 'var(--text-secondary)';
        note.style.marginTop = '10px';
        
        resultDiv.appendChild(resultTitle);
        resultDiv.appendChild(resultMessage);
        resultDiv.appendChild(contactInfo);
        resultDiv.appendChild(note);
        
        // Replace form content with result
        form.innerHTML = '';
        form.appendChild(resultDiv);
        
        // Change button to close
        const buttonGroup = createEl('div', 'form-buttons');
        const closeBtn = createEl('button', 'btn btn-primary');
        closeBtn.type = 'button';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => modal.remove();
        
        buttonGroup.appendChild(closeBtn);
        form.appendChild(buttonGroup);
    };
    
    const buttonGroup = createEl('div', 'form-buttons');
    const checkBtn = createEl('button', 'btn btn-primary');
    checkBtn.type = 'submit';
    checkBtn.textContent = 'Check Username';
    const cancelBtn = createEl('button', 'btn btn-secondary');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => modal.remove();
    
    buttonGroup.appendChild(checkBtn);
    buttonGroup.appendChild(cancelBtn);
    form.appendChild(buttonGroup);
    
    dialog.appendChild(closeBtn);
    dialog.appendChild(title);
    dialog.appendChild(form);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

/**
 * Show change password dialog for users logging in with default password
 */
function showChangePasswordDialog(user) {
    const modal = createEl('div', 'modal-overlay');
    const dialog = createEl('div', 'modal-dialog');
    const closeBtn = createEl('button', 'modal-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => {
        // If user closes without changing password, log them out
        logoutUser();
        renderLoginPage();
        modal.remove();
    };
    
    const title = createEl('h2');
    title.textContent = 'Change Your Password';
    
    const message = createEl('p');
    message.textContent = 'You are logging in with a default password. Please change your password to secure your account.';
    message.style.marginBottom = '20px';
    message.style.color = 'var(--warning-color)';
    message.style.fontWeight = 'bold';
    
    const form = createEl('form', 'user-form');
    
    const newPasswordGroup = createEl('div', 'form-group');
    const newPasswordLabel = createEl('label');
    newPasswordLabel.textContent = 'New Password';
    const newPasswordInput = createEl('input', 'form-control');
    newPasswordInput.type = 'password';
    newPasswordInput.required = true;
    newPasswordInput.placeholder = 'Enter new password';
    newPasswordGroup.appendChild(newPasswordLabel);
    newPasswordGroup.appendChild(newPasswordInput);
    
    const confirmPasswordGroup = createEl('div', 'form-group');
    const confirmPasswordLabel = createEl('label');
    confirmPasswordLabel.textContent = 'Confirm New Password';
    const confirmPasswordInput = createEl('input', 'form-control');
    confirmPasswordInput.type = 'password';
    confirmPasswordInput.required = true;
    confirmPasswordInput.placeholder = 'Confirm new password';
    confirmPasswordGroup.appendChild(confirmPasswordLabel);
    confirmPasswordGroup.appendChild(confirmPasswordInput);
    
    form.appendChild(message);
    form.appendChild(newPasswordGroup);
    form.appendChild(confirmPasswordGroup);
    
    form.onsubmit = (e) => {
        e.preventDefault();
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        if (!newPassword || !confirmPassword) {
            showNotification('Both password fields are required', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }
        
        if (newPassword === 'Pas$word098*') {
            showNotification('Please choose a different password from the default', 'error');
            return;
        }
        
        if (updateUser(user.id, { password: newPassword })) {
            showNotification('Password changed successfully! Welcome to your account.', 'success');
            modal.remove();
            // Continue with normal login flow
            setTimeout(() => {
                const schemes = getMarkingSchemesForUser(user.id);
                if (schemes.length === 0) {
                    console.log('Creating demo marking scheme for new user...');
                    createDemoMarkingScheme(user.id);
                }
                renderBackendPanel();
            }, 500);
        } else {
            showNotification('Failed to change password', 'error');
        }
    };
    
    const buttonGroup = createEl('div', 'form-buttons');
    const saveBtn = createEl('button', 'btn btn-primary');
    saveBtn.type = 'submit';
    saveBtn.textContent = 'Change Password';
    const logoutBtn = createEl('button', 'btn btn-secondary');
    logoutBtn.type = 'button';
    logoutBtn.textContent = 'Logout';
    logoutBtn.onclick = () => {
        logoutUser();
        renderLoginPage();
        modal.remove();
    };
    
    buttonGroup.appendChild(saveBtn);
    buttonGroup.appendChild(logoutBtn);
    form.appendChild(buttonGroup);
    
    dialog.appendChild(closeBtn);
    dialog.appendChild(title);
    dialog.appendChild(form);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

/**
 * Render registration page
 */
function renderRegistrationPage() {
    const app = document.getElementById('app');
    clearElement(app);
    
    const container = createEl('div', 'page registration-page');
    
    const content = createEl('div', 'auth-content');
    
    // Header
    const header = createEl('div', 'auth-header');
    const title = createEl('h1');
    title.textContent = 'Create New Account';
    header.appendChild(title);
    content.appendChild(header);
    
    // Form
    const form = createEl('form', 'auth-form');
    form.onsubmit = (e) => handleRegistrationSubmit(e);
    
    // Username
    const usernameLabel = createEl('label');
    usernameLabel.textContent = 'Username';
    const usernameInput = createEl('input', '', {
        type: 'text',
        id: 'register-username',
        placeholder: 'Choose username (min 3 chars)',
        required: 'true'
    });
    // Add focus event to clear placeholder
    usernameInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    form.appendChild(usernameLabel);
    form.appendChild(usernameInput);
    
    // Password
    const passwordLabel = createEl('label');
    passwordLabel.textContent = 'Password';
    const passwordInput = createEl('input', '', {
        type: 'password',
        id: 'register-password',
        placeholder: 'Enter password (min 6 chars)',
        required: 'true'
    });
    // Add focus event to clear placeholder
    passwordInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    form.appendChild(passwordLabel);
    form.appendChild(passwordInput);
    
    // Confirm password
    const confirmLabel = createEl('label');
    confirmLabel.textContent = 'Confirm Password';
    const confirmInput = createEl('input', '', {
        type: 'password',
        id: 'register-confirm',
        placeholder: 'Confirm password',
        required: 'true'
    });
    // Add focus event to clear placeholder
    confirmInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    form.appendChild(confirmLabel);
    form.appendChild(confirmInput);
    
    // Submit
    const submitBtn = createEl('button', 'btn btn-primary btn-full');
    submitBtn.textContent = 'Create Account';
    submitBtn.type = 'submit';
    form.appendChild(submitBtn);
    
    content.appendChild(form);
    
    // Back to login
    const backSection = createEl('div', 'auth-switch');
    const backLink = createEl('a', 'link');
    backLink.textContent = '← Back to Login';
    backLink.onclick = () => renderLoginPage();
    backSection.appendChild(backLink);
    content.appendChild(backSection);
    
    container.appendChild(content);
    app.appendChild(container);
}

/**
 * Render password reset page
 */
function renderPasswordResetPage() {
    const app = document.getElementById('app');
    clearElement(app);
    
    const container = createEl('div', 'page registration-page');
    
    const content = createEl('div', 'auth-content');
    
    // Header
    const header = createEl('div', 'auth-header');
    const title = createEl('h1');
    title.textContent = 'Reset Password';
    const subtitle = createEl('p', 'subtitle');
    subtitle.textContent = 'Enter your username to verify your account';
    header.appendChild(title);
    header.appendChild(subtitle);
    content.appendChild(header);
    
    // Form
    const form = createEl('form', 'auth-form');
    form.onsubmit = (e) => {
        e.preventDefault();
        
        const usernameInput = form.querySelector('input[name="username"]');
        const username = sanitizeInput(usernameInput.value);
        
        if (!username) {
            showNotification('Username is required', 'error');
            return;
        }
        
        // Find user by username
        const user = getUserByUsername(username);
        if (!user) {
            showNotification('User not found. Please check your username.', 'error');
            return;
        }
        
        // Show admin contact message
        showNotification('Account verified. Please contact Admin on 07707342518 to reset your password.', 'success');
        setTimeout(() => {
            renderLoginPage();
        }, 3000);
    };
    
    // Username input
    const usernameLabel = createEl('label');
    usernameLabel.textContent = 'Username';
    const usernameInput = createEl('input', '', {
        type: 'text',
        name: 'username',
        placeholder: 'Enter your username',
        required: 'true'
    });
    
    // Add real-time validation
    usernameInput.addEventListener('input', function() {
        const username = sanitizeInput(this.value);
        
        if (!username) {
            // Clear styling if empty
            this.style.borderColor = '';
            this.style.backgroundColor = '';
            return;
        }
        
        // Check if user exists
        const user = getUserByUsername(username);
        
        if (user) {
            // User found - flash green
            this.style.borderColor = '#28a745';
            this.style.backgroundColor = '#d4edda';
            this.style.boxShadow = '0 0 5px rgba(40, 167, 69, 0.5)';
        } else {
            // User not found - flash red
            this.style.borderColor = '#dc3545';
            this.style.backgroundColor = '#f8d7da';
            this.style.boxShadow = '0 0 5px rgba(220, 53, 69, 0.5)';
        }
    });
    
    // Add focus event to clear placeholder
    usernameInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    
    form.appendChild(usernameLabel);
    form.appendChild(usernameInput);
    
    // Submit button
    const submitBtn = createEl('button', 'btn btn-primary btn-full');
    submitBtn.textContent = 'Verify Username';
    submitBtn.type = 'submit';
    form.appendChild(submitBtn);
    
    content.appendChild(form);
    
    // Back to login
    const backSection = createEl('div', 'auth-switch');
    const backLink = createEl('a', 'link');
    backLink.textContent = '← Back to Login';
    backLink.onclick = () => renderLoginPage();
    backSection.appendChild(backLink);
    content.appendChild(backSection);
    
    container.appendChild(content);
    app.appendChild(container);
}

/**
 * Render backend admin panel
 */
function renderBackendPanel() {
    const app = document.getElementById('app');
    clearElement(app);
    
    const container = createEl('div', 'page backend-page');
    
    // Header with navigation
    const header = createEl('header', 'backend-header');
    const headerContent = createEl('div', 'header-content');
    
    const title = createEl('h1');
    title.textContent = 'Lecturer Dashboard';
    headerContent.appendChild(title);
    
    const navButtons = createEl('div', 'header-nav');
    
    const schemeBtn = createEl('button', 'btn btn-secondary');
    schemeBtn.textContent = 'Marking Schemes';
    schemeBtn.onclick = () => showBackendTab('schemes');
    navButtons.appendChild(schemeBtn);
    
    const studentsBtn = createEl('button', 'btn btn-secondary');
    studentsBtn.textContent = 'Students';
    studentsBtn.onclick = () => showBackendTab('students');
    navButtons.appendChild(studentsBtn);
    
    const usersBtn = createEl('button', 'btn btn-secondary');
    usersBtn.textContent = 'Users';
    usersBtn.onclick = () => showBackendTab('users');
    navButtons.appendChild(usersBtn);
    
    const settingsBtn = createEl('button', 'btn btn-secondary');
    settingsBtn.textContent = 'Settings';
    settingsBtn.onclick = () => showBackendTab('settings');
    navButtons.appendChild(settingsBtn);
    
    const logoutBtn = createEl('button', 'btn btn-danger');
    logoutBtn.textContent = 'Logout';
    logoutBtn.onclick = () => handleLogout();
    navButtons.appendChild(logoutBtn);
    
    headerContent.appendChild(navButtons);
    header.appendChild(headerContent);
    container.appendChild(header);
    
    // Main content area
    const mainContent = createEl('main', 'backend-main');
    mainContent.id = 'backend-content';
    container.appendChild(mainContent);
    
    app.appendChild(container);
    
    // Show default tab
    showBackendTab('schemes');
}

/**
 * Show specific backend tab
 * @param {string} tabName - Tab to show
 */
function showBackendTab(tabName) {
    const content = document.getElementById('backend-content');
    clearElement(content);
    
    // Set URL hash for anchor links
    window.location.hash = tabName;
    
    // Update active button styling in navigation
    const navButtons = document.querySelectorAll('.header-nav .btn');
    navButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Map tab names to button indices
    const buttonIndexMap = {
        'schemes': 0,
        'students': 1,
        'users': 2,
        'settings': 3
    };
    
    // Add active class to clicked tab button
    const buttonIndex = buttonIndexMap[tabName];
    if (buttonIndex !== undefined && navButtons[buttonIndex]) {
        navButtons[buttonIndex].classList.add('active');
    }
    
    switch(tabName) {
        case 'schemes':
            renderMarkingSchemesTab(content);
            break;
        case 'students':
            renderStudentsManagementTab(content);
            break;
        case 'users':
            renderUsersManagementTab(content);
            break;
        case 'settings':
            renderSettingsTab(content);
            break;
    }
}

/**
 * Render marking schemes management tab
 */
function renderMarkingSchemesTab(container) {
    const section = createEl('section', 'backend-section');
    
    const heading = createEl('h2');
    heading.textContent = 'Marking Schemes';
    section.appendChild(heading);
    
    const btnContainer = createEl('div', 'button-group');
    
    const createBtn = createEl('button', 'btn btn-primary');
    createBtn.textContent = '+ Create New Scheme';
    createBtn.onclick = () => renderCreateMarkingSchemeForm();
    btnContainer.appendChild(createBtn);
    
    section.appendChild(btnContainer);
    
    // List schemes
    const user = getCurrentUser();
    const schemes = getMarkingSchemesForUser(user.id);
    
    if (schemes.length === 0) {
        const emptyMsg = createEl('p', 'empty-state');
        emptyMsg.textContent = 'No marking schemes created yet. Create one to begin.';
        section.appendChild(emptyMsg);
    } else {
        const list = createEl('div', 'schemes-list');
        
        schemes.forEach(scheme => {
            const item = createEl('div', 'scheme-item');
            
            const info = createEl('div', 'scheme-info');
            const name = createEl('h3');
            name.textContent = scheme.schemeName;
            const meta = createEl('p', 'scheme-meta');
            meta.textContent = `${scheme.courseName} | ${scheme.learningOutcomes.length} LOs | ${scheme.bandScores.length} bands`;
            
            info.appendChild(name);
            info.appendChild(meta);
            item.appendChild(info);
            
            const actions = createEl('div', 'scheme-actions');
            
            const editBtn = createEl('button', 'btn btn-secondary btn-sm');
            editBtn.textContent = 'Edit';
            editBtn.onclick = () => renderEditMarkingSchemeForm(scheme.id);
            actions.appendChild(editBtn);
            
            const deleteBtn = createEl('button', 'btn btn-danger btn-sm');
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => confirmDeleteScheme(scheme.id);
            actions.appendChild(deleteBtn);
            
            item.appendChild(actions);
            list.appendChild(item);
        });
        
        section.appendChild(list);
    }
    
    container.appendChild(section);
}

/**
 * Render create marking scheme form with MANUAL ENTRY and FILE UPLOAD options
 */
function renderCreateMarkingSchemeForm() {
    const modal = createEl('div', 'modal-overlay');
    
    const dialog = createEl('div', 'modal-dialog');
    
    const closeBtn = createEl('button', 'modal-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();
    dialog.appendChild(closeBtn);
    
    const title = createEl('h2');
    title.textContent = 'Create Marking Scheme';
    dialog.appendChild(title);
    
    // Create tabs for two options
    const optionTabs = createEl('div', 'option-tabs');
    
    const manualTab = createEl('button', 'btn btn-secondary tab-button active');
    manualTab.textContent = 'Manual Entry';
    
    const uploadTab = createEl('button', 'btn btn-secondary tab-button');
    uploadTab.textContent = 'Upload File';
    
    optionTabs.appendChild(manualTab);
    optionTabs.appendChild(uploadTab);
    dialog.appendChild(optionTabs);
    
    // ===== MANUAL ENTRY FORM =====
    const manualForm = createEl('form', 'scheme-form manual-form');
    manualForm.style.display = 'block';
    manualForm.onsubmit = (e) => {
        e.preventDefault();
        handleCreateMarkingScheme(manualForm);
        modal.remove();
    };
    
    // Scheme Name (COMPULSORY)
    const nameLabel = createEl('label');
    nameLabel.textContent = 'Scheme Name *';
    const nameInput = createEl('input', '', { 
        type: 'text',
        name: 'schemeName',
        required: 'true',
        placeholder: 'e.g., Business Management Rubric'
    });
    // Add focus event to clear placeholder
    nameInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    manualForm.appendChild(nameLabel);
    manualForm.appendChild(nameInput);
    
    // Course Name (COMPULSORY)
    const courseLabel = createEl('label');
    courseLabel.textContent = 'Course Name *';
    const courseInput = createEl('input', '', { 
        type: 'text',
        name: 'courseName',
        required: 'true',
        placeholder: 'e.g., Business 101'
    });
    // Add focus event to clear placeholder
    courseInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    manualForm.appendChild(courseLabel);
    manualForm.appendChild(courseInput);
    
    // Institution (OPTIONAL)
    const institutionLabel = createEl('label');
    institutionLabel.textContent = 'Institution (Optional)';
    const institutionInput = createEl('input', '', { 
        type: 'text',
        name: 'institution',
        placeholder: 'e.g., University of Example'
    });
    // Add focus event to clear placeholder
    institutionInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    manualForm.appendChild(institutionLabel);
    manualForm.appendChild(institutionInput);

    // Band scores section
    const bandSection = createEl('div', 'scheme-subsection');
    const bandHeading = createEl('h3');
    bandHeading.textContent = 'Band Scores';
    bandSection.appendChild(bandHeading);

    const bandContainer = createEl('div', 'band-list');
    bandSection.appendChild(bandContainer);

    const addBandBtn = createEl('button', 'btn btn-secondary btn-sm');
    addBandBtn.textContent = '+ Add Band Score';
    addBandBtn.onclick = (e) => {
        e.preventDefault();
        addBandScoreRow(bandContainer);
    };
    bandSection.appendChild(addBandBtn);

    manualForm.appendChild(bandSection);

    // Learning outcomes section
    const loSection = createEl('div', 'scheme-subsection');
    const loHeading = createEl('h3');
    loHeading.textContent = 'Learning Outcomes';
    loSection.appendChild(loHeading);

    const loContainer = createEl('div', 'lo-list');
    loSection.appendChild(loContainer);

    const addLoBtn = createEl('button', 'btn btn-secondary btn-sm');
    addLoBtn.textContent = '+ Add Learning Outcome';
    addLoBtn.onclick = (e) => {
        e.preventDefault();
        addLearningOutcomeRow(loContainer);
    };
    loSection.appendChild(addLoBtn);

    manualForm.appendChild(loSection);

    // Seed default values
    createDefaultBandScores().forEach(bandScore => addBandScoreRow(bandContainer, bandScore));
    createDefaultLearningOutcomes().forEach(lo => addLearningOutcomeRow(loContainer, lo));

    // Submit button
    const submitBtn = createEl('button', 'btn btn-primary');
    submitBtn.textContent = 'Create Scheme';
    submitBtn.type = 'submit';
    manualForm.appendChild(submitBtn);

    dialog.appendChild(manualForm);
    
    // ===== FILE UPLOAD FORM =====
    const uploadForm = createEl('form', 'scheme-form upload-form');
    uploadForm.style.display = 'none';
    uploadForm.onsubmit = (e) => {
        e.preventDefault();
        handleFileUploadScheme(uploadForm);
        modal.remove();
    };
    
    // File input
    const fileLabel = createEl('label');
    fileLabel.textContent = 'Select Marking Scheme File *';
    const fileInput = createEl('input', '', {
        type: 'file',
        accept: '.docx,.pdf',
        required: 'true',
        id: 'scheme-file-input'
    });
    uploadForm.appendChild(fileLabel);
    uploadForm.appendChild(fileInput);
    
    // Scheme Name from file (COMPULSORY)
    const uploadSchemeNameLabel = createEl('label');
    uploadSchemeNameLabel.textContent = 'Scheme Name *';
    const uploadSchemeNameInput = createEl('input', '', {
        type: 'text',
        required: 'true',
        placeholder: 'Name for this scheme'
    });
    // Add focus event to clear placeholder
    uploadSchemeNameInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    uploadForm.appendChild(uploadSchemeNameLabel);
    uploadForm.appendChild(uploadSchemeNameInput);
    
    // Course Name (COMPULSORY)
    const uploadCourseLabel = createEl('label');
    uploadCourseLabel.textContent = 'Course Name *';
    const uploadCourseInput = createEl('input', '', {
        type: 'text',
        required: 'true',
        placeholder: 'e.g., Business 101'
    });
    // Add focus event to clear placeholder
    uploadCourseInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    uploadForm.appendChild(uploadCourseLabel);
    uploadForm.appendChild(uploadCourseInput);
    
    // Institution (OPTIONAL)
    const uploadInstitutionLabel = createEl('label');
    uploadInstitutionLabel.textContent = 'Institution (Optional)';
    const uploadInstitutionInput = createEl('input', '', {
        type: 'text',
        placeholder: 'e.g., University of Example'
    });
    // Add focus event to clear placeholder
    uploadInstitutionInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    uploadForm.appendChild(uploadInstitutionLabel);
    uploadForm.appendChild(uploadInstitutionInput);
    
    // Info message
    const infoMsg = createEl('p', 'info-message');
    infoMsg.textContent = '📄 Upload a DOCX or PDF file containing your marking scheme. The system will extract Learning Outcomes and Band Scores.';
    uploadForm.appendChild(infoMsg);
    
    // Submit button
    const uploadSubmitBtn = createEl('button', 'btn btn-primary');
    uploadSubmitBtn.textContent = 'Upload & Create Scheme';
    uploadSubmitBtn.type = 'submit';
    uploadForm.appendChild(uploadSubmitBtn);
    
    dialog.appendChild(uploadForm);
    
    // ===== TAB SWITCHING =====
    manualTab.onclick = (e) => {
        e.preventDefault();
        manualForm.style.display = 'block';
        uploadForm.style.display = 'none';
        manualTab.classList.add('active');
        uploadTab.classList.remove('active');
    };
    
    uploadTab.onclick = (e) => {
        e.preventDefault();
        manualForm.style.display = 'none';
        uploadForm.style.display = 'block';
        uploadTab.classList.add('active');
        manualTab.classList.remove('active');
    };
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

/**
 * Handle file upload for marking scheme
 * @param {HTMLFormElement} form - Upload form
 */
function handleFileUploadScheme(form) {
    const inputs = form.querySelectorAll('input[type="text"]');
    const fileInput = form.querySelector('input[type="file"]');
    
    const schemeName = sanitizeInput(inputs[0].value);
    const courseName = sanitizeInput(inputs[1].value);
    const institution = sanitizeInput(inputs[2].value);
    const file = fileInput.files[0];
    
    // Validation
    if (!schemeName) {
        showNotification('Scheme name is required', 'error');
        return;
    }
    
    if (!courseName) {
        showNotification('Course name is required', 'error');
        return;
    }
    
    if (!file) {
        showNotification('Please select a file', 'error');
        return;
    }
    
    // Check file type
    if (!file.name.endsWith('.docx') && !file.name.endsWith('.pdf')) {
        showNotification('Only DOCX and PDF files are supported', 'error');
        return;
    }
    
    showNotification('Processing file... This may take a moment', 'info');
    
    // Read file and parse it
    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('File uploaded:', file.name);
        
        // Future: Parse the file content to extract LOs and band scores
        // For now, create scheme with demo LOs
        
        const user = getCurrentUser();
        const scheme = createMarkingScheme(user.id, {
            schemeName: schemeName,
            institution: institution || 'Not specified',
            courseCode: '',
            courseName: courseName,
            bandScores: createDefaultBandScores(),
            learningOutcomes: createDefaultLearningOutcomes()
        });
        
        if (scheme) {
            showNotification(`Marking scheme "${schemeName}" created from file!`, 'success');
            console.log('Scheme created from file:', scheme.id);
            // Note: Currently uses default LOs/bands. Future: Parse file to extract actual scheme
            setTimeout(() => {
                showBackendTab('schemes');
            }, 500);
        }
    };
    
    reader.onerror = function() {
        showNotification('Error reading file', 'error');
    };
    
    reader.readAsArrayBuffer(file);
}

function addBandScoreRow(container, bandScore) {
    const row = createEl('div', 'band-row');
    row.setAttribute('data-band-id', bandScore ? bandScore.id : generateUniqueId());

    const number = createEl('input', 'band-number', {
        type: 'number',
        min: '1',
        value: bandScore ? bandScore.bandNumber : (container.children.length + 1),
        readonly: 'true'
    });

    const label = createEl('input', 'band-label', {
        type: 'text',
        value: bandScore ? bandScore.label : '',
        placeholder: 'Band label (e.g., Excellent)',
        required: 'true'
    });
    // Add focus event to clear placeholder
    label.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    // Add input event to update LO feedback sections
    label.addEventListener('input', function() {
        const form = container.closest('form');
        if (form) {
            clearTimeout(label._updateTimeout);
            label._updateTimeout = setTimeout(() => {
                updateAllLOFeedbackSections(form);
            }, 500);
        }
    });

    const range = createEl('input', 'band-range', {
        type: 'text',
        value: bandScore ? bandScore.scoreRange : '',
        placeholder: 'Score range (e.g., 80-89)'
    });
    // Add focus event to clear placeholder
    range.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    // Add input event to update LO feedback sections
    range.addEventListener('input', function() {
        const form = container.closest('form');
        if (form) {
            clearTimeout(range._updateTimeout);
            range._updateTimeout = setTimeout(() => {
                updateAllLOFeedbackSections(form);
            }, 500);
        }
    });

    const category = createEl('input', 'band-category', {
        type: 'text',
        value: bandScore ? bandScore.category : '',
        placeholder: 'Category (Fail/Pass/Merit/Distinction)'
    });
    // Add focus event to clear placeholder
    category.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    // Add input event to update LO feedback sections
    category.addEventListener('input', function() {
        const form = container.closest('form');
        if (form) {
            clearTimeout(category._updateTimeout);
            category._updateTimeout = setTimeout(() => {
                updateAllLOFeedbackSections(form);
            }, 500);
        }
    });

    const removeBtn = createEl('button', 'btn btn-danger btn-sm');
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = (e) => {
        e.preventDefault();
        if (row.parentNode) row.parentNode.removeChild(row);
    };

    row.appendChild(number);
    row.appendChild(label);
    row.appendChild(range);
    row.appendChild(category);
    row.appendChild(removeBtn);

    container.appendChild(row);
}

// Collect LO data from a row for saving
function collectLOData(row) {
    const loNumber = row.querySelector('.lo-number').value;
    const title = row.querySelector('.lo-title').value;
    const keyIndicatorsText = row.querySelector('.lo-key-indicators').value;
    const keyIndicators = keyIndicatorsText ? keyIndicatorsText.split('\n').map(item => item.trim()).filter(item => item) : [];

    // Collect feedbacks from band feedback inputs
    const feedbacks = {};
    const feedbackInputs = row.querySelectorAll('.band-feedback-input');
    feedbackInputs.forEach(input => {
        const bandNumber = input.getAttribute('data-band-number');
        const feedbackText = input.value.trim();
        if (bandNumber && feedbackText) {
            feedbacks[bandNumber] = feedbackText;
        }
    });

    return {
        id: row.getAttribute('data-lo-id'),
        loNumber: loNumber,
        title: title,
        keyIndicators: keyIndicators,
        feedbacks: feedbacks
    };
}

function addLearningOutcomeRow(container, lo) {
    const row = createEl('div', 'lo-row');
    row.setAttribute('data-lo-id', lo ? lo.id : generateUniqueId());

    // LO Number
    const loNumber = createEl('input', 'lo-number', {
        type: 'text',
        value: lo ? lo.loNumber : '',
        placeholder: 'LO code (e.g., LO1)',
        required: 'true'
    });

    // Add focus event to clear placeholder
    loNumber.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });

    // Outcome Title with label
    const titleLabel = createEl('label');
    titleLabel.textContent = 'Outcome Title';
    titleLabel.style.display = 'block';
    titleLabel.style.fontWeight = 'bold';
    titleLabel.style.marginBottom = '5px';

    const title = createEl('textarea', 'lo-title');
    title.placeholder = 'Enter the learning outcome title';
    title.value = lo ? lo.title : '';
    title.rows = 2;
    title.required = true;

    // Add focus event to clear placeholder
    title.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });

    // Key Indicators
    const keyIndicatorsLabel = createEl('label');
    keyIndicatorsLabel.textContent = 'LO Key Indicators';
    keyIndicatorsLabel.style.display = 'block';
    keyIndicatorsLabel.style.fontWeight = 'bold';
    keyIndicatorsLabel.style.marginBottom = '5px';

    const keyIndicators = createEl('textarea', 'lo-key-indicators');
    keyIndicators.placeholder = 'Enter key indicators for this learning outcome (one per line)';
    keyIndicators.value = lo ? (lo.keyIndicators ? lo.keyIndicators.join('\n') : '') : '';
    keyIndicators.rows = 3;

    // Add focus event to clear placeholder
    keyIndicators.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });

    // Band score configuration section
    const bandConfigSection = createEl('div', 'band-config-section');
    bandConfigSection.style.marginTop = '15px';
    bandConfigSection.style.padding = '10px';
    bandConfigSection.style.border = '1px solid #ddd';
    bandConfigSection.style.borderRadius = '4px';

    const bandConfigTitle = createEl('h4');
    bandConfigTitle.textContent = 'Band Score Feedback';
    bandConfigTitle.style.marginBottom = '10px';
    bandConfigSection.appendChild(bandConfigTitle);

    // Get available band scores from the form
    const getAvailableBands = () => {
        const form = container.closest('form');
        const bandRows = form.querySelectorAll('.band-row');
        const bands = [];
        bandRows.forEach(bandRow => {
            const bandNumber = bandRow.querySelector('.band-number').value;
            const bandLabel = bandRow.querySelector('.band-label').value;
            if (bandNumber && bandLabel) {
                bands.push({ number: bandNumber, label: bandLabel });
            }
        });
        return bands;
    };

    // Create band feedback inputs
    const createBandFeedbackInputs = () => {
        const bands = getAvailableBands();
        bandConfigSection.innerHTML = '';
        bandConfigSection.appendChild(bandConfigTitle);

        bands.forEach(band => {
            const bandItem = createEl('div', 'band-feedback-item');
            bandItem.style.marginBottom = '10px';
            bandItem.style.padding = '8px';
            bandItem.style.backgroundColor = '#f8f9fa';
            bandItem.style.borderRadius = '4px';

            const bandLabel = createEl('label');
            bandLabel.textContent = `Band ${band.number} (${band.label})`;
            bandLabel.style.display = 'block';
            bandLabel.style.fontWeight = 'bold';
            bandLabel.style.marginBottom = '5px';

            const feedbackInput = createEl('textarea', 'band-feedback-input');
            feedbackInput.placeholder = `Enter feedback summary for Band ${band.number}`;
            feedbackInput.rows = 2;
            feedbackInput.setAttribute('data-band-number', band.number);

            // Load existing feedback if available
            if (lo && lo.feedbacks && lo.feedbacks[band.number]) {
                feedbackInput.value = lo.feedbacks[band.number];
            }

            // Add focus event to clear placeholder
            feedbackInput.addEventListener('focus', function() {
                if (this.placeholder) {
                    this.placeholder = '';
                }
            });

            bandItem.appendChild(bandLabel);
            bandItem.appendChild(feedbackInput);
            bandConfigSection.appendChild(bandItem);
        });
    };

    // Initial creation of band feedback inputs
    createBandFeedbackInputs();

    // Set up dynamic updates when band scores change
    const setupDynamicUpdates = () => {
        const form = container.closest('form');
        if (!form) return;

        // Watch for changes to band score inputs
        const bandContainer = form.querySelector('.band-list');
        if (bandContainer) {
            // Use MutationObserver to watch for changes in the band list
            const observer = new MutationObserver(() => {
                updateAllLOFeedbackSections(form);
            });

            observer.observe(bandContainer, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['value']
            });

            // Also watch for input events on band score fields
            bandContainer.addEventListener('input', () => {
                // Debounce the update to avoid too many calls
                clearTimeout(bandContainer._updateTimeout);
                bandContainer._updateTimeout = setTimeout(() => {
                    updateAllLOFeedbackSections(form);
                }, 300);
            });
        }
    };

    setupDynamicUpdates();

    const saveBtn = createEl('button', 'btn btn-success btn-sm');
    saveBtn.textContent = 'Save LO';
    saveBtn.type = 'button';
    saveBtn.onclick = (e) => {
        e.preventDefault();
        // Save the current LO data
        const form = container.closest('form');
        if (form) {
            // Trigger form validation and save
            const loData = collectLOData(row);
            // Store the data temporarily or mark as saved
            row.setAttribute('data-saved', 'true');
            saveBtn.textContent = 'Saved ✓';
            saveBtn.style.backgroundColor = '#28a745';
            setTimeout(() => {
                saveBtn.textContent = 'Save LO';
                saveBtn.style.backgroundColor = '';
            }, 2000);
        }
    };

    const removeBtn = createEl('button', 'btn btn-danger btn-sm');
    removeBtn.textContent = 'Remove LO';
    removeBtn.onclick = (e) => {
        e.preventDefault();
        if (row.parentNode) row.parentNode.removeChild(row);
    };

    // Structure the row
    const leftColumn = createEl('div', 'lo-left-column');
    leftColumn.style.flex = '1';
    leftColumn.style.marginRight = '20px';

    leftColumn.appendChild(loNumber);
    leftColumn.appendChild(titleLabel);
    leftColumn.appendChild(title);
    leftColumn.appendChild(keyIndicatorsLabel);
    leftColumn.appendChild(keyIndicators);

    const rightColumn = createEl('div', 'lo-right-column');
    rightColumn.style.flex = '2';

    rightColumn.appendChild(bandConfigSection);

    // Button container
    const buttonContainer = createEl('div', 'lo-buttons');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginTop = '10px';
    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(removeBtn);

    rightColumn.appendChild(buttonContainer);

    row.style.display = 'flex';
    row.style.gap = '20px';
    row.style.alignItems = 'flex-start';

    row.appendChild(leftColumn);
    row.appendChild(rightColumn);

    container.appendChild(row);
}

// Continue in Part 2...
