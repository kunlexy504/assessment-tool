/**
 * APP.JS - Application Initialization & Main Logic
 * Orchestrates all modules and handles page navigation
 * Entry point for the entire application
 */

// ===================================== 
// APPLICATION INITIALIZATION
// ===================================== 

/**
 * Initialize application on page load
 */
function initializeApp() {
    console.log('Initializing Lecturer Assessment Tool...');
    
    // Initialize database
    initializeDatabase();
    
    // Restore user session
    const user = restoreUserSession();
    
    // Apply saved settings
    applyAppSettings();
    
    // Render appropriate page
    if (user) {
        // User is logged in - show backend panel
        // Create demo scheme if user has no schemes
        const schemes = getMarkingSchemesForUser(user.id);
        if (schemes.length === 0) {
            console.log('Creating demo marking scheme for user...');
            createDemoMarkingScheme(user.id);
        }
        renderBackendPanel();
        // Check URL hash for initial tab
        const hash = window.location.hash.substring(1); // Remove #
        if (hash && ['schemes', 'students', 'users', 'settings'].includes(hash)) {
            showBackendTab(hash);
        } else {
            showBackendTab('schemes'); // Default
        }
        console.log('Logged in as:', user.username);
    } else {
        // No user session - show login page
        renderLoginPage();
    }
    
    // Set up event listeners
    setupEventListeners();
}

/**
 * Apply saved application settings
 */
function applyAppSettings() {
    const settings = getSettings();
    
    // Apply dark mode if enabled
    if (settings.darkMode) {
        document.body.classList.add('dark-mode');
    }
}

/**
 * Set up global event listeners
 */
function setupEventListeners() {
    // Listen for storage changes (sync across tabs)
    window.addEventListener('storage', (event) => {
        if (event.key === 'currentUser') {
            // User logged in/out in another tab
            location.reload();
        }
    });
}

// ===================================== 
// AUTHENTICATION EVENT HANDLERS
// ===================================== 

/**
 * Handle login form submission
 */
function handleLoginSubmit(event) {
    event.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    const result = loginUser(username, password);
    
    if (result.success) {
        if (result.requiresPasswordChange) {
            // User logged in with default password, password change dialog will be shown
            showNotification(result.message, 'warning');
            return;
        }
        
        showNotification('Login successful', 'success');
        
        // Delay to show notification
        setTimeout(() => {
            // Create demo scheme if user has no schemes
            const schemes = getMarkingSchemesForUser(result.user.id);
            if (schemes.length === 0) {
                console.log('Creating demo marking scheme for new user...');
                createDemoMarkingScheme(result.user.id);
            }
            renderBackendPanel();
        }, 500);
    } else {
        showNotification(result.message + ' User name and password are case sensitive.', 'error');
    }
}

/**
 * Handle registration form submission
 */
function handleRegistrationSubmit(event) {
    event.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    
    const result = registerUser(username, password, confirmPassword);
    
    if (result.success) {
        showNotification(result.message, 'success');
        
        // Auto-login user
        setCurrentUser(result.user);
        
        setTimeout(() => {
            // Create demo scheme for new user
            console.log('Creating demo marking scheme for new user...');
            createDemoMarkingScheme(result.user.id);
            renderBackendPanel();
        }, 500);
    } else {
        showNotification(result.message, 'error');
    }
}

/**
 * Handle user logout
 */
function handleLogout() {
    showConfirmDialog(
        'Are you sure you want to logout?',
        () => {
            logoutUser();
            showNotification('Logged out successfully', 'success');
            
            setTimeout(() => {
                renderLoginPage();
            }, 500);
        },
        null
    );
}

// ===================================== 
// MARKING SCHEME HANDLERS
// ===================================== 

/**
 * Handle creating a new marking scheme
 */
function parseFeedbackText(feedbackText) {
    const feedback = {};
    if (!feedbackText) return feedback;

    feedbackText.split('\n').forEach(line => {
        const [key, ...rest] = line.split(':');
        if (!key || rest.length === 0) return;
        const bandNumber = parseInt(key.trim(), 10);
        if (!isNaN(bandNumber)) {
            feedback[bandNumber] = sanitizeInput(rest.join(':').trim());
        }
    });

    return feedback;
}

function getBandScoresFromForm(form) {
    const bandRows = form.querySelectorAll('.band-row');
    if (!bandRows || bandRows.length === 0) {
        return createDefaultBandScores();
    }

    const bandScores = [];
    bandRows.forEach(row => {
        const bandNumber = parseInt(row.querySelector('.band-number').value, 10);
        const label = sanitizeInput(row.querySelector('.band-label').value);
        const scoreRange = sanitizeInput(row.querySelector('.band-range').value);
        const category = sanitizeInput(row.querySelector('.band-category').value);

        if (!isNaN(bandNumber) && label) {
            bandScores.push({
                id: row.getAttribute('data-band-id') || generateUniqueId(),
                bandNumber: bandNumber,
                label: label,
                scoreRange: scoreRange || '',
                category: category || ''
            });
        }
    });

    return bandScores;
}

function getLearningOutcomesFromForm(form) {
    const loRows = form.querySelectorAll('.lo-row');
    if (!loRows || loRows.length === 0) {
        return createDefaultLearningOutcomes();
    }

    const learningOutcomes = [];
    loRows.forEach(row => {
        const loNumber = sanitizeInput(row.querySelector('.lo-number').value);
        const title = sanitizeInput(row.querySelector('.lo-title').value);
        const keyIndicatorsText = row.querySelector('.lo-key-indicators').value;
        const keyIndicators = keyIndicatorsText ? keyIndicatorsText.split('\n').map(item => sanitizeInput(item.trim())).filter(item => item) : [];

        // Collect feedbacks from individual band feedback inputs
        const feedbacks = {};
        const feedbackInputs = row.querySelectorAll('.band-feedback-input');
        feedbackInputs.forEach(input => {
            const bandNumber = input.getAttribute('data-band-number');
            const feedbackText = sanitizeInput(input.value);
            if (bandNumber && feedbackText) {
                feedbacks[bandNumber] = feedbackText;
            }
        });

        if (loNumber && title) {
            learningOutcomes.push({
                id: row.getAttribute('data-lo-id') || generateUniqueId(),
                loNumber: loNumber,
                title: title,
                description: '', // Keep for backward compatibility, but not used in new UI
                keyIndicators: keyIndicators,
                feedbacks: feedbacks
            });
        }
    });

    return learningOutcomes;
}

function handleCreateMarkingScheme(form) {
    const schemeName = sanitizeInput(form.querySelector('input[name="schemeName"]').value || '');
    const courseName = sanitizeInput(form.querySelector('input[name="courseName"]').value || '');
    const institution = sanitizeInput(form.querySelector('input[name="institution"]').value || '');

    if (!schemeName) {
        showNotification('Scheme name is required', 'error');
        return;
    }

    if (!courseName) {
        showNotification('Course name is required', 'error');
        return;
    }

    const user = getCurrentUser();

    const bandScores = getBandScoresFromForm(form);
    const learningOutcomes = getLearningOutcomesFromForm(form);

    if (learningOutcomes.length === 0) {
        showNotification('At least one learning outcome is required', 'error');
        return;
    }

    const scheme = createMarkingScheme(user.id, {
        schemeName: schemeName,
        institution: institution || 'Not specified',
        courseCode: '',
        courseName: courseName,
        bandScores: bandScores,
        learningOutcomes: learningOutcomes
    });

    if (scheme) {
        showNotification(`Marking scheme "${schemeName}" created successfully!`, 'success');
        setTimeout(() => {
            showBackendTab('schemes');
        }, 500);
    } else {
        showNotification('Error creating marking scheme', 'error');
    }
}

/**
 * Create default band scores for new scheme
 * @returns {array} - Array of band score objects
 */
function createDefaultBandScores() {
    return [
        createBandScore(1, 'Incomplete', '0-9', 'Fail'),
        createBandScore(2, 'Poor', '10-29', 'Fail'),
        createBandScore(3, 'Limited', '30-39', 'Fail'),
        createBandScore(4, 'Basic', '40-49', 'Pass'),
        createBandScore(5, 'Good', '50-59', 'Pass'),
        createBandScore(6, 'Very Good', '60-69', 'Merit'),
        createBandScore(7, 'Excellent', '70-79', 'Distinction'),
        createBandScore(8, 'Outstanding', '80-89', 'Distinction'),
        createBandScore(9, 'Exceptional', '90-100', 'Distinction')
    ];
}

/**
 * Create default learning outcomes for new scheme
 * @returns {array} - Array of learning outcome objects
 */
function createDefaultLearningOutcomes() {
    return [
        createLearningOutcome(
            'LO1',
            'Learning Outcome 1',
            'Add your description for LO1',
            ['Key indicator 1', 'Key indicator 2'],
            {1: 'Feedback for LO1 Band 1', 2: 'Feedback for LO1 Band 2', 3: 'Feedback for LO1 Band 3', 4: 'Feedback for LO1 Band 4', 5: 'Feedback for LO1 Band 5', 6: 'Feedback for LO1 Band 6', 7: 'Feedback for LO1 Band 7', 8: 'Feedback for LO1 Band 8', 9: 'Feedback for LO1 Band 9'}
        ),
        createLearningOutcome(
            'LO2',
            'Learning Outcome 2',
            'Add your description for LO2',
            ['Key indicator 1', 'Key indicator 2'],
            {1: 'Feedback for LO2 Band 1', 2: 'Feedback for LO2 Band 2', 3: 'Feedback for LO2 Band 3', 4: 'Feedback for LO2 Band 4', 5: 'Feedback for LO2 Band 5', 6: 'Feedback for LO2 Band 6', 7: 'Feedback for LO2 Band 7', 8: 'Feedback for LO2 Band 8', 9: 'Feedback for LO2 Band 9'}
        ),
        createLearningOutcome(
            'LO3',
            'Learning Outcome 3',
            'Add your description for LO3',
            ['Key indicator 1', 'Key indicator 2'],
            {1: 'Feedback for LO3 Band 1', 2: 'Feedback for LO3 Band 2', 3: 'Feedback for LO3 Band 3', 4: 'Feedback for LO3 Band 4', 5: 'Feedback for LO3 Band 5', 6: 'Feedback for LO3 Band 6', 7: 'Feedback for LO3 Band 7', 8: 'Feedback for LO3 Band 8', 9: 'Feedback for LO3 Band 9'}
        ),
        createLearningOutcome(
            'LO4',
            'Learning Outcome 4',
            'Add your description for LO4',
            ['Key indicator 1', 'Key indicator 2'],
            {1: 'Feedback for LO4 Band 1', 2: 'Feedback for LO4 Band 2', 3: 'Feedback for LO4 Band 3', 4: 'Feedback for LO4 Band 4', 5: 'Feedback for LO4 Band 5', 6: 'Feedback for LO4 Band 6', 7: 'Feedback for LO4 Band 7', 8: 'Feedback for LO4 Band 8', 9: 'Feedback for LO4 Band 9'}
        )
    ];
}

/**
 * Update all LO feedback sections when band scores change
 */
function updateAllLOFeedbackSections(form) {
    const loRows = form.querySelectorAll('.lo-row');
    loRows.forEach(row => {
        const bandConfigSection = row.querySelector('.band-config-section');
        if (bandConfigSection) {
            // Find the LO data
            const loId = row.getAttribute('data-lo-id');
            const loData = getLODataById(form, loId);

            // Recreate the band feedback inputs
            const bandConfigTitle = bandConfigSection.querySelector('h4');
            if (bandConfigTitle) {
                // Clear existing content except title
                const title = bandConfigTitle.cloneNode(true);
                title.textContent = 'Band Score Feedback';
                bandConfigSection.innerHTML = '';
                bandConfigSection.appendChild(title);

                // Get available bands
                const bandRows = form.querySelectorAll('.band-row');
                const bands = [];
                bandRows.forEach(bandRow => {
                    const bandNumber = bandRow.querySelector('.band-number').value;
                    const bandLabel = bandRow.querySelector('.band-label').value;
                    if (bandNumber && bandLabel) {
                        bands.push({ number: bandNumber, label: bandLabel });
                    }
                });

                // Create feedback inputs for each band
                bands.forEach(band => {
                    const bandItem = document.createElement('div');
                    bandItem.className = 'band-feedback-item';
                    bandItem.style.marginBottom = '10px';
                    bandItem.style.padding = '8px';
                    bandItem.style.backgroundColor = '#f8f9fa';
                    bandItem.style.borderRadius = '4px';

                    const bandLabel = document.createElement('label');
                    bandLabel.textContent = `Band ${band.number} (${band.label})`;
                    bandLabel.style.display = 'block';
                    bandLabel.style.fontWeight = 'bold';
                    bandLabel.style.marginBottom = '5px';

                    const feedbackInput = document.createElement('textarea');
                    feedbackInput.className = 'band-feedback-input';
                    feedbackInput.placeholder = `Enter feedback summary for Band ${band.number}`;
                    feedbackInput.rows = 2;
                    feedbackInput.setAttribute('data-band-number', band.number);

                    // Load existing feedback if available
                    if (loData && loData.feedbacks && loData.feedbacks[band.number]) {
                        feedbackInput.value = loData.feedbacks[band.number];
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
            }
        }
    });
}

/**
 * Get LO data by ID from form
 */
function getLODataById(form, loId) {
    const loRows = form.querySelectorAll('.lo-row');
    for (let row of loRows) {
        if (row.getAttribute('data-lo-id') === loId) {
            return collectLOData(row);
        }
    }
    return null;
}

/**
 * Delete marking scheme with confirmation
 */
function confirmDeleteScheme(schemeId) {
    showConfirmDialog(
        'Are you sure you want to delete this marking scheme? Associated students will be affected.',
        () => {
            const success = deleteMarkingScheme(schemeId);
            if (success) {
                showNotification('Marking scheme deleted', 'success');
                showBackendTab('schemes');
            }
        },
        null
    );
}

// ===================================== 
// STUDENT MANAGEMENT HANDLERS
// ===================================== 

/**
 * Handle adding a new student
 */
function handleAddStudent(form) {
    const inputs = form.querySelectorAll('input');
    const select = form.querySelector('select');
    
    const studentId = inputs[0].value;
    const studentName = inputs[1].value;
    const schemeId = select ? select.value : null;
    
    const student = addStudent(studentId, studentName, schemeId);
    
    if (student) {
        form.reset();
        showBackendTab('students');
    }
}

/**
 * Delete student with confirmation
 */
function confirmDeleteStudent(studentId) {
    const student = getStudentById(studentId);
    
    if (student) {
        removeStudent(studentId);
    }
}

// ===================================== 
// ASSESSMENT HANDLERS
// ===================================== 

/**
 * Start assessment for a student
 */
function startAssessmentForStudent(studentId, schemeId) {
    const session = initializeAssessmentSession(studentId, schemeId);
    
    if (session) {
        renderAssessmentInterface();
    }
}

/**
 * Handle band score selection during assessment
 */
function handleBandScoreSelection(bandNumber, loId) {
    const scheme = getMarkingSchemeById(currentAssessmentSession.markingSchemeId);
    const feedback = getFeedbackForLOAndBand(
        currentAssessmentSession.markingSchemeId,
        loId,
        bandNumber
    );
    
    selectBandScoreForCurrentLO(bandNumber, feedback);
    
    console.log(`Selected band ${bandNumber} for LO ${loId}`);
}

/**
 * Handle moving to next LO
 */
function handleNextLO() {
    const hasNext = moveToNextLO();
    
    if (hasNext) {
        renderAssessmentInterface();
    } else {
        // Assessment complete - show summary
        renderAssessmentSummary();
    }
}

/**
 * Handle moving to previous LO
 */
function handlePreviousLO() {
    const hasPrevious = moveToPreviousLO();
    
    if (hasPrevious) {
        renderAssessmentInterface();
    }
}

/**
 * Handle saving assessment results
 */
function handleSaveAssessment() {
    const result = saveAssessmentResults();
    
    if (result) {
        showNotification('Assessment saved successfully', 'success');
        
        setTimeout(() => {
            clearAssessmentSession();
            renderBackendPanel();
            showBackendTab('students');
        }, 500);
    }
}

/**
 * Handle generating feedforward
 */
async function handleGenerateFeedforwardForStudent(studentId) {
    showNotification('Generating feedforward...', 'info');
    
    const wordLimit = getSettings().feedbackWordLimit;
    const feedforward = await generateStudentFeedforward(studentId, wordLimit);
    
    if (feedforward) {
        showNotification('Feedforward generated successfully', 'success');
        renderFeedforwardDisplay(studentId);
    }
}

/**
 * Handle regenerating feedforward
 */
async function handleRegenerateFeedforward() {
    const session = getCurrentAssessmentSession();
    const wordLimit = getSettings().feedbackWordLimit;
    
    showNotification('Regenerating feedforward...', 'info');
    
    const feedforward = await regenerateFeedforward(session.studentId, 'encouraging', wordLimit);
    
    if (feedforward) {
        showNotification('Feedforward regenerated successfully', 'success');
        renderFeedforwardDisplay(session.studentId);
    }
}

// ===================================== 
// SETTINGS HANDLERS
// ===================================== 

/**
 * Handle dark mode toggle
 */
function handleDarkModeToggle() {
    const isDarkMode = toggleDarkMode();
    
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    showNotification(isDarkMode ? 'Dark mode enabled' : 'Light mode enabled', 'info');
}

/**
 * Handle feedback word limit change
 */
function handleWordLimitChange(newLimit) {
    setFeedbackWordLimit(newLimit);
    showNotification(`Word limit set to ${newLimit}`, 'success');
}

// ===================================== 
// USER MANAGEMENT HANDLERS
// ===================================== 

/**
 * Render student management tab (backend)
 */
function renderStudentsManagementTab(container) {
    const section = createEl('section', 'backend-section');
    
    const heading = createEl('h2');
    heading.textContent = 'Student Management';
    section.appendChild(heading);
    
    const btnContainer = createEl('div', 'button-group');
    
    const addBtn = createEl('button', 'btn btn-primary');
    addBtn.textContent = '+ Add Student';
    addBtn.onclick = () => renderAddStudentForm();
    btnContainer.appendChild(addBtn);
    
    section.appendChild(btnContainer);
    
    // Get student counts
    const counts = getStudentsCounts();
    
    // Stats
    const statsContainer = createEl('div', 'stats-grid');
    
    const totalStat = createEl('div', 'stat-card');
    const totalLabel = createEl('p');
    totalLabel.textContent = 'Total Students';
    const totalValue = createEl('h3');
    totalValue.textContent = counts.total;
    totalStat.appendChild(totalLabel);
    totalStat.appendChild(totalValue);
    statsContainer.appendChild(totalStat);
    
    const accessedStat = createEl('div', 'stat-card');
    const accessedLabel = createEl('p');
    accessedLabel.textContent = 'Assessed';
    const accessedValue = createEl('h3');
    accessedValue.textContent = counts.accessed;
    accessedStat.appendChild(accessedLabel);
    accessedStat.appendChild(accessedValue);
    statsContainer.appendChild(accessedStat);
    
    const notAccessedStat = createEl('div', 'stat-card');
    const notAccessedLabel = createEl('p');
    notAccessedLabel.textContent = 'Pending';
    const notAccessedValue = createEl('h3');
    notAccessedValue.textContent = counts.notAccessed;
    notAccessedStat.appendChild(notAccessedLabel);
    notAccessedStat.appendChild(notAccessedValue);
    statsContainer.appendChild(notAccessedStat);
    
    section.appendChild(statsContainer);
    
    // Student list
    const students = getAllStudents();
    
    if (students.length === 0) {
        const emptyMsg = createEl('p', 'empty-state');
        emptyMsg.textContent = 'No students added yet.';
        section.appendChild(emptyMsg);
    } else {
        const list = createEl('div', 'students-list');
        
        students.forEach(student => {
            const item = createEl('div', 'student-item');
            
            const info = createEl('div', 'student-info');
            const name = createEl('h3');
            name.textContent = student.studentName;
            
            const meta = createEl('p', 'student-meta');
            const idSpan = createEl('span');
            idSpan.textContent = `ID: ${student.studentId} | `;
            const statusBadge = createEl('span', `badge badge-${student.status === 'Accessed' ? 'accessed' : 'not-accessed'}`);
            statusBadge.textContent = student.status;
            meta.appendChild(idSpan);
            meta.appendChild(statusBadge);
            
            info.appendChild(name);
            info.appendChild(meta);
            item.appendChild(info);
            
            const actions = createEl('div', 'student-actions');
            
            if (student.status === 'Accessed') {
                const reviewBtn = createEl('button', 'btn btn-secondary btn-sm');
                reviewBtn.textContent = 'Review';
                reviewBtn.onclick = () => renderStudentReview(student.id);
                actions.appendChild(reviewBtn);
                
                const editBtn = createEl('button', 'btn btn-primary btn-sm');
                editBtn.textContent = 'Edit';
                editBtn.onclick = () => startAssessmentForStudent(student.id, student.markingSchemeId);
                actions.appendChild(editBtn);
            } else {
                const assessBtn = createEl('button', 'btn btn-primary btn-sm');
                assessBtn.textContent = 'Assess';
                assessBtn.onclick = () => startAssessmentForStudent(student.id, student.markingSchemeId);
                actions.appendChild(assessBtn);
            }
            
            const deleteBtn = createEl('button', 'btn btn-danger btn-sm');
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => confirmDeleteStudent(student.id);
            actions.appendChild(deleteBtn);
            
            item.appendChild(actions);
            list.appendChild(item);
        });
        
        section.appendChild(list);
    }
    
    container.appendChild(section);
}

/**
 * Render users management tab
 */
function renderUsersManagementTab(container) {
    const section = createEl('section', 'backend-section');
    
    const heading = createEl('h2');
    heading.textContent = 'User Management';
    section.appendChild(heading);
    
    const users = getAllUsers();
    const currentUser = getCurrentUser();
    
    if (users.length === 0) {
        const emptyMsg = createEl('p', 'empty-state');
        emptyMsg.textContent = 'No users found.';
        section.appendChild(emptyMsg);
    } else {
        const list = createEl('div', 'users-list');
        
        users.forEach(user => {
            const item = createEl('div', 'user-item');
            
            const info = createEl('div', 'user-info');
            const name = createEl('h3');
            name.textContent = user.username;
            if (user.id === currentUser.id) {
                name.textContent += ' (You)';
            }
            
            const meta = createEl('p', 'user-meta');
            meta.textContent = `Created: ${formatDate(user.createdAt)}`;
            if (user.lastLogin) {
                meta.textContent += ` | Last Login: ${formatDate(user.lastLogin)}`;
            }
            
            info.appendChild(name);
            info.appendChild(meta);
            item.appendChild(info);
            
            // Action buttons container
            const actions = createEl('div', 'user-actions');
            
            // Edit Profile button
            const editProfileBtn = createEl('button', 'btn btn-primary btn-sm');
            editProfileBtn.textContent = 'Edit Profile';
            editProfileBtn.onclick = () => showEditProfileDialog(user);
            actions.appendChild(editProfileBtn);
            
            // Edit Password button
            const editPasswordBtn = createEl('button', 'btn btn-warning btn-sm');
            editPasswordBtn.textContent = 'Edit Password';
            editPasswordBtn.onclick = () => showEditPasswordDialog(user);
            actions.appendChild(editPasswordBtn);
            
            // Delete Username button (only for other users)
            if (user.id !== currentUser.id ) {
                const deleteUsernameBtn = createEl('button', 'btn btn-outline-danger btn-sm');
                deleteUsernameBtn.textContent = 'Delete Username';
                deleteUsernameBtn.onclick = () => {
                    showConfirmDialog(
                        `Delete username for ${user.username}? This will set username to empty.`,
                        () => {
                            if (updateUser(user.id, { username: '' })) {
                                showNotification('Username deleted', 'success');
                                showBackendTab('users');
                            } else {
                                showNotification('Failed to delete username', 'error');
                            }
                        },
                        null
                    );
                };
                actions.appendChild(deleteUsernameBtn);
            }
            
            // Delete User button (only for other users)
            if (user.id !== currentUser.id) {
                const deleteBtn = createEl('button', 'btn btn-danger btn-sm');
                deleteBtn.textContent = 'Delete User';
                deleteBtn.onclick = () => {
                    showConfirmDialog(
                        `Delete user ${user.username}? This action cannot be undone.`,
                        () => {
                            deleteUser(user.id);
                            showNotification('User deleted', 'success');
                            showBackendTab('users');
                        },
                        null
                    );
                };
                actions.appendChild(deleteBtn);
            }
            
            item.appendChild(actions);
            list.appendChild(item);
        });
        
        section.appendChild(list);
    }
    
    container.appendChild(section);
}

/**
 * Show edit profile dialog
 */
function showEditProfileDialog(user) {
    const modal = createEl('div', 'modal-overlay');
    const dialog = createEl('div', 'modal-dialog');
    const closeBtn = createEl('button', 'modal-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();
    
    const title = createEl('h2');
    title.textContent = `Edit Profile - ${user.username}`;
    
    const form = createEl('form', 'user-form');
    
    // Username field
    const usernameGroup = createEl('div', 'form-group');
    const usernameLabel = createEl('label');
    usernameLabel.textContent = 'Username';
    const usernameInput = createEl('input', 'form-control');
    usernameInput.type = 'text';
    usernameInput.value = user.username;
    usernameInput.required = true;
    usernameGroup.appendChild(usernameLabel);
    usernameGroup.appendChild(usernameInput);
    
    // Last Login display (read-only)
    const lastLoginGroup = createEl('div', 'form-group');
    const lastLoginLabel = createEl('label');
    lastLoginLabel.textContent = 'Last Login';
    const lastLoginInput = createEl('input', 'form-control');
    lastLoginInput.type = 'text';
    lastLoginInput.value = user.lastLogin ? formatDate(user.lastLogin) : 'Never';
    lastLoginInput.readOnly = true;
    lastLoginGroup.appendChild(lastLoginLabel);
    lastLoginGroup.appendChild(lastLoginInput);
    
    // Created date display (read-only)
    const createdGroup = createEl('div', 'form-group');
    const createdLabel = createEl('label');
    createdLabel.textContent = 'Created';
    const createdInput = createEl('input', 'form-control');
    createdInput.type = 'text';
    createdInput.value = formatDate(user.createdAt);
    createdInput.readOnly = true;
    createdGroup.appendChild(createdLabel);
    createdGroup.appendChild(createdInput);
    
    form.appendChild(usernameGroup);
    form.appendChild(lastLoginGroup);
    form.appendChild(createdGroup);
    
    form.onsubmit = (e) => {
        e.preventDefault();
        const newUsername = sanitizeInput(usernameInput.value);
        
        if (!newUsername) {
            showNotification('Username is required', 'error');
            return;
        }
        
        if (updateUser(user.id, { username: newUsername })) {
            showNotification('Profile updated successfully', 'success');
            modal.remove();
            showBackendTab('users');
        } else {
            showNotification('Failed to update profile', 'error');
        }
    };
    
    const buttonGroup = createEl('div', 'form-buttons');
    const saveBtn = createEl('button', 'btn btn-primary');
    saveBtn.type = 'submit';
    saveBtn.textContent = 'Save Changes';
    const cancelBtn = createEl('button', 'btn btn-secondary');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => modal.remove();
    
    buttonGroup.appendChild(saveBtn);
    buttonGroup.appendChild(cancelBtn);
    form.appendChild(buttonGroup);
    
    dialog.appendChild(closeBtn);
    dialog.appendChild(title);
    dialog.appendChild(form);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

/**
 * Show edit username dialog
 */
function showEditUsernameDialog(user) {
    const modal = createEl('div', 'modal-overlay');
    const dialog = createEl('div', 'modal-dialog');
    const closeBtn = createEl('button', 'modal-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();
    
    const title = createEl('h2');
    title.textContent = `Edit Username - ${user.username}`;
    
    const form = createEl('form', 'user-form');
    
    const usernameGroup = createEl('div', 'form-group');
    const usernameLabel = createEl('label');
    usernameLabel.textContent = 'New Username';
    const usernameInput = createEl('input', 'form-control');
    usernameInput.type = 'text';
    usernameInput.value = user.username;
    usernameInput.required = true;
    usernameInput.placeholder = 'Enter new username';
    usernameGroup.appendChild(usernameLabel);
    usernameGroup.appendChild(usernameInput);
    
    form.appendChild(usernameGroup);
    
    form.onsubmit = (e) => {
        e.preventDefault();
        const newUsername = sanitizeInput(usernameInput.value);
        
        if (!newUsername) {
            showNotification('Username is required', 'error');
            return;
        }
        
        if (updateUser(user.id, { username: newUsername })) {
            showNotification('Username updated successfully', 'success');
            modal.remove();
            showBackendTab('users');
        } else {
            showNotification('Failed to update username', 'error');
        }
    };
    
    const buttonGroup = createEl('div', 'form-buttons');
    const saveBtn = createEl('button', 'btn btn-primary');
    saveBtn.type = 'submit';
    saveBtn.textContent = 'Update Username';
    const cancelBtn = createEl('button', 'btn btn-secondary');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => modal.remove();
    
    buttonGroup.appendChild(saveBtn);
    buttonGroup.appendChild(cancelBtn);
    form.appendChild(buttonGroup);
    
    dialog.appendChild(closeBtn);
    dialog.appendChild(title);
    dialog.appendChild(form);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

/**
 * Show edit password dialog
 */
function showEditPasswordDialog(user) {
    const modal = createEl('div', 'modal-overlay');
    const dialog = createEl('div', 'modal-dialog');
    const closeBtn = createEl('button', 'modal-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();
    
    const title = createEl('h2');
    title.textContent = `Change Password - ${user.username}`;
    
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
            showNotification('New passwords do not match', 'error');
            return;
        }
        
        if (updateUser(user.id, { password: newPassword })) {
            showNotification('Password updated successfully', 'success');
            modal.remove();
            showBackendTab('users');
        } else {
            showNotification('Failed to update password', 'error');
        }
    };
    
    const buttonGroup = createEl('div', 'form-buttons');
    const saveBtn = createEl('button', 'btn btn-primary');
    saveBtn.type = 'submit';
    saveBtn.textContent = 'Update Password';
    const cancelBtn = createEl('button', 'btn btn-secondary');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => modal.remove();
    
    buttonGroup.appendChild(saveBtn);
    buttonGroup.appendChild(cancelBtn);
    form.appendChild(buttonGroup);
    
    dialog.appendChild(closeBtn);
    dialog.appendChild(title);
    dialog.appendChild(form);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

/**
 * Show reset password dialog
 */
function showResetPasswordDialog(user) {
    const modal = createEl('div', 'modal-overlay');
    const dialog = createEl('div', 'modal-dialog');
    const closeBtn = createEl('button', 'modal-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();
    
    const title = createEl('h2');
    title.textContent = `Reset Password - ${user.username}`;
    
    const message = createEl('p');
    message.textContent = 'This will reset the password to a default value. The user will need to change it upon next login.';
    
    const form = createEl('form', 'user-form');
    
    const defaultPasswordGroup = createEl('div', 'form-group');
    const defaultPasswordLabel = createEl('label');
    defaultPasswordLabel.textContent = 'Default Password';
    const defaultPasswordInput = createEl('input', 'form-control');
    defaultPasswordInput.type = 'text';
    defaultPasswordInput.value = 'password123';
    defaultPasswordInput.required = true;
    defaultPasswordGroup.appendChild(defaultPasswordLabel);
    defaultPasswordGroup.appendChild(defaultPasswordInput);
    
    form.appendChild(message);
    form.appendChild(defaultPasswordGroup);
    
    form.onsubmit = (e) => {
        e.preventDefault();
        const defaultPassword = defaultPasswordInput.value;
        
        if (!defaultPassword) {
            showNotification('Default password is required', 'error');
            return;
        }
        
        if (updateUser(user.id, { password: defaultPassword })) {
            showNotification('Password reset successfully', 'success');
            modal.remove();
            showBackendTab('users');
        } else {
            showNotification('Failed to reset password', 'error');
        }
    };
    
    const buttonGroup = createEl('div', 'form-buttons');
    const resetBtn = createEl('button', 'btn btn-warning');
    resetBtn.type = 'submit';
    resetBtn.textContent = 'Reset Password';
    const cancelBtn = createEl('button', 'btn btn-secondary');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => modal.remove();
    
    buttonGroup.appendChild(resetBtn);
    buttonGroup.appendChild(cancelBtn);
    form.appendChild(buttonGroup);
    
    dialog.appendChild(closeBtn);
    dialog.appendChild(title);
    dialog.appendChild(form);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

/**
 * Render settings tab
 */
function renderSettingsTab(container) {
    const section = createEl('section', 'backend-section');
    
    const heading = createEl('h2');
    heading.textContent = 'Settings';
    section.appendChild(heading);
    
    const settings = getSettings();
    
    // Dark mode toggle
    const darkModeDiv = createEl('div', 'setting-item');
    
    const darkModeLabel = createEl('label');
    darkModeLabel.textContent = 'Dark Mode';
    darkModeDiv.appendChild(darkModeLabel);
    
    const darkModeToggle = createEl('input', '', {
        type: 'checkbox',
        checked: settings.darkMode ? 'checked' : ''
    });
    darkModeToggle.onchange = () => handleDarkModeToggle();
    darkModeDiv.appendChild(darkModeToggle);
    
    section.appendChild(darkModeDiv);
    
    // Word limit setting
    const wordLimitDiv = createEl('div', 'setting-item');
    
    const wordLimitLabel = createEl('label');
    wordLimitLabel.textContent = `Feedforward Word Limit (Current: ${settings.feedbackWordLimit})`;
    wordLimitDiv.appendChild(wordLimitLabel);
    
    const wordLimitInput = createEl('input', '', {
        type: 'number',
        value: settings.feedbackWordLimit,
        min: '50',
        max: '500'
    });
    wordLimitInput.onchange = () => handleWordLimitChange(parseInt(wordLimitInput.value));
    wordLimitDiv.appendChild(wordLimitInput);
    
    section.appendChild(wordLimitDiv);
    
    container.appendChild(section);
}

/**
 * Render add student form
 */
function renderAddStudentForm() {
    const modal = createEl('div', 'modal-overlay');
    
    const dialog = createEl('div', 'modal-dialog');
    
    const closeBtn = createEl('button', 'modal-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();
    dialog.appendChild(closeBtn);
    
    const title = createEl('h2');
    title.textContent = 'Add Student';
    dialog.appendChild(title);
    
    const form = createEl('form');
    form.onsubmit = (e) => {
        e.preventDefault();
        
        // Get form values
        const inputs = form.querySelectorAll('input');
        const select = form.querySelector('select');
        
        const studentId = sanitizeInput(inputs[0].value);
        const studentName = sanitizeInput(inputs[1].value);
        const schemeId = select ? select.value : null;
        
        // VALIDATION
        // Student ID is COMPULSORY
        if (!studentId) {
            showNotification('Student ID is required', 'error');
            return;
        }
        
        // Student Name is OPTIONAL - no validation needed
        
        // Marking Scheme is COMPULSORY
        if (!schemeId) {
            showNotification('Marking scheme is required', 'error');
            return;
        }
        
        // Try to add student
        const student = addStudent(studentId, studentName || `Student-${studentId}`, schemeId);
        
        if (student) {
            form.reset();
            modal.remove();
            showBackendTab('students');
        }
    };
    
    // Student ID (COMPULSORY)
    const idLabel = createEl('label');
    idLabel.textContent = 'Student ID *';
    const idInput = createEl('input', '', { 
        type: 'text', 
        required: 'true', 
        placeholder: 'e.g., SID123456',
        id: 'student-id-input'
    });
    // Add focus event to clear placeholder
    idInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    form.appendChild(idLabel);
    form.appendChild(idInput);
    
    // Student Name (OPTIONAL)
    const nameLabel = createEl('label');
    nameLabel.textContent = 'Student Name (Optional)';
    const nameInput = createEl('input', '', { 
        type: 'text', 
        placeholder: 'Full name (optional)',
        id: 'student-name-input'
    });
    // Add focus event to clear placeholder
    nameInput.addEventListener('focus', function() {
        if (this.placeholder) {
            this.placeholder = '';
        }
    });
    form.appendChild(nameLabel);
    form.appendChild(nameInput);
    
    // Marking Scheme (COMPULSORY)
    const schemeLabel = createEl('label');
    schemeLabel.textContent = 'Marking Scheme *';
    const schemeSelect = createEl('select', '', { required: 'true' });
    
    const defaultOption = createEl('option', '', { value: '' });
    defaultOption.textContent = 'Select a scheme...';
    schemeSelect.appendChild(defaultOption);
    
    const user = getCurrentUser();
    const schemes = getMarkingSchemesForUser(user.id);
    
    if (schemes.length === 0) {
        const noSchemeOption = createEl('option', '', { value: '', disabled: 'true' });
        noSchemeOption.textContent = 'No schemes available - create one first';
        schemeSelect.appendChild(noSchemeOption);
    } else {
        schemes.forEach(scheme => {
            const option = createEl('option', '', { value: scheme.id });
            option.textContent = scheme.schemeName;
            schemeSelect.appendChild(option);
        });
    }
    
    form.appendChild(schemeLabel);
    form.appendChild(schemeSelect);
    
    // Submit
    const submitBtn = createEl('button', 'btn btn-primary btn-full');
    submitBtn.textContent = 'Add Student';
    submitBtn.type = 'submit';
    form.appendChild(submitBtn);
    
    dialog.appendChild(form);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

// ===================================== 
// STUB UI FUNCTIONS (To be implemented)
// ===================================== 

function renderEditMarkingSchemeForm(schemeId) {
    const scheme = getMarkingSchemeById(schemeId);
    if (!scheme) {
        showNotification('Marking scheme not found', 'error');
        return;
    }

    const modal = createEl('div', 'modal-overlay');
    const dialog = createEl('div', 'modal-dialog');
    const closeBtn = createEl('button', 'modal-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();
    dialog.appendChild(closeBtn);

    const title = createEl('h2');
    title.textContent = 'Edit Marking Scheme';
    dialog.appendChild(title);

    const form = createEl('form', 'scheme-form');
    form.onsubmit = (e) => {
        e.preventDefault();

        const schemeName = sanitizeInput(form.querySelector('input[name="schemeName"]').value);
        const courseName = sanitizeInput(form.querySelector('input[name="courseName"]').value);
        const institution = sanitizeInput(form.querySelector('input[name="institution"]').value);
        const bandScores = getBandScoresFromForm(form);
        const learningOutcomes = getLearningOutcomesFromForm(form);

        if (!schemeName || !courseName) {
            showNotification('Scheme name and course name are required', 'error');
            return;
        }

        if (learningOutcomes.length === 0) {
            showNotification('At least one learning outcome is required', 'error');
            return;
        }

        updateMarkingScheme(schemeId, {
            schemeName: schemeName,
            institution: institution || 'Not specified',
            courseName: courseName,
            bandScores: bandScores,
            learningOutcomes: learningOutcomes
        });

        showNotification('Marking scheme updated', 'success');
        modal.remove();
        showBackendTab('schemes');
    };

    const schemeNameLabel = createEl('label');
    schemeNameLabel.textContent = 'Scheme Name *';
    const schemeNameInput = createEl('input', '', {
        type: 'text',
        name: 'schemeName',
        required: 'true',
        value: scheme.schemeName
    });
    form.appendChild(schemeNameLabel);
    form.appendChild(schemeNameInput);

    const courseLabel = createEl('label');
    courseLabel.textContent = 'Course Name *';
    const courseInput = createEl('input', '', {
        type: 'text',
        name: 'courseName',
        required: 'true',
        value: scheme.courseName
    });
    form.appendChild(courseLabel);
    form.appendChild(courseInput);

    const institutionLabel = createEl('label');
    institutionLabel.textContent = 'Institution (Optional)';
    const institutionInput = createEl('input', '', {
        type: 'text',
        name: 'institution',
        value: scheme.institution
    });
    form.appendChild(institutionLabel);
    form.appendChild(institutionInput);

    const bandSection = createEl('div', 'scheme-subsection');
    const bandHeading = createEl('h3');
    bandHeading.textContent = 'Band Scores';
    bandSection.appendChild(bandHeading);

    const bandContainer = createEl('div', 'band-list');
    bandSection.appendChild(bandContainer);
    scheme.bandScores.forEach(bandScore => addBandScoreRow(bandContainer, bandScore));

    // Button container for band score actions
    const bandButtonContainer = createEl('div', 'band-buttons');
    bandButtonContainer.style.display = 'flex';
    bandButtonContainer.style.gap = '10px';
    bandButtonContainer.style.marginTop = '10px';

    const addBandBtn = createEl('button', 'btn btn-secondary btn-sm');
    addBandBtn.textContent = '+ Add Band Score';
    addBandBtn.onclick = (e) => {
        e.preventDefault();
        addBandScoreRow(bandContainer);
        // Trigger update of LO feedback sections
        updateAllLOFeedbackSections(form);
    };

    const saveBandBtn = createEl('button', 'btn btn-success btn-sm');
    saveBandBtn.textContent = 'Save Band Scores';
    saveBandBtn.onclick = (e) => {
        e.preventDefault();
        // Save band scores and update all LO feedback sections
        updateAllLOFeedbackSections(form);
        saveBandBtn.textContent = 'Saved ✓';
        saveBandBtn.style.backgroundColor = '#28a745';
        setTimeout(() => {
            saveBandBtn.textContent = 'Save Band Scores';
            saveBandBtn.style.backgroundColor = '';
        }, 2000);
    };

    bandButtonContainer.appendChild(addBandBtn);
    bandButtonContainer.appendChild(saveBandBtn);
    bandSection.appendChild(bandButtonContainer);

    form.appendChild(bandSection);

    const loSection = createEl('div', 'scheme-subsection');
    const loHeading = createEl('h3');
    loHeading.textContent = 'Learning Outcomes';
    loSection.appendChild(loHeading);

    const loContainer = createEl('div', 'lo-list');
    loSection.appendChild(loContainer);
    scheme.learningOutcomes.forEach(lo => addLearningOutcomeRow(loContainer, lo));

    const addLoBtn = createEl('button', 'btn btn-secondary btn-sm');
    addLoBtn.textContent = '+ Add Learning Outcome';
    addLoBtn.onclick = (e) => {
        e.preventDefault();
        addLearningOutcomeRow(loContainer);
    };
    loSection.appendChild(addLoBtn);

    form.appendChild(loSection);

    const saveBtn = createEl('button', 'btn btn-primary');
    saveBtn.textContent = 'Save Changes';
    saveBtn.type = 'submit';
    form.appendChild(saveBtn);

    dialog.appendChild(form);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

function renderAssessmentInterface() {
    const session = getCurrentAssessmentSession();
    if (!session || !session.studentId || !session.markingSchemeId) {
        showNotification('No active assessment session. Select a student to assess.', 'warning');
        showBackendTab('students');
        return;
    }

    const student = getStudentById(session.studentId);
    if (!student) {
        showNotification('Student not found', 'error');
        return;
    }

    const scheme = getMarkingSchemeById(session.markingSchemeId);
    if (!scheme) {
        showNotification('Marking scheme not found for this student', 'error');
        return;
    }

    const currentLO = getCurrentLearningOutcome();

    if (!currentLO) {
        renderAssessmentSummary();
        return;
    }

    const main = document.getElementById('app');
    clearElement(main);

    const container = createEl('div', 'assessment-page');

    const header = createEl('div', 'assessment-header');
    const title = createEl('h2');
    const isEditing = Object.keys(session.selections).length > 0;
    title.textContent = `${isEditing ? 'Editing' : 'Assessing'} Student ID: ${student.studentId} (${session.studentName})`;
    const sub = createEl('p');
    sub.textContent = `${scheme.schemeName} | ${scheme.courseName}`;
    header.appendChild(title);
    header.appendChild(sub);

    const progress = getAssessmentProgress();
    const progressText = createEl('p');
    progressText.textContent = `Progress: ${progress.completed}/${progress.total} LOs completed`;
    header.appendChild(progressText);

    container.appendChild(header);

    const content = createEl('div', 'assessment-content');
    content.style.display = 'flex';
    content.style.gap = '20px';
    content.style.flex = '1';

    // LO on the left
    const loSection = createEl('div', 'lo-section');
    loSection.style.flex = '1';
    const loCard = createEl('div', 'assessment-lo-card');
    const loTitle = createEl('h3');
    loTitle.textContent = `${currentLO.loNumber}: ${currentLO.title}`;
    const loDesc = createEl('p');
    loDesc.textContent = currentLO.description || 'No description provided.';
    const feedbackHint = createEl('p', 'small');
    feedbackHint.textContent = 'Select a band score to apply and view mapped feedback.';
    loCard.appendChild(loTitle);
    loCard.appendChild(loDesc);
    loCard.appendChild(feedbackHint);
    loSection.appendChild(loCard);
    content.appendChild(loSection);

    // Band scores on the right
    const bandSection = createEl('div', 'band-section');
    bandSection.style.flex = '1';
    const bandCard = createEl('div', 'assessment-lo-card');
    const bandTitle = createEl('h3');
    bandTitle.textContent = 'Band Scores';
    bandCard.appendChild(bandTitle);

    const bandGrid = createEl('div', 'band-grid');
    scheme.bandScores.forEach(band => {
        const bandBtn = createEl('button', `btn band-option ${getBandScoreSelectionForLO(currentLO.id) && getBandScoreSelectionForLO(currentLO.id).bandNumber === band.bandNumber ? 'selected' : ''}`);
        bandBtn.textContent = `${band.bandNumber} - ${band.label} (${band.scoreRange || 'range N/A'})`;
        bandBtn.onclick = () => {
            handleBandScoreSelection(band.bandNumber, currentLO.id);
            renderAssessmentInterface();
        };
        bandGrid.appendChild(bandBtn);
    });
    bandCard.appendChild(bandGrid);

    const selected = getBandScoreSelectionForLO(currentLO.id);
    const selectedFeedback = createEl('div', 'selected-feedback');
    selectedFeedback.innerHTML = `<strong>Selected Band:</strong> ${selected ? selected.bandNumber : 'None'}<br><strong>Feedback:</strong> ${selected ? selected.feedback : 'No selection yet'}`;
    bandCard.appendChild(selectedFeedback);

    bandSection.appendChild(bandCard);
    content.appendChild(bandSection);

    container.appendChild(content);

    // Navigation buttons at bottom center
    const nav = createEl('div', 'assessment-nav button-group');
    const prevBtn = createEl('button', 'btn btn-secondary');
    prevBtn.textContent = 'Previous';
    prevBtn.onclick = () => { handlePreviousLO(); };
    prevBtn.disabled = session.currentLOIndex === 0;

    const nextBtn = createEl('button', 'btn btn-secondary');
    nextBtn.textContent = session.currentLOIndex === session.learningOutcomes.length - 1 ? 'Finish' : 'Next';
    nextBtn.onclick = () => { handleNextLO(); };

    const saveBtn = createEl('button', 'btn btn-primary');
    saveBtn.textContent = 'Save Assessment';
    saveBtn.onclick = () => { handleSaveAssessment(); };
    saveBtn.disabled = getAssessmentProgress().percentage < 100;

    const cancelBtn = createEl('button', 'btn btn-danger');
    cancelBtn.textContent = 'Cancel & Back';
    cancelBtn.onclick = () => {
        clearAssessmentSession();
        renderBackendPanel();
        showBackendTab('students');
    };

    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    nav.appendChild(saveBtn);
    nav.appendChild(cancelBtn);

    container.appendChild(nav);
    main.appendChild(container);
}

function renderAssessmentSummary() {
    const session = getCurrentAssessmentSession();
    if (!session) {
        showNotification('No assessment in progress', 'warning');
        showBackendTab('students');
        return;
    }

    const student = getStudentById(session.studentId);
    if (!student) {
        showNotification('Student not found', 'error');
        return;
    }

    const summary = getAssessmentSummary();
    const progress = getAssessmentProgress();

    const main = document.getElementById('app');
    clearElement(main);

    const container = createEl('div', 'assessment-summary');

    const title = createEl('h2');
    title.textContent = `Assessment Summary for Student ID: ${student.studentId}`;
    container.appendChild(title);

    summary.forEach(item => {
        const row = createEl('div', 'summary-row');
        row.innerHTML = `<strong>${item.loNumber} - ${item.loTitle}</strong><br>` +
            `Selected band: ${item.selection ? item.selection.bandNumber : 'not set'}<br>` +
            `Feedback: ${item.selection ? item.selection.feedback : 'N/A'}<br>`;
        container.appendChild(row);
    });

    const buttonGroup = createEl('div', 'button-group');
    buttonGroup.style.justifyContent = 'center';
    buttonGroup.style.marginTop = '30px';
    buttonGroup.style.gap = '15px';

    const editBtn = createEl('button', 'btn btn-secondary');
    editBtn.textContent = 'Edit Assessment';
    editBtn.onclick = () => {
        const session = getCurrentAssessmentSession();
        if (session) {
            session.currentLOIndex = 0;
        }
        renderAssessmentInterface();
    };

    const saveBtn = createEl('button', 'btn btn-primary');
    saveBtn.textContent = 'Save Assessment';
    saveBtn.onclick = () => {
        handleSaveAssessment();
        showBackendTab('students');
    };
    saveBtn.disabled = progress.percentage < 100;

    const generateBtn = createEl('button', 'btn btn-success');
    generateBtn.textContent = 'Generate Feedforward';
    generateBtn.onclick = () => {
        handleGenerateFeedforward();
    };
    generateBtn.disabled = progress.percentage < 100;

    const backBtn = createEl('button', 'btn btn-secondary');
    backBtn.textContent = 'Back to Students';
    backBtn.onclick = () => {
        clearAssessmentSession();
        renderBackendPanel();
        showBackendTab('students');
    };

    buttonGroup.appendChild(editBtn);
    buttonGroup.appendChild(saveBtn);
    buttonGroup.appendChild(generateBtn);
    buttonGroup.appendChild(backBtn);

    container.appendChild(buttonGroup);
    main.appendChild(container);
}

function renderStudentReview(studentId) {
    const student = getStudentById(studentId);
    if (!student) {
        showNotification('Student not found', 'error');
        return;
    }

    const result = getFormattedAssessmentForDisplay(studentId);
    if (!result) {
        showNotification('No assessment data available for this student', 'warning');
        return;
    }

    const main = document.getElementById('app');
    clearElement(main);

    const container = createEl('div', 'assessment-summary');

    const title = createEl('h2');
    title.textContent = `Assessment Review for Student ID: ${student.studentId}`;
    container.appendChild(title);

    const details = createEl('p');
    details.textContent = `Completed on ${result.completedAt}`;
    container.appendChild(details);

    result.loResults.forEach(item => {
        const row = createEl('div', 'summary-row');
        row.innerHTML = `<strong>${item.loNumber}: ${item.loTitle}</strong><br>` +
            `Band ${item.bandNumber} (${item.bandLabel}): ${item.feedback}<br>`;
        container.appendChild(row);
    });

    const buttonGroup = createEl('div', 'button-group');
    buttonGroup.style.justifyContent = 'center';
    buttonGroup.style.marginTop = '30px';
    buttonGroup.style.padding = '20px';

    const generateBtn = createEl('button', 'btn btn-success');
    generateBtn.textContent = 'Generate Feedforward';
    generateBtn.onclick = () => {
        handleGenerateFeedforwardForStudent(studentId);
    };

    const backBtn = createEl('button', 'btn btn-secondary');
    backBtn.textContent = 'Back to Students';
    backBtn.onclick = () => {
        renderBackendPanel();
        showBackendTab('students');
    };

    buttonGroup.appendChild(generateBtn);
    buttonGroup.appendChild(backBtn);

    container.appendChild(buttonGroup);
    main.appendChild(container);
}

// ===================================== 
// APP START// ===================================== 

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
