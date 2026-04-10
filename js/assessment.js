/**
 * ASSESSMENT.JS - Assessment Management & Logic
 * Handles the core assessment process:
 * - Sequential LO question presentation
 * - Band score selection
 * - Results recording and retrieval
 * - Summary and feedback compilation
 */

// =====================================================
// ASSESSMENT SESSION STATE
// =====================================================

let currentAssessmentSession = {
    studentId: null,
    studentName: null,
    markingSchemeId: null,
    learningOutcomes: [],
    currentLOIndex: 0,
    selections: {}, // { loId: { bandNumber, feedback } }
    startedAt: null,
    completedAt: null
};

/**
 * Initialize assessment session for a student
 * @param {string} studentId - Student ID
 * @param {string} markingSchemeId - Marking scheme ID
 * @returns {object} - Assessment session object
 */
function initializeAssessmentSession(studentId, markingSchemeId) {
    const student = getStudentById(studentId);
    const scheme = getMarkingSchemeById(markingSchemeId);
    
    if (!student || !scheme) {
        console.error('Student or marking scheme not found');
        return null;
    }
    
    // Reset session
    currentAssessmentSession = {
        studentId: studentId,
        studentName: student.studentName,
        markingSchemeId: markingSchemeId,
        learningOutcomes: deepCopy(scheme.learningOutcomes),
        currentLOIndex: 0,
        selections: {},
        startedAt: new Date().toISOString(),
        completedAt: null
    };
    
    // Load existing assessment data if available
    const existingAssessment = getStudentAssessmentResult(studentId);
    if (existingAssessment && existingAssessment.assessments) {
        currentAssessmentSession.selections = deepCopy(existingAssessment.assessments);
    }
    
    console.log('Assessment session initialized for:', student.studentName);
    return currentAssessmentSession;
}

/**
 * Get current assessment session
 * @returns {object} - Current session object
 */
function getCurrentAssessmentSession() {
    return currentAssessmentSession;
}

/**
 * Get current learning outcome being assessed
 * @returns {object|null} - Current LO or null if assessment complete
 */
function getCurrentLearningOutcome() {
    const session = getCurrentAssessmentSession();
    
    if (session.currentLOIndex < session.learningOutcomes.length) {
        return session.learningOutcomes[session.currentLOIndex];
    }
    
    return null;
}

/**
 * Move to next learning outcome
 * @returns {boolean} - True if next LO exists, false if assessment complete
 */
function moveToNextLO() {
    const session = getCurrentAssessmentSession();
    session.currentLOIndex++;
    
    return session.currentLOIndex < session.learningOutcomes.length;
}

/**
 * Move to previous learning outcome
 * @returns {boolean} - True if previous LO exists
 */
function moveToPreviousLO() {
    const session = getCurrentAssessmentSession();
    
    if (session.currentLOIndex > 0) {
        session.currentLOIndex--;
        return true;
    }
    
    return false;
}

/**
 * Check if assessment is complete (all LOs assessed)
 * @returns {boolean} - True if all LOs have band score selections
 */
function isAssessmentComplete() {
    const session = getCurrentAssessmentSession();
    return session.currentLOIndex >= session.learningOutcomes.length;
}

// =====================================================
// BAND SCORE SELECTION
// =====================================================

/**
 * Record band score selection for current LO
 * @param {number} bandNumber - Selected band score (1-10)
 * @param {string} feedback - Corresponding feedback text
 * @returns {boolean} - True if successful
 */
function selectBandScoreForCurrentLO(bandNumber, feedback) {
    const session = getCurrentAssessmentSession();
    const currentLO = getCurrentLearningOutcome();
    
    if (!currentLO) {
        console.error('No current learning outcome');
        return false;
    }
    
    // Record selection
    session.selections[currentLO.id] = {
        bandNumber: parseInt(bandNumber),
        feedback: sanitizeInput(feedback),
        selectedAt: new Date().toISOString()
    };
    
    console.log(`Band ${bandNumber} selected for ${currentLO.loNumber}`);
    return true;
}

/**
 * Get band score selection for specific LO
 * @param {string} loId - Learning outcome ID
 * @returns {object|null} - { bandNumber, feedback } or null
 */
function getBandScoreSelectionForLO(loId) {
    const session = getCurrentAssessmentSession();
    return session.selections[loId] || null;
}

/**
 * Update band score selection (allows changing selection)
 * @param {string} loId - Learning outcome ID
 * @param {number} bandNumber - New band score
 * @param {string} feedback - New feedback text
 */
function updateBandScoreSelection(loId, bandNumber, feedback) {
    const session = getCurrentAssessmentSession();
    
    session.selections[loId] = {
        bandNumber: parseInt(bandNumber),
        feedback: sanitizeInput(feedback),
        selectedAt: new Date().toISOString()
    };
    
    console.log(`Selection updated for LO: ${loId}`);
}

// =====================================================
// ASSESSMENT SUMMARY & RETRIEVAL
// =====================================================

/**
 * Get assessment summary (all selections made)
 * @returns {array} - Array of { lo, bandNumber, feedback }
 */
function getAssessmentSummary() {
    const session = getCurrentAssessmentSession();
    
    return session.learningOutcomes.map(lo => ({
        loId: lo.id,
        loNumber: lo.loNumber,
        loTitle: lo.title,
        selection: session.selections[lo.id] || null
    }));
}

/**
 * Get assessment completion status
 * @returns {object} - { total: number, completed: number, incomplete: number, percentage: number }
 */
function getAssessmentProgress() {
    const session = getCurrentAssessmentSession();
    const total = session.learningOutcomes.length;
    const completed = Object.keys(session.selections).length;
    const incomplete = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, incomplete, percentage };
}

// =====================================================
// SAVE ASSESSMENT RESULTS
// =====================================================

/**
 * Save assessment results to database
 * @returns {object|null} - Assessment result object or null if failed
 */
function saveAssessmentResults() {
    const session = getCurrentAssessmentSession();
    
    // Check if all LOs are assessed
    if (getAssessmentProgress().percentage < 100) {
        showNotification('All learning outcomes must be assessed', 'error');
        return null;
    }
    
    // Create assessment result
    const result = createAssessmentResult(
        session.studentId,
        session.studentName,
        session.markingSchemeId,
        session.selections
    );
    
    // Mark student as accessed
    markStudentAccessed(session.studentId);
    
    // Update session
    session.completedAt = new Date().toISOString();
    
    showNotification('Assessment results saved', 'success');
    console.log('Assessment results saved for:', session.studentName);
    
    return result;
}

/**
 * Get saved assessment for student
 * @param {string} studentId - Student ID
 * @returns {object|null} - Assessment result or null
 */
function getStudentAssessmentResult(studentId) {
    return getAssessmentResult(studentId);
}

/**
 * Get detailed assessment with LO info
 * @param {string} studentId - Student ID
 * @returns {object|null} - Detailed assessment or null
 */
function getDetailedAssessmentResult(studentId) {
    const result = getAssessmentResult(studentId);
    
    if (!result) return null;
    
    const scheme = getMarkingSchemeById(result.markingSchemeId);
    
    if (!scheme) return null;
    
    // Enrich result with LO information
    const enrichedAssessments = {};
    
    Object.keys(result.assessments).forEach(loId => {
        const lo = findByProperty(scheme.learningOutcomes, 'id', loId);
        const selection = result.assessments[loId];
        const bandScore = findByProperty(scheme.bandScores, 'bandNumber', selection.bandNumber);
        
        enrichedAssessments[loId] = {
            loId: loId,
            loNumber: lo ? lo.loNumber : 'Unknown',
            loTitle: lo ? lo.title : 'Unknown',
            bandNumber: selection.bandNumber,
            bandLabel: bandScore ? bandScore.label : 'Unknown',
            bandCategory: bandScore ? bandScore.category : 'Unknown',
            feedback: selection.feedback
        };
    });
    
    return {
        ...result,
        enrichedAssessments: enrichedAssessments,
        scheme: scheme
    };
}

// =====================================================
// ASSESSMENT RESET/CLEAR
// =====================================================

/**
 * Clear current assessment session (for starting new assessment)
 */
function clearAssessmentSession() {
    currentAssessmentSession = {
        studentId: null,
        studentName: null,
        markingSchemeId: null,
        learningOutcomes: [],
        currentLOIndex: 0,
        selections: {},
        startedAt: null,
        completedAt: null
    };
    
    console.log('Assessment session cleared');
}

/**
 * Reset student assessment (delete results and mark as not accessed)
 * @param {string} studentId - Student ID
 * @returns {boolean} - True if successful
 */
function resetStudentAssessment(studentId) {
    showConfirmDialog(
        'Are you sure you want to reset this student\'s assessment? They will need to be reassessed.',
        () => {
            const success = clearStudentAssessment(studentId);
            if (success) {
                showNotification('Assessment reset successfully', 'success');
            }
        },
        null
    );
    
    return true;
}

// =====================================================
// HELPER: Get assessment readable format
// =====================================================

/**
 * Get assessment formatted for display
 * @param {string} studentId - Student ID
 * @returns {object|null} - Formatted assessment data or null
 */
function getFormattedAssessmentForDisplay(studentId) {
    const detailedResult = getDetailedAssessmentResult(studentId);
    
    if (!detailedResult) return null;
    
    const loResults = [];
    
    Object.values(detailedResult.enrichedAssessments).forEach(assessment => {
        loResults.push({
            loNumber: assessment.loNumber,
            loTitle: assessment.loTitle,
            bandNumber: assessment.bandNumber,
            bandLabel: assessment.bandLabel,
            bandCategory: assessment.bandCategory,
            feedback: assessment.feedback,
            categoryColor: assessment.bandCategory === 'Fail' ? 'red' : 
                          assessment.bandCategory === 'Pass' ? 'green' :
                          assessment.bandCategory === 'Merit' ? 'blue' : 'purple'
        });
    });
    
    return {
        studentId: detailedResult.studentId,
        studentName: detailedResult.studentName,
        completedAt: formatDate(detailedResult.completedAt),
        loResults: loResults,
        overallFeedback: detailedResult.overallFeedback || ''
    };
}
