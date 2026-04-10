/**
 * FEEDFORWARD.JS - AI-Powered Feedforward Generation
 * Calls the Groq API (free tier — 14,400 req/day, no credit card needed).
 */

// API key is set in js/firebase-config.js (gitignored) as window._groqApiKey
// NOTE: read at call time (not load time) — firebase-config.js runs after this script
const GROQ_URL       = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL     = 'llama-3.1-8b-instant';
const FF_COOLDOWN_MS = 30000; // 30-second cooldown between requests per student
const _ffCooldowns   = {};    // { studentId: lastRequestTimestamp }

// =====================================================
// MAIN GENERATION FUNCTIONS
// =====================================================

/**
 * Generate AI feedforward for a student.
 * Reads their full assessment, calls Gemini, saves the result.
 * @param {string} studentId
 * @param {number} wordLimit  – from app settings
 * @returns {Promise<string>} – generated feedforward text, or '' on error
 */
async function generateStudentFeedforward(studentId, wordLimit = 200) {
    // Rate limiting — enforce cooldown per student
    const now = Date.now();
    const last = _ffCooldowns[studentId] || 0;
    const wait = Math.ceil((FF_COOLDOWN_MS - (now - last)) / 1000);
    if (now - last < FF_COOLDOWN_MS) {
        showNotification(`Please wait ${wait}s before generating again`, 'warning');
        return '';
    }
    _ffCooldowns[studentId] = now;

    const assessment = getDetailedAssessmentResult(studentId);
    if (!assessment) {
        showNotification('Assessment data not found', 'error');
        return '';
    }

    const assessmentData = _buildAssessmentPayload(assessment);
    let feedforward = await _callGroq(assessmentData, wordLimit);

    if (feedforward) {
        // Replace any "[Your Name]" placeholder with the logged-in lecturer's name
        const user = getCurrentUser();
        const lecturerName = (user && (user.displayName || user.email)) || 'Your Lecturer';
        feedforward = feedforward.replace(/\[Your Name\]/gi, lecturerName);

        // Hard-enforce the word limit — truncate if AI exceeded it
        const words = feedforward.trim().split(/\s+/);
        if (words.length > wordLimit) {
            feedforward = words.slice(0, wordLimit).join(' ');
        }

        updateAssessmentFeedback(assessment.id, feedforward);
    }

    return feedforward;
}

/**
 * Regenerate feedforward — always produces a fresh response.
 * @param {string} studentId
 * @param {string} _tone  – kept for API compatibility (ignored — Gemini handles tone)
 * @param {number} wordLimit
 * @returns {Promise<string>}
 */
async function regenerateFeedforward(studentId, _tone = 'supportive', wordLimit = 200) {
    return generateStudentFeedforward(studentId, wordLimit);
}

// =====================================================
// GROQ API COMMUNICATION
// =====================================================

/**
 * Call the Groq API and return the feedforward text.
 * @param {object} assessmentData
 * @param {number} wordLimit
 * @returns {Promise<string>}
 */
async function _callGroq(assessmentData, wordLimit) {
    const prompt = _buildPrompt(assessmentData, wordLimit);

    try {
        const response = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window._groqApiKey || ''}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 700,
                temperature: 0.8,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            const msg = data?.error?.message || 'Unknown error';
            console.error('Groq API error:', msg);
            showNotification('AI generation failed: ' + msg, 'error');
            return '';
        }

        const feedforward = data?.choices?.[0]?.message?.content?.trim() || '';

        if (!feedforward) {
            showNotification('AI returned an empty response. Please try again.', 'error');
            return '';
        }

        return feedforward;

    } catch (err) {
        console.error('Groq fetch error:', err);
        showNotification('Could not reach the AI service. Check your connection.', 'error');
        return '';
    }
}

/**
 * Build the prompt with full scheme context and band-aware tone rules.
 * @param {object} assessmentData
 * @param {number} wordLimit
 * @returns {string}
 */
function _buildPrompt(assessmentData, wordLimit) {
    const {
        studentName,
        schemeName,
        courseName,
        institution,
        bandScale,
        maxBandNumber,
        loResults
    } = assessmentData;

    // ── Overall performance level ──────────────────────────────────────────
    const avgBand = loResults.reduce((s, lo) => s + lo.bandNumber, 0) / loResults.length;
    const allTopBand = loResults.every(lo => lo.bandNumber === maxBandNumber);
    const allDistinction = loResults.every(lo => lo.bandCategory === 'Distinction');
    const anyFail = loResults.some(lo => lo.bandCategory === 'Fail');

    let overallToneRule;
    if (allTopBand) {
        overallToneRule = `OVERALL TONE: The student achieved the HIGHEST possible band in EVERY learning outcome. Your tone must be entirely celebratory and reinforcing. Do NOT suggest any improvements or areas to work on — there are none at this level.`;
    } else if (allDistinction) {
        overallToneRule = `OVERALL TONE: Distinction-level performance across all LOs. Predominantly celebratory. Only mention growth if a band was clearly lower than the others.`;
    } else if (anyFail) {
        overallToneRule = `OVERALL TONE: Some learning outcomes were not passed. Be supportive and encouraging but honest. Clearly identify what must improve with specific, actionable steps. Do not over-praise areas that did not meet the pass threshold.`;
    } else if (avgBand / maxBandNumber >= 0.7) {
        overallToneRule = `OVERALL TONE: Strong overall performance. Acknowledge genuine achievements warmly, then identify 1–2 focused areas for development.`;
    } else {
        overallToneRule = `OVERALL TONE: Mixed performance. Be balanced — recognise what was done well and clearly explain what needs to improve with concrete actions.`;
    }

    // ── Per-LO breakdown ───────────────────────────────────────────────────
    const loDetails = loResults.map(lo => {
        let toneNote;
        if (lo.bandNumber === maxBandNumber) {
            toneNote = `⚠ TOP BAND ACHIEVED — reinforce this strength ONLY. Do NOT criticise or suggest improvement for this LO.`;
        } else if (lo.bandCategory === 'Distinction') {
            toneNote = `High achievement — acknowledge strongly, brief forward-looking note only if appropriate.`;
        } else if (lo.bandCategory === 'Merit') {
            toneNote = `Good achievement — recognise the strength and identify one focused area to develop further.`;
        } else if (lo.bandCategory === 'Pass') {
            toneNote = `Satisfactory — acknowledge what was done, clearly explain what needs to improve with specific advice.`;
        } else {
            toneNote = `Below pass — be supportive but direct, explain specifically what must change.`;
        }

        return (
            `${lo.loNumber}: ${lo.loTitle}\n` +
            `  Key indicators assessed: ${lo.keyIndicators}\n` +
            `  Band achieved: ${lo.bandNumber} — ${lo.bandLabel} [${lo.bandCategory}] (out of ${maxBandNumber})\n` +
            `  What this band means: ${lo.feedback}\n` +
            `  Tone instruction: ${toneNote}`
        );
    }).join('\n\n');

    // ── Full band scale ────────────────────────────────────────────────────
    const bandScaleText = bandScale
        .map(b => `  Band ${b.bandNumber} (${b.label}) — ${b.category} — Score range: ${b.scoreRange}`)
        .join('\n');

    return `You are an expert academic assessor writing personalised feedforward for a student at ${institution || 'a higher education institution'}.

COURSE: ${schemeName} — ${courseName}

FULL BAND SCALE FOR THIS SCHEME (so you understand exactly where the student stands):
${bandScaleText}

${overallToneRule}

CRITICAL RULES — you MUST follow every one of these:
1. Read every band score carefully. Your feedback for each LO must directly reflect what that band descriptor says — nothing more, nothing less.
2. NEVER criticise or suggest improvement for an LO where the student achieved the top band. That is factually incorrect and misleading.
3. NEVER invent weaknesses that are not evidenced by the band scores.
4. NEVER give generic advice — every sentence must relate specifically to this student's results and this course.
5. Write directly TO the student using "you" / "your".
6. Use domain-specific language appropriate for ${courseName}.
7. STRICT WORD LIMIT: Write EXACTLY ${wordLimit} words — no more, no fewer than ${Math.round(wordLimit * 0.9)}.

STUDENT: ${studentName}
ASSESSMENT RESULTS:

${loDetails}

Write the feedforward now, addressing ${studentName} directly (EXACTLY ${wordLimit} words):`;
}

/**
 * Build the full assessment payload including marking scheme context.
 * @param {object} detailedResult  – from getDetailedAssessmentResult()
 * @returns {object}
 */
function _buildAssessmentPayload(detailedResult) {
    // Fetch the full marking scheme for this assessment
    const scheme = getMarkingSchemeById(detailedResult.markingSchemeId);
    const bandScores = (scheme && scheme.bandScores) || [];
    const maxBandNumber = bandScores.length
        ? Math.max(...bandScores.map(b => b.bandNumber))
        : 9;

    const loResults = Object.values(detailedResult.enrichedAssessments).map(a => {
        // Find the LO in the scheme to get key indicators
        const schemeLoList = (scheme && scheme.learningOutcomes) || [];
        const schemeLo = schemeLoList.find(l => l.loNumber === a.loNumber) || {};
        const keyIndicators = (schemeLo.keyIndicators || []).join(', ') || 'See LO descriptor';

        return {
            loNumber:     a.loNumber,
            loTitle:      a.loTitle,
            keyIndicators,
            bandNumber:   a.bandNumber,
            bandLabel:    a.bandLabel,
            bandCategory: a.bandCategory,
            feedback:     a.feedback,
        };
    });

    return {
        studentName:   detailedResult.studentName,
        schemeName:    (scheme && scheme.schemeName)  || 'Assessment',
        courseName:    (scheme && scheme.courseName)  || 'Course',
        institution:   (scheme && scheme.institution) || '',
        bandScale:     bandScores.sort((a, b) => a.bandNumber - b.bandNumber),
        maxBandNumber,
        loResults,
    };
}

// =====================================================
// SAVED FEEDFORWARD HELPERS
// (used by the review/edit panel)
// =====================================================

/**
 * Get the saved feedforward for a student (or '' if none).
 * @param {string} studentId
 * @returns {string}
 */
function getSavedFeedforward(studentId) {
    const result = getAssessmentResult(studentId);
    return result ? (result.overallFeedback || '') : '';
}

/**
 * Save an edited feedforward for a student.
 * @param {string} studentId
 * @param {string} feedforwardText
 */
function updateFeedforwardManually(studentId, feedforwardText) {
    const result = getAssessmentResult(studentId);
    if (result) {
        updateAssessmentFeedback(result.id, sanitizeInput(feedforwardText));
        showNotification('Feedforward saved', 'success');
    }
}

// =====================================================
// LEGACY HELPERS
// (kept so nothing else breaks)
// =====================================================

function analyzePerformance(assessment) {
    const enriched = assessment.enrichedAssessments || {};
    return { studentName: assessment.studentName, enrichedAssessments: enriched };
}

function getSavedFeedforwardForSession() {
    const session = getCurrentAssessmentSession();
    if (!session || !session.studentId) return '';
    return getSavedFeedforward(session.studentId);
}
