// Icon wrapper: allows usage as <Icon name="..." size={} color={} />
import React from 'react';
import type { LucideProps } from 'lucide-react-native';
import {
  MessageCircle,
  Search,
  User,
  Mail,
  Lock,
  CameraOff,
  AlertCircle,
  UserCheck,
  CheckCircle,
  Users,
  X,
  Send,
  Image as ImageIcon,
  Phone,
  Video,
  MoreVertical,
  ArrowLeft,
  Settings,
  Bell,
  LogOut,
  Info,
  FileText,
  Shield,
  ShieldCheck,
  HelpCircle,
  ChevronRight,
  Eye,
  EyeOff,
  Camera,
  AtSign,
  Home,
  Trash2,
  Check,
  CheckCheck,
  Clock,
  WifiOff,
  RefreshCw,
  UserPlus,
  UserX,
  Loader2,
} from 'lucide-react-native';

const ICONS: Record<string, React.ComponentType<any>> = {
  'message-circle': MessageCircle,
  search: Search,
  user: User,
  mail: Mail,
  lock: Lock,
  'camera-off': CameraOff,
  'alert-circle': AlertCircle,
  'user-check': UserCheck,
  'check-circle': CheckCircle,
  users: Users,
  x: X,
  send: Send,
  image: ImageIcon,
  phone: Phone,
  video: Video,
  'more-vertical': MoreVertical,
  'arrow-left': ArrowLeft,
  settings: Settings,
  bell: Bell,
  'log-out': LogOut,
  info: Info,
  'file-text': FileText,
  shield: Shield,
  'shield-check': ShieldCheck,
  'help-circle': HelpCircle,
  'chevron-right': ChevronRight,
  eye: Eye,
  'eye-off': EyeOff,
  camera: Camera,
  'at-sign': AtSign,
  home: Home,
  trash: Trash2,
  check: Check,
  'check-check': CheckCheck,
  clock: Clock,
  'wifi-off': WifiOff,
  'refresh-cw': RefreshCw,
  'user-plus': UserPlus,
  'user-x': UserX,
  loader: Loader2,
};

export interface IconProps extends Omit<LucideProps, 'ref'> {
  name: string;
}

export const LucideIcon = ({ name, size = 24, color, strokeWidth = 2, style, ...rest }: IconProps) => {
  const IconComponent = ICONS[name];
  if (!IconComponent) {
    // A missing icon silently renders nothing, which is very hard to spot in a
    // layout. Warn loudly in development so the typo is caught at the call site.
    if (__DEV__) {
      console.warn(
        `LucideIcon: no icon named "${name}". Add it to the ICONS map in components/ui/LucideIcon.tsx.`
      );
    }
    return null;
  }
  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} style={style} {...rest} />;
};

export default LucideIcon;