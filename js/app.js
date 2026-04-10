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
    // Apply saved settings (dark mode etc.) immediately
    applyAppSettings();
    // Set up global event listeners
    setupEventListeners();
    // Rendering (login page / backend panel) is driven by
    // onAuthStateChanged in firebase-config.js — not here.
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
async function handleLoginSubmit(event) {
    event.preventDefault();

    const email    = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const result = await loginUser(email, password);

    if (!result.success) {
        showNotification(result.message, 'error');
    }
    // On success, onAuthStateChanged in firebase-config.js takes over
    // and renders the backend panel automatically
}

/**
 * Handle registration form submission
 */
async function handleRegistrationSubmit(event) {
    event.preventDefault();

    const email           = document.getElementById('register-email').value;
    const password        = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;

    const result = await registerUser(email, password, confirmPassword);

    if (result.success) {
        showNotification(result.message, 'success');
        // onAuthStateChanged fires automatically and renders the backend panel
    } else {
        showNotification(result.message, 'error');
    }
}

/**
 * Handle Google sign-in
 */
async function handleGoogleSignIn() {
    const result = await googleSignIn();
    if (!result.success && result.message) {
        showNotification(result.message, 'error');
    }
    // On success, onAuthStateChanged handles rendering
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
                    if (bandNumber) {
                        bands.push({ number: bandNumber, label: bandLabel || `Band ${bandNumber}` });
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

/**
 * Duplicate a marking scheme — deep copies bands & LOs with fresh IDs
 */
function duplicateMarkingScheme(schemeId) {
    const original = getMarkingSchemeById(schemeId);
    if (!original) {
        showNotification('Scheme not found', 'error');
        return;
    }

    const user = getCurrentUser();

    // Deep-copy band scores with new IDs
    const bandScores = (original.bandScores || []).map(b => ({
        id: generateUniqueId(),
        bandNumber: b.bandNumber,
        label: b.label,
        scoreRange: b.scoreRange,
        category: b.category
    }));

    // Deep-copy learning outcomes with new IDs (feedbacks are plain objects — spread is fine)
    const learningOutcomes = (original.learningOutcomes || []).map(lo => ({
        id: generateUniqueId(),
        loNumber: lo.loNumber,
        title: lo.title,
        keyIndicators: lo.keyIndicators ? [...lo.keyIndicators] : [],
        feedbacks: lo.feedbacks ? Object.assign({}, lo.feedbacks) : {}
    }));

    const copy = createMarkingScheme(user.id, {
        schemeName:  `Copy of ${original.schemeName}`,
        institution: original.institution || '',
        courseCode:  original.courseCode  || '',
        courseName:  original.courseName  || '',
        bandScores,
        learningOutcomes
    });

    if (copy) {
        showNotification(`"${copy.schemeName}" created`, 'success');
        showBackendTab('schemes');
    }
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
            renderAssessmentSummary();
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
 * Returns the computed student score exactly as shown on the Review page.
 * Returns { markText: "40.0 / 40", category: "Distinction" } or null if no data.
 */
function _computeStudentScoreDisplay(studentId) {
    const result = getFormattedAssessmentForDisplay(studentId);
    if (!result || !result.loResults || result.loResults.length === 0) return null;

    const rawResult = getAssessmentResult(studentId);
    const gradeScheme = rawResult ? getMarkingSchemeById(rawResult.markingSchemeId) : null;
    if (!gradeScheme) return null;

    const midpoints = result.loResults.map(item => {
        const bandScore = (gradeScheme.bandScores || []).find(
            b => b.bandNumber === Number(item.bandNumber)
        );
        if (!bandScore || !bandScore.scoreRange) return null;
        const parts = bandScore.scoreRange.split('-').map(Number);
        return (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) ? parts[1] : null;
    }).filter(v => v !== null);

    if (midpoints.length === 0) return null;

    const avgNumeric = midpoints.reduce((s, v) => s + v, 0) / midpoints.length;
    if (gradeScheme.overallGrade == null || gradeScheme.overallGrade === '') return null;

    const studentMark = (avgNumeric / 100) * Number(gradeScheme.overallGrade);

    // Find category band
    const s = Math.round(avgNumeric);
    let category = null;
    for (const b of (gradeScheme.bandScores || [])) {
        const p = (b.scoreRange || '').split('-').map(Number);
        if (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1]) && s >= p[0] && s <= p[1]) {
            category = b.category || null;
            break;
        }
    }

    return {
        markText: studentMark.toFixed(1) + ' / ' + gradeScheme.overallGrade,
        category: category
    };
}

// Persists the active scheme selection across re-renders
let _activeSchemeId = null;

// Tracks which student internal IDs are checked for bulk actions
let _selectedStudentIds = new Set();

// Student list filter / sort / search state
let _studentFilter = 'all';     // 'all' | 'accessed' | 'not-accessed'
let _studentSort   = 'date-desc'; // 'date-asc' | 'date-desc' | 'name-asc' | 'name-desc'
let _studentSearch = '';
let _studentScrollHandler = null; // tracks mobile scroll-away listener

/**
 * Render student management tab (backend)
 */
function renderStudentsManagementTab(container) {
    const currentUser = getCurrentUser();
    const schemes = currentUser ? getMarkingSchemesForUser(currentUser.id) : [];

    // Default or reset active scheme
    if (!_activeSchemeId || !schemes.find(s => s.id === _activeSchemeId)) {
        _activeSchemeId = schemes.length > 0 ? schemes[0].id : null;
    }

    const section = createEl('section', 'backend-section students-section');

    // ── Sticky header ──────────────────────────────────────────────────────
    const stickyHeader = createEl('div', 'students-sticky-header');

    const headingRow = createEl('div', 'students-heading-row');
    const heading = createEl('h2');
    heading.textContent = 'Student Management';
    headingRow.appendChild(heading);

    // Button group: Bulk Actions + Add Student
    const headerBtns = createEl('div', 'students-header-btns');

    const selCount = _selectedStudentIds.size;
    const bulkBtn = createEl('button', `btn btn-secondary bulk-actions-btn${selCount > 0 ? ' bulk-actions-btn--active' : ''}`);
    bulkBtn.textContent = selCount > 0 ? `Bulk Actions (${selCount})` : 'Bulk Actions';
    bulkBtn.disabled = selCount === 0;
    bulkBtn.onclick = () => _showBulkActionsDialog(schemes, () => {
        clearElement(container);
        renderStudentsManagementTab(container);
    });
    headerBtns.appendChild(bulkBtn);

    const addBtn = createEl('button', 'btn btn-primary');
    addBtn.textContent = '+ Add Student';
    addBtn.onclick = () => renderAddStudentForm();
    headerBtns.appendChild(addBtn);

    headingRow.appendChild(headerBtns);
    stickyHeader.appendChild(headingRow);

    // ── Scheme tabs (scroll-away on mobile) ───────────────────────────────
    const scrollAway = createEl('div', 'students-scroll-away');

    if (schemes.length > 0) {
        const tabsRow = createEl('div', 'scheme-tabs');
        schemes.forEach(scheme => {
            const tab = createEl('button', `scheme-tab${scheme.id === _activeSchemeId ? ' scheme-tab--active' : ''}`);
            tab.textContent = scheme.schemeName || 'Unnamed Scheme';
            tab.onclick = () => {
                _activeSchemeId = scheme.id;
                _selectedStudentIds.clear();
                _studentSearch = '';
                clearElement(container);
                renderStudentsManagementTab(container);
            };
            tabsRow.appendChild(tab);
        });
        scrollAway.appendChild(tabsRow);
    }

    // ── Filter students by active scheme ───────────────────────────────────
    const allStudents = getAllStudents();
    const students = _activeSchemeId
        ? allStudents.filter(s => s.markingSchemeId === _activeSchemeId)
        : allStudents;

    const accessedCount = students.filter(s => s.status === 'Accessed').length;
    const pendingCount  = students.filter(s => s.status !== 'Accessed').length;

    // ── Apply search / filter / sort ──────────────────────────────────────
    let displayStudents = students;
    if (_studentSearch.trim()) {
        const q = _studentSearch.trim().toLowerCase();
        displayStudents = displayStudents.filter(s =>
            s.studentName.toLowerCase().includes(q) ||
            s.studentId.toLowerCase().includes(q)
        );
    }
    if (_studentFilter === 'accessed') {
        displayStudents = displayStudents.filter(s => s.status === 'Accessed');
    } else if (_studentFilter === 'not-accessed') {
        displayStudents = displayStudents.filter(s => s.status !== 'Accessed');
    }
    displayStudents = [...displayStudents].sort((a, b) => {
        if (_studentSort === 'name-asc')  return a.studentName.localeCompare(b.studentName);
        if (_studentSort === 'name-desc') return b.studentName.localeCompare(a.studentName);
        if (_studentSort === 'date-asc')  return new Date(a.createdAt) - new Date(b.createdAt);
        return new Date(b.createdAt) - new Date(a.createdAt); // date-desc default
    });

    // ── Stats bar ─────────────────────────────────────────────────────────
    const statsBar = createEl('div', 'students-stats-bar');
    [
        { label: 'Total Students', value: students.length, cls: 'stat--total' },
        { label: 'Assessed',       value: accessedCount,   cls: 'stat--assessed' },
        { label: 'Pending',        value: pendingCount,    cls: 'stat--pending'  },
    ].forEach(({ label, value, cls }) => {
        const card = createEl('div', `students-stat-card ${cls}`);
        const val  = createEl('span', 'stat-value');
        val.textContent = value;
        const lbl  = createEl('span', 'stat-label');
        lbl.textContent = label;
        card.appendChild(val);
        card.appendChild(lbl);
        statsBar.appendChild(card);
    });
    stickyHeader.appendChild(statsBar);

    // ── Controls bar (select-all · search · filter · sort) ────────────────
    const controlsBar = createEl('div', 'students-controls-bar');

    // Left: Select-All checkbox (only when students exist in scheme)
    const controlsLeft = createEl('div', 'students-controls-left');
    if (students.length > 0) {
        const allChecked = displayStudents.length > 0 && displayStudents.every(s => _selectedStudentIds.has(s.id));
        const someChecked = displayStudents.some(s => _selectedStudentIds.has(s.id));
        const selectAllCb = createEl('input');
        selectAllCb.type = 'checkbox';
        selectAllCb.className = 'bulk-checkbox';
        selectAllCb.id = 'select-all-cb';
        selectAllCb.checked = allChecked;
        selectAllCb.indeterminate = !allChecked && someChecked;
        selectAllCb.onchange = () => {
            if (selectAllCb.checked) {
                displayStudents.forEach(s => _selectedStudentIds.add(s.id));
            } else {
                displayStudents.forEach(s => _selectedStudentIds.delete(s.id));
            }
            clearElement(container);
            renderStudentsManagementTab(container);
        };
        const selectAllLabel = createEl('label', 'select-all-label');
        selectAllLabel.htmlFor = 'select-all-cb';
        selectAllLabel.textContent = allChecked ? 'Deselect All' : 'Select All';
        controlsLeft.appendChild(selectAllCb);
        controlsLeft.appendChild(selectAllLabel);
    }
    controlsBar.appendChild(controlsLeft);

    // Center: Search input
    const controlsCenter = createEl('div', 'students-controls-center');
    const searchWrap = createEl('div', 'student-search-wrap');
    const searchInput = createEl('input');
    searchInput.type = 'text';
    searchInput.id = 'student-search-input';
    searchInput.className = 'student-search-input';
    searchInput.placeholder = 'Search by Name or ID…';
    searchInput.value = _studentSearch;
    searchInput.oninput = () => {
        _studentSearch = searchInput.value;
        clearElement(container);
        renderStudentsManagementTab(container);
        const refocused = document.getElementById('student-search-input');
        if (refocused) {
            refocused.focus();
            refocused.setSelectionRange(refocused.value.length, refocused.value.length);
        }
    };
    searchWrap.appendChild(searchInput);
    controlsCenter.appendChild(searchWrap);
    controlsBar.appendChild(controlsCenter);

    // Right: Filter button group + Sort select
    const controlsRight = createEl('div', 'students-controls-right');

    const filterGroup = createEl('div', 'student-filter-group');
    [
        { value: 'all',          label: 'All'      },
        { value: 'accessed',     label: 'Assessed' },
        { value: 'not-accessed', label: 'Pending'  },
    ].forEach(({ value, label }) => {
        const btn = createEl('button', `student-filter-btn${_studentFilter === value ? ' student-filter-btn--active' : ''}`);
        btn.textContent = label;
        btn.onclick = () => {
            _studentFilter = value;
            clearElement(container);
            renderStudentsManagementTab(container);
        };
        filterGroup.appendChild(btn);
    });
    controlsRight.appendChild(filterGroup);

    const sortSelect = createEl('select', 'student-sort-select');
    [
        { value: 'date-desc', label: 'Date ↓ Newest' },
        { value: 'date-asc',  label: 'Date ↑ Oldest' },
        { value: 'name-asc',  label: 'Name A → Z'    },
        { value: 'name-desc', label: 'Name Z → A'    },
    ].forEach(({ value, label }) => {
        const opt = createEl('option');
        opt.value = value;
        opt.textContent = label;
        if (_studentSort === value) opt.selected = true;
        sortSelect.appendChild(opt);
    });
    sortSelect.onchange = () => {
        _studentSort = sortSelect.value;
        clearElement(container);
        renderStudentsManagementTab(container);
    };
    controlsRight.appendChild(sortSelect);
    controlsBar.appendChild(controlsRight);

    scrollAway.appendChild(controlsBar);

    section.appendChild(stickyHeader);
    section.appendChild(scrollAway);

    // ── Mobile scroll-away animation ───────────────────────────────────────
    if (_studentScrollHandler) {
        window.removeEventListener('scroll', _studentScrollHandler);
        _studentScrollHandler = null;
    }
    if (window.innerWidth <= 600) {
        let lastScrollY = window.scrollY;
        _studentScrollHandler = () => {
            const y = window.scrollY;
            const goingDown = y > lastScrollY;
            lastScrollY = y;
            const threshold = stickyHeader.offsetHeight || 80;
            if (goingDown && y > threshold) {
                scrollAway.classList.add('students-scroll-away--hidden');
            } else if (!goingDown) {
                scrollAway.classList.remove('students-scroll-away--hidden');
            }
        };
        window.addEventListener('scroll', _studentScrollHandler, { passive: true });
    }

    // ── Student list ───────────────────────────────────────────────────────
    if (students.length === 0) {
        const emptyMsg = createEl('p', 'empty-state');
        emptyMsg.textContent = schemes.length === 0
            ? 'No marking schemes created yet. Create a scheme first.'
            : 'No students added to this scheme yet.';
        section.appendChild(emptyMsg);
    } else if (displayStudents.length === 0) {
        const noResults = createEl('p', 'empty-state');
        noResults.textContent = _studentSearch.trim()
            ? `No students match "${_studentSearch.trim()}".`
            : 'No students match the current filter.';
        section.appendChild(noResults);
    } else {
        const list = createEl('div', 'students-list');

        displayStudents.forEach(student => {
            const isSelected = _selectedStudentIds.has(student.id);
            const item = createEl('div', `student-item${isSelected ? ' student-item--selected' : ''}`);

            // Checkbox
            const cbWrap = createEl('div', 'student-cb-wrap');
            const cb = createEl('input');
            cb.type = 'checkbox';
            cb.className = 'bulk-checkbox';
            cb.checked = isSelected;
            cb.onchange = () => {
                if (cb.checked) _selectedStudentIds.add(student.id);
                else _selectedStudentIds.delete(student.id);
                clearElement(container);
                renderStudentsManagementTab(container);
            };
            cbWrap.appendChild(cb);
            item.appendChild(cbWrap);

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

            // Score inline — only for accessed students
            if (student.status === 'Accessed') {
                const scoreData = _computeStudentScoreDisplay(student.id);
                if (scoreData) {
                    const scoreSpan = createEl('span', 'student-score');
                    scoreSpan.textContent = ` | ${scoreData.markText} `;
                    meta.appendChild(scoreSpan);
                    if (scoreData.category) {
                        const catBadge = createEl('span', `grade-category-badge grade-category-badge--${scoreData.category.toLowerCase()}`);
                        catBadge.textContent = scoreData.category;
                        meta.appendChild(catBadge);
                    }
                }
            }

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

// =====================================================
// BULK ACTIONS
// =====================================================

function _showBulkActionsDialog(schemes, onDone) {
    const count = _selectedStudentIds.size;
    if (count === 0) return;

    const modal = createEl('div', 'modal-overlay');
    const dialog = createEl('div', 'modal-dialog');
    dialog.style.maxWidth = '400px';

    const closeBtn = createEl('button', 'modal-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();
    dialog.appendChild(closeBtn);

    const title = createEl('h2');
    title.textContent = `Bulk Actions`;
    dialog.appendChild(title);

    const desc = createEl('p');
    desc.style.cssText = 'color:var(--text-secondary);font-size:14px;margin-bottom:20px';
    desc.textContent = `${count} student${count !== 1 ? 's' : ''} selected. Choose an action:`;
    dialog.appendChild(desc);

    const optionsWrap = createEl('div', 'bulk-action-options');

    // Copy to Scheme
    const copyBtn = createEl('button', 'btn btn-primary bulk-action-option');
    copyBtn.textContent = '📋  Copy to Another Scheme';
    copyBtn.onclick = () => { modal.remove(); _showCopyToSchemeDialog(schemes, onDone); };
    optionsWrap.appendChild(copyBtn);

    // Bulk Delete
    const delBtn = createEl('button', 'btn btn-danger bulk-action-option');
    delBtn.textContent = '🗑  Delete Selected Students';
    delBtn.onclick = () => { modal.remove(); _handleBulkDelete(onDone); };
    optionsWrap.appendChild(delBtn);

    dialog.appendChild(optionsWrap);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

function _handleBulkDelete(onDone) {
    const count = _selectedStudentIds.size;
    if (count === 0) return;

    showConfirmDialog(
        `Delete ${count} student${count !== 1 ? 's' : ''}? Their assessment results will also be removed. This cannot be undone.`,
        () => {
            let deleted = 0;
            _selectedStudentIds.forEach(id => { if (deleteStudent(id)) deleted++; });
            _selectedStudentIds.clear();
            showNotification(`${deleted} student${deleted !== 1 ? 's' : ''} deleted`, 'success');
            onDone();
        },
        null
    );
}

function _showCopyToSchemeDialog(schemes, onDone) {
    const otherSchemes = schemes.filter(s => s.id !== _activeSchemeId);

    if (otherSchemes.length === 0) {
        showNotification('No other marking schemes available. Create another scheme first.', 'warning');
        return;
    }

    const count = _selectedStudentIds.size;
    const modal = createEl('div', 'modal-overlay');
    const dialog = createEl('div', 'modal-dialog');
    dialog.style.maxWidth = '440px';

    const closeBtn = createEl('button', 'modal-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();
    dialog.appendChild(closeBtn);

    const title = createEl('h2');
    title.textContent = 'Copy Students to Scheme';
    dialog.appendChild(title);

    const desc = createEl('p');
    desc.style.cssText = 'color:var(--text-secondary);font-size:14px;margin-bottom:20px';
    desc.textContent = `${count} student${count !== 1 ? 's' : ''} will be copied to the selected scheme as Pending with no prior assessment data — the lecturer will assess them fresh.`;
    dialog.appendChild(desc);

    const label = createEl('label');
    label.textContent = 'Target scheme:';
    label.style.cssText = 'display:block;font-weight:600;margin-bottom:6px';
    dialog.appendChild(label);

    const select = createEl('select', 'form-input');
    select.style.cssText = 'width:100%;margin-bottom:24px';
    otherSchemes.forEach(scheme => {
        const opt = createEl('option', '', { value: scheme.id });
        opt.textContent = scheme.schemeName || 'Unnamed Scheme';
        select.appendChild(opt);
    });
    dialog.appendChild(select);

    const btnRow = createEl('div', 'button-group');

    const confirmBtn = createEl('button', 'btn btn-primary');
    confirmBtn.textContent = 'Copy Students';
    confirmBtn.onclick = () => {
        const targetId = select.value;
        const targetScheme = getMarkingSchemeById(targetId);
        if (!targetScheme) return;

        // Existing student IDs (by studentId field) in the target scheme
        const existingIds = new Set(
            getAllStudents()
                .filter(s => s.markingSchemeId === targetId)
                .map(s => s.studentId)
        );

        let copied = 0, skipped = 0;
        _selectedStudentIds.forEach(internalId => {
            const student = getStudentById(internalId);
            if (!student) { skipped++; return; }
            if (existingIds.has(student.studentId)) {
                skipped++;
            } else {
                createStudent(student.studentId, student.studentName, targetId);
                copied++;
            }
        });

        _selectedStudentIds.clear();
        modal.remove();

        let msg = `${copied} student${copied !== 1 ? 's' : ''} copied to "${targetScheme.schemeName}"`;
        if (skipped > 0) msg += ` · ${skipped} skipped (already in scheme)`;
        showNotification(msg, copied > 0 ? 'success' : 'warning');
        onDone();
    };

    const cancelBtn = createEl('button', 'btn btn-secondary');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => modal.remove();

    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(cancelBtn);
    dialog.appendChild(btnRow);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
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
            
            // Avatar
            item.appendChild(_renderAvatarCircle(user.avatar || 'av1', 44));

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

            // Delete own account (only for the current user)
            if (user.id === currentUser.id) {
                const deleteSelfBtn = createEl('button', 'btn btn-danger btn-sm');
                deleteSelfBtn.textContent = 'Delete User';
                deleteSelfBtn.onclick = () => _showDeleteSelfDialog(user);
                actions.appendChild(deleteSelfBtn);
            }

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
 * Fully delete a user's Firestore data AND their Firebase Auth account
 */
async function _deleteAccountFromFirebase(uid) {
    const { getDocs, deleteDoc, collection, doc } = window._firebaseFns;
    const db   = window._db;
    const auth = window._auth;

    // 1. Delete all documents in every Firestore sub-collection
    const cols = ['markingSchemes', 'students', 'assessmentResults'];
    for (const col of cols) {
        const snap = await getDocs(collection(db, `users/${uid}/${col}`));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    }

    // 2. Delete single documents
    await deleteDoc(doc(db, `users/${uid}/settings/app`)).catch(() => {});
    await deleteDoc(doc(db, `users/${uid}/profile/data`)).catch(() => {});

    // 3. Delete the Firebase Auth account (prevents re-login)
    if (auth && auth.currentUser) {
        await auth.currentUser.delete();
    }
}

/**
 * Confirmation dialog before deleting own account and logging out
 */
function _showDeleteSelfDialog(user) {
    const overlay = createEl('div', 'modal-overlay');
    const dialog  = createEl('div', 'modal-dialog');

    const title = createEl('h3');
    title.textContent = 'Delete Your Account';
    title.style.cssText = 'margin:0 0 10px; color:#dc3545;';

    const warning = createEl('p');
    warning.innerHTML = `<strong>This action is permanent and cannot be undone.</strong><br><br>
        Deleting your account will:<br>
        &bull; Permanently remove your profile and credentials<br>
        &bull; Delete all your marking schemes and student records<br>
        &bull; Immediately log you out<br><br>
        Are you sure you want to delete <strong>${user.username || user.email}</strong>?`;
    warning.style.cssText = 'font-size:14px; line-height:1.6; color:var(--text-primary); margin:0 0 20px;';

    // Confirmation input — user must type DELETE
    const confirmLabel = createEl('label');
    confirmLabel.textContent = 'Type DELETE to confirm:';
    confirmLabel.style.cssText = 'font-size:13px; font-weight:600; display:block; margin-bottom:6px;';

    const confirmInput = createEl('input', 'form-control');
    confirmInput.placeholder = 'DELETE';
    confirmInput.style.marginBottom = '16px';

    const btnRow = createEl('div', 'form-buttons');

    const cancelBtn = createEl('button', 'btn btn-secondary');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => overlay.remove();

    const deleteBtn = createEl('button', 'btn btn-danger');
    deleteBtn.textContent = 'Delete My Account';
    deleteBtn.disabled = true;

    confirmInput.oninput = () => {
        deleteBtn.disabled = confirmInput.value.trim() !== 'DELETE';
    };

    deleteBtn.onclick = async () => {
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Deleting…';
        try {
            await _deleteAccountFromFirebase(user.id);
            overlay.remove();
            showNotification('Account deleted. Logging out…', 'warning', 3000);
            setTimeout(() => logoutUser(), 1500);
        } catch (err) {
            console.error('Account deletion error:', err);
            if (err.code === 'auth/requires-recent-login') {
                showNotification('For security, please log out and log back in, then try again.', 'error', 5000);
            } else {
                showNotification('Failed to delete account. Please try again.', 'error');
            }
            deleteBtn.disabled = false;
            deleteBtn.textContent = 'Delete My Account';
        }
    };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(deleteBtn);

    dialog.appendChild(title);
    dialog.appendChild(warning);
    dialog.appendChild(confirmLabel);
    dialog.appendChild(confirmInput);
    dialog.appendChild(btnRow);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

/**
 * Show edit profile dialog
 */
// Predefined avatar options (emoji + background colour)
const PROFILE_AVATARS = [
    { id: 'av1',  emoji: '👤', bg: '#4285f4' },
    { id: 'av2',  emoji: '👩‍💼', bg: '#e53935' },
    { id: 'av3',  emoji: '👨‍💼', bg: '#43a047' },
    { id: 'av4',  emoji: '👩‍🏫', bg: '#8e24aa' },
    { id: 'av5',  emoji: '👨‍🏫', bg: '#0097a7' },
    { id: 'av6',  emoji: '👩‍🎓', bg: '#f57c00' },
    { id: 'av7',  emoji: '👨‍🎓', bg: '#c62828' },
    { id: 'av8',  emoji: '🦁',  bg: '#6d4c41' },
    { id: 'av9',  emoji: '🦊',  bg: '#e64a19' },
    { id: 'av10', emoji: '🦅',  bg: '#00695c' },
    { id: 'av11', emoji: '🦉',  bg: '#5e35b1' },
    { id: 'av12', emoji: '🐺',  bg: '#37474f' },
];

function _renderAvatarCircle(avatarId, size) {
    const av = PROFILE_AVATARS.find(a => a.id === avatarId) || PROFILE_AVATARS[0];
    const el = createEl('div', 'avatar-circle');
    el.style.cssText = `width:${size}px;height:${size}px;background:${av.bg};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.48)}px;flex-shrink:0;`;
    el.textContent = av.emoji;
    return el;
}

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

    // Email display (read-only)
    const emailGroup = createEl('div', 'form-group');
    const emailLabel = createEl('label');
    emailLabel.textContent = 'Email';
    const emailInput = createEl('input', 'form-control');
    emailInput.type = 'text';
    emailInput.value = user.email || 'No email on record';
    emailInput.readOnly = true;
    emailGroup.appendChild(emailLabel);
    emailGroup.appendChild(emailInput);

    // Avatar selector
    let selectedAvatarId = user.avatar || 'av1';

    const avatarGroup = createEl('div', 'form-group');
    const avatarLabel = createEl('label');
    avatarLabel.textContent = 'Profile Avatar';
    avatarGroup.appendChild(avatarLabel);

    const avatarPreviewRow = createEl('div', 'avatar-preview-row');
    const avatarPreview = _renderAvatarCircle(selectedAvatarId, 64);
    avatarPreview.classList.add('avatar-preview-large');
    avatarPreviewRow.appendChild(avatarPreview);

    const avatarGrid = createEl('div', 'avatar-grid');
    PROFILE_AVATARS.forEach(av => {
        const circle = createEl('div', `avatar-option${av.id === selectedAvatarId ? ' avatar-option--selected' : ''}`);
        circle.style.cssText = `background:${av.bg};`;
        circle.textContent = av.emoji;
        circle.title = av.id;
        circle.onclick = () => {
            selectedAvatarId = av.id;
            // Update preview
            const previewAv = PROFILE_AVATARS.find(a => a.id === av.id);
            avatarPreview.style.background = previewAv.bg;
            avatarPreview.textContent = previewAv.emoji;
            // Update selected state
            avatarGrid.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('avatar-option--selected'));
            circle.classList.add('avatar-option--selected');
        };
        avatarGrid.appendChild(circle);
    });

    avatarPreviewRow.appendChild(avatarGrid);
    avatarGroup.appendChild(avatarPreviewRow);

    form.appendChild(avatarGroup);
    form.appendChild(usernameGroup);
    form.appendChild(emailGroup);
    form.appendChild(lastLoginGroup);
    form.appendChild(createdGroup);

    form.onsubmit = (e) => {
        e.preventDefault();
        const newUsername = sanitizeInput(usernameInput.value);

        if (!newUsername) {
            showNotification('Username is required', 'error');
            return;
        }

        if (updateUser(user.id, { username: newUsername, avatar: selectedAvatarId })) {
            // Keep currentUser in sync
            const cu = getCurrentUser();
            if (cu && cu.id === user.id) {
                cu.avatar = selectedAvatarId;
                cu.username = newUsername;
                cu.displayName = newUsername;
            }
            // Update header avatar + welcome text instantly
            const welcomeWrap = document.querySelector('.header-welcome');
            if (welcomeWrap && cu) {
                clearElement(welcomeWrap);
                welcomeWrap.appendChild(_renderAvatarCircle(cu.avatar || 'av1', 40));
                const welcomeText = createEl('span', 'header-welcome-text');
                welcomeText.textContent = `Welcome, ${cu.displayName || cu.username || cu.email}`;
                welcomeWrap.appendChild(welcomeText);
            }
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

    const toggleSwitch = createEl('button', `toggle-switch${settings.darkMode ? ' toggle-switch--on' : ''}`);
    toggleSwitch.setAttribute('aria-label', 'Toggle dark mode');
    const toggleKnob = createEl('span', 'toggle-knob');
    toggleSwitch.appendChild(toggleKnob);
    toggleSwitch.onclick = () => {
        handleDarkModeToggle();
        toggleSwitch.classList.toggle('toggle-switch--on');
    };
    darkModeDiv.appendChild(toggleSwitch);

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

    // Session timeout setting
    const timeoutDiv = createEl('div', 'setting-item');
    const timeoutLabel = createEl('label');
    timeoutLabel.textContent = 'Session Timeout (Min 30-Sec)';
    timeoutDiv.appendChild(timeoutLabel);
    const timeoutInput = createEl('input', '', { type: 'number', min: '30', max: '7200' });
    timeoutInput.value = settings.sessionTimeoutSeconds || 30;
    timeoutInput.onchange = () => {
        const val = parseInt(timeoutInput.value);
        if (val >= 30 && val <= 7200) {
            updateSettings({ sessionTimeoutSeconds: val });
            showNotification(`Session timeout updated to ${val} seconds`, 'success');
            initSessionTimeout(); // apply new value immediately
        } else {
            showNotification('Timeout must be between 30 and 7200 seconds', 'error');
            timeoutInput.value = settings.sessionTimeoutSeconds || 30;
        }
    };
    timeoutDiv.appendChild(timeoutInput);
    section.appendChild(timeoutDiv);

    container.appendChild(section);
}

// =====================================================
// SESSION TIMEOUT
// =====================================================

let _sessionTimeoutId  = null;
let _sessionWarningId  = null;
let _sessionActive     = false;
let _sessionLastReset  = 0; // throttle activity resets

function initSessionTimeout() {
    _sessionActive = true;
    _resetSessionTimer();
    _setupActivityListeners();
}

// Activity events reset the timer — but ONLY when the warning is not yet visible.
// Once the warning appears, only the "Stay Logged In" button can dismiss it.
function _onUserActivity() {
    if (!_sessionActive) return;
    if (document.getElementById('session-warning-modal')) return; // warning showing — wait for button
    const now = Date.now();
    if (now - _sessionLastReset < 10000) return; // throttle: max one reset per 10 s
    _sessionLastReset = now;
    _resetSessionTimer();
}

const _ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

function _setupActivityListeners() {
    _ACTIVITY_EVENTS.forEach(evt =>
        document.addEventListener(evt, _onUserActivity, { passive: true })
    );
}

function _teardownSessionListeners() {
    _ACTIVITY_EVENTS.forEach(evt =>
        document.removeEventListener(evt, _onUserActivity)
    );
}

function _resetSessionTimer() {
    if (!_sessionActive) return;
    if (_sessionTimeoutId) clearTimeout(_sessionTimeoutId);
    if (_sessionWarningId) clearTimeout(_sessionWarningId);

    // The warning is only removed by the "Stay Logged In" button — never by activity.

    const settings = getSettings();
    const totalMs  = Math.max((settings.sessionTimeoutSeconds || 30), 30) * 1000;
    const warnMs   = Math.min(15 * 1000, totalMs * 0.25); // warn 15s before (or 25% of total)

    // Only schedule a new warning if one isn't already visible
    if (!document.getElementById('session-warning-modal')) {
        _sessionWarningId = setTimeout(_showSessionWarning, totalMs - warnMs);
    }
    _sessionTimeoutId = setTimeout(_handleSessionTimeout, totalMs);
}

function clearSessionTimeout() {
    _sessionActive = false;
    _teardownSessionListeners();
    if (_sessionTimeoutId) { clearTimeout(_sessionTimeoutId); _sessionTimeoutId = null; }
    if (_sessionWarningId) { clearTimeout(_sessionWarningId); _sessionWarningId = null; }
    const existing = document.getElementById('session-warning-modal');
    if (existing) existing.remove();
}

function _showSessionWarning() {
    if (!_sessionActive) return;
    const existing = document.getElementById('session-warning-modal');
    if (existing) existing.remove();

    const overlay = createEl('div', 'session-warning-overlay');
    overlay.id = 'session-warning-modal';
    const box = createEl('div', 'session-warning-box');
    const icon = createEl('div', 'session-warning-icon');
    icon.textContent = '⏱';
    const msg = createEl('p', 'session-warning-msg');
    msg.textContent = 'Your session is about to expire due to inactivity.';
    const stayBtn = createEl('button', 'btn btn-primary');
    stayBtn.textContent = 'Stay Logged In';
    stayBtn.onclick = () => {
        overlay.remove();
        _resetSessionTimer();
    };
    box.appendChild(icon);
    box.appendChild(msg);
    box.appendChild(stayBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

async function _handleSessionTimeout() {
    // Capture any in-progress work BEFORE clearing the session
    saveUnsavedWork();
    clearSessionTimeout();
    showNotification('Session expired due to inactivity. Logging out…', 'warning', 4000);
    setTimeout(async () => {
        try {
            const { signOut } = window._firebaseFns;
            await signOut(window._auth);
        } catch (e) {
            console.error('Session timeout logout error:', e);
        }
    }, 1500);
}

// =====================================================
// UNSAVED WORK — Session State Persistence
// =====================================================

const _UNSAVED_WORK_PREFIX = 'unsaved_work_';

/**
 * Capture in-progress work: active assessment session and/or open scheme form.
 * Returns a state object or null if nothing meaningful to save.
 */
function _captureUnsavedWork() {
    const user = getCurrentUser();
    if (!user) return null;

    const state = {
        uid: user.id,
        savedAt: new Date().toISOString(),
        currentTab: window.location.hash.substring(1) || 'schemes',
        assessment: null,
        scheme: null
    };

    // 1. Check for active assessment session
    const session = getCurrentAssessmentSession();
    if (session && session.studentId) {
        state.assessment = {
            studentId: session.studentId,
            studentName: session.studentName,
            markingSchemeId: session.markingSchemeId,
            currentLOIndex: session.currentLOIndex,
            selections: deepCopy(session.selections),
            startedAt: session.startedAt
        };
    }

    // 2. Check for an open scheme form in the DOM
    const schemeForm = document.querySelector('.scheme-form');
    if (schemeForm) {
        const isCreate = schemeForm.classList.contains('manual-form');
        const schemeId = schemeForm.dataset.schemeId || null;
        const nameEl = schemeForm.querySelector('input[name="schemeName"]');
        const courseEl = schemeForm.querySelector('input[name="courseName"]');
        const schemeName = nameEl ? nameEl.value.trim() : '';
        const courseName = courseEl ? courseEl.value.trim() : '';

        // Only worth saving if user typed something or it's an edit
        if (schemeName || courseName || schemeId) {
            state.scheme = {
                type: isCreate ? 'create' : 'edit',
                schemeId: schemeId,
                schemeName: schemeName,
                courseName: courseName
            };
        }
    }

    return (state.assessment || state.scheme) ? state : null;
}

/**
 * Save unsaved work to localStorage.
 */
function saveUnsavedWork() {
    const state = _captureUnsavedWork();
    if (!state) return;
    try {
        localStorage.setItem(_UNSAVED_WORK_PREFIX + state.uid, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save unsaved work:', e);
    }
}

/**
 * Clear saved unsaved-work entry for a user.
 */
function clearUnsavedWork(uid) {
    localStorage.removeItem(_UNSAVED_WORK_PREFIX + uid);
}

/**
 * Check for saved unsaved work on login. If found, show a resume prompt.
 */
function checkUnsavedWork(uid) {
    let state = null;
    try {
        const raw = localStorage.getItem(_UNSAVED_WORK_PREFIX + uid);
        if (raw) state = JSON.parse(raw);
    } catch (e) {
        console.error('Failed to read unsaved work:', e);
    }
    if (!state) return;

    // Build a human-readable description
    const parts = [];
    if (state.assessment) {
        const selCount = Object.keys(state.assessment.selections || {}).length;
        parts.push(`assessment for ${state.assessment.studentName || 'a student'}` +
            (selCount > 0 ? ` (${selCount} band${selCount !== 1 ? 's' : ''} selected)` : ''));
    }
    if (state.scheme) {
        const label = state.scheme.schemeName || 'untitled scheme';
        parts.push(state.scheme.type === 'create'
            ? `new marking scheme "${label}" (unsaved)`
            : `marking scheme "${label}" (editing)`);
    }

    _showResumePrompt(state, parts.join(' and '));
}

function _showResumePrompt(state, description) {
    // Don't stack multiple prompts
    const existing = document.getElementById('resume-work-modal');
    if (existing) existing.remove();

    const overlay = createEl('div', 'modal-overlay');
    overlay.id = 'resume-work-modal';
    const dialog = createEl('div', 'modal-dialog');
    dialog.style.cssText = 'max-width:440px;text-align:center;padding:32px 28px';

    const icon = createEl('div');
    icon.style.cssText = 'font-size:2.4rem;margin-bottom:12px';
    icon.textContent = '📋';

    const heading = createEl('h2');
    heading.style.cssText = 'margin:0 0 12px;font-size:1.2rem';
    heading.textContent = 'Unsaved Work Found';

    const msg = createEl('p');
    msg.style.cssText = 'margin:0 0 24px;color:var(--text-secondary);font-size:14px;line-height:1.5';
    msg.textContent = `Your last session timed out while you were working on: ${description}. Would you like to resume where you left off?`;

    const btnRow = createEl('div', 'button-group');
    btnRow.style.justifyContent = 'center';

    const resumeBtn = createEl('button', 'btn btn-primary');
    resumeBtn.textContent = 'Resume Work';
    resumeBtn.onclick = () => { overlay.remove(); _resumeUnsavedWork(state); };

    const discardBtn = createEl('button', 'btn btn-secondary');
    discardBtn.textContent = 'Discard';
    discardBtn.onclick = () => { overlay.remove(); clearUnsavedWork(state.uid); };

    btnRow.appendChild(resumeBtn);
    btnRow.appendChild(discardBtn);
    dialog.appendChild(icon);
    dialog.appendChild(heading);
    dialog.appendChild(msg);
    dialog.appendChild(btnRow);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}

/**
 * Restore saved state when user clicks "Resume Work".
 */
function _resumeUnsavedWork(state) {
    clearUnsavedWork(state.uid);

    // Prefer resuming assessment over scheme (assessment is more stateful)
    if (state.assessment) {
        const s = state.assessment;
        const student = getStudentById(s.studentId);
        const scheme  = getMarkingSchemeById(s.markingSchemeId);
        if (student && scheme) {
            initializeAssessmentSession(s.studentId, s.markingSchemeId);
            // Overwrite with the saved progress
            const session = getCurrentAssessmentSession();
            session.currentLOIndex = s.currentLOIndex || 0;
            session.selections     = s.selections || {};
            session.startedAt      = s.startedAt;
            showBackendTab('students');
            renderAssessmentInterface();
            return;
        }
        showNotification('Could not restore assessment — student or scheme no longer exists.', 'warning');
    }

    if (state.scheme) {
        showBackendTab('schemes');
        if (state.scheme.type === 'edit' && state.scheme.schemeId) {
            setTimeout(() => renderEditMarkingSchemeForm(state.scheme.schemeId), 150);
        } else {
            setTimeout(() => renderCreateMarkingSchemeForm(), 150);
        }
        return;
    }

    // Fallback — navigate to the tab that was active
    showBackendTab(state.currentTab || 'schemes');
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
    form.dataset.schemeId = schemeId; // used by saveUnsavedWork to identify edit vs. create
    form.onsubmit = (e) => {
        e.preventDefault();

        const schemeName = sanitizeInput(form.querySelector('input[name="schemeName"]').value);
        const courseName = sanitizeInput(form.querySelector('input[name="courseName"]').value);
        const institution = sanitizeInput(form.querySelector('input[name="institution"]').value);
        const overallGradeVal = form.querySelector('input[name="overallGrade"]').value;
        const overallGrade = overallGradeVal !== '' ? Number(overallGradeVal) : null;
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
            overallGrade: overallGrade,
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

    const overallGradeLabel = createEl('label');
    overallGradeLabel.textContent = 'Overall grade for this scheme submission';
    const overallGradeInput = createEl('input', '', {
        type: 'number',
        name: 'overallGrade',
        min: '0',
        placeholder: 'e.g., 75'
    });
    overallGradeInput.value = scheme.overallGrade != null ? scheme.overallGrade : '';
    form.appendChild(overallGradeLabel);
    form.appendChild(overallGradeInput);

    const bandSection = createEl('div', 'scheme-subsection');
    const bandHeading = createEl('h3');
    bandHeading.textContent = 'Band Scores';
    bandSection.appendChild(bandHeading);

    const bandContainer = createEl('div', 'band-list');
    bandSection.appendChild(bandContainer);

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
        updateAllLOFeedbackSections(form);
    };

    const saveBandBtn = createEl('button', 'btn btn-success btn-sm');
    saveBandBtn.textContent = 'Save Band Scores';
    saveBandBtn.onclick = (e) => {
        e.preventDefault();
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

    // Append band section to form BEFORE adding rows so closest('form') works
    form.appendChild(bandSection);
    scheme.bandScores.forEach(bandScore => addBandScoreRow(bandContainer, bandScore));

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

    // Append LO section to form BEFORE adding rows so closest('form') works
    form.appendChild(loSection);
    scheme.learningOutcomes.forEach(lo => addLearningOutcomeRow(loContainer, lo));

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

    renderAppHeader();
    const main = document.getElementById('app-content');
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

    // LO on the left
    const loSection = createEl('div', 'lo-section');
    const loCard = createEl('div', 'assessment-lo-card');
    const loTitle = createEl('h3', 'panel-heading');
    loTitle.textContent = `${currentLO.loNumber}: ${currentLO.title}`;
    const feedbackHint = createEl('p', 'assessment-hint');
    feedbackHint.textContent = 'Select a band score to apply and view mapped feedback.';
    loCard.appendChild(loTitle);
    loCard.appendChild(feedbackHint);
    loSection.appendChild(loCard);
    content.appendChild(loSection);

    // Band scores on the right
    const bandSection = createEl('div', 'band-section');
    const bandCard = createEl('div', 'assessment-lo-card');
    const bandTitle = createEl('h3', 'panel-heading');
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

    renderAppHeader();
    const main = document.getElementById('app-content');
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

    const buttonGroup = createEl('div', 'assessment-nav');

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
    saveBtn.textContent = 'Review Assessment';
    saveBtn.onclick = () => {
        const result = saveAssessmentResults();
        if (result) {
            showNotification('Assessment saved successfully', 'success');
            const studentId = session.studentId;
            setTimeout(() => {
                clearAssessmentSession();
                renderStudentReview(studentId);
            }, 500);
        }
    };
    saveBtn.disabled = progress.percentage < 100;

    const backBtn = createEl('button', 'btn btn-secondary');
    backBtn.textContent = 'Back to Students';
    backBtn.onclick = () => {
        clearAssessmentSession();
        renderBackendPanel();
        showBackendTab('students');
    };

    buttonGroup.appendChild(editBtn);
    buttonGroup.appendChild(saveBtn);
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

    renderAppHeader();
    const main = document.getElementById('app-content');
    clearElement(main);

    // ── Page wrapper ────────────────────────────────────────────────────
    const page = createEl('div', 'review-page');

    // Back button at top
    const topBar = createEl('div', 'review-topbar');
    const backBtn = createEl('button', 'btn btn-secondary btn-sm');
    backBtn.textContent = '← Back to Students';
    backBtn.onclick = () => { renderBackendPanel(); showBackendTab('students'); };
    topBar.appendChild(backBtn);

    const pageTitle = createEl('h2');
    pageTitle.textContent = `Assessment Review — ${student.studentName} (${student.studentId})`;
    topBar.appendChild(pageTitle);

    const completedNote = createEl('p', 'review-date');
    completedNote.textContent = `Completed: ${result.completedAt}`;
    topBar.appendChild(completedNote);
    page.appendChild(topBar);

    // ── Two-column body ─────────────────────────────────────────────────
    const columns = createEl('div', 'review-columns');

    // ── LEFT: Assessment summary ────────────────────────────────────────
    const leftPanel = createEl('div', 'review-panel review-panel--left');

    const leftTitle = createEl('h3', 'panel-heading');
    leftTitle.textContent = 'Assessment Summary';
    leftPanel.appendChild(leftTitle);

    result.loResults.forEach(item => {
        const row = createEl('div', 'summary-row');
        const badge = createEl('span', `band-badge band-badge--${(item.bandCategory || '').toLowerCase()}`);
        badge.textContent = `Band ${item.bandNumber} — ${item.bandLabel}`;
        row.innerHTML =
            `<p class="lo-label"><strong>${item.loNumber}:</strong> ${item.loTitle}</p>`;
        row.appendChild(badge);
        const fb = createEl('p', 'lo-feedback');
        fb.textContent = item.feedback;
        row.appendChild(fb);
        leftPanel.appendChild(row);
    });

    // ── RIGHT: Feedforward panel ────────────────────────────────────────
    const rightPanel = createEl('div', 'review-panel review-panel--right');

    const rightTitle = createEl('h3', 'panel-heading');
    rightTitle.textContent = 'Feed-Forward';
    rightPanel.appendChild(rightTitle);

    // Generate button
    const generateBtn = createEl('button', 'btn btn-success btn-full');
    generateBtn.id  = 'ff-generate-btn';
    generateBtn.textContent = '✦ Generate Feed-Forward';
    rightPanel.appendChild(generateBtn);

    // Loading indicator (hidden by default)
    const loader = createEl('div', 'ff-loader');
    loader.id = 'ff-loader';
    loader.innerHTML = '<div class="ff-spinner"></div><p>Generating with AI…</p>';
    loader.style.display = 'none';
    rightPanel.appendChild(loader);

    // Editable textarea
    const textarea = createEl('textarea', 'ff-textarea');
    textarea.id          = 'ff-textarea';
    textarea.placeholder = 'Generate / Edit Feed-Forward';
    textarea.rows        = 12;
    textarea.value       = getSavedFeedforward(studentId);
    rightPanel.appendChild(textarea);

    // Word count
    const wordCount = createEl('p', 'ff-wordcount');
    wordCount.id = 'ff-wordcount';
    const updateWordCount = () => {
        const words = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
        wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
    };
    updateWordCount();
    textarea.addEventListener('input', updateWordCount);
    rightPanel.appendChild(wordCount);

    // Save button
    const saveBtn = createEl('button', 'btn btn-primary btn-full');
    saveBtn.id          = 'ff-save-btn';
    saveBtn.textContent = 'Save Feed-Forward';
    saveBtn.onclick = () => {
        updateFeedforwardManually(studentId, textarea.value);
    };
    rightPanel.appendChild(saveBtn);

    // ── Grade summary container ─────────────────────────────────────────
    const gradeContainer = createEl('div', 'grade-summary-container');

    // Use the scheme referenced by the assessment result (guaranteed valid path)
    const rawResult = getAssessmentResult(studentId);
    const gradeScheme = rawResult ? getMarkingSchemeById(rawResult.markingSchemeId) : null;

    // Helper: given a numeric score, find which band it falls into
    function _bandForScore(score, bandScores) {
        if (score == null || !bandScores) return null;
        const s = Math.round(score); // round so decimals like 59.5 map to a band
        for (const b of bandScores) {
            const parts = (b.scoreRange || '').split('-').map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])
                && s >= parts[0] && s <= parts[1]) {
                return b;
            }
        }
        return null;
    }

    // Helper: append a category badge to a value span
    function _appendCategoryBadge(span, category) {
        if (!category) return;
        const badge = createEl('span', `grade-category-badge grade-category-badge--${category.toLowerCase()}`);
        badge.textContent = category;
        span.appendChild(badge);
    }

    // 1. Overall grade from scheme — number only, no badge
    const overallGradeRow = createEl('div', 'grade-summary-row');
    const overallGradeLabel = createEl('span', 'grade-summary-label');
    overallGradeLabel.textContent = 'Overall grade for this scheme submission:';
    const overallGradeValue = createEl('span', 'grade-summary-value');
    overallGradeValue.textContent = (gradeScheme && gradeScheme.overallGrade != null)
        ? gradeScheme.overallGrade
        : '—';
    overallGradeRow.appendChild(overallGradeLabel);
    overallGradeRow.appendChild(overallGradeValue);
    gradeContainer.appendChild(overallGradeRow);

    // 2. Average score — raw percentage, no badge
    let avgNumeric = null;
    if (gradeScheme && result.loResults.length > 0) {
        const midpoints = result.loResults.map(item => {
            const bandScore = (gradeScheme.bandScores || []).find(
                b => b.bandNumber === Number(item.bandNumber)
            );
            if (!bandScore || !bandScore.scoreRange) return null;
            const parts = bandScore.scoreRange.split('-').map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                return parts[1]; // upper bound — Band 9 (90-100) → 100%
            }
            return null;
        }).filter(v => v !== null);

        if (midpoints.length > 0) {
            avgNumeric = midpoints.reduce((sum, v) => sum + v, 0) / midpoints.length;
        }
    }
    const avgBandRow = createEl('div', 'grade-summary-row');
    const avgBandLabel = createEl('span', 'grade-summary-label');
    avgBandLabel.textContent = 'Average score:';
    const avgBandValue = createEl('span', 'grade-summary-value');
    avgBandValue.textContent = avgNumeric !== null ? avgNumeric.toFixed(1) + '%' : '—';
    avgBandRow.appendChild(avgBandLabel);
    avgBandRow.appendChild(avgBandValue);
    gradeContainer.appendChild(avgBandRow);

    // 3. Student score — avg % scaled to overall grade + category badge
    const studentScoreRow = createEl('div', 'grade-summary-row');
    const studentScoreLabel = createEl('span', 'grade-summary-label');
    studentScoreLabel.textContent = 'Student score:';
    const studentScoreValue = createEl('span', 'grade-summary-value');
    if (avgNumeric !== null && gradeScheme && gradeScheme.overallGrade != null) {
        const studentMark = (avgNumeric / 100) * Number(gradeScheme.overallGrade);
        studentScoreValue.appendChild(document.createTextNode(
            studentMark.toFixed(1) + ' / ' + gradeScheme.overallGrade + ' '
        ));
        const studentBand = _bandForScore(avgNumeric, gradeScheme.bandScores);
        _appendCategoryBadge(studentScoreValue, studentBand ? studentBand.category : null);
    } else {
        studentScoreValue.textContent = '—';
    }
    studentScoreRow.appendChild(studentScoreLabel);
    studentScoreRow.appendChild(studentScoreValue);
    gradeContainer.appendChild(studentScoreRow);

    rightPanel.appendChild(gradeContainer);

    // ── Generate button logic ───────────────────────────────────────────
    generateBtn.onclick = async () => {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating…';
        loader.style.display = 'flex';
        textarea.style.opacity = '0.4';

        const wordLimit = getSettings().feedbackWordLimit || 200;
        const feedforward = await generateStudentFeedforward(studentId, wordLimit);

        loader.style.display = 'none';
        textarea.style.opacity = '1';
        generateBtn.disabled = false;
        generateBtn.textContent = '✦ Regenerate Feedforward';

        if (feedforward) {
            textarea.value = feedforward;
            updateWordCount();
        }
    };

    columns.appendChild(leftPanel);
    columns.appendChild(rightPanel);
    page.appendChild(columns);
    main.appendChild(page);
}

// ===================================== 
// APP START// ===================================== 

// App is bootstrapped by firebase-config.js via onAuthStateChanged.
// Do NOT call initializeApp here — Firebase handles the startup lifecycle.
