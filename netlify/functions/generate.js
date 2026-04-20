exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { field, technique, topic } = JSON.parse(event.body);

    if (!field || !topic) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing field or topic' })
      };
    }

    // Field-specific framing (now includes Education)
    const fieldFraming = {
      clinical: 'Use the PICO framework. Focus on testable clinical hypotheses.',
      stem: 'Focus on methodological gaps and falsifiable experiments.',
      social: 'Generate both quantitative and qualitative research angles.',
      education: 'Use frameworks like Bloom\'s Taxonomy, UDL, or design-based research. Focus on pedagogical interventions, learning outcomes, or equity in education.',
      humanities: 'Use theoretical lenses and archival perspectives. Avoid "gap" language.',
      comp: 'Focus on generalization, efficiency, and benchmark limitations.'
    };

    // Technique-specific instructions
    const techniqueInstructions = {
      standard: 'Generate a clear, structured academic prompt.',
      falsificationist: `Structure the prompt to ask for a falsification test. Include:
        - Task 1: State the dominant hypothesis.
        - Task 2: Design a minimal experiment that would FALSIFY it.
        - Task 3: Estimate likelihood of falsification based on current constraints.`,
      adversarial: `Structure the prompt as an adversarial dialectic:
        - Task 1 (Thesis): Authoritative synthesis of consensus.
        - Task 2 (Antithesis): Heterodox critique attacking methodological assumptions.
        - Task 3 (Synthesis): Reconcile the conflict and identify the precise friction point.`,
      triangulation: `Structure the prompt for methodological triangulation:
        - Task 1: Frame the problem quantitatively (variables, measurement, variance).
        - Task 2: Frame the same problem qualitatively (process, meaning, lived experience).
        - Task 3: Identify one insight from Task 2 that cannot be captured by Task 1.`,
      genealogy: `Structure the prompt as a conceptual genealogy:
        - Task 1: Trace semantic shifts of the key concept over the last 50 years.
        - Task 2: Identify what is excluded or marginalized by the dominant definition.
        - Task 3: Propose a research question that re-problematizes the term.`,
      peerreview: `Structure the prompt as a peer review simulation:
        - Task 1 (Major Concern): One paragraph of specific, harsh methodological critique.
        - Task 2 (Required Citation): One study the author MUST cite to address the concern.
        - Task 3 (Revised Question): Rewrite the gap into a defensible research question.`
    };

    const framing = fieldFraming[field] || fieldFraming.clinical;
    const techniquePrompt = techniqueInstructions[technique] || techniqueInstructions.standard;

    const systemPrompt = `You are an expert prompt engineer for academic research. Generate a structured, rigorous prompt that the user will paste into another LLM.

CRITICAL: You are generating the PROMPT TEXT only, not answering the research question.

Generate a prompt that includes:
1. A role assignment appropriate to the field.
2. A structured framework. ${framing}
3. The following cognitive technique: ${techniquePrompt}
4. This exact citation protocol: "[CRITICAL CITATION PROTOCOL: Output only [Author Last Name, Year, Journal Hint]. Never invent full citations. If uncertain, use [YEAR?] or [VERIFY: Search Term].]"

User Discipline: ${field}
User Topic: ${topic}

Output only the prompt text, no commentary.`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: systemPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error('Groq API error:', data);
      throw new Error(data.error?.message || 'Groq API error');
    }

    const generatedPrompt = data.choices?.[0]?.message?.content || 'Error: Could not generate prompt.';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ prompt: generatedPrompt })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    };
  }
};