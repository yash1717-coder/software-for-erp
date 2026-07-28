export interface SupabaseOptions {
  order?: string;
  limit?: number;
  filter?: string;
}

export interface SupabaseFilter {
  col: string;
  val: string | number;
}

export async function getSupabaseCredentials(): Promise<{ url: string; isLocal: boolean; configured: boolean }> {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      return { url: data.url || '', isLocal: !data.configured, configured: Boolean(data.configured) };
    }
  } catch (e) {
    // Ignore fetch failure
  }
  return { url: '', isLocal: true, configured: false };
}

export async function saveSupabaseCredentials(url: string, key: string): Promise<boolean> {
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, key })
    });
    return res.ok;
  } catch (e) {
    console.error('Failed to update server database credentials:', e);
    return false;
  }
}

export const isLocalMode = false;

// Seed initial fallback data for static/client environment (only initial admin)
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

function getFallbackStore(): Record<string, any[]> {
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

function saveFallbackStore(store: Record<string, any[]>) {
  try {
    localStorage.setItem('infiev_fallback_db', JSON.stringify(store));
  } catch {
    // ignore quota error
  }
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
        try {
          let url = `/api/db/${table}?select=${encodeURIComponent(cols)}`;
          if (opts.order) url += `&order=${encodeURIComponent(opts.order)}`;
          if (opts.limit) url += `&limit=${opts.limit}`;
          if (opts.filter) url += `&filter=${encodeURIComponent(opts.filter)}`;

          const r = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
          const contentType = r.headers.get('content-type') || '';
          
          if (r.ok && contentType.includes('application/json')) {
            const res = await r.json();
            return { data: res.data as T[], error: res.error || null };
          }
        } catch (e: any) {
          console.warn(`Backend server API unavailable for select [${table}], using local fallback:`, e?.message);
        }

        // Fallback store handling if backend API returned 404 or non-JSON
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

        try {
          const r = await fetch(`/api/db/${table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(processed)
          });
          const contentType = r.headers.get('content-type') || '';

          if (r.ok && contentType.includes('application/json')) {
            const res = await r.json();
            return { data: res.data as T[], error: res.error || null };
          }
        } catch (e: any) {
          console.warn(`Backend server API unavailable for insert [${table}], using local fallback:`, e?.message);
        }

        // Fallback store handling
        const store = getFallbackStore();
        const existing = store[table] || [];
        store[table] = [...processed, ...existing];
        saveFallbackStore(store);

        return { data: processed as T[], error: null };
      },

      update: async (row: Partial<T>, filter: SupabaseFilter): Promise<{ data: T[] | null; error: string | null }> => {
        try {
          const filterStr = `${filter.col}=eq.${encodeURIComponent(String(filter.val))}`;
          const url = `/api/db/${table}?filter=${encodeURIComponent(filterStr)}`;
          const r = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(row)
          });
          const contentType = r.headers.get('content-type') || '';

          if (r.ok && contentType.includes('application/json')) {
            const res = await r.json();
            return { data: res.data as T[], error: res.error || null };
          }
        } catch (e: any) {
          console.warn(`Backend server API unavailable for update [${table}], using local fallback:`, e?.message);
        }

        // Fallback store handling
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

        return { data: updatedRows as T[], error: null };
      },

      delete: async (filter: SupabaseFilter): Promise<{ error: string | null }> => {
        try {
          const filterStr = `${filter.col}=eq.${encodeURIComponent(String(filter.val))}`;
          const url = `/api/db/${table}?filter=${encodeURIComponent(filterStr)}`;
          const r = await fetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
          });
          const contentType = r.headers.get('content-type') || '';

          if (r.ok && contentType.includes('application/json')) {
            const res = await r.json();
            return { error: res.error || null };
          }
        } catch (e: any) {
          console.warn(`Backend server API unavailable for delete [${table}], using local fallback:`, e?.message);
        }

        // Fallback store handling
        const store = getFallbackStore();
        const existing = store[table] || [];
        store[table] = existing.filter((r: any) => String(r[filter.col]) !== String(filter.val));
        saveFallbackStore(store);

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
