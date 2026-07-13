import React from 'react';
import {
  LayoutDashboard,
  Factory,
  Package,
  Users,
  Map,
  Zap,
  BarChart3,
  Bot,
  Bell,
  LogOut,
  CheckSquare,
  Upload,
  MessageSquare,
  FlaskConical,
  X,
  Plus,
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Container,
  FolderLock,
  Key,
  Edit,
  Shield,
  Briefcase
} from 'lucide-react';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 16, color = 'currentColor', className }) => {
  const icons: { [key: string]: React.ReactNode } = {
    dashboard: <LayoutDashboard size={size} color={color} className={className} />,
    factory: <Factory size={size} color={color} className={className} />,
    inventory: <Package size={size} color={color} className={className} />,
    users: <Users size={size} color={color} className={className} />,
    map: <Map size={size} color={color} className={className} />,
    lightning: <Zap size={size} color={color} className={className} />,
    chart: <BarChart3 size={size} color={color} className={className} />,
    ai: <Bot size={size} color={color} className={className} />,
    bell: <Bell size={size} color={color} className={className} />,
    logout: <LogOut size={size} color={color} className={className} />,
    tasks: <CheckSquare size={size} color={color} className={className} />,
    upload: <Upload size={size} color={color} className={className} />,
    chat: <MessageSquare size={size} color={color} className={className} />,
    test: <FlaskConical size={size} color={color} className={className} />,
    close: <X size={size} color={color} className={className} />,
    plus: <Plus size={size} color={color} className={className} />,
    alert: <AlertTriangle size={size} color={color} className={className} />,
    check: <Check size={size} color={color} className={className} />,
    eye: <Eye size={size} color={color} className={className} />,
    eyeoff: <EyeOff size={size} color={color} className={className} />,
    raw: <Container size={size} color={color} className={className} />,
    supervisor: <Briefcase size={size} color={color} className={className} />,
    key: <Key size={size} color={color} className={className} />,
    edit: <Edit size={size} color={color} className={className} />,
    shield: <Shield size={size} color={color} className={className} />,
  };

  return icons[name] || <LayoutDashboard size={size} color={color} className={className} />;
};
