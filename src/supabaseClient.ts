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
    console.warn('Failed to fetch backend database configuration:', e);
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
          if (!r.ok) {
            const errText = await r.text();
            throw new Error(`HTTP ${r.status}: ${errText}`);
          }
          const res = await r.json();
          return { data: res.data as T[], error: res.error || null };
        } catch (e: any) {
          console.error(`Backend API select error on [${table}]:`, e);
          return { data: [], error: e?.message || 'Failed to fetch data from backend server.' };
        }
      },

      insert: async (rows: Partial<T> | Partial<T>[]): Promise<{ data: T[] | null; error: string | null }> => {
        try {
          const r = await fetch(`/api/db/${table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rows)
          });
          if (!r.ok) {
            const errText = await r.text();
            throw new Error(`HTTP ${r.status}: ${errText}`);
          }
          const res = await r.json();
          return { data: res.data as T[], error: res.error || null };
        } catch (e: any) {
          console.error(`Backend API insert error on [${table}]:`, e);
          return { data: null, error: e?.message || 'Failed to insert data on backend server.' };
        }
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
          if (!r.ok) {
            const errText = await r.text();
            throw new Error(`HTTP ${r.status}: ${errText}`);
          }
          const res = await r.json();
          return { data: res.data as T[], error: res.error || null };
        } catch (e: any) {
          console.error(`Backend API update error on [${table}]:`, e);
          return { data: null, error: e?.message || 'Failed to update data on backend server.' };
        }
      },

      delete: async (filter: SupabaseFilter): Promise<{ error: string | null }> => {
        try {
          const filterStr = `${filter.col}=eq.${encodeURIComponent(String(filter.val))}`;
          const url = `/api/db/${table}?filter=${encodeURIComponent(filterStr)}`;
          const r = await fetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
          });
          if (!r.ok) {
            const errText = await r.text();
            throw new Error(`HTTP ${r.status}: ${errText}`);
          }
          const res = await r.json();
          return { error: res.error || null };
        } catch (e: any) {
          console.error(`Backend API delete error on [${table}]:`, e);
          return { error: e?.message || 'Failed to delete data on backend server.' };
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
