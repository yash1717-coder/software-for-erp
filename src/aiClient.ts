export const askAI = async (prompt: string, context: any = null): Promise<string> => {
  const GROQ_API_KEY = (import.meta as any).env.VITE_GROQ_API_KEY || "";

  if (!GROQ_API_KEY) {
    return "❌ Groq API Key is not configured. Please set the VITE_GROQ_API_KEY environment variable in your .env or Vercel settings.";
  }

  try {
    const systemMsg = `You are INFIEV ERP AI — a state-of-the-art manufacturing intelligence assistant. 
Be concise, technical, and professional. Provide highly actionable, bulleted insights regarding production scheduling, inventory replenishment, equipment downtime, and labor productivity.
Always reference the actual enterprise data when provided to make your answers concrete.

Current Manufacturing Enterprise Context Data:
${context ? JSON.stringify(context, null, 2) : "No context data available."}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return `❌ Groq API Error (${res.status}): ${errText || "Unable to retrieve response."}`;
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || "No content returned from AI.";
  } catch (e: any) {
    console.error("askAI error:", e);
    return `❌ Request failed: ${e?.message || String(e)}`;
  }
};
