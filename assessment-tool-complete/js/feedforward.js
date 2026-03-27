/**
 * FEEDFORWARD.JS - Dynamic Feedforward Generation
 * Creates constructive, personalized feedforward based on:
 * - Student's assessment results
 * - Feedback from each LO + band score selection
 * - Overall performance patterns
 * 
 * Feedforward is different from feedback:
 * - Feedback: What they did well/poorly (from rubric)
 * - Feedforward: How to improve for next time (AI-generated, dynamic)
 */

// =====================================================
// FEEDFORWARD GENERATION
// =====================================================

/**
 * Generate personalized feedforward for student
 * @param {string} studentId - Student ID
 * @param {number} wordLimit - Maximum word count (from settings)
 * @returns {Promise<string>} - Generated feedforward text
 */
async function generateStudentFeedforward(studentId, wordLimit = 200) {
    const assessment = getDetailedAssessmentResult(studentId);
    
    if (!assessment) {
        console.error('Assessment not found');
        return '';
    }
    
    // Analyze performance across all LOs
    const analysis = analyzePerformance(assessment);
    
    // Generate feedforward based on analysis
    const feedforward = createFeedforwardText(analysis, wordLimit);
    
    // Save feedforward to result
    updateAssessmentFeedback(assessment.id, feedforward);
    
    return feedforward;
}

/**
 * Regenerate feedforward with different tone/perspective
 * @param {string} studentId - Student ID
 * @param {string} tone - Tone: 'supportive', 'critical', 'encouraging'
 * @param {number} wordLimit - Maximum word count
 * @returns {Promise<string>} - Regenerated feedforward
 */
async function regenerateFeedforward(studentId, tone = 'supportive', wordLimit = 200) {
    const assessment = getDetailedAssessmentResult(studentId);
    
    if (!assessment) {
        console.error('Assessment not found');
        return '';
    }
    
    const analysis = analyzePerformance(assessment);
    
    // Generate with different tone
    const feedforward = createFeedforwardText(analysis, wordLimit, tone);
    
    // Save regenerated feedforward
    updateAssessmentFeedback(assessment.id, feedforward);
    
    return feedforward;
}

// =====================================================
// PERFORMANCE ANALYSIS
// =====================================================

/**
 * Analyze student performance across all assessments
 * @param {object} assessment - Detailed assessment result
 * @returns {object} - Analysis object with patterns and insights
 */
function analyzePerformance(assessment) {
    const enriched = assessment.enrichedAssessments || {};
    
    const analysis = {
        studentName: assessment.studentName,
        totalLOs: Object.keys(enriched).length,
        assessments: [],
        bandScoreDistribution: {},
        categoryDistribution: {},
        overallLevel: null,
        patterns: [],
        strengths: [],
        areasForImprovement: []
    };
    
    // Analyze each LO assessment
    Object.values(enriched).forEach(loAssessment => {
        analysis.assessments.push({
            loNumber: loAssessment.loNumber,
            loTitle: loAssessment.loTitle,
            bandNumber: loAssessment.bandNumber,
            bandLabel: loAssessment.bandLabel,
            bandCategory: loAssessment.bandCategory,
            feedback: loAssessment.feedback
        });
        
        // Track band score distribution
        const bandKey = `${loAssessment.bandNumber} (${loAssessment.bandLabel})`;
        analysis.bandScoreDistribution[bandKey] = 
            (analysis.bandScoreDistribution[bandKey] || 0) + 1;
        
        // Track category distribution
        analysis.categoryDistribution[loAssessment.bandCategory] = 
            (analysis.categoryDistribution[loAssessment.bandCategory] || 0) + 1;
    });
    
    // Determine overall level
    analysis.overallLevel = calculateOverallLevel(enriched);
    
    // Identify patterns
    analysis.patterns = identifyPatterns(enriched);
    
    // Identify strengths and areas for improvement
    const classified = classifyAssessments(enriched);
    analysis.strengths = classified.strengths;
    analysis.areasForImprovement = classified.areasForImprovement;
    
    return analysis;
}

/**
 * Calculate overall performance level
 * @param {object} enrichedAssessments - All assessments with details
 * @returns {string} - Overall level description
 */
function calculateOverallLevel(enrichedAssessments) {
    const bandNumbers = Object.values(enrichedAssessments).map(a => a.bandNumber);
    const average = bandNumbers.reduce((a, b) => a + b, 0) / bandNumbers.length;
    
    if (average <= 2) return 'Struggling';
    if (average <= 3) return 'Below Average';
    if (average <= 4) return 'Average';
    if (average <= 6) return 'Good';
    if (average <= 7) return 'Excellent';
    return 'Outstanding';
}

/**
 * Identify patterns in performance
 * @param {object} enrichedAssessments - All assessments
 * @returns {array} - Array of pattern strings
 */
function identifyPatterns(enrichedAssessments) {
    const patterns = [];
    const assessments = Object.values(enrichedAssessments);
    
    // Pattern 1: Consistency
    const bandNumbers = assessments.map(a => a.bandNumber);
    const variance = calculateVariance(bandNumbers);
    
    if (variance < 1) {
        patterns.push('consistent_performance');
    } else if (variance > 3) {
        patterns.push('variable_performance');
    }
    
    // Pattern 2: Fail/Pass distribution
    const failCount = assessments.filter(a => a.bandCategory === 'Fail').length;
    const passCount = assessments.filter(a => a.bandCategory === 'Pass').length;
    
    if (failCount > 0 && passCount === 0) {
        patterns.push('all_failing');
    } else if (failCount > passCount) {
        patterns.push('more_fails_than_passes');
    }
    
    // Pattern 3: High performance areas
    const highPerformers = assessments.filter(a => a.bandNumber >= 7);
    if (highPerformers.length > 0) {
        patterns.push('some_high_performance');
    }
    
    return patterns;
}

/**
 * Classify assessments into strengths and areas for improvement
 * @param {object} enrichedAssessments - All assessments
 * @returns {object} - { strengths: array, areasForImprovement: array }
 */
function classifyAssessments(enrichedAssessments) {
    const strengths = [];
    const areasForImprovement = [];
    
    Object.values(enrichedAssessments).forEach(assessment => {
        if (assessment.bandNumber >= 6) {
            // Band 6+ = strength
            strengths.push({
                lo: assessment.loNumber,
                label: assessment.bandLabel,
                category: assessment.bandCategory
            });
        } else if (assessment.bandNumber <= 3) {
            // Band 1-3 = area for improvement
            areasForImprovement.push({
                lo: assessment.loNumber,
                label: assessment.bandLabel,
                category: assessment.bandCategory
            });
        }
    });
    
    return { strengths, areasForImprovement };
}

/**
 * Calculate statistical variance
 * @param {array} numbers - Array of numbers
 * @returns {number} - Variance
 */
function calculateVariance(numbers) {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((a, b) => a + b) / numbers.length;
    const squareDiffs = numbers.map(v => Math.pow(v - mean, 2));
    return squareDiffs.reduce((a, b) => a + b) / numbers.length;
}

// =====================================================
// FEEDFORWARD TEXT GENERATION
// =====================================================

/**
 * Create feedforward text based on analysis - DYNAMIC & PERSONALIZED
 * @param {object} analysis - Performance analysis
 * @param {number} wordLimit - Maximum words
 * @param {string} tone - Tone: 'supportive', 'critical', 'encouraging'
 * @returns {string} - Generated feedforward
 */
function createFeedforwardText(analysis, wordLimit = 200, tone = 'supportive') {
    const sections = [];
    
    // 1. DYNAMIC Opening - Specific to student's overall level
    sections.push(generateDynamicOpening(analysis, tone));
    
    // 2. PERSONALIZED Strengths - Reference actual strong LOs
    if (analysis.strengths.length > 0) {
        sections.push(generatePersonalizedStrengths(analysis));
    }
    
    // 3. TARGETED Improvement areas - Specific LO weaknesses
    if (analysis.areasForImprovement.length > 0) {
        sections.push(generateTargetedImprovements(analysis));
    }
    
    // 4. CUSTOMIZED Action Plan - Based on their specific patterns
    sections.push(generateCustomizedActionPlan(analysis, tone));
    
    // 5. DYNAMIC Closing - Reflective of their performance level
    sections.push(generateDynamicClosing(analysis, tone));
    
    // Combine and enforce word limit
    let feedforward = sections.filter(s => s && s.length > 0).join(' ').trim();
    feedforward = enforceWordLimit(feedforward, wordLimit);
    
    return feedforward;
}

/**
 * Generate dynamic opening statement personalized to student
 */
function generateDynamicOpening(analysis, tone) {
    const studentName = analysis.studentName || 'Student';
    const level = analysis.overallLevel;
    const loCount = analysis.totalLOs;
    
    const openings = {
        'Struggling': {
            supportive: `${studentName}, thank you for completing this assessment across ${loCount} learning outcomes. Your current performance level shows areas that require immediate focused attention and support.`,
            critical: `${studentName}, your assessment results across ${loCount} learning outcomes indicate significant performance gaps that need urgent remediation.`,
            encouraging: `${studentName}, you've completed the assessment. While your current level shows ${level.toLowerCase()} performance, there's clear potential for significant improvement with targeted effort.`
        },
        'Below Average': {
            supportive: `${studentName}, your assessment demonstrates foundational engagement with ${loCount} learning outcomes, but there are notable gaps to address.`,
            critical: `${studentName}, your assessment shows below-average performance across ${loCount} outcomes, suggesting need for stronger foundation building.`,
            encouraging: `${studentName}, you've made a start across ${loCount} learning outcomes. Building stronger foundations in specific areas will help you progress effectively.`
        },
        'Average': {
            supportive: `${studentName}, your assessment performance demonstrates satisfactory engagement with ${loCount} learning outcomes, with clear opportunities for growth.`,
            critical: `${studentName}, while you've demonstrated average performance across ${loCount} outcomes, reaching your potential requires pushing beyond these baseline levels.`,
            encouraging: `${studentName}, you've achieved average performance across ${loCount} outcomes. With targeted focus on specific areas, you can elevate your overall performance significantly.`
        },
        'Good': {
            supportive: `${studentName}, your assessment demonstrates good competency across ${loCount} learning outcomes. You've shown solid understanding in several areas with opportunity for deepening that expertise.`,
            critical: `${studentName}, your good performance across ${loCount} outcomes shows capacity. However, consistency and depth in weaker areas remain necessary for excellence.`,
            encouraging: `${studentName}, congratulations on your good performance across ${loCount} learning outcomes! You're building genuine competency and further refinement will lead to distinction-level work.`
        },
        'Excellent': {
            supportive: `${studentName}, your assessment reflects excellent performance across ${loCount} learning outcomes. You demonstrate strong mastery and understanding that positions you well for advanced work.`,
            critical: `${studentName}, your excellent performance shows strong capability. Sustaining this excellence while eliminating remaining gaps will move you toward distinction-level achievement.`,
            encouraging: `${studentName}, excellent work across ${loCount} learning outcomes! Your demonstrated mastery is impressive, and fine-tuning specific areas will help you achieve distinction-level achievement.`
        },
        'Outstanding': {
            supportive: `${studentName}, your assessment results reflect outstanding performance across ${loCount} learning outcomes. You've demonstrated exceptional mastery and depth of understanding.`,
            critical: `${studentName}, your outstanding performance across ${loCount} outcomes is commendable. Maintaining this standard will secure distinction-level achievement.`,
            encouraging: `${studentName}, outstanding performance! Your mastery across ${loCount} learning outcomes demonstrates exceptional capability and positions you for distinction-level results.`
        }
    };
    
    const categoryOpenings = openings[level] || openings['Average'];
    return categoryOpenings[tone] || categoryOpenings['supportive'];
}

/**
 * Generate personalized strengths section with specific LO names
 */
function generatePersonalizedStrengths(analysis) {
    if (analysis.strengths.length === 0) return '';
    
    const loNames = analysis.strengths.map(s => s.lo).join(' and ');
    const bandLabels = [...new Set(analysis.strengths.map(s => s.label))].join(', ');
    
    return `Your demonstrated strength in ${loNames} (achieving ${bandLabels}-level work) showcases your ability to engage deeply with complex concepts and apply them effectively.`;
}

/**
 * Generate targeted improvement section specific to weak areas
 */
function generateTargetedImprovements(analysis) {
    if (analysis.areasForImprovement.length === 0) return '';
    
    const weakLOs = analysis.areasForImprovement.map(a => a.lo).join(' and ');
    const improvementCount = analysis.areasForImprovement.length;
    
    if (improvementCount === 1) {
        return `${weakLOs} requires your focused attention. Invest additional time in understanding foundational concepts and practicing application.`;
    } else {
        return `${weakLOs} are areas requiring your priority attention. These ${improvementCount} outcomes need consistent, deliberate practice and concept reinforcement.`;
    }
}

/**
 * Generate customized action plan based on specific performance patterns
 */
function generateCustomizedActionPlan(analysis, tone) {
    const recommendations = [];
    
    // Analyze consistency
    const variance = calculateVariance(Object.values(analysis.enrichedAssessments).map(a => a.bandNumber));
    
    if (variance < 1) {
        recommendations.push('Your consistent performance across outcomes is excellent - leverage this stability to push for improvement in all areas simultaneously.');
    } else if (variance > 3) {
        recommendations.push('Address the variability in your performance - identify what supports your strong areas and replicate those strategies in weaker ones.');
    }
    
    // Identify strongest LO for leverage
    const bestLO = Object.values(analysis.enrichedAssessments).reduce((best, current) => 
        current.bandNumber > best.bandNumber ? current : best
    );
    
    if (bestLO.bandNumber >= 6) {
        recommendations.push(`Apply the study and preparation strategies that enabled your success in ${bestLO.loNumber} to your developing areas.`);
    }
    
    // Get specific actions
    if (analysis.areasForImprovement.length > 0) {
        recommendations.push('Seek additional resources, tutoring, or peer discussion specifically for your weaker outcomes.');
    }
    
    return recommendations.length > 0 ? 
        `To improve: ${recommendations.join(' ')}` : 
        'Continue leveraging your effective strategies across all learning outcomes.';
}

/**
 * Generate dynamic closing specific to student's level and tone
 */
function generateDynamicClosing(analysis, tone) {
    const level = analysis.overallLevel;
    
    const closings = {
        'Struggling': {
            supportive: 'Reach out to your instructor or academic support services - additional guidance is available and will significantly help your progress.',
            critical: 'Immediate intervention and structured support are needed to address performance gaps.',
            encouraging: 'You have potential. With dedicated effort and strategic support, meaningful improvement is absolutely achievable.'
        },
        'Below Average': {
            supportive: 'Building stronger foundations across your weaker areas will create momentum for your overall progress.',
            critical: 'Systematic effort to strengthen foundational understanding is essential for advancement.',
            encouraging: 'You\'re establishing a foundation - strengthening it now will enable faster progress toward your goals.'
        },
        'Average': {
            supportive: 'Moving from satisfactory to strong requires deliberate focus on deepening understanding and application.',
            critical: 'Transcending average requires going beyond minimum competency - commit to deeper mastery.',
            encouraging: 'You\'ve established competency - now build on it by deepening and extending your understanding.'
        },
        'Good': {
            supportive: 'Your good foundation provides an excellent platform for achieving distinction-level work through targeted refinement.',
            critical: 'Distinction requires excellence - eliminate remaining gaps with precision and rigor.',
            encouraging: 'Your good work is solid. Push toward excellence by refining weaker areas and deepening your best work.'
        },
        'Excellent': {
            supportive: 'Your excellent performance demonstrates you\'re well on track. Maintaining this trajectory will yield distinction-level results.',
            critical: 'Sustain this excellence - it\'s the foundation for achieving distinction-level distinction.',
            encouraging: 'Excellent work! You\'re performing at a high level - maintain this momentum for distinction-level achievement.'
        },
        'Outstanding': {
            supportive: 'Your outstanding performance reflects exceptional capability. You\'re well-positioned for distinction-level recognition.',
            critical: 'Your outstanding work is exceptional - this level of performance merits distinction-level results.',
            encouraging: 'Outstanding performance! You\'ve demonstrated exceptional mastery and excellence across your learning outcomes.'
        }
    };
    
    const categoryClosings = closings[level] || closings['Average'];
    return categoryClosings[tone] || categoryClosings['supportive'];
}

/**
 * Enforce word limit on text
 * @param {string} text - Generated text
 * @param {number} limit - Word limit
 * @returns {string} - Text within word limit
 */
function enforceWordLimit(text, limit = 200) {
    const words = text.split(/\s+/);
    
    if (words.length <= limit) {
        return text;
    }
    
    // Truncate to limit and clean up
    const truncated = words.slice(0, limit).join(' ');
    
    // Remove incomplete sentence at end
    const lastPeriod = truncated.lastIndexOf('.');
    const lastComma = truncated.lastIndexOf(',');
    const lastEnd = Math.max(lastPeriod, lastComma);
    
    if (lastEnd > -1) {
        return truncated.substring(0, lastEnd + 1);
    }
    
    return truncated + '.';
}

// =====================================================
// FEEDFORWARD RETRIEVAL & UPDATES
// =====================================================

/**
 * Get saved feedforward for student
 * @param {string} studentId - Student ID
 * @returns {string} - Feedforward text or empty string
 */
function getSavedFeedforward(studentId) {
    const result = getAssessmentResult(studentId);
    return result ? result.overallFeedback : '';
}

/**
 * Update feedforward manually
 * @param {string} studentId - Student ID
 * @param {string} feedforwardText - New feedforward text
 */
function updateFeedforwardManually(studentId, feedforwardText) {
    const result = getAssessmentResult(studentId);
    
    if (result) {
        updateAssessmentFeedback(result.id, sanitizeInput(feedforwardText));
        showNotification('Feedforward updated', 'success');
    }
}
