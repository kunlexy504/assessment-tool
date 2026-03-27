/**
 * STUDENTMANAGEMENT.JS - Student Management
 * Handles student registration, searching, filtering, and status tracking
 * Manages Accessed/Not Accessed status for assessment
 */

// =====================================================
// STUDENT REGISTRATION
// =====================================================

/**
 * Add new student to system
 * @param {string} studentId - Student ID (can be numeric or alphanumeric)
 * @param {string} studentName - Student full name
 * @param {string} markingSchemeId - Associated marking scheme ID
 * @returns {object|null} - Created student object or null if failed
 */
function addStudent(studentId, studentName, markingSchemeId) {
    // Validate inputs
    const idClean = sanitizeInput(studentId);
    const nameClean = sanitizeInput(studentName);
    
    if (!idClean) {
        showNotification('Student ID is required', 'error');
        return null;
    }
    
    if (!nameClean) {
        showNotification('Student name is required', 'error');
        return null;
    }
    
    if (!markingSchemeId) {
        showNotification('Marking scheme must be selected', 'error');
        return null;
    }
    
    // Check if student ID already exists
    if (findByProperty(getAllStudents(), 'studentId', idClean)) {
        showNotification('Student ID already exists', 'error');
        return null;
    }
    
    // Create student
    const student = createStudent(idClean, nameClean, markingSchemeId);
    
    showNotification(`Student ${nameClean} added successfully`, 'success');
    return student;
}

/**
 * Add multiple students at once (from file or batch)
 * @param {array} studentsList - Array of {studentId, studentName}
 * @param {string} markingSchemeId - Associated marking scheme ID
 * @returns {object} - { created: array, errors: array }
 */
function addMultipleStudents(studentsList, markingSchemeId) {
    const created = [];
    const errors = [];
    
    studentsList.forEach((student, index) => {
        const result = addStudent(student.studentId, student.studentName, markingSchemeId);
        
        if (result) {
            created.push(result);
        } else {
            errors.push({
                index: index,
                studentId: student.studentId,
                message: 'Failed to add student'
            });
        }
    });
    
    return { created, errors };
}

// =====================================================
// STUDENT RETRIEVAL & SEARCHING
// =====================================================

/**
 * Get all students with their assessment status
 * @param {string} status - Optional: Filter by 'Accessed' or 'Not Accessed'
 * @returns {array} - Array of student objects with status
 */
function getStudentsWithStatus(status = null) {
    return getAllStudents(status);
}

/**
 * Get students count by status
 * @returns {object} - { total: number, accessed: number, notAccessed: number }
 */
function getStudentsCounts() {
    const all = getAllStudents();
    const accessed = filterByProperty(all, 'status', 'Accessed');
    
    return {
        total: all.length,
        accessed: accessed.length,
        notAccessed: all.length - accessed.length
    };
}

/**
 * Search students by name or ID
 * @param {string} query - Search term (name or student ID)
 * @returns {array} - Matching students
 */
function searchStudentsQuery(query) {
    if (!query) {
        return getAllStudents();
    }
    
    return searchStudents(sanitizeInput(query));
}

/**
 * Get next student in list (after current student)
 * @param {string} currentStudentId - Current student ID
 * @returns {object|null} - Next student or null
 */
function getNextStudent(currentStudentId) {
    const students = getAllStudents();
    const currentIndex = students.findIndex(s => s.id === currentStudentId);
    
    if (currentIndex >= 0 && currentIndex < students.length - 1) {
        return students[currentIndex + 1];
    }
    
    return null;
}

/**
 * Get previous student in list (before current student)
 * @param {string} currentStudentId - Current student ID
 * @returns {object|null} - Previous student or null
 */
function getPreviousStudent(currentStudentId) {
    const students = getAllStudents();
    const currentIndex = students.findIndex(s => s.id === currentStudentId);
    
    if (currentIndex > 0) {
        return students[currentIndex - 1];
    }
    
    return null;
}

/**
 * Get students for a specific marking scheme
 * @param {string} markingSchemeId - Marking scheme ID
 * @returns {array} - Students using this scheme
 */
function getStudentsForScheme(markingSchemeId) {
    return filterByProperty(getAllStudents(), 'markingSchemeId', markingSchemeId);
}

// =====================================================
// STUDENT STATUS MANAGEMENT
// =====================================================

/**
 * Mark student as accessed (assessment started/completed)
 * @param {string} studentId - Student ID
 */
function markStudentAccessed(studentId) {
    updateStudentStatus(studentId, 'Accessed');
}

/**
 * Mark student as not accessed (reset assessment)
 * @param {string} studentId - Student ID
 */
function markStudentNotAccessed(studentId) {
    updateStudentStatus(studentId, 'Not Accessed');
}

/**
 * Check if student has been accessed
 * @param {string} studentId - Student ID
 * @returns {boolean} - True if accessed
 */
function isStudentAccessed(studentId) {
    const student = getStudentById(studentId);
    return student && student.status === 'Accessed';
}

// =====================================================
// STUDENT DELETION
// =====================================================

/**
 * Remove student from system
 * @param {string} studentId - Student ID to delete
 * @returns {boolean} - True if successful
 */
function removeStudent(studentId) {
    const student = getStudentById(studentId);
    
    if (!student) {
        showNotification('Student not found', 'error');
        return false;
    }
    
    // Confirm deletion
    showConfirmDialog(
        `Are you sure you want to delete ${student.studentName}? This will also remove all assessment results.`,
        () => {
            const success = deleteStudent(studentId);
            if (success) {
                showNotification('Student deleted successfully', 'success');
                showBackendTab('students');
            } else {
                showNotification('Error deleting student', 'error');
            }
        },
        null
    );
    
    return true;
}

/**
 * Delete assessment result for a student (keep student record)
 * @param {string} studentId - Student ID
 * @returns {boolean} - True if successful
 */
function clearStudentAssessment(studentId) {
    const result = getAssessmentResult(studentId);
    
    if (result) {
        deleteAssessmentResult(result.id);
        markStudentNotAccessed(studentId);
        showNotification('Assessment cleared', 'success');
        return true;
    }
    
    return false;
}

// =====================================================
// STUDENT DATA EXPORT/IMPORT
// =====================================================

/**
 * Export students list as JSON
 * @param {string} schemeId - Optional: Filter by marking scheme ID
 * @returns {string} - JSON string
 */
function exportStudentsAsJSON(schemeId = null) {
    let students;
    
    if (schemeId) {
        students = getStudentsForScheme(schemeId);
    } else {
        students = getAllStudents();
    }
    
    // Remove sensitive fields if needed
    const exportData = students.map(s => ({
        studentId: s.studentId,
        studentName: s.studentName,
        status: s.status,
        createdAt: s.createdAt
    }));
    
    return JSON.stringify(exportData, null, 2);
}

/**
 * Export students as CSV
 * @param {string} schemeId - Optional: Filter by marking scheme ID
 * @returns {string} - CSV string
 */
function exportStudentsAsCSV(schemeId = null) {
    let students;
    
    if (schemeId) {
        students = getStudentsForScheme(schemeId);
    } else {
        students = getAllStudents();
    }
    
    // Create CSV header
    const headers = ['Student ID', 'Student Name', 'Status', 'Created Date'];
    const rows = students.map(s => [
        s.studentId,
        s.studentName,
        s.status,
        formatDate(s.createdAt)
    ]);
    
    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
}

/**
 * Import students from CSV data
 * @param {string} csvData - CSV data string
 * @param {string} markingSchemeId - Associated marking scheme ID
 * @returns {object} - { success: array, failed: array }
 */
function importStudentsFromCSV(csvData, markingSchemeId) {
    const lines = csvData.trim().split('\n');
    const students = [];
    
    // Skip header row (first line)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Simple parsing - handles quoted fields
        const fields = line.split(',').map(f => f.replace(/"/g, '').trim());
        
        if (fields.length >= 2 && fields[0] && fields[1]) {
            students.push({
                studentId: fields[0],
                studentName: fields[1]
            });
        }
    }
    
    // Add students
    return addMultipleStudents(students, markingSchemeId);
}

// =====================================================
// HELPER: Format student for display
// =====================================================

/**
 * Get formatted student info for display
 * @param {string} studentId - Student ID
 * @returns {object|null} - Formatted student info or null
 */
function getFormattedStudentInfo(studentId) {
    const student = getStudentById(studentId);
    
    if (!student) return null;
    
    const result = getAssessmentResult(studentId);
    
    return {
        id: student.id,
        studentId: student.studentId,
        studentName: student.studentName,
        status: student.status,
        statusBadgeClass: student.status === 'Accessed' ? 'badge-accessed' : 'badge-not-accessed',
        createdDate: formatDate(student.createdAt),
        hasAssessment: !!result,
        assessmentDate: result ? formatDate(result.completedAt) : null
    };
}
