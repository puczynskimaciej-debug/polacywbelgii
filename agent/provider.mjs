export class BudgetExceeded extends Error {}

export function estimateCost(usage, prices) {
  return (usage.inputTokens || 0) / 1_000_000 * prices.inputPerMillion + (usage.outputTokens || 0) / 1_000_000 * prices.outputPerMillion;
}

export async function generateWithProvider({ prompt, allowPaid = false, apiKey = process.env.AI_API_KEY, endpoint = process.env.AI_API_ENDPOINT, model = process.env.AI_MODEL, maxOutputTokens = 1200, timeoutMs = 15000, retries = 2, budget, usage = { dayUsd: 0, monthUsd: 0 }, prices = { inputPerMillion: 0, outputPerMillion: 0 }, fetcher = fetch }) {
  if (!allowPaid) throw new Error('paid AI calls require explicit opt-in');
  if (!apiKey || !endpoint || !model) throw new Error('AI provider is not configured');
  if (!/^https:\/\//.test(endpoint)) throw new Error('AI endpoint must use HTTPS');
  if (budget && (usage.dayUsd >= budget.dayUsd || usage.monthUsd >= budget.monthUsd)) throw new BudgetExceeded('AI budget reached');
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetcher(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxOutputTokens }), signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
      if (!response.ok) {
        if ([429, 500, 502, 503].includes(response.status) && attempt < retries) continue;
        throw new Error(`AI HTTP ${response.status}`);
      }
      const json = await response.json();
      const text = json.choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw new Error('invalid AI response');
      const tokens = { inputTokens: json.usage?.prompt_tokens || 0, outputTokens: json.usage?.completion_tokens || 0 };
      const costUsd = estimateCost(tokens, prices);
      if (budget && (usage.dayUsd + costUsd > budget.dayUsd || usage.monthUsd + costUsd > budget.monthUsd)) throw new BudgetExceeded('AI budget reached');
      return { text, tokens, costUsd, model };
    } catch (error) {
      if (attempt === retries || error instanceof BudgetExceeded) throw error;
    }
  }
}
