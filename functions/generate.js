// functions/generate.js
export async function onRequest(context) {
  const { request, env } = context;

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  try {
    const { field, promptType, topic } = await request.json();

    if (!field || !topic) {
      return new Response(JSON.stringify({ error: 'Missing field or topic' }), {
        status: 400,
        headers
      });
    }

    // Detailed instructions for each prompt type
    const typeInstructions = {
      brainstorming: 'Generate novel research questions, hypotheses, or interdisciplinary connections. The output should be a list of ideas with brief rationale.',
      'gap-analysis': 'Identify underexplored areas, contradictions, or methodological weaknesses in the existing literature. For each gap, explain why it persists and suggest a testable research question.',
      outlining: 'Create a structured outline (headings and subpoints) for a paper, grant proposal, or dissertation chapter. The output should be hierarchical and clear.',
      synthesis: 'Organize existing knowledge into a thematic map, typology, or conceptual framework. Group studies into themes and provide one‑sentence summaries.',
      framework: 'Suggest three relevant theories, models, or constructs that could frame research on the topic. For each, explain core constructs and how they illuminate the topic.',
      'stress-testing': 'Critically evaluate an idea, identify weak assumptions, or design falsification tests. The output should be a numbered critique or a set of counter‑arguments.',
      'counter-argument': 'Provide plausible alternative explanations or opposing viewpoints for the given topic or claim. For each, describe what evidence would distinguish it.',
      methodology: 'Propose a study design to investigate the topic. Specify methods, data sources, and anticipated validity threats with mitigation strategies.',
      'rq-refinement': 'Transform a broad topic into progressively refined research questions using frameworks like PICo, SPICE, or FINER. Evaluate feasibility and novelty.'
    };

    const instruction = typeInstructions[promptType] || typeInstructions.brainstorming;

    const systemPrompt = `You are an expert prompt engineer. Generate a prompt that a researcher will paste into an LLM to help with ${promptType}.

The generated prompt must be strictly for ${promptType}. It should instruct the LLM to:
- ${instruction}
- Adopt an expert role appropriate for the field of ${field}.
- Consider the specific research topic: "${topic}".
- Embed this citation protocol VERBATIM: "[CRITICAL CITATION PROTOCOL: Output only [Author Last Name, Year, Journal Hint]. Never invent full citations. If uncertain, use [YEAR?] or [VERIFY: Search Term].]"
- Specify the desired output format (e.g., bullet list, numbered items, outline levels).

To make the prompt specific, briefly analyze the topic and weave in 1–2 subdomain‑relevant concepts, methodologies, or frameworks if applicable.

CRITICAL RULES:
- DO NOT answer the research question.
- DO NOT write a literature review, analysis, or findings.
- OUTPUT ONLY THE PROMPT TEXT.

Now, write the prompt (and only the prompt):`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: systemPrompt }
        ],
        temperature: 0.3,
        max_tokens: 600
      })
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error('Groq API error:', data);
      throw new Error(data.error?.message || 'Groq API error');
    }

    const generatedPrompt = data.choices?.[0]?.message?.content || 'Error: Could not generate prompt.';

    return new Response(JSON.stringify({ prompt: generatedPrompt }), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers
    });
  }
}