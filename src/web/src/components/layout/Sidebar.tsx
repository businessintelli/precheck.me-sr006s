"use client";

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import { Button, buttonVariants } from '../shared/Button';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/user.types';

// Icons from lucide-react @version ^0.3.0
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Video,
  Building,
  AlertCircle
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
  description: string;
}

const navigationItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: [UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER, UserRole.CANDIDATE],
    description: 'Overview of your background checks and tasks'
  },
  {
    label: 'Background Checks',
    href: '/background-checks',
    icon: <ClipboardCheck className="w-5 h-5" />,
    roles: [UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER],
    description: 'Manage and track background checks'
  },
  {
    label: 'Interviews',
    href: '/interviews',
    icon: <Video className="w-5 h-5" />,
    roles: [UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER],
    description: 'Schedule and manage AI interviews'
  },
  {
    label: 'Documents',
    href: '/documents',
    icon: <FileText className="w-5 h-5" />,
    roles: [UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER, UserRole.CANDIDATE],
    description: 'View and manage verification documents'
  },
  {
    label: 'Users',
    href: '/users',
    icon: <Users className="w-5 h-5" />,
    roles: [UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN],
    description: 'Manage system users and permissions'
  },
  {
    label: 'Organizations',
    href: '/organizations',
    icon: <Building className="w-5 h-5" />,
    roles: [UserRole.SYSTEM_ADMIN],
    description: 'Manage organizations and settings'
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="w-5 h-5" />,
    roles: [UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER, UserRole.CANDIDATE],
    description: 'Configure system preferences'
  }
];

const isNavItemActive = (href: string, pathname: string): boolean => {
  if (href === '/dashboard' && pathname === '/') return true;
  return pathname.startsWith(href);
};

const filterNavItemsByRole = (items: NavItem[], userRole?: UserRole): NavItem[] => {
  if (!userRole) return [];
  return items.filter(item => item.roles.includes(userRole));
};

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggle,
  className
}) => {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !isAuthenticated) return null;

  const filteredNavItems = filterNavItemsByRole(navigationItems, user?.role);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[70px]" : "w-64",
        "focus-within:outline-none",
        className
      )}
      aria-label="Sidebar navigation"
    >
      <div className="flex h-full flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between px-3 py-4">
          {!isCollapsed && (
            <Link 
              href="/dashboard"
              className="text-lg font-semibold text-gray-900 dark:text-white"
              aria-label="Return to dashboard"
            >
              Precheck.me
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="ml-auto"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {filteredNavItems.map((item) => {
            const isActive = isNavItemActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({
                    variant: isActive ? "secondary" : "ghost",
                    size: "sm",
                  }),
                  "w-full justify-start gap-3",
                  isActive && "bg-gray-100 dark:bg-gray-700"
                )}
                aria-current={isActive ? "page" : undefined}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="flex shrink-0 items-center justify-center">
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-gray-200 px-3 py-4 dark:border-gray-700">
          {user && !isCollapsed && (
            <div className="mb-4 px-2">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {user.profile.first_name} {user.profile.last_name}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {user.email}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;