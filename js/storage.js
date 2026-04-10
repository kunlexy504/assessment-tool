/**
 * STORAGE.JS - Data Persistence (Firestore)
 * Uses an in-memory cache for synchronous reads throughout the app.
 * Every write updates the cache AND fires a background Firestore write.
 *
 * Firestore structure (private per user):
 *   users/{uid}/markingSchemes/{schemeId}
 *   users/{uid}/students/{studentId}
 *   users/{uid}/assessmentResults/{resultId}
 *   users/{uid}/settings/app
 *   users/{uid}/profile/data
 */

// =====================================================
// DEFAULT STRUCTURES
// =====================================================

const DEFAULT_SETTINGS = { darkMode: false, feedbackWordLimit: 200, sessionTimeoutSeconds: 60 };

const DEFAULT_USER = {
    id: '', email: '', displayName: '', createdAt: '', lastLogin: ''
};

const DEFAULT_STUDENT = {
    id: '', studentId: '', studentName: '',
    markingSchemeId: '', status: 'Not Accessed', createdAt: ''
};

const DEFAULT_MARKING_SCHEME = {
    id: '', createdByUserId: '', schemeName: '', institution: '',
    courseCode: '', courseName: '', bandScores: [], learningOutcomes: [], createdAt: ''
};

const DEFAULT_BAND_SCORE = {
    id: '', bandNumber: 1, label: '', scoreRange: '', category: ''
};

const DEFAULT_LEARNING_OUTCOME = {
    id: '', loNumber: '', title: '', description: '',
    keyIndicators: [], feedbacks: {}
};

const DEFAULT_ASSESSMENT_RESULT = {
    id: '', studentId: '', studentName: '', markingSchemeId: '',
    assessments: {}, overallFeedback: '', feedbackGeneratedAt: '', completedAt: ''
};

// Keep a reference so other files can read the default DB shape if needed
const DEFAULT_DB = {
    users: [],
    students: [],
    markingSchemes: [],
    assessmentResults: [],
    settings: { ...DEFAULT_SETTINGS }
};

// =====================================================
// IN-MEMORY CACHE
// =====================================================

let _cache = {
    users: [],
    students: [],
    markingSchemes: [],
    assessmentResults: [],
    settings: { ...DEFAULT_SETTINGS }
};

let _uid = null; // Firebase Auth UID of the signed-in user

// =====================================================
// FIREBASE BOOTSTRAP — called by firebase-config.js
// =====================================================

/**
 * Load all data for a user from Firestore into the cache.
 * Called once when onAuthStateChanged fires with a logged-in user.
 */
window.loadUserData = async function (uid) {
    _uid = uid;
    _cache = {
        users: [],
        students: [],
        markingSchemes: [],
        assessmentResults: [],
        settings: { ...DEFAULT_SETTINGS }
    };

    if (!window._db || !window._firebaseFns) return;
    const { getDocs, getDoc, collection, doc } = window._firebaseFns;
    const db = window._db;

    try {
        const [schemesSnap, studentsSnap, resultsSnap] = await Promise.all([
            getDocs(collection(db, `users/${uid}/markingSchemes`)),
            getDocs(collection(db, `users/${uid}/students`)),
            getDocs(collection(db, `users/${uid}/assessmentResults`)),
        ]);

        schemesSnap.forEach(d => _cache.markingSchemes.push(d.data()));
        studentsSnap.forEach(d => _cache.students.push(d.data()));
        resultsSnap.forEach(d => _cache.assessmentResults.push(d.data()));

        console.log('User data loaded from Firestore');
    } catch (err) {
        console.error('Error loading user data from Firestore:', err);
    }

    // Load settings and profile independently so errors don't block core data
    try {
        const settingsSnap = await getDoc(doc(db, `users/${uid}/settings/app`));
        if (settingsSnap.exists()) {
            _cache.settings = { ...DEFAULT_SETTINGS, ...settingsSnap.data() };
        }
    } catch (err) {
        console.warn('Could not load settings:', err);
    }

    try {
        const profileSnap = await getDoc(doc(db, `users/${uid}/profile/data`));
        if (profileSnap.exists()) {
            _cache.users = [profileSnap.data()];
        }
    } catch (err) {
        console.warn('Could not load profile:', err);
    }
};

/**
 * Clear the cache when user signs out.
 */
window.clearUserData = function () {
    _uid = null;
    _cache = {
        users: [],
        students: [],
        markingSchemes: [],
        assessmentResults: [],
        settings: { ...DEFAULT_SETTINGS }
    };
};

// =====================================================
// FIRESTORE WRITE HELPERS
// =====================================================

function _fsWrite(path, data) {
    if (!_uid || !window._db || !window._firebaseFns) return;
    const { doc, setDoc } = window._firebaseFns;
    setDoc(doc(window._db, path), data).catch(err => {
        console.error('Firestore write error:', path, err);
        if (typeof showNotification === 'function') {
            showNotification('Error saving data to cloud', 'error');
        }
    });
}

function _fsDelete(path) {
    if (!_uid || !window._db || !window._firebaseFns) return;
    const { doc, deleteDoc } = window._firebaseFns;
    deleteDoc(doc(window._db, path)).catch(err =>
        console.error('Firestore delete error:', path, err)
    );
}

// =====================================================
// DATABASE COMPATIBILITY LAYER
// (keeps existing callers working unchanged)
// =====================================================

function initializeDatabase() {
    // No-op: Firebase handles initialisation
}

function getDatabase() {
    return _cache;
}

function saveDatabase(db) {
    // Keeps cache in sync when legacy code calls saveDatabase directly.
    // Individual functions handle targeted Firestore writes.
    _cache = db;
}

// =====================================================
// USER MANAGEMENT
// =====================================================

/**
 * Store / update the current user's profile in Firestore.
 * Called after registration so the profile doc exists.
 */
function createUser(email, displayName) {
    if (!_uid) return null;
    const user = {
        id: _uid,
        email: sanitizeInput(email),
        displayName: sanitizeInput(displayName || email),
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
    };
    _cache.users = [user];
    _fsWrite(`users/${_uid}/profile/data`, user);
    return user;
}

function getUserByEmail(email) {
    return _cache.users.find(u => u.email === email) || null;
}

// Legacy — kept for any code that still calls getUserByUsername
function getUserByUsername(username) {
    return _cache.users.find(
        u => u.email === username || u.displayName === username
    ) || null;
}

// Legacy — authentication is handled by Firebase Auth now
function authenticateUser() { return null; }

function getAllUsers() {
    return _cache.users;
}

function deleteUser(userId) {
    _cache.users = _cache.users.filter(u => u.id !== userId);
    if (_uid) _fsDelete(`users/${_uid}/profile/data`);
    return true;
}

function updateUser(userId, updates) {
    const user = _cache.users.find(u => u.id === userId);
    if (user) {
        Object.assign(user, updates);
        if (_uid) _fsWrite(`users/${_uid}/profile/data`, user);
        return true;
    }
    return false;
}

// =====================================================
// STUDENT MANAGEMENT
// =====================================================

function createStudent(studentId, studentName, markingSchemeId) {
    const student = {
        id: generateUniqueId(),
        studentId: sanitizeInput(studentId),
        studentName: sanitizeInput(studentName),
        markingSchemeId: markingSchemeId,
        status: 'Not Accessed',
        createdAt: new Date().toISOString()
    };
    _cache.students.push(student);
    _fsWrite(`users/${_uid}/students/${student.id}`, student);
    console.log('Student created:', student.studentName);
    return student;
}

function getAllStudents(status = null) {
    if (status) return _cache.students.filter(s => s.status === status);
    return _cache.students;
}

function getStudentById(studentId) {
    return _cache.students.find(s => s.id === studentId) || null;
}

function searchStudents(searchTerm) {
    const term = searchTerm.toLowerCase();
    return _cache.students.filter(s =>
        s.studentName.toLowerCase().includes(term) ||
        s.studentId.toLowerCase().includes(term)
    );
}

function updateStudentStatus(studentId, newStatus) {
    const student = _cache.students.find(s => s.id === studentId);
    if (student) {
        student.status = newStatus;
        _fsWrite(`users/${_uid}/students/${studentId}`, student);
    }
}

function deleteStudent(studentId) {
    const idx = _cache.students.findIndex(s => s.id === studentId);
    if (idx !== -1) {
        _cache.students.splice(idx, 1);
        _fsDelete(`users/${_uid}/students/${studentId}`);

        // Also remove associated assessment results
        const toDelete = _cache.assessmentResults.filter(r => r.studentId === studentId);
        toDelete.forEach(r => _fsDelete(`users/${_uid}/assessmentResults/${r.id}`));
        _cache.assessmentResults = _cache.assessmentResults.filter(
            r => r.studentId !== studentId
        );

        console.log('Student and results deleted:', studentId);
        return true;
    }
    return false;
}

// =====================================================
// MARKING SCHEME MANAGEMENT
// =====================================================

function createMarkingScheme(createdByUserId, schemeData) {
    const scheme = {
        id: generateUniqueId(),
        createdByUserId: createdByUserId,
        schemeName: sanitizeInput(schemeData.schemeName || ''),
        institution: sanitizeInput(schemeData.institution || ''),
        courseCode: sanitizeInput(schemeData.courseCode || ''),
        courseName: sanitizeInput(schemeData.courseName || ''),
        bandScores: schemeData.bandScores || [],
        learningOutcomes: schemeData.learningOutcomes || [],
        createdAt: new Date().toISOString()
    };
    _cache.markingSchemes.push(scheme);
    _fsWrite(`users/${_uid}/markingSchemes/${scheme.id}`, scheme);
    console.log('Marking scheme created:', scheme.schemeName);
    return scheme;
}

function getMarkingSchemesForUser(userId) {
    return _cache.markingSchemes.filter(s => s.createdByUserId === userId);
}

function getMarkingSchemeById(schemeId) {
    return _cache.markingSchemes.find(s => s.id === schemeId) || null;
}

function updateMarkingScheme(schemeId, updates) {
    const scheme = _cache.markingSchemes.find(s => s.id === schemeId);
    if (scheme) {
        Object.assign(scheme, updates);
        _fsWrite(`users/${_uid}/markingSchemes/${schemeId}`, scheme);
    }
}

function deleteMarkingScheme(schemeId) {
    const idx = _cache.markingSchemes.findIndex(s => s.id === schemeId);
    if (idx !== -1) {
        _cache.markingSchemes.splice(idx, 1);
        _fsDelete(`users/${_uid}/markingSchemes/${schemeId}`);
        console.log('Marking scheme deleted:', schemeId);
        return true;
    }
    return false;
}

// =====================================================
// ASSESSMENT RESULTS
// =====================================================

function createAssessmentResult(studentId, studentName, markingSchemeId, assessments) {
    const existingIdx = _cache.assessmentResults.findIndex(r => r.studentId === studentId);

    if (existingIdx !== -1) {
        const existing = _cache.assessmentResults[existingIdx];
        existing.studentName = studentName;
        existing.markingSchemeId = markingSchemeId;
        existing.assessments = assessments;
        existing.completedAt = new Date().toISOString();
        _fsWrite(`users/${_uid}/assessmentResults/${existing.id}`, existing);
        console.log('Assessment result updated for:', studentName);
    } else {
        const result = {
            id: generateUniqueId(),
            studentId: studentId,
            studentName: studentName,
            markingSchemeId: markingSchemeId,
            assessments: assessments,
            overallFeedback: '',
            feedbackGeneratedAt: '',
            completedAt: new Date().toISOString()
        };
        _cache.assessmentResults.push(result);
        _fsWrite(`users/${_uid}/assessmentResults/${result.id}`, result);
        console.log('Assessment result created for:', studentName);
    }

    return getAssessmentResult(studentId);
}

function getAssessmentResult(studentId) {
    return _cache.assessmentResults.find(r => r.studentId === studentId) || null;
}

function updateAssessmentFeedback(resultId, feedback) {
    const result = _cache.assessmentResults.find(r => r.id === resultId);
    if (result) {
        result.overallFeedback = feedback;
        result.feedbackGeneratedAt = new Date().toISOString();
        _fsWrite(`users/${_uid}/assessmentResults/${resultId}`, result);
    }
}

function deleteAssessmentResult(resultId) {
    const idx = _cache.assessmentResults.findIndex(r => r.id === resultId);
    if (idx !== -1) {
        _cache.assessmentResults.splice(idx, 1);
        _fsDelete(`users/${_uid}/assessmentResults/${resultId}`);
        return true;
    }
    return false;
}

// =====================================================
// SETTINGS
// =====================================================

function getSettings() {
    return _cache.settings || { ...DEFAULT_SETTINGS };
}

function updateSettings(updates) {
    _cache.settings = Object.assign(_cache.settings || {}, updates);
    if (_uid) _fsWrite(`users/${_uid}/settings/app`, _cache.settings);
}

function toggleDarkMode() {
    _cache.settings.darkMode = !_cache.settings.darkMode;
    if (_uid) _fsWrite(`users/${_uid}/settings/app`, _cache.settings);
    return _cache.settings.darkMode;
}

function setFeedbackWordLimit(limit) {
    _cache.settings.feedbackWordLimit = Math.max(50, Math.min(500, limit));
    if (_uid) _fsWrite(`users/${_uid}/settings/app`, _cache.settings);
}
