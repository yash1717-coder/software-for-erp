import React, { useState, useEffect } from 'react';
import { sb } from '../supabaseClient';
import { AppUser, ProductionOrder, DailyFinancial, Task } from '../types';
import { Icon } from './Icons';
import { KPICard, Spinner, NoData, Modal } from './SharedUI';

// ============================================================
// RESPONSIVE SVG BAR CHART
// ============================================================
interface BarChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  prefix?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  xKey,
  yKey,
  color = '#6366f1',
  height = 160,
  prefix = ''
}) => {
  if (!data || data.length === 0) {
    return <NoData label="NO DATA TO CHART" />;
  }

  const maxVal = Math.max(...data.map((d) => Number(d[yKey]) || 0), 1);
  const barW = Math.max(20, Math.min(44, Math.floor(460 / data.length) - 8));
  const svgW = Math.max(500, data.length * (barW + 8) + 80);
  const bottomPad = 60; // space for rotated labels

  return (
    <div className="overflow-x-auto w-full">
      <svg width="100%" height={height + bottomPad} viewBox={`0 0 ${svgW} ${height + bottomPad}`} preserveAspectRatio="xMinYMin meet" className="mx-auto block">
        {/* Y-axis grid lines and markers */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <g key={pct}>
            <line x1={44} y1={height * (1 - pct)} x2={svgW - 10} y2={height * (1 - pct)} stroke="rgba(99,102,241,0.08)" strokeWidth={1} />
            <text x={38} y={height * (1 - pct) + 4} textAnchor="end" fill="rgba(165,180,252,0.4)" fontSize={9} className="font-mono">
              {prefix}
              {pct === 0
                ? '0'
                : (maxVal * pct) >= 100000
                ? ((maxVal * pct) / 100000).toFixed(1) + 'L'
                : (maxVal * pct) >= 1000
                ? ((maxVal * pct) / 1000).toFixed(0) + 'K'
                : (maxVal * pct).toFixed(0)}
            </text>
          </g>
        ))}

        {/* Bars and rotated x labels */}
        {data.map((d, i) => {
          const val = Number(d[yKey]) || 0;
          const barH = Math.max(2, (val / maxVal) * height);
          const x = 52 + i * (barW + 8);
          const labelX = x + barW / 2;
          const rawLabel = String(d[xKey] || '');
          const label = rawLabel.length > 12 ? rawLabel.slice(0, 11) + '…' : rawLabel;

          return (
            <g key={i} className="group cursor-pointer">
              <rect
                x={x}
                y={height - barH}
                width={barW}
                height={barH}
                fill={color}
                className="opacity-75 hover:opacity-100 transition-all duration-200"
                rx={2}
              />
              <rect x={x} y={height - barH} width={barW} height={2} fill={color} rx={1} />
              {/* Tooltip value */}
              <text x={labelX} y={height - barH - 6} textAnchor="middle" fill="#e8f4f8" fontSize={9} className="font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-900">
                {prefix}
                {val.toLocaleString()}
              </text>
              {/* Rotated label */}
              <text
                x={labelX}
                y={height + 6}
                textAnchor="end"
                fill="rgba(165,180,252,0.7)"
                fontSize={9}
                className="font-mono"
                transform={`rotate(-40, ${labelX}, ${height + 6})`}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* X-axis line */}
        <line x1={44} y1={height} x2={svgW - 10} y2={height} stroke="rgba(99,102,241,0.25)" strokeWidth={1} />
      </svg>
    </div>
  );
};

// ============================================================
// EMPLOYEE DETAIL MODAL (Admin click to see details)
// ============================================================
interface EmployeeDetailModalProps {
  emp: AppUser | null;
  onClose: () => void;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({ emp, onClose }) => {
  const [reports, setReports] = useState<any[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    if (!emp) return;
    setReports(null);
    setTasks(null);

    Promise.all([
      sb.from('work_reports').select('*', { filter: `employee_id=eq.${emp.user_id}`, order: 'submitted_at.desc', limit: 10 }),
      sb.from('tasks').select('*', { filter: `assigned_to=eq.${emp.user_id}`, order: 'created_at.desc', limit: 10 })
    ]).then(([r, t]) => {
      setReports(r.data || []);
      setTasks(t.data || []);
    });
  }, [emp]);

  if (!emp) return null;

  return (
    <Modal open={!!emp} onClose={onClose} title={`EMPLOYEE INSIGHTS — ${emp.name || emp.user_id}`}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3.5">
          {[
            ['USER ID', emp.user_id],
            ['NAME', emp.name],
            ['ROLE', (emp.role || '').toUpperCase()],
            ['DEPARTMENT', emp.department || '—'],
            ['CONTACT DIRECTORY', emp.contact || '—'],
            ['STATUS', emp.is_active ? 'ACTIVE' : 'INACTIVE']
          ].map(([l, v]) => (
            <div key={l} className="bg-cyan-500/5 border border-cyan-500/10 rounded p-3">
              <div className="text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-1">{l}</div>
              <div className="text-sm text-slate-100 font-mono font-semibold">{v}</div>
            </div>
          ))}
        </div>

        {/* Submissions */}
        <div>
          <div className="text-[10px] font-bold tracking-widest text-cyan-400 font-mono uppercase mb-3 flex items-center gap-1.5">
            <Icon name="upload" size={12} color="var(--neon-cyan)" /> RECENT WORK SUBMISSIONS ({reports?.length || 0})
          </div>
          {!reports ? (
            <Spinner />
          ) : reports.length === 0 ? (
            <div className="text-slate-500 text-xs font-mono py-2">No work reports logged yet.</div>
          ) : (
            <div className="max-h-36 overflow-y-auto border border-cyan-500/5 rounded divide-y divide-cyan-500/5 bg-slate-950/20 px-3.5">
              {reports.map((r, i) => (
                <div key={i} className="py-2.5">
                  <div className="text-slate-100 text-xs font-semibold">{r.work_description}</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    Hours: {r.hours_worked || 0} hrs · Output: {r.units_completed || 0} units · {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div>
          <div className="text-[10px] font-bold tracking-widest text-emerald-400 font-mono uppercase mb-3 flex items-center gap-1.5">
            <Icon name="tasks" size={12} color="#10b981" /> ASSIGNED WORK TASK LIST ({tasks?.length || 0})
          </div>
          {!tasks ? (
            <Spinner />
          ) : tasks.length === 0 ? (
            <div className="text-slate-500 text-xs font-mono py-2">No assigned tasks found.</div>
          ) : (
            <div className="max-h-36 overflow-y-auto border border-cyan-500/5 rounded divide-y divide-cyan-500/5 bg-slate-950/20 px-3.5">
              {tasks.map((t, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-slate-100 text-xs font-semibold">{t.task_title}</div>
                    <div className="text-[9px] font-mono text-slate-500 mt-1">Due: {t.due_date || '—'}</div>
                  </div>
                  <span
                    className={`font-mono text-[9px] tracking-wider px-2 py-0.5 rounded border uppercase ${
                      t.status === 'completed'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : t.status === 'in_progress'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// ============================================================
// ADMIN OVERVIEW MAIN COMPONENT
// ============================================================
interface AdminOverviewProps {
  user: AppUser;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ user }) => {
  const [stats, setStats] = useState({
    orders: 0,
    inventory: 0,
    employees: 0,
    downtime: 0,
    profit: 0,
    revenue: 0,
    tasks: 0,
    completed: 0
  });

  const [financials, setFinancials] = useState<DailyFinancial[]>([]);
  const [prodData, setProdData] = useState<any[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [taskStats, setTaskStats] = useState({ pending: 0, in_progress: 0, completed: 0 });
  const [calView, setCalView] = useState<'daily' | 'monthly'>('daily');
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<AppUser | null>(null);
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [empSearch, setEmpSearch] = useState('');

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const [ord, inv, emp, down, fin, tasks, allEmps] = await Promise.all([
        sb.from<ProductionOrder>('production_orders').select('id,status,product_name,quantity', { limit: 200 }),
        sb.from<any>('inventory_items').select('id', { limit: 200 }),
        sb.from<AppUser>('app_users').select('id', { filter: 'is_active=eq.true', limit: 200 }),
        sb.from<any>('electricity_downtimes').select('id,status', { filter: 'status=eq.active', limit: 50 }),
        sb.from<DailyFinancial>('daily_financials').select('*', { order: 'date.asc', limit: 30 }),
        sb.from<Task>('tasks').select('*', { order: 'created_at.desc', limit: 100 }),
        sb.from<AppUser>('app_users').select('*', { filter: 'role=eq.employee', order: 'created_at.desc', limit: 100 })
      ]);

      const tList = tasks.data || [];
      const pending = tList.filter((x) => x.status === 'pending').length;
      const inProg = tList.filter((x) => x.status === 'in_progress').length;
      const done = tList.filter((x) => x.status === 'completed').length;

      const finList = fin.data || [];
      const totRev = finList.reduce((s, f) => s + (Number(f.revenue) || 0), 0);
      const totProfit = finList.reduce((s, f) => s + (Number(f.net_profit) || 0), 0);

      setStats({
        orders: (ord.data || []).length,
        inventory: (inv.data || []).length,
        employees: (emp.data || []).length,
        downtime: (down.data || []).length,
        profit: totProfit,
        revenue: totRev,
        tasks: tList.length,
        completed: done
      });

      setFinancials(finList);
      setProdData((ord.data || []).filter((o) => o.product_name).slice(0, 8));
      setRecentTasks(tList.slice(0, 6));
      setTaskStats({ pending, in_progress: inProg, completed: done });
      setEmployees(allEmps.data || []);
    } catch (err) {
      console.error("Error fetching admin stats:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOverviewData();
    const interval = setInterval(() => {
      loadOverviewData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const calData = calView === 'daily' ? financials.slice(-7) : financials;
  
  const formatCurrency = (v: number) => {
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
    return `₹${Math.round(v)}`;
  };

  const filteredEmps = empSearch
    ? employees.filter(
        (e) =>
          (e.name || '').toLowerCase().includes(empSearch.toLowerCase()) ||
          (e.user_id || '').toLowerCase().includes(empSearch.toLowerCase())
      )
    : employees;

  return (
    <div className="flex flex-col gap-6">
      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* KPI Dashboard Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <KPICard label="PRODUCTION ORDERS" value={stats.orders} icon="factory" accent="cyan" />
            <KPICard label="INVENTORY ITEMS" value={stats.inventory} icon="inventory" accent="green" />
            <KPICard label="ACTIVE STAFF" value={stats.employees} icon="users" accent="orange" />
            <KPICard label="DOWNTIME EVENTS" value={stats.downtime} icon="lightning" accent="red" />
            <KPICard label="TOTAL REVENUE" value={formatCurrency(stats.revenue)} icon="chart" accent="green" />
            <KPICard label="NET PROFIT" value={formatCurrency(stats.profit)} icon="chart" accent={stats.profit >= 0 ? 'cyan' : 'red'} />
            <KPICard label="TOTAL TASKS" value={stats.tasks} icon="tasks" accent="cyan" />
            <KPICard label="TASKS COMPLETED" value={stats.completed} icon="check" accent="green" />
          </div>

          {/* Charts Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Revenue */}
            <div className="bg-slate-950 border border-cyan-500/5 rounded p-5 relative">
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/25" />
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold tracking-widest text-cyan-400 font-mono uppercase">
                  ENTERPRISE REVENUE PATTERNS
                </div>
                <div className="flex border border-cyan-500/10 rounded overflow-hidden">
                  {(['daily', 'monthly'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setCalView(v)}
                      className={`px-2.5 py-1 font-mono text-[8px] tracking-widest uppercase transition-colors cursor-pointer ${
                        calView === v ? 'bg-cyan-500/20 text-cyan-400' : 'bg-transparent text-slate-500'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {!calData.length ? (
                <NoData label="LOG FINANCIALS FIRST" />
              ) : (
                <BarChart data={calData} xKey="date" yKey="revenue" color="#6366f1" height={130} prefix="₹" />
              )}
            </div>

            {/* Profit */}
            <div className="bg-slate-950 border border-cyan-500/5 rounded p-5 relative">
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-emerald-500/25" />
              <div className="text-[10px] font-bold tracking-widest text-emerald-400 font-mono uppercase mb-4">
                NET PROFIT METRICS
              </div>
              {!calData.length ? (
                <NoData label="LOG FINANCIALS FIRST" />
              ) : (
                <BarChart data={calData} xKey="date" yKey="net_profit" color="#10b981" height={130} prefix="₹" />
              )}
            </div>
          </div>

          {/* Task Status & Product breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-950 border border-cyan-500/5 rounded p-5 md:col-span-1 relative">
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/25" />
              <div className="text-[10px] font-bold tracking-widest text-cyan-400 font-mono uppercase mb-4">
                TASK STATUS BREAKDOWN
              </div>
              {[
                { label: 'PENDING', val: taskStats.pending, color: 'bg-rose-500', text: 'text-rose-400' },
                { label: 'IN PROGRESS', val: taskStats.in_progress, color: 'bg-amber-500', text: 'text-amber-400' },
                { label: 'COMPLETED', val: taskStats.completed, color: 'bg-emerald-500', text: 'text-emerald-400' }
              ].map(({ label, val, color, text }) => {
                const total = taskStats.pending + taskStats.in_progress + taskStats.completed || 1;
                const pct = Math.round((val / total) * 100);
                return (
                  <div key={label} className="mb-4">
                    <div className="flex justify-between text-[10px] font-mono mb-2">
                      <span className={`${text} tracking-wider font-semibold`}>{label}</span>
                      <span className="text-slate-100 font-bold">
                        {val} <span className="text-slate-500 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-950 border border-cyan-500/5 rounded p-5 md:col-span-2 relative">
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-amber-500/25" />
              <div className="text-[10px] font-bold tracking-widest text-amber-500 font-mono uppercase mb-4">
                PRODUCTION BY PRODUCT NAME
              </div>
              {!prodData.length ? (
                <NoData label="ADD PRODUCTION ORDERS" />
              ) : (
                <BarChart
                  data={prodData.map((p) => ({
                    ...p,
                    product_name: (p.product_name || '').slice(0, 10)
                  }))}
                  xKey="product_name"
                  yKey="quantity"
                  color="#f59e0b"
                  height={130}
                />
              )}
            </div>
          </div>

          {/* Interactive Employee List */}
          <div className="bg-slate-950 border border-cyan-500/5 rounded p-5 relative">
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/25" />
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="text-[10px] font-bold tracking-widest text-cyan-400 font-mono uppercase">
                Enterprise Employee Directory — click row for detailed insights
              </div>
              <input
                type="text"
                className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-1.5 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-400 outline-none w-52"
                placeholder="Search employees..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
              />
            </div>
            {!filteredEmps.length ? (
              <NoData label="NO STAFF LOGGED" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-cyan-500/5 border-b border-cyan-500/10 text-[9px] text-cyan-400 font-mono tracking-widest uppercase">
                      <th className="p-3">EMP ID</th>
                      <th className="p-3">NAME</th>
                      <th className="p-3">DEPARTMENT</th>
                      <th className="p-3">STATUS</th>
                      <th className="p-3">JOIN DATE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/5 text-xs text-slate-300">
                    {filteredEmps.map((e, i) => (
                      <tr
                        key={e.id || i}
                        onClick={() => setSelectedEmp(e)}
                        className="hover:bg-cyan-500/5 transition-all cursor-pointer group"
                      >
                        <td className="p-3">
                          <span className="font-mono text-cyan-400 group-hover:text-cyan-300 bg-cyan-950/20 border border-cyan-500/10 px-2 py-0.5 rounded">
                            {e.user_id}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-200 group-hover:text-cyan-200 transition-colors">
                          {e.name || '—'}
                        </td>
                        <td className="p-3 text-slate-400">{e.department || '—'}</td>
                        <td className="p-3">
                          <span
                            className={`inline-block font-mono text-[9px] tracking-wider px-2 py-0.5 rounded border uppercase ${
                              e.is_active
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}
                          >
                            {e.is_active ? 'ACTIVE' : 'LOCKED'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-500">
                          {e.created_at ? new Date(e.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Task List */}
          <div className="bg-slate-950 border border-cyan-500/5 rounded p-5 relative">
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/25" />
            <div className="text-[10px] font-bold tracking-widest text-cyan-400 font-mono uppercase mb-4">
              RECENT TASK ALLOCATIONS
            </div>
            {!recentTasks.length ? (
              <NoData label="NO RECENT ALLOCATIONS" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-cyan-500/5 border-b border-cyan-500/10 text-[9px] text-cyan-400 font-mono tracking-widest uppercase">
                      <th className="p-3">ALLOCATED TASK</th>
                      <th className="p-3">ASSIGNED STAFF</th>
                      <th className="p-3">STATUS</th>
                      <th className="p-3">PROOF STATUS</th>
                      <th className="p-3">DUE DATE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/5 text-xs text-slate-300">
                    {recentTasks.map((t, i) => (
                      <tr key={t.id || i} className="hover:bg-cyan-500/2 transition-colors">
                        <td className="p-3 text-slate-200 font-semibold max-w-xs truncate">{t.task_title}</td>
                        <td className="p-3 font-mono text-cyan-400">{t.assigned_to_name || t.assigned_to || '—'}</td>
                        <td className="p-3">
                          <span
                            className={`inline-block font-mono text-[9px] tracking-wider px-2 py-0.5 rounded border uppercase ${
                              t.status === 'completed'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : t.status === 'in_progress'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}
                          >
                            {(t.status || '').replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3">
                          {t.photo_verified ? (
                            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[9px] px-1.5 py-0.5 rounded tracking-wider">
                              VERIFIED
                            </span>
                          ) : t.photo_proof_url ? (
                            <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[9px] px-1.5 py-0.5 rounded tracking-wider animate-pulse">
                              PENDING REVIEW
                            </span>
                          ) : (
                            <span className="text-slate-600 font-mono text-[10px]">NO PHOTO</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-500">{t.due_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Slide-out or modal drill down */}
      <EmployeeDetailModal emp={selectedEmp} onClose={() => setSelectedEmp(null)} />
    </div>
  );
};
