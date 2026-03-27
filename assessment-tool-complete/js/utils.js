/**
 * UTILS.JS - Utility Functions
 * Contains helper functions used throughout the application
 * Purpose: Reduce code duplication, provide reusable logic
 */

// =====================================================
// STRING MANIPULATION & VALIDATION
// =====================================================

/**
 * Capitalize first letter of a string
 * @param {string} str - Input string
 * @returns {string} - Capitalized string
 */
function capitalizeFirstLetter(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate unique ID (timestamp + random number)
 * @returns {string} - Unique identifier
 */
function generateUniqueId() {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password (minimum 6 characters)
 * @param {string} password - Password to validate
 * @returns {boolean} - True if password meets requirements
 */
function isValidPassword(password) {
    return password && password.length >= 6;
}

/**
 * Trim and validate string input
 * @param {string} input - Input to validate
 * @returns {string} - Trimmed string or empty string if invalid
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim();
}

// =====================================================
// DOM & UI HELPERS
// =====================================================

/**
 * Create element with classes and attributes
 * @param {string} tag - HTML tag name
 * @param {string} className - CSS class names
 * @param {object} attributes - Key-value attributes
 * @returns {HTMLElement} - Created element
 */
function createEl(tag, className = '', attributes = {}) {
    const element = document.createElement(tag);
    
    if (className) {
        element.className = className;
    }
    
    Object.keys(attributes).forEach(key => {
        element.setAttribute(key, attributes[key]);
    });
    
    return element;
}

/**
 * Show/hide element by changing display property
 * @param {HTMLElement} element - Element to toggle
 * @param {boolean} show - True to show, false to hide
 */
function toggleDisplay(element, show = true) {
    if (element) {
        element.style.display = show ? 'block' : 'none';
    }
}

/**
 * Clear all children of an element
 * @param {HTMLElement} element - Parent element to clear
 */
function clearElement(element) {
    if (element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
}

/**
 * Add multiple classes to element
 * @param {HTMLElement} element - Target element
 * @param {string|array} classes - Class name(s) to add
 */
function addClasses(element, classes) {
    if (!element) return;
    const classList = Array.isArray(classes) ? classes : [classes];
    classList.forEach(cls => element.classList.add(cls));
}

/**
 * Remove multiple classes from element
 * @param {HTMLElement} element - Target element
 * @param {string|array} classes - Class name(s) to remove
 */
function removeClasses(element, classes) {
    if (!element) return;
    const classList = Array.isArray(classes) ? classes : [classes];
    classList.forEach(cls => element.classList.remove(cls));
}

// =====================================================
// ARRAY & OBJECT HELPERS
// =====================================================

/**
 * Find object in array by property value
 * @param {array} arr - Array to search
 * @param {string} property - Property to match
 * @param {*} value - Value to match
 * @returns {object|null} - Found object or null
 */
function findByProperty(arr, property, value) {
    if (!Array.isArray(arr)) return null;
    return arr.find(item => item[property] === value) || null;
}

/**
 * Filter array by property value
 * @param {array} arr - Array to filter
 * @param {string} property - Property to check
 * @param {*} value - Value to match
 * @returns {array} - Filtered array
 */
function filterByProperty(arr, property, value) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(item => item[property] === value);
}

/**
 * Remove item from array by property value
 * @param {array} arr - Array to modify
 * @param {string} property - Property to match
 * @param {*} value - Value to match
 * @returns {array} - Modified array
 */
function removeByProperty(arr, property, value) {
    return arr.filter(item => item[property] !== value);
}

/**
 * Deep copy an object
 * @param {object} obj - Object to copy
 * @returns {object} - Deep copy
 */
function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// =====================================================
// NUMBER & TEXT FORMATTING
// =====================================================

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @returns {string} - Truncated text with ellipsis
 */
function truncateText(text, length = 100) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
}

/**
 * Count words in text
 * @param {string} text - Text to count
 * @returns {number} - Word count
 */
function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
}

/**
 * Format date as readable string
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date (DD/MM/YYYY)
 */
function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// =====================================================
// NOTIFICATION HELPERS
// =====================================================

/**
 * Show temporary notification message
 * @param {string} message - Message to display
 * @param {string} type - Type: 'success', 'error', 'info', 'warning'
 * @param {number} duration - Duration in milliseconds (default 3000)
 */
function showNotification(message, type = 'info', duration = 3000) {
    const notificationContainer = document.getElementById('notifications') || createNotificationContainer();
    
    const notification = createEl('div', `notification notification-${type}`);
    notification.textContent = message;
    
    notificationContainer.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
        notification.remove();
    }, duration);
}

/**
 * Create notification container if it doesn't exist
 * @returns {HTMLElement} - Notification container
 */
function createNotificationContainer() {
    const container = createEl('div', 'notification-container');
    container.id = 'notifications';
    document.body.appendChild(container);
    return container;
}

/**
 * Show confirmation dialog
 * @param {string} message - Confirmation message
 * @param {function} onConfirm - Callback if confirmed
 * @param {function} onCancel - Callback if cancelled
 */
function showConfirmDialog(message, onConfirm, onCancel) {
    const dialog = createEl('div', 'dialog-overlay');
    
    const dialogContent = createEl('div', 'dialog-content');
    
    const messageEl = createEl('p', 'dialog-message');
    messageEl.textContent = message;
    dialogContent.appendChild(messageEl);
    
    const buttonContainer = createEl('div', 'dialog-buttons');
    
    const confirmBtn = createEl('button', 'btn btn-primary');
    confirmBtn.textContent = 'Confirm';
    confirmBtn.onclick = () => {
        dialog.remove();
        if (onConfirm) onConfirm();
    };
    
    const cancelBtn = createEl('button', 'btn btn-secondary');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
        dialog.remove();
        if (onCancel) onCancel();
    };
    
    buttonContainer.appendChild(confirmBtn);
    buttonContainer.appendChild(cancelBtn);
    dialogContent.appendChild(buttonContainer);
    
    dialog.appendChild(dialogContent);
    document.body.appendChild(dialog);
}

// =====================================================
// LOCAL STORAGE HELPERS
// =====================================================

/**
 * Get item from localStorage with JSON parsing
 * @param {string} key - Storage key
 * @returns {*} - Parsed value or null
 */
function getLocalStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error(`Error reading from localStorage: ${key}`, error);
        return null;
    }
}

/**
 * Set item in localStorage with JSON stringification
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 */
function setLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Error writing to localStorage: ${key}`, error);
    }
}

/**
 * Remove item from localStorage
 * @param {string} key - Storage key
 */
function removeLocalStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error(`Error removing from localStorage: ${key}`, error);
    }
}

/**
 * Clear all localStorage items
 */
function clearLocalStorage() {
    try {
        localStorage.clear();
    } catch (error) {
        console.error('Error clearing localStorage', error);
    }
}
