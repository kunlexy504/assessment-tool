/**
 * LAT Feedforward Worker
 * Cloudflare Worker that receives student assessment data,
 * calls the Gemini API, and returns an AI-generated feedforward.
 *
 * Secret required:  GEMINI_API_KEY
 * Set it with:      wrangler secret put GEMINI_API_KEY
 */

const GEMINI_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
    async fetch(request, env) {
        // ── CORS preflight ──────────────────────────────────────────────
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        if (request.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        // ── Parse request body ──────────────────────────────────────────
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: 'Invalid JSON body' }, 400);
        }

        const { assessmentData, wordLimit = 200 } = body;

        if (!assessmentData || !Array.isArray(assessmentData.loResults)) {
            return jsonResponse({ error: 'Missing or invalid assessmentData' }, 400);
        }

        if (!env.GEMINI_API_KEY) {
            return jsonResponse({ error: 'API key not configured' }, 500);
        }

        // ── Build prompt ────────────────────────────────────────────────
        const prompt = buildPrompt(assessmentData, wordLimit);

        // ── Call Gemini API ─────────────────────────────────────────────
        let geminiRes;
        try {
            geminiRes = await fetch(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: 700,
                        temperature: 0.8,
                        topP: 0.9,
                    },
                }),
            });
        } catch (err) {
            console.error('Gemini fetch error:', err);
            return jsonResponse({ error: 'Failed to reach AI service' }, 502);
        }

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            console.error('Gemini API error:', errText);
            return jsonResponse({ error: 'AI service returned an error' }, 502);
        }

        const data = await geminiRes.json();
        const feedforward =
            data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        if (!feedforward) {
            return jsonResponse({ error: 'AI returned empty response' }, 500);
        }

        return jsonResponse({ feedforward });
    },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildPrompt(assessmentData, wordLimit) {
    const { studentName, loResults } = assessmentData;

    const loSummary = loResults
        .map(
            lo =>
                `• ${lo.loNumber} — ${lo.loTitle}\n` +
                `  Band ${lo.bandNumber} (${lo.bandLabel}) [${lo.bandCategory}]\n` +
                `  Feedback: ${lo.feedback}`
        )
        .join('\n\n');

    return `You are an educational assessment assistant helping lecturers communicate constructive feedforward to students.

Write a personalised feedforward summary for ${studentName} based on their assessment results below.

Rules:
- Write directly TO the student (use "you / your")
- Maximum ${wordLimit} words — be concise
- Structure: (1) brief acknowledgement of overall performance, (2) highlight 1–2 genuine strengths from the LO feedback, (3) identify 1–2 key areas to improve with specific, actionable advice, (4) short motivating closing sentence
- Use encouraging, professional language
- Do NOT repeat band numbers or categories verbatim — paraphrase naturally

Assessment results for ${studentName}:
${loSummary}

Write the feedforward now:`;
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
}
