"use client";

import * as React from "react";
import { cn } from "class-variance-authority"; // @version ^0.7.0
import { Button, buttonVariants } from "../shared/Button";
import Link from "next/link";
import { ChevronRight } from "lucide-react"; // @version ^0.3.0

interface BreadcrumbItem {
  label: string;
  href: string;
  current?: boolean;
  icon?: React.ReactNode;
}

interface PageHeaderProps {
  heading: string;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

const RenderBreadcrumbs = React.memo(({ breadcrumbs }: { breadcrumbs: BreadcrumbItem[] }) => {
  if (!breadcrumbs?.length) return null;

  return (
    <nav aria-label="Breadcrumb navigation" className="mb-2">
      <ol className="flex items-center text-sm text-muted-foreground">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <li
              key={item.href}
              className={cn("flex items-center", {
                "text-foreground font-medium": item.current,
              })}
            >
              {index > 0 && (
                <ChevronRight
                  className="mx-2 h-4 w-4 text-muted-foreground/50"
                  aria-hidden="true"
                />
              )}
              <span className="flex items-center gap-1">
                {item.icon && (
                  <span className="h-4 w-4" aria-hidden="true">
                    {item.icon}
                  </span>
                )}
                {isLast ? (
                  <span aria-current="page">{item.label}</span>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "h-auto p-0 hover:bg-transparent"
                    )}
                  >
                    {item.label}
                  </Link>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
});

RenderBreadcrumbs.displayName = "RenderBreadcrumbs";

const PageHeader = React.memo(({
  heading,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) => {
  return (
    <div
      className={cn(
        "relative space-y-2 px-4 py-6 sm:px-6 lg:px-8",
        "border-b border-border/50",
        "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          {breadcrumbs && <RenderBreadcrumbs breadcrumbs={breadcrumbs} />}
          <h1 
            className={cn(
              "text-2xl font-bold tracking-tight",
              "text-foreground",
              "sm:text-3xl"
            )}
          >
            {heading}
          </h1>
          {description && (
            <div className="text-base text-muted-foreground max-w-prose">
              {description}
            </div>
          )}
        </div>
        {actions && (
          <div 
            className={cn(
              "flex items-center gap-4",
              "mt-4 md:mt-0",
              "flex-shrink-0"
            )}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
});

PageHeader.displayName = "PageHeader";

export default PageHeader;