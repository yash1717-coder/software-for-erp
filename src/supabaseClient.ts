export function getSupabaseCredentials() {
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('infiev_supabase_url') : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('infiev_supabase_anon_key') : null;
  
  const url = localUrl || (import.meta as any).env.VITE_SUPABASE_URL || "https://sfhnaamxhwmzppmcmvbo.supabase.co";
  const key = localKey || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "sb_publishable_hkCdMoiafha4Zxs6nm0t0Q_nZBb-JQD";
  
  const isLocal = 
    !url || 
    url.includes("your-project.supabase.co") ||
    !key ||
    key.includes("your-anon-key") ||
    url.includes("sfhnaamxhwmzppmcmvbo.supabase.co");
    
  return { url, key, isLocal };
}

export function saveSupabaseCredentials(url: string, key: string) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem('infiev_supabase_url', url.trim());
    else localStorage.removeItem('infiev_supabase_url');
    
    if (key) localStorage.setItem('infiev_supabase_anon_key', key.trim());
    else localStorage.removeItem('infiev_supabase_anon_key');
    
    isLocalMode = getSupabaseCredentials().isLocal;
  }
}

export let isLocalMode = getSupabaseCredentials().isLocal;

export interface SupabaseOptions {
  order?: string;
  limit?: number;
  filter?: string;
}

export interface SupabaseFilter {
  col: string;
  val: string | number;
}

// Prefix for storing fallback data in LocalStorage
const LOCAL_STORAGE_DB_PREFIX = 'infiev_db_v3_';

// Rich seed data for fallback mode so the app works out-of-the-box (Now empty to clear dummy data)
const SEED_DATA: Record<string, any[]> = {
  app_users: [],
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

// Local storage management helpers
function getLocalTable(table: string): any[] {
  const key = LOCAL_STORAGE_DB_PREFIX + table;
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // Ignore parse failure and fall through
    }
  }
  const seed = SEED_DATA[table] || [];
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

function saveLocalTable(table: string, data: any[]) {
  const key = LOCAL_STORAGE_DB_PREFIX + table;
  localStorage.setItem(key, JSON.stringify(data));
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
}

// Parsers for simple PostgREST-like URI filters in mock local queries
function matchLocalRow(row: any, filterStr: string | undefined): boolean {
  if (!filterStr) return true;
  // Examples: 
  // "user_id=eq.operator_01&role=eq.employee&is_active=eq.true"
  // "assigned_to=eq.operator_01&status=neq.completed"
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
      if (String(rowVal).toLowerCase() !== String(val).toLowerCase()) {
        return false;
      }
    } else if (op === 'neq') {
      if (String(rowVal).toLowerCase() === String(val).toLowerCase()) {
        return false;
      }
    } else if (op === 'is') {
      if (String(rowVal).toLowerCase() !== String(val).toLowerCase()) {
        return false;
      }
    }
  }
  return true;
}

export const sb = {
  from: <T = any>(table: string) => {
    const { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, isLocal } = getSupabaseCredentials();
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    };
    const base = `${SUPABASE_URL}/rest/v1`;

    return {
      select: async (cols: string = '*', opts: SupabaseOptions = {}): Promise<{ data: T[] | null; error: string | null }> => {
        if (isLocal) {
          let localRows = getLocalTable(table);
          if (opts.filter) {
            localRows = localRows.filter(row => matchLocalRow(row, opts.filter));
          }
          if (opts.order) {
            const [orderCol, orderDir] = opts.order.split('.');
            localRows.sort((a, b) => {
              const valA = String(a[orderCol] || '');
              const valB = String(b[orderCol] || '');
              return orderDir === 'desc' ? valB.localeCompare(valA) : valA.localeCompare(valB);
            });
          }
          if (opts.limit) {
            localRows = localRows.slice(0, opts.limit);
          }
          return { data: localRows as T[], error: null };
        }

        try {
          let url = `${base}/${table}?select=${cols}`;
          if (opts.order) {
            url += `&order=${opts.order}`;
          }
          if (opts.limit) {
            url += `&limit=${opts.limit}`;
          }
          if (opts.filter) {
            url += `&${opts.filter}`;
          }
          const r = await fetch(url, {
            headers: {
              ...headers,
              'Prefer': 'return=representation'
            }
          });
          if (!r.ok) {
            let errorText = '';
            try {
              const errJson = await r.json();
              errorText = errJson.message || errJson.details || JSON.stringify(errJson);
            } catch {
              errorText = await r.text();
            }
            throw new Error(`HTTP Error ${r.status}: ${errorText || r.statusText}`);
          }
          const data = await r.json();
          // Update our local storage cache on successful remote fetch
          saveLocalTable(table, data);
          return { data, error: null };
        } catch (e: any) {
          console.warn(`Supabase Remote Select failed on [${table}]. Servicing from LocalStorage database.`, e);
          // FALLBACK to localStorage
          let localRows = getLocalTable(table);
          if (opts.filter) {
            localRows = localRows.filter(row => matchLocalRow(row, opts.filter));
          }
          if (opts.order) {
            const [orderCol, orderDir] = opts.order.split('.');
            localRows.sort((a, b) => {
              const valA = String(a[orderCol] || '');
              const valB = String(b[orderCol] || '');
              return orderDir === 'desc' ? valB.localeCompare(valA) : valA.localeCompare(valB);
            });
          }
          if (opts.limit) {
            localRows = localRows.slice(0, opts.limit);
          }
          return { data: localRows as T[], error: null };
        }
      },

      insert: async (rows: Partial<T> | Partial<T>[]): Promise<{ data: T[] | null; error: string | null }> => {
        const incoming = Array.isArray(rows) ? rows : [rows];
        const processedIncoming = incoming.map(r => ({
          id: generateId(),
          created_at: new Date().toISOString(),
          ...r
        }));

        if (isLocal) {
          const localRows = getLocalTable(table);
          const updatedRows = [...processedIncoming, ...localRows];
          saveLocalTable(table, updatedRows);
          return { data: processedIncoming as T[], error: null };
        }

        try {
          const body = Array.isArray(rows) ? rows : [rows];
          const r = await fetch(`${base}/${table}`, {
            method: 'POST',
            headers: {
              ...headers,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(body)
          });
          if (!r.ok) {
            let errorText = '';
            try {
              const errJson = await r.json();
              errorText = errJson.message || errJson.details || JSON.stringify(errJson);
            } catch {
              errorText = await r.text();
            }
            throw new Error(`HTTP Error ${r.status}: ${errorText || r.statusText}`);
          }

          let data: T[] = [];
          try {
            data = await r.json();
          } catch {
            data = processedIncoming as T[];
          }

          const localRows = getLocalTable(table);
          saveLocalTable(table, [...data, ...localRows]);
          return { data, error: null };
        } catch (e: any) {
          console.warn(`Supabase Remote Insert failed on [${table}]. Falling back to LocalStorage write.`, e);
          const localRows = getLocalTable(table);
          const updatedRows = [...processedIncoming, ...localRows];
          saveLocalTable(table, updatedRows);
          return { data: processedIncoming as T[], error: null };
        }
      },

      update: async (row: Partial<T>, filter: SupabaseFilter): Promise<{ data: T[] | null; error: string | null }> => {
        if (isLocal) {
          const localRows = getLocalTable(table);
          let updatedLocal: any[] = [];
          const localRowsNew = localRows.map(r => {
            if (String(r[filter.col]) === String(filter.val)) {
              const updated = { ...r, ...row };
              updatedLocal.push(updated);
              return updated;
            }
            return r;
          });
          saveLocalTable(table, localRowsNew);
          return { data: updatedLocal as T[], error: null };
        }

        try {
          const url = `${base}/${table}?${filter.col}=eq.${encodeURIComponent(String(filter.val))}`;
          const r = await fetch(url, {
            method: 'PATCH',
            headers: {
              ...headers,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(row)
          });
          if (!r.ok) {
            let errorText = '';
            try {
              const errJson = await r.json();
              errorText = errJson.message || errJson.details || JSON.stringify(errJson);
            } catch {
              errorText = await r.text();
            }
            throw new Error(`HTTP Error ${r.status}: ${errorText || r.statusText}`);
          }

          let data: T[] = [];
          try {
            data = await r.json();
          } catch {
            data = [row] as any;
          }

          const localRows = getLocalTable(table);
          const localRowsNew = localRows.map(r => {
            if (String(r[filter.col]) === String(filter.val)) {
              return { ...r, ...row };
            }
            return r;
          });
          saveLocalTable(table, localRowsNew);
          return { data, error: null };
        } catch (e: any) {
          console.warn(`Supabase Remote Update failed on [${table}]. Falling back to LocalStorage write.`, e);
          const localRows = getLocalTable(table);
          let updatedLocal: any[] = [];
          const localRowsNew = localRows.map(r => {
            if (String(r[filter.col]) === String(filter.val)) {
              const updated = { ...r, ...row };
              updatedLocal.push(updated);
              return updated;
            }
            return r;
          });
          saveLocalTable(table, localRowsNew);
          return { data: updatedLocal as T[], error: null };
        }
      },

      delete: async (filter: SupabaseFilter): Promise<{ error: string | null }> => {
        if (isLocal) {
          const localRows = getLocalTable(table);
          const filteredLocal = localRows.filter(r => String(r[filter.col]) !== String(filter.val));
          saveLocalTable(table, filteredLocal);
          return { error: null };
        }

        try {
          const url = `${base}/${table}?${filter.col}=eq.${encodeURIComponent(String(filter.val))}`;
          const r = await fetch(url, {
            method: 'DELETE',
            headers
          });
          if (!r.ok) {
            let errorText = '';
            try {
              const errJson = await r.json();
              errorText = errJson.message || errJson.details || JSON.stringify(errJson);
            } catch {
              errorText = await r.text();
            }
            throw new Error(`HTTP Error ${r.status}: ${errorText || r.statusText}`);
          }

          const localRows = getLocalTable(table);
          const filteredLocal = localRows.filter(r => String(r[filter.col]) !== String(filter.val));
          saveLocalTable(table, filteredLocal);
          return { error: null };
        } catch (e: any) {
          console.warn(`Supabase Remote Delete failed on [${table}]. Falling back to LocalStorage write.`, e);
          const localRows = getLocalTable(table);
          const filteredLocal = localRows.filter(r => String(r[filter.col]) !== String(filter.val));
          saveLocalTable(table, filteredLocal);
          return { error: null };
        }
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
