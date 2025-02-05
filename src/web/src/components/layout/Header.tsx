"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "@mantine/hooks"; // @version ^7.0.0
import { useTheme } from "next-themes"; // @version ^0.2.1
import { Button, ButtonLoading } from "../shared/Button";
import { Dropdown, DropdownOption } from "../shared/Dropdown";
import useAuth from "../../hooks/useAuth";
import { cn } from "../../lib/utils";
import { UserRole } from "../../types/user.types";

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  organizations?: Array<{
    id: string;
    name: string;
    role: UserRole;
  }>;
}

export const Header: React.FC<HeaderProps> = ({
  className,
  organizations = [],
  ...props
}) => {
  const router = useRouter();
  const { user, organization, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  // Navigation items based on user role
  const navigationItems = React.useMemo(() => {
    const items = [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Background Checks", href: "/checks" },
      { label: "Interviews", href: "/interviews" },
    ];

    if (user?.role === UserRole.SYSTEM_ADMIN || user?.role === UserRole.COMPANY_ADMIN) {
      items.push({ label: "Reports", href: "/reports" });
      items.push({ label: "Settings", href: "/settings" });
    }

    return items;
  }, [user?.role]);

  // Organization options for dropdown
  const organizationOptions: DropdownOption[] = React.useMemo(() => {
    return organizations.map((org) => ({
      value: org.id,
      label: org.name,
      description: `Role: ${org.role}`,
    }));
  }, [organizations]);

  // Handle organization switching
  const handleOrganizationSwitch = async (organizationId: string) => {
    try {
      setIsLoading(true);
      // Implement organization switch logic here
      router.refresh();
    } catch (error) {
      console.error("Organization switch failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout with loading state
  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await logout();
      router.push("/auth/login");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
      {...props}
    >
      <div className="container flex h-14 items-center justify-between px-4">
        {/* Logo and Company Name */}
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <span className="font-bold text-xl">Precheck.me</span>
          </Link>
        </div>

        {/* Main Navigation - Desktop */}
        {!isMobile && (
          <nav className="mx-6 flex items-center space-x-4 lg:space-x-6">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* Organization Switcher */}
          {organizations.length > 1 && (
            <Dropdown
              options={organizationOptions}
              value={organization?.id}
              onChange={handleOrganizationSwitch}
              placeholder="Select Organization"
              disabled={isLoading}
              variant="compact"
              className="w-48"
            />
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "🌞" : "🌙"}
          </Button>

          {/* User Menu */}
          <Dropdown
            options={[
              { value: "profile", label: "Profile" },
              { value: "settings", label: "Settings" },
              { value: "logout", label: "Logout" },
            ]}
            onChange={(value) => {
              if (value === "logout") {
                handleLogout();
              } else {
                router.push(`/${value}`);
              }
            }}
            value=""
            variant="ghost"
            className="w-40"
          >
            <div className="flex items-center space-x-2">
              <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                {user?.profile.first_name?.[0] || "U"}
              </span>
              {!isMobile && (
                <span className="text-sm font-medium">
                  {user?.profile.first_name}
                </span>
              )}
            </div>
          </Dropdown>

          {/* Mobile Menu Button */}
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? "✕" : "☰"}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobile && isMenuOpen && (
        <nav className="border-t p-4 bg-background">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block py-2 text-sm font-medium transition-colors hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
};

export default Header;