/**
 * MARKINGSCHEME.JS - Marking Scheme Management
 * Handles creation, editing, and management of marking schemes
 * Supports both document upload (disabled for demo) and manual entry
 * 
 * For demo version: Manual entry only
 * Future: Add document parsing capability
 */

// =====================================================
// MARKING SCHEME CREATION
// =====================================================

/**
 * Parse uploaded marking scheme document
 * Currently disabled for demo version
 * @param {File} file - Uploaded document file
 * @returns {Promise<object|null>} - Parsed scheme or null if failed
 */
async function parseMarkingSchemeDocument(file) {
    // DISABLED FOR DEMO VERSION
    // Future implementation will use document parsing library
    console.log('Document parsing disabled for demo version');
    return null;
}

/**
 * Create marking scheme with manual entry
 * @param {string} schemeName - Name of the scheme
 * @param {string} institution - Institution name
 * @param {string} courseCode - Course code
 * @param {string} courseName - Course name
 * @param {array} bandScores - Array of band score objects
 * @param {array} learningOutcomes - Array of learning outcome objects
 * @returns {object} - Created marking scheme
 */
function createMarkingSchemeManual(
    schemeName,
    institution,
    courseCode,
    courseName,
    bandScores,
    learningOutcomes
) {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        console.error('User must be logged in to create scheme');
        return null;
    }
    
    // Validate inputs
    if (!sanitizeInput(schemeName)) {
        showNotification('Scheme name is required', 'error');
        return null;
    }
    
    if (!bandScores || bandScores.length === 0) {
        showNotification('At least one band score is required', 'error');
        return null;
    }
    
    if (!learningOutcomes || learningOutcomes.length === 0) {
        showNotification('At least one learning outcome is required', 'error');
        return null;
    }
    
    // Create scheme
    const scheme = createMarkingScheme(currentUser.id, {
        schemeName: sanitizeInput(schemeName),
        institution: sanitizeInput(institution),
        courseCode: sanitizeInput(courseCode),
        courseName: sanitizeInput(courseName),
        bandScores: bandScores,
        learningOutcomes: learningOutcomes
    });
    
    showNotification('Marking scheme created successfully', 'success');
    return scheme;
}

// =====================================================
// BAND SCORE MANAGEMENT
// =====================================================

/**
 * Create band score object
 * @param {number} bandNumber - Band number (1-10)
 * @param {string} label - Band label (e.g., "Incomplete", "Poor")
 * @param {string} scoreRange - Score range (e.g., "0-9", "10-29")
 * @param {string} category - Grade category (Fail, Pass, Merit, Distinction)
 * @returns {object} - Band score object
 */
function createBandScore(bandNumber, label, scoreRange, category) {
    return {
        id: generateUniqueId(),
        bandNumber: parseInt(bandNumber),
        label: sanitizeInput(label),
        scoreRange: sanitizeInput(scoreRange),
        category: sanitizeInput(category)
    };
}

/**
 * Get all band scores from scheme
 * @param {string} schemeId - Marking scheme ID
 * @returns {array} - Array of band scores
 */
function getBandScoresFromScheme(schemeId) {
    const scheme = getMarkingSchemeById(schemeId);
    return scheme ? scheme.bandScores : [];
}

/**
 * Get band score by number from scheme
 * @param {string} schemeId - Marking scheme ID
 * @param {number} bandNumber - Band number to find
 * @returns {object|null} - Band score or null
 */
function getBandScoreByNumber(schemeId, bandNumber) {
    const bandScores = getBandScoresFromScheme(schemeId);
    return findByProperty(bandScores, 'bandNumber', bandNumber);
}

// =====================================================
// LEARNING OUTCOME MANAGEMENT
// =====================================================

/**
 * Create learning outcome object
 * @param {string} loNumber - LO number (e.g., "LO1", "LO2")
 * @param {string} title - LO title
 * @param {string} description - LO description
 * @param {array} keyIndicators - Array of key indicator strings
 * @param {object} feedbacks - Object with bandNumber as key, feedback text as value
 * @returns {object} - Learning outcome object
 */
function createLearningOutcome(loNumber, title, description, keyIndicators, feedbacks) {
    return {
        id: generateUniqueId(),
        loNumber: sanitizeInput(loNumber),
        title: sanitizeInput(title),
        description: sanitizeInput(description),
        keyIndicators: keyIndicators || [],
        feedbacks: feedbacks || {} // { "1": "feedback text", "2": "feedback text", etc }
    };
}

/**
 * Get all learning outcomes from scheme
 * @param {string} schemeId - Marking scheme ID
 * @returns {array} - Array of learning outcomes
 */
function getLearningOutcomesFromScheme(schemeId) {
    const scheme = getMarkingSchemeById(schemeId);
    return scheme ? scheme.learningOutcomes : [];
}

/**
 * Get learning outcome by ID
 * @param {string} schemeId - Marking scheme ID
 * @param {string} loId - Learning outcome ID
 * @returns {object|null} - Learning outcome or null
 */
function getLearningOutcomeById(schemeId, loId) {
    const los = getLearningOutcomesFromScheme(schemeId);
    return findByProperty(los, 'id', loId);
}

/**
 * Get feedback for specific LO and band score
 * @param {string} schemeId - Marking scheme ID
 * @param {string} loId - Learning outcome ID
 * @param {number} bandNumber - Band number (1-10)
 * @returns {string} - Feedback text or empty string
 */
function getFeedbackForLOAndBand(schemeId, loId, bandNumber) {
    const lo = getLearningOutcomeById(schemeId, loId);
    
    if (lo && lo.feedbacks) {
        return lo.feedbacks[bandNumber] || '';
    }
    
    return '';
}

/**
 * Add or update feedback for specific LO and band
 * @param {string} schemeId - Marking scheme ID
 * @param {string} loId - Learning outcome ID
 * @param {number} bandNumber - Band number (1-10)
 * @param {string} feedbackText - Feedback text
 */
function setFeedbackForLOAndBand(schemeId, loId, bandNumber, feedbackText) {
    const db = getDatabase();
    const scheme = findByProperty(db.markingSchemes, 'id', schemeId);
    
    if (scheme) {
        const lo = findByProperty(scheme.learningOutcomes, 'id', loId);
        
        if (lo) {
            lo.feedbacks[bandNumber] = sanitizeInput(feedbackText);
            saveDatabase(db);
        }
    }
}

// =====================================================
// DEMO MARKING SCHEME INITIALIZATION
// =====================================================

/**
 * Create demo marking scheme for testing
 * Uses the Governance, Law & Ethics rubric as template
 * @param {string} userId - User ID of creator
 * @returns {object} - Created demo scheme
 */
function createDemoMarkingScheme(userId) {
    // Define band scores
    const bandScores = [
        createBandScore(1, 'Incomplete Submission', '0-9', 'Fail'),
        createBandScore(2, 'Poor', '10-29', 'Fail'),
        createBandScore(3, 'Limited', '30-39', 'Fail'),
        createBandScore(4, 'Basic', '40-49', 'Pass'),
        createBandScore(5, 'Good', '50-59', 'Pass'),
        createBandScore(6, 'Very Good', '60-69', 'Merit'),
        createBandScore(7, 'Excellent', '70-79', 'Distinction'),
        createBandScore(8, 'Outstanding', '80-89', 'Distinction'),
        createBandScore(9, 'Exceptional', '90-100', 'Distinction')
    ];
    
    // Define learning outcomes with feedbacks
    const learningOutcomes = [
        createLearningOutcome(
            'LO1',
            'Apply a range of corporate governance and legal principles to a variety of organisational contexts',
            'Key indicators: Depth of knowledge and understanding; Engagement with subject-specific theories, concepts, and principles; Logical argument, analysis, and synthesis; Organisation and communication of ideas & evidence; Application of discipline-specific specialist skills',
            [
                'Depth of knowledge and understanding',
                'Engagement with subject-specific theories, concepts, and principles',
                'Logical argument, analysis, and synthesis',
                'Organisation and communication of ideas & evidence',
                'Application of discipline-specific specialist skills'
            ],
            {
                1: 'Little or no evidence of demonstrating knowledge and understanding within specialised field of study. Limited or no engagement with subject-specific theories, concepts, and principles, logical argument, analysis, and synthesis.',
                2: 'Weak evidence of demonstrating knowledge and understanding within specialised field of study. A weak engagement with subject-specific theories, concepts, and principles, logical argument, analysis, and synthesis.',
                3: 'Limited evidence of demonstrating knowledge and understanding within specialised field of study. Insufficient engagement with subject-specific theories, concepts, and principles, logical argument, analysis, and synthesis.',
                4: 'Satisfactory evidence of demonstrating knowledge and understanding within specialised field of study. Satisfactory engagement with subject-specific theories, concepts, and principles, logical argument, analysis, and synthesis.',
                5: 'Good and sound breadth evidence of demonstrating knowledge and understanding within specialised field of study. Good engagement with subject-specific theories, concepts, and principles, logical argument, analysis, and synthesis.',
                6: 'Very good and refined systematic evidence of demonstrating knowledge and understanding within specialised field of study. Very good engagement with subject-specific theories, concepts, and principles, logical argument, analysis, and synthesis.',
                7: 'Excellent and highly accomplished systematic evidence of demonstrating knowledge and understanding within specialised field of study. Excellent and deep engagement with subject-specific theories, concepts, and principles, logical argument, analysis, and synthesis.',
                8: 'Outstanding systematic evidence of demonstrating knowledge and understanding within specialised field of study. Outstanding engagement with subject-specific theories, concepts, and principles, logical argument, analysis, and synthesis.',
                9: 'Exceptional systematic evidence of demonstrating knowledge and understanding within specialised field of study. Exceptional engagement with subject-specific theories, concepts, and principles, logical argument, analysis, and synthesis.'
            }
        ),
        
        createLearningOutcome(
            'LO2',
            'Evaluate the key ethical and governance theories that impact organisations in a range of international jurisdictions',
            'Key indicators: Breadth and depth of understanding; Critical evaluation of theories and concepts; Application across jurisdictions; Originality and reflection in analysis',
            [
                'Breadth and depth of understanding',
                'Critical evaluation of theories and concepts',
                'Application across jurisdictions',
                'Originality and reflection in analysis'
            ],
            {
                1: 'Little or no evidence of understanding of ethical and governance theories. No engagement with international or comparative contexts. Limited or no critical evaluation.',
                2: 'Weak evidence of understanding of ethical and governance theories. Weak engagement with international or comparative contexts. Weak critical evaluation.',
                3: 'Limited evidence of understanding of ethical and governance theories. Limited engagement with international or comparative contexts. Limited critical evaluation.',
                4: 'Satisfactory understanding of ethical and governance theories. Satisfactory engagement with international or comparative contexts. Satisfactory critical evaluation.',
                5: 'Good understanding of ethical and governance theories. Good engagement with international or comparative contexts. Good critical evaluation.',
                6: 'Very good understanding of ethical and governance theories. Very good engagement with international or comparative contexts. Very good critical evaluation.',
                7: 'Excellent understanding of ethical and governance theories. Excellent engagement with international or comparative contexts. Excellent critical evaluation.',
                8: 'Outstanding understanding of ethical and governance theories. Outstanding engagement with international or comparative contexts. Outstanding critical evaluation.',
                9: 'Exceptional understanding of ethical and governance theories. Exceptional engagement with international or comparative contexts. Exceptional critical evaluation.'
            }
        ),
        
        createLearningOutcome(
            'LO3',
            'Problem-solving, ethical decision-making, and transferable skills in complex scenarios',
            'Key indicators: Analytical and personal reflection; Problem-solving and decision-making; Self-awareness and sensitivity to diversity; Ethical decision-making and accountability; Creative and evidence-based analysis',
            [
                'Analytical and personal reflection',
                'Problem-solving and decision-making',
                'Self-awareness and sensitivity to diversity',
                'Ethical decision-making and accountability',
                'Creative and evidence-based analysis'
            ],
            {
                1: 'Little or no evidence of competency in analytical reflection. Limited or no problem-solving. Limited evidence of ethical decision-making.',
                2: 'Weak evidence of competency in analytical reflection. Weak problem-solving skills. Weak evidence of ethical decision-making.',
                3: 'Limited evidence of competency in analytical reflection. Limited problem-solving skills. Limited evidence of ethical decision-making.',
                4: 'Satisfactory evidence of competency in analytical reflection. Satisfactory problem-solving skills. Satisfactory evidence of ethical decision-making.',
                5: 'Good evidence of competency in analytical reflection. Good problem-solving skills. Good evidence of ethical decision-making.',
                6: 'Very good evidence of competency in analytical reflection. Very good problem-solving skills. Very good evidence of ethical decision-making.',
                7: 'Excellent evidence of competency in analytical reflection. Excellent problem-solving skills. Excellent evidence of ethical decision-making.',
                8: 'Outstanding evidence of competency in analytical reflection. Outstanding problem-solving skills. Outstanding evidence of ethical decision-making.',
                9: 'Exceptional evidence of competency in analytical reflection. Exceptional problem-solving skills. Exceptional evidence of ethical decision-making.'
            }
        ),
        
        createLearningOutcome(
            'LO4',
            'Transferable skills, identification and integration of sources, and referencing',
            'Key indicators: Written and electronic communication; Spelling, punctuation, and grammar; Professional presentation and use of sources; Academic publishing standards; Word count compliance',
            [
                'Written and electronic communication',
                'Spelling, punctuation, and grammar',
                'Professional presentation and use of sources',
                'Academic publishing standards',
                'Word count compliance'
            ],
            {
                1: 'Work demonstrates limited ability to maintain digital literacy and communication skills. Major errors in spelling, grammar, punctuation. Presentation unacceptable for academic publication. Little evidence of appropriate sources.',
                2: 'Work demonstrates weak ability to maintain digital literacy and communication skills. Significant errors in spelling, grammar, punctuation. Presentation unacceptable for academic publication. Weak evidence of appropriate sources.',
                3: 'Work demonstrates limited ability to maintain digital literacy and communication skills. Significant errors in spelling, grammar, punctuation. Presentation unacceptable for academic publication. Limited evidence of appropriate sources.',
                4: 'Work demonstrates satisfactory ability to maintain digital literacy and communication skills. Some errors in spelling, grammar, punctuation. Presentation satisfactory but incapable of publication. Satisfactory evidence of appropriate sources.',
                5: 'Work demonstrates good ability to maintain digital literacy and communication skills. Minor errors in spelling, grammar, punctuation. Presentation good but incapable of publication. Good evidence of appropriate sources.',
                6: 'Work demonstrates very good ability to maintain digital literacy and communication skills. Minor errors in spelling, grammar, punctuation. Presentation very good and capable of publication with amendments. Very good evidence of appropriate sources.',
                7: 'Work demonstrates excellent ability to maintain digital literacy and communication skills. Very minor errors. Presentation excellent and capable of publication with minor amendments. Excellent evidence of appropriate sources.',
                8: 'Work demonstrates outstanding ability to maintain digital literacy and communication skills. No errors. Presentation excellent and capable of academic publication. Outstanding evidence of appropriate sources.',
                9: 'Work demonstrates exceptional ability to maintain digital literacy and communication skills. No errors. Presentation exceptional and capable of academic publication. Exceptional evidence of appropriate sources.'
            }
        )
    ];
    
    // Create scheme and save to Firestore so it persists across reloads
    const scheme = createMarkingScheme(userId, {
        schemeName: 'Governance, Law & Ethics (Demo)',
        institution: 'York St. John University',
        courseCode: 'GLK101',
        courseName: 'Governance, Law and Ethics',
        bandScores: bandScores,
        learningOutcomes: learningOutcomes,
    });

    console.log('Demo marking scheme created');
    return scheme;
}
