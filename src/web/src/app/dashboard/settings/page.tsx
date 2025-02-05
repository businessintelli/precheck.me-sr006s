"use client";

import * as React from "react";
import { z } from "zod";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Form } from "@/components/shared/Form";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { UI_CONSTANTS } from "@/lib/constants";

// Settings form validation schema
const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"], {
    required_error: "Please select a theme",
  }),
  language: z.enum(["en-US", "en-GB", "hi"], {
    required_error: "Please select a language",
  }),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean(),
  }),
  timezone: z.string().min(1, "Please select a timezone"),
  dateFormat: z.enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"], {
    required_error: "Please select a date format",
  }),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// Theme options following Material Design 3.0
const THEME_OPTIONS = [
  { label: "Light", value: "light", icon: "☀️" },
  { label: "Dark", value: "dark", icon: "🌙" },
  { label: "System", value: "system", icon: "⚙️" },
] as const;

// Language options with native names
const LANGUAGE_OPTIONS = [
  { label: "English (US)", value: "en-US", nativeName: "English (US)" },
  { label: "English (UK)", value: "en-GB", nativeName: "English (UK)" },
  { label: "हिंदी", value: "hi", nativeName: "हिंदी (Hindi)" },
] as const;

// Date format options
const DATE_FORMAT_OPTIONS = [
  { label: "MM/DD/YYYY", value: "MM/DD/YYYY", example: "12/31/2023" },
  { label: "DD/MM/YYYY", value: "DD/MM/YYYY", example: "31/12/2023" },
  { label: "YYYY-MM-DD", value: "YYYY-MM-DD", example: "2023-12-31" },
] as const;

const SettingsPage: React.FC = () => {
  const { user, updateUserSettings } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  // Default values from user settings
  const defaultValues: SettingsFormData = React.useMemo(() => ({
    theme: user?.profile?.theme || "system",
    language: user?.profile?.locale || "en-US",
    notifications: {
      email: user?.profile?.notifications?.email ?? true,
      push: user?.profile?.notifications?.push ?? true,
      sms: user?.profile?.notifications?.sms ?? false,
    },
    timezone: user?.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: user?.profile?.dateFormat || "MM/DD/YYYY",
  }), [user]);

  // Handle settings submission with optimistic updates
  const handleSettingsSubmit = async (data: SettingsFormData) => {
    try {
      setIsSaving(true);
      await updateUserSettings(data);
    } catch (error) {
      console.error("Failed to update settings:", error);
      throw new Error("Failed to update settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardShell>
      <div className="container max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Header Section */}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Settings
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage your account preferences and application settings
            </p>
          </div>

          {/* Settings Form */}
          <Form
            schema={settingsSchema}
            onSubmit={handleSettingsSubmit}
            defaultValues={defaultValues}
            className="space-y-8"
          >
            {({ register, formState: { errors } }) => (
              <>
                {/* Appearance Section */}
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Appearance
                  </h2>
                  <div className="space-y-4">
                    {/* Theme Selection */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        Theme
                      </label>
                      <div className="mt-2 grid grid-cols-3 gap-3">
                        {THEME_OPTIONS.map((option) => (
                          <label
                            key={option.value}
                            className={cn(
                              "flex items-center justify-center p-3 border rounded-lg cursor-pointer",
                              "transition-colors duration-200",
                              errors.theme
                                ? "border-red-500"
                                : "border-gray-200 dark:border-gray-700",
                              "hover:bg-gray-50 dark:hover:bg-gray-700"
                            )}
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              value={option.value}
                              {...register("theme")}
                            />
                            <span className="flex items-center space-x-2">
                              <span className="text-xl">{option.icon}</span>
                              <span className="text-sm font-medium">
                                {option.label}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Language Selection */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        Language
                      </label>
                      <select
                        className={cn(
                          "mt-1 block w-full rounded-md border-gray-300 shadow-sm",
                          "focus:border-primary-500 focus:ring-primary-500",
                          "dark:bg-gray-700 dark:border-gray-600",
                          errors.language && "border-red-500"
                        )}
                        {...register("language")}
                      >
                        {LANGUAGE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.nativeName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Notifications Section */}
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Notifications
                  </h2>
                  <div className="space-y-4">
                    {["email", "push", "sms"].map((type) => (
                      <label
                        key={type}
                        className="flex items-center space-x-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                          {...register(`notifications.${type}`)}
                        />
                        <span className="text-gray-700 dark:text-gray-200 capitalize">
                          {type} notifications
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Regional Settings */}
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Regional Settings
                  </h2>
                  <div className="space-y-4">
                    {/* Timezone Selection */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        Timezone
                      </label>
                      <select
                        className={cn(
                          "mt-1 block w-full rounded-md border-gray-300 shadow-sm",
                          "focus:border-primary-500 focus:ring-primary-500",
                          "dark:bg-gray-700 dark:border-gray-600",
                          errors.timezone && "border-red-500"
                        )}
                        {...register("timezone")}
                      >
                        {Intl.supportedValuesOf("timeZone").map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date Format Selection */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        Date Format
                      </label>
                      <div className="mt-2 grid grid-cols-3 gap-3">
                        {DATE_FORMAT_OPTIONS.map((option) => (
                          <label
                            key={option.value}
                            className={cn(
                              "flex flex-col p-3 border rounded-lg cursor-pointer",
                              "transition-colors duration-200",
                              errors.dateFormat
                                ? "border-red-500"
                                : "border-gray-200 dark:border-gray-700",
                              "hover:bg-gray-50 dark:hover:bg-gray-700"
                            )}
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              value={option.value}
                              {...register("dateFormat")}
                            />
                            <span className="text-sm font-medium">
                              {option.label}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {option.example}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={cn(
                      "px-4 py-2 rounded-md text-white bg-primary-600",
                      "hover:bg-primary-700 focus:outline-none focus:ring-2",
                      "focus:ring-offset-2 focus:ring-primary-500",
                      "transition-colors duration-200",
                      isSaving && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </>
            )}
          </Form>
        </div>
      </div>
    </DashboardShell>
  );
};

export default SettingsPage;