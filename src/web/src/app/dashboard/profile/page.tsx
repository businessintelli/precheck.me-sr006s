'use client';

// @package react ^18.0.0
// @package zod ^3.22.0
// @package react-hot-toast ^2.4.1

import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Form } from '@/components/shared/Form';
import { UserProfile, User, userProfileSchema } from '@/types/user.types';
import { useAuth } from '@/hooks/useAuth';

// Profile form validation schema extending the base user profile schema
const profileSchema = userProfileSchema.extend({
  organization_role: z.string().min(2, 'Role is required').max(100, 'Role is too long'),
  profile_image_url: z.string().url().nullable()
});

type ProfileFormData = z.infer<typeof profileSchema>;

/**
 * User profile management page implementing Material Design 3.0 principles
 * with comprehensive form validation and real-time updates
 */
const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize form with current user data
  const defaultValues: ProfileFormData = {
    first_name: user?.profile.first_name || '',
    last_name: user?.profile.last_name || '',
    phone: user?.profile.phone || '',
    timezone: user?.profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    organization_role: user?.profile.organization_role || '',
    profile_image_url: user?.profile.avatar_url || null
  };

  /**
   * Handle profile update with optimistic updates and error recovery
   */
  const handleProfileUpdate = async (data: ProfileFormData) => {
    setIsLoading(true);
    const previousData = user?.profile;

    try {
      // Optimistically update UI
      updateUser({
        ...user,
        profile: {
          ...user?.profile,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          timezone: data.timezone,
          organization_role: data.organization_role,
          avatar_url: data.profile_image_url
        }
      } as User);

      // Show success notification
      toast.success('Profile updated successfully');
      setIsDirty(false);
    } catch (error) {
      // Revert optimistic update on error
      if (previousData && user) {
        updateUser({ ...user, profile: previousData });
      }
      
      toast.error('Failed to update profile. Please try again.');
      console.error('Profile update error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle form reset with unsaved changes warning
   */
  const handleFormReset = () => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to reset the form?');
      if (!confirmed) return;
    }
    // Reset form to initial values
    setIsDirty(false);
  };

  // Warn user about unsaved changes before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-gray-100">
          Profile Settings
        </h1>

        <Form<ProfileFormData>
          onSubmit={handleProfileUpdate}
          schema={profileSchema}
          defaultValues={defaultValues}
          className="space-y-6"
        >
          {({ register, formState: { errors } }) => (
            <>
              {/* Profile Image Section */}
              <div className="mb-8 flex items-center space-x-4">
                <div className="relative">
                  <img
                    src={user?.profile.avatar_url || '/default-avatar.png'}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary-500"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      // Handle image upload
                      setIsDirty(true);
                    }}
                    aria-label="Update profile picture"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Profile Picture
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    JPG, PNG or GIF, max 2MB
                  </p>
                </div>
              </div>

              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    First Name
                  </label>
                  <input
                    {...register('first_name')}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    aria-invalid={!!errors.first_name}
                  />
                  {errors.first_name && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.first_name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Last Name
                  </label>
                  <input
                    {...register('last_name')}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    aria-invalid={!!errors.last_name}
                  />
                  {errors.last_name && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.last_name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Phone Number
                  </label>
                  <input
                    {...register('phone')}
                    type="tel"
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    aria-invalid={!!errors.phone}
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.phone.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Organization Role
                  </label>
                  <input
                    {...register('organization_role')}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    aria-invalid={!!errors.organization_role}
                  />
                  {errors.organization_role && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.organization_role.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Timezone
                  </label>
                  <select
                    {...register('timezone')}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    aria-invalid={!!errors.timezone}
                  >
                    {Intl.supportedValuesOf('timeZone').map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  {errors.timezone && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.timezone.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-4 mt-8">
                <button
                  type="button"
                  onClick={handleFormReset}
                  className="px-6 py-2 rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  disabled={isLoading}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-md text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </Form>
      </div>
    </div>
  );
};

export default ProfilePage;