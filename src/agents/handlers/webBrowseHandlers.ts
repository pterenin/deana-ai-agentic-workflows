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
      // Protocol allowlist
      const u = new URL(args.url);
      if (!['http:', 'https:'].includes(u.protocol)) {
        return {
          error: true,
          message: 'Only http/https protocols are allowed.',
        };
      }

      // Limit redirects, set timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let currentUrl = args.url;
      let redirects = 0;
      let res: Response | null = null;
      while (redirects <= 3) {
        res = await fetch(currentUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          redirect: 'manual',
          signal: controller.signal,
        });
        const loc = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && loc) {
          redirects += 1;
          const next = new URL(loc, currentUrl).toString();
          const nextUrl = new URL(next);
          if (!['http:', 'https:'].includes(nextUrl.protocol)) {
            clearTimeout(timeout);
            return {
              error: true,
              message: 'Redirected to disallowed protocol.',
            };
          }
          currentUrl = nextUrl.toString();
          continue;
        }
        break;
      }
      clearTimeout(timeout);
      if (!res) return { error: true, message: 'Failed to fetch URL' };
      if (!res.ok)
        return { error: true, message: `Fetch failed (${res.status})` };

      // Cap response size
      const reader = (res.body as any)?.getReader?.();
      let received = 0;
      const maxBytes = 1_000_000;
      let html = '';
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.length;
          if (received > maxBytes) break;
          html += decoder.decode(value, { stream: true });
        }
        html += decoder.decode();
      } else {
        html = await res.text();
        if (html.length > maxBytes) html = html.slice(0, maxBytes);
      }

      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const max = Math.min(Math.max(args.maxChars ?? 12000, 1000), 60000);
      return { success: true, content: text.slice(0, max), untrusted: true };
    } catch (e: any) {
      return { error: true, message: e.message || 'Failed to fetch URL' };
    }
  },
};
