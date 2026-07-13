export interface AppUser {
  id?: string;
  user_id: string;
  name: string;
  password?: string;
  role: 'admin' | 'supervisor' | 'employee';
  department?: string;
  contact?: string;
  is_active: boolean;
  created_at?: string;
}

export interface ProductionOrder {
  id?: string;
  order_number: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  status: 'pending' | 'in_progress' | 'completed';
  due_date?: string;
  assigned_to?: string;
  target_units?: number;
  completed_units?: number;
  notes?: string;
  created_at?: string;
}

export interface InventoryItem {
  id?: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_price: number;
  min_stock: number;
  location?: string;
  created_at?: string;
}

export interface RawMaterial {
  id?: string;
  material_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  supplier?: string;
  target_output?: number;
  target_units?: string;
  status: 'in_stock' | 'low' | 'out_of_stock';
  notes?: string;
  created_at?: string;
}

export interface GPSLocation {
  id?: string;
  employee_id: string;
  latitude: number;
  longitude: number;
  recorded_at?: string;
}

export interface ElectricityDowntime {
  id?: string;
  location: string;
  start_time: string;
  end_time?: string;
  duration_hours?: number;
  cause?: string;
  power_cost_lost?: number;
  status: 'active' | 'resolved';
  notes?: string;
  created_at?: string;
}

export interface QualityTest {
  id?: string;
  product_name: string;
  batch_number: string;
  test_type: string;
  target_units?: number;
  tested_units?: number;
  passed_units?: number;
  failed_units?: number;
  cost_per_test?: number;
  result: 'pending' | 'pass' | 'fail';
  tested_by?: string;
  tested_at?: string;
  notes?: string;
  created_at?: string;
}

export interface Announcement {
  id?: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  target: string;
  created_by?: string;
  created_at?: string;
}

export interface Message {
  id?: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'admin' | 'supervisor' | 'employee';
  recipient_id?: string | null;
  recipient_name?: string | null;
  room?: string | null;
  content: string;
  created_at?: string;
}

export interface Notification {
  id?: string;
  recipient_id?: string;
  recipient_role?: string;
  sender_id?: string;
  sender_name?: string;
  title: string;
  message: string;
  type: 'task' | 'success' | 'warning' | 'work' | 'message' | 'info';
  is_read?: boolean;
  created_at?: string;
}

export interface WorkReport {
  id?: string;
  employee_id: string;
  employee_name: string;
  task_id?: string;
  task_title?: string;
  work_description: string;
  hours_worked?: number;
  units_completed?: number;
  notes?: string;
  photo_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at?: string;
}

export interface DailyFinancial {
  id?: string;
  date: string;
  revenue: number;
  material_cost: number;
  electricity_cost: number;
  labor_cost: number;
  other_costs: number;
  net_profit?: number;
  notes?: string;
  created_at?: string;
}

export interface Task {
  id?: string;
  task_title: string;
  assigned_to: string;
  assigned_to_name: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  due_date?: string;
  description?: string;
  assigned_by: string;
  photo_proof_url?: string;
  photo_verified?: boolean;
  verified_by?: string;
  verified_at?: string;
  created_at?: string;
}

export interface ProductivityMetric {
  id?: string;
  employee_id: string;
  metric_name: string;
  value: string;
  period: string;
  status: 'good' | 'average' | 'poor';
  created_at?: string;
}
