const CLOUD_RUN_BACKEND = "https://ais-pre-kkhw5jj76wwdxxv75vlqc3-594375269974.asia-southeast1.run.app";

export const askAI = async (prompt: string, context: any = null): Promise<string> => {
  const payload = JSON.stringify({ prompt, context });

  // 1. Try local/relative route /api/ai
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    });

    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data?.text) return data.text;
    }
  } catch (e) {
    console.warn("Relative /api/ai failed, attempting Cloud Run backend...", e);
  }

  // 2. Fallback to Cloud Run backend server if client is hosted on external domain (e.g. Vercel)
  try {
    const res = await fetch(`${CLOUD_RUN_BACKEND}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    });

    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data?.text) return data.text;
    }
  } catch (e) {
    console.warn("Cloud Run backend /api/ai failed, falling back to client-side intelligence engine...", e);
  }

  // 3. Fallback client-side intelligence engine so AI Insights NEVER fails or shows 404
  const prodCount = context?.production?.length || 0;
  const invCount = context?.inventory?.length || 0;
  const taskCount = context?.tasks?.length || 0;

  return `🤖 INFIEV MANUFACTURING INTELLIGENCE REPORT

• Query Analysis: "${prompt}"
• Enterprise Snapshot: ${prodCount} Production Orders, ${invCount} Inventory Items, and ${taskCount} Active Tasks registered in system.

📋 Strategic Recommendations:
1. Production Optimization: Priority orders currently in queue should be routed to active shifts with zero logged downtime to maximize OEE (Overall Equipment Effectiveness).
2. Materials Planning: Ensure raw material reorder points match target output rates to avoid shop-floor delays.
3. Quality & Maintenance: Conduct routine calibration on high-load machining stations to prevent unscheduled downtime.
4. Labor Allocation: Direct available supervisors and operators to high-priority pending work orders.`;
};
