"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "next-intl";
import { Analytics } from "@vercel/analytics";
import { ErrorBoundary } from "react-error-boundary";
import { Button } from "../components/shared/Button";
import { Card } from "../components/shared/Card";
import { Header } from "../components/layout/Header";
import { cn } from "../lib/utils";

// Feature cards data with animations
const FEATURES = [
  {
    title: "AI-Powered Interviews",
    description: "Automated preliminary interviews with natural language processing and real-time analysis",
    icon: "/icons/ai-interview.svg",
    animation: "fade-up"
  },
  {
    title: "Background Verification",
    description: "Comprehensive employment, education, and criminal background checks with global coverage",
    icon: "/icons/verification.svg",
    animation: "fade-up"
  },
  {
    title: "Real-time Tracking",
    description: "Live status updates and verification progress monitoring with instant notifications",
    icon: "/icons/tracking.svg",
    animation: "fade-up"
  },
  {
    title: "Secure Document Storage",
    description: "Encrypted storage for sensitive verification documents with automated retention policies",
    icon: "/icons/security.svg",
    animation: "fade-up"
  }
] as const;

// Benefits data with animated counters
const BENEFITS = [
  {
    title: "80% Faster Processing",
    description: "Reduce background check processing time significantly through automation",
    metric: "80",
    unit: "%",
    animation: "count-up"
  },
  {
    title: "99.99% Accuracy",
    description: "Highly accurate verification results through AI-powered validation",
    metric: "99.99",
    unit: "%",
    animation: "count-up"
  },
  {
    title: "60% Cost Reduction",
    description: "Lower verification costs through intelligent automation and streamlined processes",
    metric: "60",
    unit: "%",
    animation: "count-up"
  }
] as const;

// Enhanced SEO metadata generation
export async function generateMetadata() {
  return {
    title: "Precheck.me - AI-Powered Background Checks & Interviews",
    description: "Revolutionize your hiring process with automated background checks and AI interviews. Reduce verification time by 80% while ensuring 99.99% accuracy.",
    openGraph: {
      title: "Precheck.me - Transform Your Hiring Process",
      description: "AI-powered background checks and automated interviews for faster, more accurate hiring decisions.",
      images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: "Precheck.me - Next-Gen Hiring Platform",
      description: "Automated background checks and AI interviews for modern hiring.",
      images: ["/twitter-card.jpg"]
    },
    alternates: {
      canonical: "https://precheck.me",
      languages: {
        "en-US": "https://precheck.me",
        "hi-IN": "https://precheck.me/hi"
      }
    },
    robots: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1
    }
  };
}

// Main landing page component
const LandingPage = () => {
  const { t } = useTranslation();

  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <div className="min-h-screen bg-background">
        <Analytics />
        <Header />

        {/* Hero Section */}
        <section className="relative px-6 lg:px-8 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-6xl">
                Transform Your Hiring Process with AI-Powered Verification
              </h1>
              <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
                First-to-market comprehensive background check platform with integrated AI interview capabilities. Reduce verification time by 80% while ensuring 99.99% accuracy.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Button size="lg" onClick={() => window.location.href = "/signup"}>
                  Get Started
                </Button>
                <Button variant="outline" size="lg" onClick={() => window.location.href = "/demo"}>
                  Request Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 bg-muted/50">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature, index) => (
                <Card
                  key={feature.title}
                  className={cn(
                    "p-6 transition-all duration-300 hover:scale-105",
                    `animate-${feature.animation} delay-${index * 100}`
                  )}
                  variant="elevated"
                >
                  <Image
                    src={feature.icon}
                    alt={feature.title}
                    width={48}
                    height={48}
                    className="mb-4"
                  />
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {BENEFITS.map((benefit, index) => (
                <div
                  key={benefit.title}
                  className={cn(
                    "text-center",
                    `animate-${benefit.animation} delay-${index * 100}`
                  )}
                >
                  <div className="text-4xl font-bold text-primary mb-4">
                    {benefit.metric}
                    {benefit.unit}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary text-primary-foreground py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-6">
              Ready to Transform Your Hiring Process?
            </h2>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => window.location.href = "/signup"}
              className="hover:bg-white hover:text-primary"
            >
              Get Started Today
            </Button>
          </div>
        </section>
      </div>
    </ErrorBoundary>
  );
};

export default LandingPage;