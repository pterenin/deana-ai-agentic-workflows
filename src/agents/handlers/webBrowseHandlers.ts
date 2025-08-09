const TAVILY_API = 'https://api.tavily.com/search';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

export const webBrowseHandlers = {
  async webSearch(args: { query: string; maxResults?: number }) {
    if (!TAVILY_API_KEY) {
      return {
        error: true,
        message: 'Missing TAVILY_API_KEY environment variable.',
      };
    }
    const body = {
      api_key: TAVILY_API_KEY,
      query: args.query,
      search_depth: 'advanced',
      include_answer: true,
      include_domains: [],
      exclude_domains: [],
      max_results: Math.min(Math.max(args.maxResults ?? 5, 1), 10),
      include_raw_content: true,
    } as any;

    const resp = await fetch(TAVILY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok)
      return { error: true, message: `Search failed (${resp.status})` };
    const data: any = await resp.json();
    return {
      success: true,
      answer: (data as any).answer || null,
      results: ((data as any).results || []).map((r: any) => ({
        url: r.url,
        title: r.title,
        content: r.content,
        score: r.score,
      })),
    };
  },

  async webGet(args: { url: string; maxChars?: number }) {
    try {
      const res = await fetch(args.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok)
        return { error: true, message: `Fetch failed (${res.status})` };
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const max = Math.min(Math.max(args.maxChars ?? 12000, 1000), 60000);
      return { success: true, content: text.slice(0, max) };
    } catch (e: any) {
      return { error: true, message: e.message || 'Failed to fetch URL' };
    }
  },
};
