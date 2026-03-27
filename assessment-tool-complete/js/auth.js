/**
 * AUTH.JS - Authentication & Session Management
 * Handles user login, registration, password validation
 * Manages current user session throughout the app
 */

// =====================================================
// CURRENT SESSION STATE
// =====================================================

let currentUser = null;

/**
 * Get currently logged-in user
 * @returns {object|null} - Current user object or null if not logged in
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Set current user (after successful login)
 * @param {object} user - User object from authentication
 */
function setCurrentUser(user) {
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
}

/**
 * Clear current user session (logout)
 */
function clearCurrentUser() {
    currentUser = null;
    localStorage.removeItem('currentUser');
}

/**
 * Restore user session from localStorage (on page load)
 * @returns {object|null} - Restored user or null
 */
function restoreUserSession() {
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            currentUser = JSON.parse(stored);
            return currentUser;
        }
    } catch (error) {
        console.error('Error restoring session:', error);
    }
    return null;
}

/**
 * Check if user is logged in
 * @returns {boolean} - True if user is logged in
 */
function isUserLoggedIn() {
    return currentUser !== null;
}

// =====================================================
// REGISTRATION & LOGIN
// =====================================================

/**
 * Register new user account
 * @param {string} username - Desired username
 * @param {string} password - Desired password
 * @param {string} confirmPassword - Password confirmation
 * @returns {object} - { success: boolean, message: string, user: object|null }
 */
function registerUser(username, password, confirmPassword) {
    // Validate inputs
    const usernameClean = sanitizeInput(username);
    
    if (!usernameClean || usernameClean.length < 3) {
        return {
            success: false,
            message: 'Username must be at least 3 characters',
            user: null
        };
    }
    
    if (!isValidPassword(password)) {
        return {
            success: false,
            message: 'Password must be at least 6 characters',
            user: null
        };
    }
    
    if (password !== confirmPassword) {
        return {
            success: false,
            message: 'Passwords do not match',
            user: null
        };
    }
    
    // Attempt to create user
    const user = createUser(usernameClean, password);
    
    if (user) {
        return {
            success: true,
            message: 'Registration successful',
            user: user
        };
    } else {
        return {
            success: false,
            message: 'Username already exists',
            user: null
        };
    }
}

/**
 * Login user with username and password
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {object} - { success: boolean, message: string, user: object|null }
 */
function loginUser(username, password) {
    // Validate inputs
    const usernameClean = sanitizeInput(username);
    
    if (!usernameClean || !password) {
        return {
            success: false,
            message: 'Username and password required',
            user: null
        };
    }
    
    // Authenticate user
    const user = authenticateUser(usernameClean, password);
    
    if (user) {
        // Check if user is logging in with default password
        const DEFAULT_PASSWORD = 'Pas$word098*';
        if (password === DEFAULT_PASSWORD) {
            // Force password change for users logging in with default password
            setCurrentUser(user);
            showChangePasswordDialog(user);
            return {
                success: true,
                message: 'Please change your default password',
                user: user,
                requiresPasswordChange: true
            };
        }
        
        // Store user session
        setCurrentUser(user);
        
        return {
            success: true,
            message: 'Login successful',
            user: user
        };
    } else {
        return {
            success: false,
            message: 'Invalid username or password',
            user: null
        };
    }
}

/**
 * Logout current user
 */
function logoutUser() {
    clearCurrentUser();
}

// =====================================================
// PASSWORD VALIDATION
// =====================================================

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - { isValid: boolean, issues: array }
 */
function validatePasswordStrength(password) {
    const issues = [];
    
    if (!password) {
        issues.push('Password is required');
    } else {
        if (password.length < 6) {
            issues.push('Minimum 6 characters');
        }
        if (!/[a-z]/.test(password)) {
            issues.push('Include lowercase letters');
        }
        if (!/[A-Z]/.test(password)) {
            issues.push('Include uppercase letters');
        }
        if (!/[0-9]/.test(password)) {
            issues.push('Include numbers');
        }
    }
    
    return {
        isValid: issues.length === 0,
        issues: issues
    };
}

/**
 * Change user password
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password for verification
 * @param {string} newPassword - New password
 * @param {string} confirmPassword - Confirmation of new password
 * @returns {object} - { success: boolean, message: string }
 */
function changeUserPassword(userId, currentPassword, newPassword, confirmPassword) {
    const user = findByProperty(getAllUsers(), 'id', userId);
    
    if (!user) {
        return { success: false, message: 'User not found' };
    }
    
    // Verify current password
    if (user.password !== currentPassword) {
        return { success: false, message: 'Current password is incorrect' };
    }
    
    // Validate new password
    if (!isValidPassword(newPassword)) {
        return { success: false, message: 'New password must be at least 6 characters' };
    }
    
    if (newPassword !== confirmPassword) {
        return { success: false, message: 'Passwords do not match' };
    }
    
    if (newPassword === currentPassword) {
        return { success: false, message: 'New password must be different from current password' };
    }
    
    // Update password
    const db = getDatabase();
    user.password = newPassword;
    const index = db.users.findIndex(u => u.id === userId);
    db.users[index] = user;
    saveDatabase(db);
    
    return { success: true, message: 'Password changed successfully' };
}

// =====================================================
// USER VERIFICATION
// =====================================================

/**
 * Verify user can access a resource
 * @param {string} requiredRole - Required role (for future expansion)
 * @returns {boolean} - True if authorized
 */
function verifyUserAuthorization(requiredRole = 'user') {
    // In current demo, all logged-in users are lecturers
    return isUserLoggedIn();
}

/**
 * Get user information
 * @param {string} userId - User ID
 * @returns {object|null} - User object (without password for security)
 */
function getUserInfo(userId) {
    const user = findByProperty(getAllUsers(), 'id', userId);
    
    if (user) {
        // Return user info without password
        const { password, ...safeUser } = user;
        return safeUser;
    }
    
    return null;
}
