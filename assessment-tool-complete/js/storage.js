/**
 * STORAGE.JS - Data Persistence Management
 * Manages all JSON data storage for the application
 * Includes: Users, Students, Marking Schemes, Assessment Results
 * 
 * Note: In demo version, data stored in localStorage as JSON
 * Future: Can be replaced with backend API calls
 */

// =====================================================
// DEFAULT DATA STRUCTURES
// =====================================================

/**
 * Default empty database structure
 * All data is stored as JSON objects in localStorage
 */
const DEFAULT_DB = {
    users: [],
    students: [],
    markingSchemes: [],
    assessmentResults: [],
    settings: {
        darkMode: false,
        feedbackWordLimit: 200
    }
};

/**
 * Default user object structure
 */
const DEFAULT_USER = {
    id: '',
    username: '',
    password: '', // In production, this would be hashed
    createdAt: '',
    lastLogin: ''
};

/**
 * Default student object structure
 */
const DEFAULT_STUDENT = {
    id: '',
    studentId: '',
    studentName: '',
    markingSchemeId: '',
    status: 'Not Accessed', // 'Not Accessed' or 'Accessed'
    createdAt: ''
};

/**
 * Default marking scheme object structure
 */
const DEFAULT_MARKING_SCHEME = {
    id: '',
    createdByUserId: '',
    schemeName: '',
    institution: '',
    courseCode: '',
    courseName: '',
    bandScores: [], // Array of band score objects
    learningOutcomes: [], // Array of LO objects with feedbacks
    createdAt: ''
};

/**
 * Default band score object structure
 */
const DEFAULT_BAND_SCORE = {
    id: '',
    bandNumber: 1,
    label: '',
    scoreRange: '',
    category: '' // 'Fail', 'Pass', 'Merit', 'Distinction'
};

/**
 * Default learning outcome object structure
 */
const DEFAULT_LEARNING_OUTCOME = {
    id: '',
    loNumber: '', // 'LO1', 'LO2', etc.
    title: '',
    description: '',
    keyIndicators: [], // Array of key indicator strings
    feedbacks: {} // Object with bandNumber as key, feedback text as value
};

/**
 * Default assessment result object structure
 */
const DEFAULT_ASSESSMENT_RESULT = {
    id: '',
    studentId: '',
    studentName: '',
    markingSchemeId: '',
    assessments: {}, // Object with LO IDs as keys, { bandScore, feedback } as values
    overallFeedback: '',
    feedbackGeneratedAt: '',
    completedAt: ''
};

// =====================================================
// DATABASE INITIALIZATION
// =====================================================

/**
 * Initialize database - called on app startup
 * Creates empty database if it doesn't exist
 */
function initializeDatabase() {
    const existing = localStorage.getItem('assessmentDB');
    
    if (!existing) {
        // First time - create database
        localStorage.setItem('assessmentDB', JSON.stringify(DEFAULT_DB));
        console.log('Database initialized');
    }
}

/**
 * Get entire database
 * @returns {object} - Full database object
 */
function getDatabase() {
    try {
        const db = localStorage.getItem('assessmentDB');
        return db ? JSON.parse(db) : DEFAULT_DB;
    } catch (error) {
        console.error('Error reading database:', error);
        return DEFAULT_DB;
    }
}

/**
 * Save entire database
 * @param {object} db - Database object to save
 */
function saveDatabase(db) {
    try {
        localStorage.setItem('assessmentDB', JSON.stringify(db));
    } catch (error) {
        console.error('Error saving database:', error);
        showNotification('Error saving data', 'error');
    }
}

// =====================================================
// USER MANAGEMENT
// =====================================================

/**
 * Create a new user
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {object} - Created user object or null if failed
 */
function createUser(username, password) {
    const db = getDatabase();
    
    // Check if username already exists
    if (findByProperty(db.users, 'username', username)) {
        console.warn('Username already exists');
        return null;
    }
    
    // Create new user
    const user = deepCopy(DEFAULT_USER);
    user.id = generateUniqueId();
    user.username = sanitizeInput(username);
    user.password = password; // Note: Should be hashed in production
    user.createdAt = new Date().toISOString();
    
    db.users.push(user);
    saveDatabase(db);
    
    console.log('User created:', user.username);
    return user;
}

/**
 * Get user by username
 * @param {string} username - Username to find
 * @returns {object|null} - User object or null
 */
function getUserByUsername(username) {
    const db = getDatabase();
    return findByProperty(db.users, 'username', sanitizeInput(username));
}

/**
 * Authenticate user (login)
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {object|null} - User object if authenticated, null otherwise
 */
function authenticateUser(username, password) {
    const user = getUserByUsername(username);
    
    if (user && user.password === password) {
        // Update last login timestamp
        const db = getDatabase();
        user.lastLogin = new Date().toISOString();
        const userIndex = db.users.findIndex(u => u.id === user.id);
        db.users[userIndex] = user;
        saveDatabase(db);
        
        return user;
    }
    
    return null;
}

/**
 * Get all users
 * @returns {array} - Array of user objects
 */
function getAllUsers() {
    const db = getDatabase();
    return db.users || [];
}

/**
 * Delete user by ID
 * @param {string} userId - User ID to delete
 * @returns {boolean} - True if deleted, false if not found
 */
function deleteUser(userId) {
    const db = getDatabase();
    const initialLength = db.users.length;
    
    db.users = removeByProperty(db.users, 'id', userId);
    
    if (db.users.length < initialLength) {
        saveDatabase(db);
        console.log('User deleted:', userId);
        return true;
    }
    
    return false;
}
/**
 * Update user
 * @param {string} userId - User ID to update
 * @param {object} updates - Object with user properties to update
 * @returns {boolean} - True if updated
 */
function updateUser(userId, updates) {
    const db = getDatabase();
    const user = findByProperty(db.users, 'id', userId);
    
    if (user) {
        // Check if username is being updated and if it already exists
        if (updates.username && updates.username !== user.username) {
            const existingUser = findByProperty(db.users, 'username', updates.username);
            if (existingUser) {
                console.warn('Username already exists');
                return false;
            }
        }
        
        Object.assign(user, updates);
        saveDatabase(db);
        console.log('User updated:', userId);
        return true;
    }
    
    return false;
}
// =====================================================
// STUDENT MANAGEMENT
// =====================================================

/**
 * Create a new student
 * @param {string} studentId - Student ID
 * @param {string} studentName - Student name
 * @param {string} markingSchemeId - Associated marking scheme ID
 * @returns {object} - Created student object
 */
function createStudent(studentId, studentName, markingSchemeId) {
    const db = getDatabase();
    
    // Create new student
    const student = deepCopy(DEFAULT_STUDENT);
    student.id = generateUniqueId();
    student.studentId = sanitizeInput(studentId);
    student.studentName = sanitizeInput(studentName);
    student.markingSchemeId = markingSchemeId;
    student.status = 'Not Accessed';
    student.createdAt = new Date().toISOString();
    
    db.students.push(student);
    saveDatabase(db);
    
    console.log('Student created:', student.studentName);
    return student;
}

/**
 * Get all students (optionally filter by status)
 * @param {string} status - Optional: 'Not Accessed' or 'Accessed'
 * @returns {array} - Array of student objects
 */
function getAllStudents(status = null) {
    const db = getDatabase();
    
    if (status) {
        return filterByProperty(db.students, 'status', status);
    }
    
    return db.students || [];
}

/**
 * Get student by ID
 * @param {string} studentId - Student ID to find
 * @returns {object|null} - Student object or null
 */
function getStudentById(studentId) {
    const db = getDatabase();
    return findByProperty(db.students, 'id', studentId);
}

/**
 * Search students by name or ID
 * @param {string} searchTerm - Name or student ID to search
 * @returns {array} - Array of matching students
 */
function searchStudents(searchTerm) {
    const db = getDatabase();
    const term = searchTerm.toLowerCase();
    
    return db.students.filter(student =>
        student.studentName.toLowerCase().includes(term) ||
        student.studentId.toLowerCase().includes(term)
    );
}

/**
 * Update student status
 * @param {string} studentId - Student ID
 * @param {string} newStatus - New status ('Accessed' or 'Not Accessed')
 */
function updateStudentStatus(studentId, newStatus) {
    const db = getDatabase();
    const student = findByProperty(db.students, 'id', studentId);
    
    if (student) {
        student.status = newStatus;
        const index = db.students.findIndex(s => s.id === studentId);
        db.students[index] = student;
        saveDatabase(db);
    }
}

/**
 * Delete student
 * @param {string} studentId - Student ID to delete
 * @returns {boolean} - True if deleted
 */
function deleteStudent(studentId) {
    const db = getDatabase();
    const initialLength = db.students.length;
    
    db.students = removeByProperty(db.students, 'id', studentId);
    
    if (db.students.length < initialLength) {
        // Also delete associated assessment results
        db.assessmentResults = removeByProperty(db.assessmentResults, 'studentId', studentId);
        saveDatabase(db);
        console.log('Student and results deleted:', studentId);
        return true;
    }
    
    return false;
}

// =====================================================
// MARKING SCHEME MANAGEMENT
// =====================================================

/**
 * Create a new marking scheme
 * @param {string} createdByUserId - User ID of creator
 * @param {object} schemeData - Scheme configuration object
 * @returns {object} - Created marking scheme
 */
function createMarkingScheme(createdByUserId, schemeData) {
    const db = getDatabase();
    
    const scheme = deepCopy(DEFAULT_MARKING_SCHEME);
    scheme.id = generateUniqueId();
    scheme.createdByUserId = createdByUserId;
    scheme.schemeName = sanitizeInput(schemeData.schemeName || '');
    scheme.institution = sanitizeInput(schemeData.institution || '');
    scheme.courseCode = sanitizeInput(schemeData.courseCode || '');
    scheme.courseName = sanitizeInput(schemeData.courseName || '');
    scheme.bandScores = schemeData.bandScores || [];
    scheme.learningOutcomes = schemeData.learningOutcomes || [];
    scheme.createdAt = new Date().toISOString();
    
    db.markingSchemes.push(scheme);
    saveDatabase(db);
    
    console.log('Marking scheme created:', scheme.schemeName);
    return scheme;
}

/**
 * Get all marking schemes for a user
 * @param {string} userId - User ID
 * @returns {array} - Array of marking schemes
 */
function getMarkingSchemesForUser(userId) {
    const db = getDatabase();
    return filterByProperty(db.markingSchemes, 'createdByUserId', userId);
}

/**
 * Get marking scheme by ID
 * @param {string} schemeId - Scheme ID
 * @returns {object|null} - Marking scheme or null
 */
function getMarkingSchemeById(schemeId) {
    const db = getDatabase();
    return findByProperty(db.markingSchemes, 'id', schemeId);
}

/**
 * Update marking scheme
 * @param {string} schemeId - Scheme ID
 * @param {object} updates - Fields to update
 */
function updateMarkingScheme(schemeId, updates) {
    const db = getDatabase();
    const scheme = findByProperty(db.markingSchemes, 'id', schemeId);
    
    if (scheme) {
        Object.assign(scheme, updates);
        const index = db.markingSchemes.findIndex(s => s.id === schemeId);
        db.markingSchemes[index] = scheme;
        saveDatabase(db);
    }
}

/**
 * Delete marking scheme
 * @param {string} schemeId - Scheme ID to delete
 * @returns {boolean} - True if deleted
 */
function deleteMarkingScheme(schemeId) {
    const db = getDatabase();
    const initialLength = db.markingSchemes.length;
    
    db.markingSchemes = removeByProperty(db.markingSchemes, 'id', schemeId);
    
    if (db.markingSchemes.length < initialLength) {
        saveDatabase(db);
        console.log('Marking scheme deleted:', schemeId);
        return true;
    }
    
    return false;
}

// =====================================================
// ASSESSMENT RESULTS
// =====================================================

/**
 * Create assessment result
 * @param {string} studentId - Student ID
 * @param {string} studentName - Student name
 * @param {string} markingSchemeId - Marking scheme ID
 * @param {object} assessments - Assessment data (LO -> band score + feedback)
 * @returns {object} - Assessment result object
 */
function createAssessmentResult(studentId, studentName, markingSchemeId, assessments) {
    const db = getDatabase();
    
    // Check if assessment already exists for this student
    const existingIndex = db.assessmentResults.findIndex(result => result.studentId === studentId);
    
    if (existingIndex !== -1) {
        // Update existing
        db.assessmentResults[existingIndex].studentName = studentName;
        db.assessmentResults[existingIndex].markingSchemeId = markingSchemeId;
        db.assessmentResults[existingIndex].assessments = assessments;
        db.assessmentResults[existingIndex].completedAt = new Date().toISOString();
        console.log('Assessment result updated for:', studentName);
    } else {
        // Create new
        const result = deepCopy(DEFAULT_ASSESSMENT_RESULT);
        result.id = generateUniqueId();
        result.studentId = studentId;
        result.studentName = studentName;
        result.markingSchemeId = markingSchemeId;
        result.assessments = assessments;
        result.completedAt = new Date().toISOString();
        
        db.assessmentResults.push(result);
        console.log('Assessment result created for:', studentName);
    }
    
    saveDatabase(db);
    return getAssessmentResult(studentId);
}

/**
 * Get assessment result for student
 * @param {string} studentId - Student ID
 * @returns {object|null} - Assessment result or null
 */
function getAssessmentResult(studentId) {
    const db = getDatabase();
    return findByProperty(db.assessmentResults, 'studentId', studentId);
}

/**
 * Update assessment result with feedback
 * @param {string} resultId - Result ID
 * @param {string} feedback - Overall feedback text
 */
function updateAssessmentFeedback(resultId, feedback) {
    const db = getDatabase();
    const result = findByProperty(db.assessmentResults, 'id', resultId);
    
    if (result) {
        result.overallFeedback = feedback;
        result.feedbackGeneratedAt = new Date().toISOString();
        const index = db.assessmentResults.findIndex(r => r.id === resultId);
        db.assessmentResults[index] = result;
        saveDatabase(db);
    }
}

/**
 * Delete assessment result
 * @param {string} resultId - Result ID to delete
 * @returns {boolean} - True if deleted
 */
function deleteAssessmentResult(resultId) {
    const db = getDatabase();
    const initialLength = db.assessmentResults.length;
    
    db.assessmentResults = removeByProperty(db.assessmentResults, 'id', resultId);
    
    if (db.assessmentResults.length < initialLength) {
        saveDatabase(db);
        console.log('Assessment result deleted:', resultId);
        return true;
    }
    
    return false;
}

// =====================================================
// SETTINGS
// =====================================================

/**
 * Get application settings
 * @returns {object} - Settings object
 */
function getSettings() {
    const db = getDatabase();
    return db.settings || DEFAULT_DB.settings;
}

/**
 * Update settings
 * @param {object} updates - Settings to update
 */
function updateSettings(updates) {
    const db = getDatabase();
    db.settings = Object.assign(db.settings || {}, updates);
    saveDatabase(db);
}

/**
 * Toggle dark mode
 * @returns {boolean} - New dark mode state
 */
function toggleDarkMode() {
    const db = getDatabase();
    db.settings.darkMode = !db.settings.darkMode;
    saveDatabase(db);
    return db.settings.darkMode;
}

/**
 * Set feedback word limit
 * @param {number} limit - New word limit
 */
function setFeedbackWordLimit(limit) {
    const db = getDatabase();
    db.settings.feedbackWordLimit = Math.max(50, Math.min(500, limit)); // Constrain between 50-500
    saveDatabase(db);
}
