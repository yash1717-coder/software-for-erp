import React, { useState, useEffect } from 'react';
import { AppUser } from './types';
import { Icon } from './components/Icons';
import { LandingPage } from './components/LandingPage';
import { UserManagement } from './components/UserManagement';
import { GPSMap } from './components/GPSMap';
import { DataTable, ColumnDefinition } from './components/DataTable';
import { AIInsights } from './components/AIInsights';
import { MessagingPanel } from './components/MessagingPanel';
import { WorkSubmitPanel } from './components/WorkSubmitPanel';
import { MyTasksPanel } from './components/MyTasksPanel';
import { NotificationPanel } from './components/NotificationPanel';
import { AdminOverview } from './components/AdminOverview';
import { TaskAssignment } from './components/TaskAssignment';
import { KPICard } from './components/SharedUI';
import { sb, getDirectSupabaseConfig } from './supabaseClient';
import { CloudSyncModal } from './components/CloudSyncModal';

// Dynamic navigation titles
const navTitles: { [key: string]: string } = {
  overview: 'OVERVIEW DASHBOARD',
  'user-mgmt': 'USER ACCESS CONTROL',
  production: 'PRODUCTION SCHEDULING',
  inventory: 'STOCK INVENTORY CONTROLS',
  'raw-materials': 'RAW MATERIALS SYSTEM',
  employees: 'STAFF MEMBER DIRECTORY',
  supervisors: 'COORDINATOR REGISTRY',
  gps: 'GPS SATELLITE TRACKER',
  electricity: 'POWER OUTAGE RECORDERS',
  testing: 'QA INSPECTION REGISTRY',
  'ai-insights': 'AI ANALYTICS ENGINE',
  announcements: 'COMPANY ANNOUNCEMENTS',
  messages: 'TEAM MESSAGING CHANNELS',
  financials: 'DAILY LEDGER RECORDINGS',
  tasks: 'ALLOCATION CONTROL BOARD',
  submit: 'WORK LOG TRANSMISSION',
  chat: 'TEAM SECURE DIRECT CHAT',
  productivity: 'INDIVIDUAL EFFICIENCY STATS'
};

export default function App() {
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem('infiev_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [view, setView] = useState('overview');
  const [showNotif, setShowNotif] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [time, setTime] = useState(new Date());
  const [dbStatusTick, setDbStatusTick] = useState(0);

  const checkSyncStatus = () => {
    const cfg = getDirectSupabaseConfig();
    setIsCloudSynced(Boolean(cfg));
  };

  useEffect(() => {
    checkSyncStatus();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Periodic database auto-sync across all devices (every 5 seconds)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      setDbStatusTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(syncInterval);
  }, []);

  const handleLogin = (u: AppUser) => {
    localStorage.setItem('infiev_session', JSON.stringify(u));
    setUser(u);
    setView('overview');
  };

  const handleLogout = () => {
    localStorage.removeItem('infiev_session');
    setUser(null);
    setView('overview');
    setShowNotif(false);
  };

  // Navigations lists matching the roles
  const adminNav = [
    { key: 'overview', label: 'OVERVIEW', icon: 'dashboard' },
    { key: 'user-mgmt', label: 'USER ACCESS', icon: 'key' },
    { key: 'production', label: 'PRODUCTION', icon: 'factory' },
    { key: 'inventory', label: 'INVENTORY', icon: 'inventory' },
    { key: 'raw-materials', label: 'RAW MATERIALS', icon: 'raw' },
    { key: 'employees', label: 'EMPLOYEES', icon: 'users' },
    { key: 'supervisors', label: 'SUPERVISORS', icon: 'supervisor' },
    { key: 'gps', label: 'GPS TRACKING', icon: 'map' },
    { key: 'electricity', label: 'ELECTRICITY', icon: 'lightning' },
    { key: 'testing', label: 'QUALITY TEST', icon: 'test' },
    { key: 'ai-insights', label: 'AI INSIGHTS', icon: 'ai' },
    { key: 'announcements', label: 'ANNOUNCEMENTS', icon: 'bell' },
    { key: 'messages', label: 'MESSAGES', icon: 'chat' },
    { key: 'financials', label: 'DAILY LEDGER', icon: 'chart' }
  ];

  const supervisorNav = [
    { key: 'overview', label: 'DASHBOARD', icon: 'dashboard' },
    { key: 'tasks', label: 'ASSIGN TASKS', icon: 'tasks' },
    { key: 'production', label: 'PRODUCTION', icon: 'factory' },
    { key: 'gps', label: 'GPS TRACKING', icon: 'map' },
    { key: 'testing', label: 'TESTING', icon: 'test' },
    { key: 'electricity', label: 'ELECTRICITY', icon: 'lightning' },
    { key: 'raw-materials', label: 'RAW MATERIALS', icon: 'raw' },
    { key: 'messages', label: 'MESSAGES', icon: 'chat' }
  ];

  const employeeNav = [
    { key: 'overview', label: 'MY DASHBOARD', icon: 'dashboard' },
    { key: 'tasks', label: 'MY TASKS', icon: 'tasks' },
    { key: 'submit', label: 'SUBMIT WORK', icon: 'upload' },
    { key: 'chat', label: 'MESSAGES', icon: 'chat' },
    { key: 'productivity', label: 'PRODUCTIVITY', icon: 'chart' }
  ];

  const sidebarNavItems = user?.role === 'admin'
    ? adminNav
    : user?.role === 'supervisor'
    ? supervisorNav
    : employeeNav;

  const roleColor = user?.role === 'admin'
    ? 'text-cyan-400 border-cyan-500/30'
    : user?.role === 'supervisor'
    ? 'text-emerald-400 border-emerald-500/30'
    : 'text-amber-400 border-amber-500/30';

  if (!user) {
    return <LandingPage onLogin={handleLogin} />;
  }

  // DataTable Configurations
  const prodCols: ColumnDefinition[] = [
    { key: 'order_number', label: 'ORDER #' },
    { key: 'product_name', label: 'PRODUCT' },
    { key: 'quantity', label: 'QTY' },
    { key: 'unit_price', label: 'UNIT PRICE (₹)' },
    { key: 'status', label: 'STATUS', badge: (v) => (v === 'completed' ? 'online' : v === 'in_progress' ? 'warning' : 'offline') },
    { key: 'due_date', label: 'DUE DATE' },
    { key: 'assigned_to', label: 'ASSIGNED' }
  ];

  const inventoryCols: ColumnDefinition[] = [
    { key: 'item_name', label: 'ITEM NAME' },
    { key: 'category', label: 'CATEGORY' },
    { key: 'quantity', label: 'QTY' },
    { key: 'unit', label: 'UNIT' },
    { key: 'min_stock', label: 'MIN STOCK' },
    { key: 'location', label: 'LOCATION' }
  ];

  const rawMatCols: ColumnDefinition[] = [
    { key: 'material_name', label: 'MATERIAL' },
    { key: 'quantity', label: 'QTY' },
    { key: 'unit', label: 'UNIT' },
    { key: 'unit_price', label: 'PRICE/UNIT (₹)' },
    { key: 'supplier', label: 'SUPPLIER' },
    { key: 'target_output', label: 'TARGET OUTPUT' },
    { key: 'status', label: 'STATUS', badge: (v) => (v === 'in_stock' ? 'online' : v === 'low' ? 'warning' : 'offline') }
  ];

  const staffCols: ColumnDefinition[] = [
    { key: 'user_id', label: 'STAFF ID' },
    { key: 'name', label: 'NAME' },
    { key: 'department', label: 'DEPARTMENT' },
    { key: 'contact', label: 'CONTACT DIRECTORY' },
    { key: 'is_active', label: 'STATUS', badge: (v) => (v ? 'online' : 'offline') }
  ];

  const elecCols: ColumnDefinition[] = [
    { key: 'location', label: 'LOCATION' },
    { key: 'start_time', label: 'START' },
    { key: 'end_time', label: 'END' },
    { key: 'duration_hours', label: 'HOURS' },
    { key: 'cause', label: 'CAUSE' },
    { key: 'status', label: 'STATUS', badge: (v) => (v === 'resolved' ? 'online' : 'offline') }
  ];

  const testCols: ColumnDefinition[] = [
    { key: 'product_name', label: 'PRODUCT' },
    { key: 'batch_number', label: 'BATCH' },
    { key: 'test_type', label: 'TEST TYPE' },
    { key: 'result', label: 'RESULT', badge: (v) => (v === 'pass' ? 'online' : v === 'fail' ? 'offline' : 'warning') },
    { key: 'tested_by', label: 'TESTER' },
    { key: 'tested_at', label: 'DATE' }
  ];

  const announceCols: ColumnDefinition[] = [
    { key: 'title', label: 'TITLE' },
    { key: 'message', label: 'ALERT MESSAGE' },
    { key: 'priority', label: 'PRIORITY', badge: (v) => (v === 'high' ? 'offline' : v === 'medium' ? 'warning' : 'online') },
    { key: 'created_at', label: 'POST DATE' }
  ];

  const finCols: ColumnDefinition[] = [
    { key: 'date', label: 'DATE' },
    { key: 'revenue', label: 'REVENUE' },
    { key: 'material_cost', label: 'MATERIAL COST' },
    { key: 'electricity_cost', label: 'POWER COST' },
    { key: 'labor_cost', label: 'LABOR COST' },
    { key: 'other_costs', label: 'OTHER COSTS' },
    { key: 'net_profit', label: 'NET PROFIT' }
  ];

  const productivityCols: ColumnDefinition[] = [
    { key: 'metric_name', label: 'METRIC' },
    { key: 'value', label: 'VALUE' },
    { key: 'period', label: 'PERIOD' },
    { key: 'status', label: 'STATUS', badge: (v) => (v === 'good' ? 'online' : v === 'average' ? 'warning' : 'offline') }
  ];

  // Render view router based on user role
  const renderViewContent = () => {
    if (user.role === 'admin') {
      switch (view) {
        case 'overview':
          return <AdminOverview user={user} />;
        case 'user-mgmt':
          return <UserManagement />;
        case 'production':
          return (
            <DataTable
              table="production_orders"
              columns={prodCols}
              title="PRODUCTION ORDERS"
              icon="factory"
              addable
              defaultForm={{ order_number: '', product_name: '', quantity: '', unit_price: '', status: 'pending', due_date: '', assigned_to: '', target_units: '', completed_units: '', notes: '' }}
            />
          );
        case 'inventory':
          return (
            <DataTable
              table="inventory_items"
              columns={inventoryCols}
              title="INVENTORY ITEMS"
              icon="inventory"
              addable
              defaultForm={{ item_name: '', category: '', quantity: '', unit: '', unit_price: '', min_stock: '', location: '' }}
            />
          );
        case 'raw-materials':
          return (
            <DataTable
              table="raw_materials"
              columns={rawMatCols}
              title="RAW MATERIALS"
              icon="raw"
              addable
              defaultForm={{ material_name: '', quantity: '', unit: '', unit_price: '', supplier: '', target_output: '', target_units: '', status: 'in_stock', notes: '' }}
            />
          );
        case 'employees':
          return <DataTable table="app_users" columns={staffCols} title="EMPLOYEE PERSONNEL DIRECTORY" icon="users" filter="role=eq.employee" />;
        case 'supervisors':
          return <DataTable table="app_users" columns={staffCols} title="COORDINATOR PERSONNEL DIRECTORY" icon="supervisor" filter="role=eq.supervisor" />;
        case 'gps':
          return <GPSMap user={user} />;
        case 'electricity':
          return (
            <DataTable
              table="electricity_downtimes"
              columns={elecCols}
              title="POWER DOWNTIMES"
              icon="lightning"
              addable
              defaultForm={{ location: '', start_time: '', end_time: '', duration_hours: '', cause: '', power_cost_lost: '', status: 'active', notes: '' }}
            />
          );
        case 'testing':
          return (
            <DataTable
              table="quality_tests"
              columns={testCols}
              title="QUALITY TESTS"
              icon="test"
              addable
              defaultForm={{ product_name: '', batch_number: '', test_type: '', target_units: '', tested_units: '', passed_units: '', failed_units: '', cost_per_test: '', result: 'pending', tested_by: '', tested_at: '', notes: '' }}
            />
          );
        case 'ai-insights':
          return <AIInsights />;
        case 'announcements':
          return (
            <DataTable
              table="announcements"
              columns={announceCols}
              title="COMPANY BROADCASTS"
              icon="bell"
              addable
              defaultForm={{ title: '', message: '', priority: 'medium', target: 'all', created_by: 'admin' }}
            />
          );
        case 'messages':
          return <MessagingPanel user={user} />;
        case 'financials':
          return (
            <DataTable
              table="daily_financials"
              columns={finCols}
              title="DAILY LEDGERS"
              icon="chart"
              addable
              defaultForm={{ date: new Date().toISOString().split('T')[0], revenue: '', material_cost: '', electricity_cost: '', labor_cost: '', other_costs: '', notes: '' }}
            />
          );
        default:
          return <AdminOverview user={user} />;
      }
    }

    if (user.role === 'supervisor') {
      switch (view) {
        case 'overview':
          return (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <KPICard label="COORDINATED TASKS" value="Live Sync" icon="tasks" accent="cyan" />
                <KPICard label="REVIEWS COMPLETED" value="Active Queue" icon="check" accent="green" />
                <KPICard label="TEAM MEMBERS" value="Connected" icon="users" accent="orange" />
                <KPICard label="URGENT DISPATCH" value="Review Required" icon="bell" accent="red" />
              </div>
              <TaskAssignment user={user} />
            </div>
          );
        case 'tasks':
          return <TaskAssignment user={user} />;
        case 'production':
          return (
            <DataTable
              table="production_orders"
              columns={prodCols}
              title="PRODUCTION SCHEDULER"
              icon="factory"
              addable
              defaultForm={{ order_number: '', product_name: '', quantity: '', unit_price: '', status: 'pending', due_date: '', assigned_to: '', target_units: '', completed_units: '', notes: '' }}
            />
          );
        case 'gps':
          return <GPSMap user={user} />;
        case 'testing':
          return (
            <DataTable
              table="quality_tests"
              columns={testCols}
              title="QA INSPECTIONS"
              icon="test"
              addable
              defaultForm={{ product_name: '', batch_number: '', test_type: '', target_units: '', tested_units: '', passed_units: '', failed_units: '', cost_per_test: '', result: 'pending', tested_by: user.user_id, tested_at: '', notes: '' }}
            />
          );
        case 'electricity':
          return (
            <DataTable
              table="electricity_downtimes"
              columns={elecCols}
              title="POWER STATUSES"
              icon="lightning"
              addable
              defaultForm={{ location: '', start_time: '', end_time: '', duration_hours: '', cause: '', power_cost_lost: '', status: 'active', notes: '' }}
            />
          );
        case 'raw-materials':
          return (
            <DataTable
              table="raw_materials"
              columns={rawMatCols}
              title="RAW STOCKS LIST"
              icon="raw"
              addable
              defaultForm={{ material_name: '', quantity: '', unit: '', unit_price: '', supplier: '', target_output: '', target_units: '', status: 'in_stock', notes: '' }}
            />
          );
        case 'messages':
          return <MessagingPanel user={user} />;
        default:
          return <TaskAssignment user={user} />;
      }
    }

    if (user.role === 'employee') {
      switch (view) {
        case 'overview':
          return (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <KPICard label="MY LOGGED ALLOCATIONS" value="Local telemetry" icon="tasks" accent="cyan" />
                <KPICard label="FINISHED ASSIGNMENTS" value="Auto-Logged" icon="check" accent="green" />
                <KPICard label="PENDING VERIFICATION" value="Under review" icon="alert" accent="orange" />
                <KPICard label="LOG EFFICIENCY" value="Active logs" icon="chart" accent="cyan" />
              </div>
              <MyTasksPanel user={user} />
            </div>
          );
        case 'tasks':
          return <MyTasksPanel user={user} />;
        case 'submit':
          return <WorkSubmitPanel user={user} />;
        case 'chat':
          return <MessagingPanel user={user} />;
        case 'productivity':
          return <DataTable table="productivity_metrics" columns={productivityCols} title="MY PRODUCTIVITY METRICS" icon="chart" />;
        default:
          return <MyTasksPanel user={user} />;
      }
    }

    return null;
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* SCANLINE FILTER EFFECT */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none z-[999] opacity-40" />

      {/* FIXED SIDEBAR */}
      <aside className="w-56 bg-slate-900 border-r border-cyan-500/15 fixed inset-y-0 left-0 z-10 flex flex-col">
        {/* BRAND HEADER */}
        <div className="p-4 border-b border-cyan-500/15 flex flex-col">
          <div className="font-mono text-xl font-black tracking-[4px] text-cyan-400">INFIEV</div>
          <div className="text-[8px] tracking-[3px] text-slate-500 font-mono mt-0.5">MANUFACTURING PLATFORM</div>
        </div>

        {/* LOGGED CONTEXT */}
        <div className="p-4 border-b border-cyan-500/10 flex items-center gap-3 bg-slate-950/20">
          <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
            <Icon name="users" size={13} color="var(--neon-cyan)" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-mono font-bold text-slate-200 truncate">{user.name}</div>
            <div className="text-[9px] tracking-widest font-mono text-slate-500 uppercase mt-0.5">{user.role}</div>
          </div>
        </div>

        {/* INTERACTIVE NAVIGATION LINKS */}
        <nav className="flex-1 overflow-y-auto py-3">
          {sidebarNavItems.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setView(item.key);
                setShowNotif(false);
              }}
              className={`w-full flex items-center gap-3 px-5 py-3 text-left font-mono text-[10px] tracking-wider uppercase border-l-2 transition-all cursor-pointer ${
                view === item.key
                  ? 'border-cyan-400 bg-cyan-500/5 text-cyan-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-cyan-500/1'
              }`}
            >
              <Icon name={item.icon} size={13} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* EXIT BUTTON */}
        <div className="p-3 border-t border-cyan-500/15">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left font-mono text-[10px] tracking-wider uppercase text-rose-400 hover:bg-rose-500/5 transition-all cursor-pointer rounded"
          >
            <Icon name="logout" size={13} color="var(--neon-red)" />
            <span>LOGOUT SESSION</span>
          </button>
        </div>
      </aside>

      {/* RIGHT WORK AREA */}
      <div className="pl-56 flex-1 flex flex-col min-h-screen">
        {/* STICKY STATUS BAR */}
        <header className="h-14 border-b border-cyan-500/15 flex items-center justify-between px-6 bg-slate-900 sticky top-0 z-50">
          <div className="font-mono text-xs font-bold tracking-widest text-slate-100 uppercase">
            {navTitles[view] || 'ENTERPRISE CONTROLS'}
          </div>
          
          <div className="flex items-center gap-5">
            {/* Clock telemetry */}
            <div className="font-mono text-xs text-cyan-400 font-medium">
              {time.toLocaleTimeString()}
            </div>
            <div className="text-slate-500 text-[10px] tracking-wider font-mono hidden sm:block">
              {time.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            {/* Sidebar toggle button */}
            <button
              onClick={() => setShowNotif((p) => !p)}
              className="relative cursor-pointer text-slate-400 hover:text-cyan-400 transition-colors p-1"
            >
              <Icon name="bell" size={16} />
              {/* Alert indicator dot */}
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full border border-slate-900" />
            </button>
            {/* Online beacon / Cloud Sync button */}
            <button
              onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-2 p-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 border border-cyan-500/30 transition-all cursor-pointer"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isCloudSynced ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isCloudSynced ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <span className={`text-[9px] font-mono tracking-wider font-semibold ${isCloudSynced ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isCloudSynced ? '🟢 CLOUD SYNC ACTIVE' : '⚡ CLOUD SYNC SETUP'}
              </span>
            </button>
          </div>
        </header>

        {/* WORKSTAGE VIEWPORT */}
        <main className="flex-1 p-6 relative bg-slate-950">
          {/* Ambient subtle decorative light effect */}
          <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-cyan-500/[0.015] blur-3xl pointer-events-none" />
          
          <div key={view} className="relative z-10 animate-fade-up">
            {renderViewContent()}
          </div>
        </main>
      </div>

      {/* SLIDEALERT PANEL */}
      {showNotif && <NotificationPanel user={user} onClose={() => setShowNotif(false)} />}

      {/* CLOUD SYNC MODAL */}
      <CloudSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onSyncUpdated={checkSyncStatus}
      />
    </div>
  );
}
