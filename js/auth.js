/**
 * AUTH.JS - Authentication (Firebase Auth)
 * Wraps Firebase Auth for Email/Password and Google Sign-In.
 * Keeps the same public API shape so the rest of the app needs minimal changes.
 */

// =====================================================
// SESSION STATE
// =====================================================

let currentUser = null;

function getCurrentUser() {
    return currentUser;
}

function setCurrentUser(user) {
    currentUser = user;
}

function clearCurrentUser() {
    currentUser = null;
}

/**
 * Called by firebase-config.js once onAuthStateChanged fires.
 * Converts a Firebase user object into the app's user shape.
 */
window._setCurrentUserFromFirebase = function (firebaseUser) {
    // Preserve any stored profile fields (e.g. avatar) loaded from Firestore
    const db = getDatabase();
    const storedProfile = (db.users || []).find(u => u.id === firebaseUser.uid) || {};

    currentUser = {
        avatar: storedProfile.avatar || null,
        id: firebaseUser.uid,
        email: firebaseUser.email,
        // username kept for legacy code that reads user.username
        username: firebaseUser.displayName || firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email,
        createdAt: firebaseUser.metadata.creationTime,
        lastLogin: firebaseUser.metadata.lastSignInTime,
        isGoogleUser: firebaseUser.providerData.some(p => p.providerId === 'google.com')
    };

    // Sync into the storage cache so getAllUsers() returns the current user
    db.users = [currentUser];
    saveDatabase(db);
};

/**
 * Legacy — session is now managed by onAuthStateChanged.
 * Returns whatever is in memory (set by _setCurrentUserFromFirebase).
 */
function restoreUserSession() {
    return currentUser;
}

function isUserLoggedIn() {
    return currentUser !== null;
}

// =====================================================
// LOGIN / REGISTER / GOOGLE
// =====================================================

/**
 * Sign in with email + password.
 * Returns { success, message, user }.
 */
async function loginUser(email, password) {
    if (!email || !password) {
        return { success: false, message: 'Email and password are required', user: null };
    }

    try {
        const { signInWithEmailAndPassword } = window._firebaseFns;
        const cred = await signInWithEmailAndPassword(window._auth, email.trim(), password);
        return { success: true, message: 'Login successful', user: cred.user };
    } catch (error) {
        return { success: false, message: _authErrorMessage(error.code), user: null };
    }
}

/**
 * Create a new account with email + password.
 * Returns { success, message, user }.
 */
async function registerUser(email, password, confirmPassword) {
    if (!isValidEmail(email)) {
        return { success: false, message: 'A valid email address is required', user: null };
    }

    if (!isValidPassword(password)) {
        return { success: false, message: 'Password must be at least 6 characters', user: null };
    }

    if (password !== confirmPassword) {
        return { success: false, message: 'Passwords do not match', user: null };
    }

    try {
        const { createUserWithEmailAndPassword } = window._firebaseFns;
        const cred = await createUserWithEmailAndPassword(
            window._auth, email.trim(), password
        );
        return { success: true, message: 'Account created successfully', user: cred.user };
    } catch (error) {
        return { success: false, message: _authErrorMessage(error.code), user: null };
    }
}

/**
 * Sign in with Google (popup).
 */
async function googleSignIn() {
    try {
        const { signInWithPopup } = window._firebaseFns;
        await signInWithPopup(window._auth, window._googleProvider);
        return { success: true };
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user') {
            return { success: false, message: '' };
        }
        return { success: false, message: _authErrorMessage(error.code) };
    }
}

/**
 * Sign out current user.
 */
function logoutUser() {
    const { signOut } = window._firebaseFns;
    signOut(window._auth).catch(console.error);
    clearCurrentUser();
}

// =====================================================
// PASSWORD MANAGEMENT
// =====================================================

/**
 * Change password for an email/password user.
 * Requires re-authentication with current password first.
 */
async function changeUserPassword(_userId, currentPassword, newPassword, confirmPassword) {
    const firebaseUser = window._auth && window._auth.currentUser;
    if (!firebaseUser) return { success: false, message: 'Not logged in' };

    if (newPassword !== confirmPassword) {
        return { success: false, message: 'Passwords do not match' };
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
        return { success: false, message: validation.issues.join(', ') };
    }

    try {
        const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } =
            window._firebaseFns;
        const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
        await reauthenticateWithCredential(firebaseUser, credential);
        await updatePassword(firebaseUser, newPassword);
        return { success: true, message: 'Password changed successfully' };
    } catch (error) {
        return { success: false, message: _authErrorMessage(error.code) };
    }
}

/**
 * Send a Firebase password-reset email.
 */
async function sendPasswordReset(email) {
    if (!email) return { success: false, message: 'Email is required' };
    try {
        const { sendPasswordResetEmail } = window._firebaseFns;
        await sendPasswordResetEmail(window._auth, email.trim());
        return { success: true, message: 'Password reset email sent — check your inbox' };
    } catch (error) {
        return { success: false, message: _authErrorMessage(error.code) };
    }
}

// =====================================================
// VALIDATION HELPERS
// =====================================================

function validatePasswordStrength(password) {
    const issues = [];
    if (!password) {
        issues.push('Password is required');
    } else {
        if (password.length < 6)       issues.push('Minimum 6 characters');
        if (!/[a-z]/.test(password))   issues.push('Include lowercase letters');
        if (!/[A-Z]/.test(password))   issues.push('Include uppercase letters');
        if (!/[0-9]/.test(password))   issues.push('Include numbers');
    }
    return { isValid: issues.length === 0, issues };
}

function _authErrorMessage(code) {
    const map = {
        'auth/user-not-found':         'No account found with this email',
        'auth/wrong-password':         'Incorrect password',
        'auth/invalid-credential':     'Invalid email or password',
        'auth/email-already-in-use':   'An account with this email already exists',
        'auth/invalid-email':          'Invalid email address',
        'auth/weak-password':          'Password must be at least 6 characters',
        'auth/too-many-requests':      'Too many failed attempts. Try again later',
        'auth/network-request-failed': 'Network error — check your connection',
        'auth/popup-closed-by-user':   'Sign-in popup was closed',
        'auth/requires-recent-login':  'Please log out and log back in before changing your password'
    };
    return map[code] || 'Authentication failed. Please try again';
}
