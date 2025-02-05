"use client";

import React, { memo } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@react-hook/media-query";
import { Button } from "../shared/Button";
import { cn } from "../../lib/utils";
import { UI_CONSTANTS } from "../../lib/constants";

// Footer link configuration with tracking IDs
const FOOTER_LINKS = {
  company: [
    { label: "About", href: "/about", trackingId: "footer_about" },
    { label: "Careers", href: "/careers", trackingId: "footer_careers" },
    { label: "Contact", href: "/contact", trackingId: "footer_contact" }
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy", trackingId: "footer_privacy" },
    { label: "Terms of Service", href: "/terms", trackingId: "footer_terms" },
    { label: "Security", href: "/security", trackingId: "footer_security" }
  ],
  resources: [
    { label: "Documentation", href: "/docs", trackingId: "footer_docs" },
    { label: "Support", href: "/support", trackingId: "footer_support" },
    { label: "FAQs", href: "/faqs", trackingId: "footer_faqs" }
  ]
} as const;

// Social media links with accessibility labels
const SOCIAL_LINKS = [
  {
    platform: "LinkedIn",
    href: "https://linkedin.com/company/precheck-me",
    trackingId: "footer_linkedin",
    ariaLabel: "Visit our LinkedIn page"
  },
  {
    platform: "Twitter",
    href: "https://twitter.com/precheck_me",
    trackingId: "footer_twitter",
    ariaLabel: "Follow us on Twitter"
  },
  {
    platform: "GitHub",
    href: "https://github.com/precheck-me",
    trackingId: "footer_github",
    ariaLabel: "View our GitHub repository"
  }
] as const;

// Analytics category for footer interactions
const FOOTER_ANALYTICS_CATEGORY = "footer_interaction";

// Footer link component with tracking and accessibility
const FooterLink: React.FC<{
  label: string;
  href: string;
  trackingId: string;
}> = memo(({ label, href, trackingId }) => (
  <Link href={href} passHref legacyBehavior>
    <Button
      variant="ghost"
      size="sm"
      asChild
      className="text-muted-foreground hover:text-primary"
      onClick={() => {
        // Analytics tracking
        window.gtag?.("event", "click", {
          event_category: FOOTER_ANALYTICS_CATEGORY,
          event_label: trackingId
        });
      }}
      aria-label={label}
    >
      {label}
    </Button>
  </Link>
));

FooterLink.displayName = "FooterLink";

// Main Footer component
const Footer: React.FC = memo(() => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery(
    `(max-width: ${UI_CONSTANTS.BREAKPOINTS.mobile}px)`
  );
  const isTablet = useMediaQuery(
    `(max-width: ${UI_CONSTANTS.BREAKPOINTS.tablet}px)`
  );

  // Get current year for copyright
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "w-full bg-background border-t",
        "py-8 px-4 md:px-6 lg:px-8",
        "print:hidden"
      )}
      role="contentinfo"
      aria-label="Site footer"
    >
      {/* Structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "http://schema.org",
            "@type": "Organization",
            name: "Precheck.me",
            url: "https://precheck.me",
            logo: "https://precheck.me/logo.png",
            sameAs: SOCIAL_LINKS.map((link) => link.href)
          })
        }}
      />

      <div className="max-w-7xl mx-auto">
        {/* Main footer content */}
        <div
          className={cn(
            "grid gap-8",
            isMobile
              ? "grid-cols-1"
              : isTablet
              ? "grid-cols-2"
              : "grid-cols-4"
          )}
        >
          {/* Company info */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/logo.svg"
                alt="Precheck.me"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
              <span className="text-xl font-semibold">Precheck.me</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              {t("footer.description")}
            </p>
          </div>

          {/* Navigation columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                {t(`footer.categories.${category}`)}
              </h2>
              <nav className="flex flex-col gap-1" aria-label={`${category} links`}>
                {links.map((link) => (
                  <FooterLink key={link.trackingId} {...link} />
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Bottom section */}
        <div
          className={cn(
            "mt-8 pt-8 border-t",
            "flex flex-col md:flex-row justify-between items-center gap-4"
          )}
        >
          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © {currentYear} Precheck.me. {t("footer.rights")}
          </p>

          {/* Social links */}
          <div className="flex gap-4">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.trackingId}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label={link.ariaLabel}
                onClick={() => {
                  window.gtag?.("event", "click", {
                    event_category: FOOTER_ANALYTICS_CATEGORY,
                    event_label: link.trackingId
                  });
                }}
              >
                <span className="sr-only">{link.platform}</span>
                <i className={`icon-${link.platform.toLowerCase()}`} aria-hidden="true" />
              </a>
            ))}
          </div>

          {/* Language selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("footer.language")}:
            </span>
            <select
              className="text-sm bg-transparent border rounded-md"
              onChange={(e) => {
                // Handle language change
                const newLang = e.target.value;
                window.gtag?.("event", "language_change", {
                  event_category: FOOTER_ANALYTICS_CATEGORY,
                  event_label: newLang
                });
              }}
              aria-label={t("footer.select_language")}
            >
              <option value="en-US">English (US)</option>
              <option value="en-UK">English (UK)</option>
              <option value="hi-IN">हिंदी</option>
            </select>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;