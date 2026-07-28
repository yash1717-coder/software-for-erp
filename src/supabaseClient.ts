export interface SupabaseOptions {
  order?: string;
  limit?: number;
  filter?: string;
}

export interface SupabaseFilter {
  col: string;
  val: string | number;
}

const CANDIDATE_BACKENDS = [
  "", // relative path for same-origin
  "https://ais-pre-kkhw5jj76wwdxxv75vlqc3-594375269974.asia-southeast1.run.app",
  "https://ais-dev-kkhw5jj76wwdxxv75vlqc3-594375269974.asia-southeast1.run.app"
];

// Helper to retrieve direct client-side Supabase credentials
export function getDirectSupabaseConfig(): { url: string; key: string } | null {
  try {
    const metaEnv = (import.meta as any).env || {};
    const url = (localStorage.getItem('infiev_supabase_url') || metaEnv.VITE_SUPABASE_URL || '').trim();
    const key = (localStorage.getItem('infiev_supabase_key') || metaEnv.VITE_SUPABASE_ANON_KEY || '').trim();
    if (url && key && url.includes('supabase.co')) {
      return { url: url.replace(/\/$/, ''), key };
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveDirectSupabaseConfig(url: string, key: string) {
  try {
    const cleanUrl = url.trim().replace(/\/$/, '');
    const cleanKey = key.trim();
    localStorage.setItem('infiev_supabase_url', cleanUrl);
    localStorage.setItem('infiev_supabase_key', cleanKey);
    // Best-effort sync to server backend as well
    fetchDbApi('/api/config', {
      method: 'POST',
      body: JSON.stringify({ url: cleanUrl, key: cleanKey })
    });
  } catch {
    // ignore
  }
}

export function clearDirectSupabaseConfig() {
  try {
    localStorage.removeItem('infiev_supabase_url');
    localStorage.removeItem('infiev_supabase_key');
  } catch {
    // ignore
  }
}

async function fetchSupabaseDirect(endpointPath: string, options: RequestInit = {}): Promise<Response | null> {
  const cfg = getDirectSupabaseConfig();
  if (!cfg) return null;

  try {
    const fullUrl = `${cfg.url}/rest/v1${endpointPath}`;
    const res = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'apikey': cfg.key,
        'Authorization': `Bearer ${cfg.key}`,
        'Prefer': 'return=representation',
        ...(options.headers || {})
      },
      mode: 'cors',
      referrerPolicy: 'no-referrer'
    });
    if (res.ok) {
      return res;
    } else {
      console.warn(`Supabase Direct REST call [${endpointPath}] error code: ${res.status}`);
    }
  } catch (e) {
    console.warn(`Supabase Direct REST request exception [${endpointPath}]:`, e);
  }
  return null;
}

async function fetchDbApi(endpointPath: string, options: RequestInit = {}): Promise<Response | null> {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  for (const backend of CANDIDATE_BACKENDS) {
    try {
      const fullUrl = `${backend}${endpointPath}`;
      const res = await fetch(fullUrl, {
        ...options,
        headers,
        mode: 'cors',
        referrerPolicy: 'no-referrer'
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return res;
      }
    } catch {
      // Try next candidate endpoint
    }
  }

  return null;
}

export async function getSupabaseCredentials(): Promise<{ url: string; isLocal: boolean; configured: boolean }> {
  const directCfg = getDirectSupabaseConfig();
  if (directCfg) {
    return { url: directCfg.url, isLocal: false, configured: true };
  }

  const res = await fetchDbApi('/api/config');
  if (res) {
    try {
      const data = await res.json();
      return { url: data.url || '', isLocal: !data.configured, configured: Boolean(data.configured) };
    } catch {
      // ignore
    }
  }
  return { url: '', isLocal: true, configured: false };
}

export async function saveSupabaseCredentials(url: string, key: string): Promise<boolean> {
  saveDirectSupabaseConfig(url, key);
  const res = await fetchDbApi('/api/config', {
    method: 'POST',
    body: JSON.stringify({ url, key })
  });
  return true;
}

export const isLocalMode = false;

// Seed initial fallback data for static/offline environment
const INITIAL_FALLBACK_USERS = [
  {
    id: 'user_admin_01',
    user_id: 'admin',
    name: 'Administrator',
    full_name: 'Administrator',
    role: 'admin',
    department: 'Executive',
    email: 'admin@infiev.com',
    password: 'admin',
    is_active: true,
    created_at: new Date().toISOString()
  }
];

export function getFallbackStore(): Record<string, any[]> {
  try {
    const stored = localStorage.getItem('infiev_fallback_db');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore parse error
  }
  const defaultStore: Record<string, any[]> = {
    app_users: INITIAL_FALLBACK_USERS,
    production_orders: [],
    inventory_items: [],
    raw_materials: [],
    electricity_downtimes: [],
    quality_tests: [],
    announcements: [],
    daily_financials: [],
    messages: [],
    tasks: [],
    work_reports: [],
    notifications: []
  };
  try {
    localStorage.setItem('infiev_fallback_db', JSON.stringify(defaultStore));
  } catch {
    // ignore quota error
  }
  return defaultStore;
}

export function saveFallbackStore(store: Record<string, any[]>) {
  try {
    localStorage.setItem('infiev_fallback_db', JSON.stringify(store));
  } catch {
    // ignore quota error
  }
}

// Full App Data Export helper for multi-device sync
export function exportAllAppDataJSON(): string {
  const store = getFallbackStore();
  return JSON.stringify(store, null, 2);
}

// Full App Data Import helper
export function importAllAppDataJSON(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object') {
      const store = getFallbackStore();
      const newStore = { ...store, ...parsed };
      saveFallbackStore(newStore);
      return true;
    }
  } catch (e) {
    console.error("Failed to parse imported DB JSON:", e);
  }
  return false;
}

// Queue for offline-created items to auto-push when online
function queuePendingSync(table: string, item: any) {
  try {
    const raw = localStorage.getItem('infiev_pending_sync');
    const queue: { table: string; item: any }[] = raw ? JSON.parse(raw) : [];
    queue.push({ table, item });
    localStorage.setItem('infiev_pending_sync', JSON.stringify(queue));
  } catch {
    // ignore
  }
}

async function flushPendingSync() {
  try {
    const raw = localStorage.getItem('infiev_pending_sync');
    if (!raw) return;
    const queue: { table: string; item: any }[] = JSON.parse(raw);
    if (!queue.length) return;

    const remaining: { table: string; item: any }[] = [];
    for (const entry of queue) {
      const r = await fetchDbApi(`/api/db/${entry.table}`, {
        method: 'POST',
        body: JSON.stringify(entry.item)
      });
      if (!r || !r.ok) {
        remaining.push(entry);
      }
    }
    localStorage.setItem('infiev_pending_sync', JSON.stringify(remaining));
  } catch {
    // ignore
  }
}

// Background poll to sync pending items
if (typeof window !== 'undefined') {
  setInterval(() => {
    flushPendingSync();
  }, 5000);
}

function matchFilterRow(row: any, filterStr: string | undefined): boolean {
  if (!filterStr) return true;
  const parts = filterStr.split('&');
  for (const part of parts) {
    const match = part.match(/^([^=!<>]+)=([^.]+)\.(.+)$/);
    if (!match) continue;
    const col = match[1];
    const op = match[2];
    let val: any = decodeURIComponent(match[3]);

    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (val === 'null') val = null;

    const rowVal = row[col];

    if (op === 'eq') {
      if (typeof rowVal === 'boolean' && typeof val === 'string') {
        if (rowVal && val === 'true') continue;
        if (!rowVal && val === 'false') continue;
      }
      if (String(rowVal ?? '').toLowerCase() !== String(val ?? '').toLowerCase()) {
        return false;
      }
    } else if (op === 'neq') {
      if (String(rowVal ?? '').toLowerCase() === String(val ?? '').toLowerCase()) {
        return false;
      }
    }
  }
  return true;
}

export const sb = {
  from: <T = any>(table: string) => {
    return {
      select: async (cols: string = '*', opts: SupabaseOptions = {}): Promise<{ data: T[] | null; error: string | null }> => {
        // 1. Try direct Supabase connection if configured
        let directEndpoint = `/${table}?select=${encodeURIComponent(cols)}`;
        if (opts.order) directEndpoint += `&order=${encodeURIComponent(opts.order)}`;
        if (opts.limit) directEndpoint += `&limit=${opts.limit}`;
        if (opts.filter) directEndpoint += `&${opts.filter}`;

        const directRes = await fetchSupabaseDirect(directEndpoint);
        if (directRes) {
          try {
            const data = await directRes.json();
            if (Array.isArray(data)) {
              const store = getFallbackStore();
              store[table] = data;
              saveFallbackStore(store);
              return { data: data as T[], error: null };
            }
          } catch (e: any) {
            console.warn(`Error parsing Supabase Direct JSON for [${table}]:`, e);
          }
        }

        // 2. Try backend API proxy
        let url = `/api/db/${table}?select=${encodeURIComponent(cols)}`;
        if (opts.order) url += `&order=${encodeURIComponent(opts.order)}`;
        if (opts.limit) url += `&limit=${opts.limit}`;
        if (opts.filter) url += `&filter=${encodeURIComponent(opts.filter)}`;

        const r = await fetchDbApi(url);
        if (r) {
          try {
            const res = await r.json();
            if (Array.isArray(res.data)) {
              // Cache in local store
              const store = getFallbackStore();
              store[table] = res.data;
              saveFallbackStore(store);
              return { data: res.data as T[], error: null };
            }
          } catch (e: any) {
            console.warn(`Error parsing DB JSON for [${table}]:`, e);
          }
        }

        // 3. Fallback store handling if backend server is completely unavailable
        const store = getFallbackStore();
        let rows = store[table] || [];

        if (opts.filter) {
          rows = rows.filter(r => matchFilterRow(r, opts.filter));
        }

        if (opts.order) {
          const [orderCol, orderDir] = opts.order.split('.');
          rows = [...rows].sort((a, b) => {
            const valA = String(a[orderCol] ?? '');
            const valB = String(b[orderCol] ?? '');
            return orderDir === 'desc' ? valB.localeCompare(valA) : valA.localeCompare(valB);
          });
        }

        if (opts.limit) {
          rows = rows.slice(0, opts.limit);
        }

        return { data: rows as T[], error: null };
      },

      insert: async (rows: Partial<T> | Partial<T>[]): Promise<{ data: T[] | null; error: string | null }> => {
        const incoming = Array.isArray(rows) ? rows : [rows];
        const processed = incoming.map((r: any) => ({
          id: r.id || 'id_' + Math.random().toString(36).substring(2, 11),
          created_at: r.created_at || new Date().toISOString(),
          ...r
        }));

        // Always save to fallback store immediately so local client is responsive
        const store = getFallbackStore();
        const existing = store[table] || [];
        // Deduplicate
        const existingIds = new Set(existing.map((e: any) => e.user_id || e.id));
        const newUnique = processed.filter((p: any) => !existingIds.has(p.user_id || p.id));
        store[table] = [...newUnique, ...existing];
        saveFallbackStore(store);

        // 1. Try direct Supabase connection
        const directRes = await fetchSupabaseDirect(`/${table}`, {
          method: 'POST',
          body: JSON.stringify(processed)
        });
        if (directRes) {
          try {
            const resData = await directRes.json();
            if (Array.isArray(resData)) {
              return { data: resData as T[], error: null };
            }
          } catch {
            // ignore
          }
          return { data: processed as T[], error: null };
        }

        // 2. Try backend API proxy
        const r = await fetchDbApi(`/api/db/${table}`, {
          method: 'POST',
          body: JSON.stringify(processed)
        });

        if (r) {
          try {
            const res = await r.json();
            if (Array.isArray(res.data)) {
              return { data: res.data as T[], error: null };
            }
          } catch (e: any) {
            console.warn(`Error parsing insert DB JSON for [${table}]:`, e);
          }
        } else {
          // Queue for pending sync if server wasn't reached immediately
          processed.forEach(item => queuePendingSync(table, item));
        }

        return { data: processed as T[], error: null };
      },

      update: async (row: Partial<T>, filter: SupabaseFilter): Promise<{ data: T[] | null; error: string | null }> => {
        const filterStr = `${filter.col}=eq.${encodeURIComponent(String(filter.val))}`;
        
        // Update fallback store
        const store = getFallbackStore();
        const existing = store[table] || [];
        const updatedRows: any[] = [];
        store[table] = existing.map((r: any) => {
          if (String(r[filter.col]) === String(filter.val)) {
            const u = { ...r, ...row };
            updatedRows.push(u);
            return u;
          }
          return r;
        });
        saveFallbackStore(store);

        // 1. Try direct Supabase
        const directRes = await fetchSupabaseDirect(`/${table}?${filterStr}`, {
          method: 'PATCH',
          body: JSON.stringify(row)
        });
        if (directRes) {
          return { data: updatedRows as T[], error: null };
        }

        // 2. Try backend proxy
        const url = `/api/db/${table}?filter=${encodeURIComponent(filterStr)}`;
        const r = await fetchDbApi(url, {
          method: 'PATCH',
          body: JSON.stringify(row)
        });

        if (r) {
          try {
            const res = await r.json();
            return { data: res.data as T[], error: res.error || null };
          } catch (e: any) {
            console.warn(`Error parsing update DB JSON for [${table}]:`, e);
          }
        }

        return { data: updatedRows as T[], error: null };
      },

      delete: async (filter: SupabaseFilter): Promise<{ error: string | null }> => {
        const filterStr = `${filter.col}=eq.${encodeURIComponent(String(filter.val))}`;

        // Update fallback store
        const store = getFallbackStore();
        const existing = store[table] || [];
        store[table] = existing.filter((r: any) => String(r[filter.col]) !== String(filter.val));
        saveFallbackStore(store);

        // 1. Try direct Supabase
        const directRes = await fetchSupabaseDirect(`/${table}?${filterStr}`, {
          method: 'DELETE'
        });
        if (directRes) {
          return { error: null };
        }

        // 2. Try backend proxy
        const url = `/api/db/${table}?filter=${encodeURIComponent(filterStr)}`;
        const r = await fetchDbApi(url, { method: 'DELETE' });

        if (r) {
          try {
            const res = await r.json();
            return { error: res.error || null };
          } catch (e: any) {
            console.warn(`Error parsing delete DB JSON for [${table}]:`, e);
          }
        }

        return { error: null };
      }
    };
  }
};

// Application Auth helper
export const appAuth = {
  login: async (userId: string, password_raw: string, role: string) => {
    const { data, error } = await sb.from<any>('app_users').select('*', {
      filter: `user_id=eq.${encodeURIComponent(userId)}&role=eq.${role}&is_active=eq.true`
    });
    if (error || !data?.length) {
      return { ok: false, msg: 'User not found, disabled or incorrect role.', user: null };
    }
    const user = data[0];
    if (user.password !== password_raw) {
      return { ok: false, msg: 'Incorrect password.', user: null };
    }
    return { ok: true, user, msg: '' };
  }
};
