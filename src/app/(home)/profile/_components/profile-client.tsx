"use client";

import { useState, useTransition, useCallback } from "react";
import { updateProfileAction } from "@/lib/actions/settings";
import { useToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

type Profile = {
  id: string;
  username: string;
  fullName: string | null;
  email: string;
  role: "administrator" | "editor" | "viewer" | null;
  avatarUrl: string | null;
  twoFactorEnabled: boolean | null;
  preferredLanguage: string | null;
  lastLogin: Date | null;
  createdAt: Date | null;
};

type Stats =
  | { role: "administrator"; totalUsersManaged: number; totalReportsReleased: number }
  | { role: "editor"; totalReportsCreated: number; activeFindings: number }
  | { role: "viewer"; totalReportsAccessed: number }
  | null;

type Props = {
  profile: Profile;
  stats: Stats;
};

const roleBadgeColors: Record<string, string> = {
  administrator: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  editor: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  viewer: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
};

export default function ProfileClient({ profile, stats }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const { addToast } = useToast();
  useUnsavedChanges(isDirty);

  const markDirty = useCallback(() => {
    if (!isDirty) setIsDirty(true);
  }, [isDirty]);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateProfileAction(formData);
      if (result.success) {
        addToast("Profile updated successfully.", "success");
        setIsEditing(false);
        setIsDirty(false);
      } else {
        addToast(result.error || "Failed to update profile.", "error");
      }
    });
  };

  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  const lastLoginText = profile.lastLogin
    ? new Date(profile.lastLogin).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* Profile Card */}
      <div className="xl:col-span-1">
        <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex size-[120px] items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M20 21a8 8 0 0 0-16 0" />
              </svg>
            </span>

            <h3 className="mt-4 text-xl font-bold text-dark dark:text-white">
              {profile.fullName || profile.username}
            </h3>

            <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
              @{profile.username}
            </p>

            <span
              className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                roleBadgeColors[profile.role ?? "viewer"] || ""
              }`}
            >
              {profile.role ?? "viewer"}
            </span>

            <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
              {profile.email}
            </p>
          </div>

          <hr className="my-5 border-stroke dark:border-dark-3" />

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-dark-4 dark:text-dark-6">Member Since</span>
              <span className="font-medium text-dark dark:text-white">{memberSince}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-4 dark:text-dark-6">Last Login</span>
              <span className="font-medium text-dark dark:text-white">{lastLoginText}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-4 dark:text-dark-6">2FA</span>
              <span
                className={`font-medium ${
                  profile.twoFactorEnabled
                    ? "text-green-500"
                    : "text-dark-4 dark:text-dark-6"
                }`}
              >
                {profile.twoFactorEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="space-y-6 xl:col-span-2">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.role === "administrator" && (
              <>
                <StatCard label="Users Managed" value={stats.totalUsersManaged} />
                <StatCard label="Reports Released" value={stats.totalReportsReleased} />
              </>
            )}
            {stats.role === "editor" && (
              <>
                <StatCard label="Reports Created" value={stats.totalReportsCreated} />
                <StatCard label="Finding Templates" value={stats.activeFindings} />
              </>
            )}
            {stats.role === "viewer" && (
              <StatCard label="Reports Accessible" value={stats.totalReportsAccessed} />
            )}
          </div>
        )}

        {/* Edit Profile Form */}
        <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <h4 className="text-lg font-bold text-dark dark:text-white">Profile Information</h4>
            <button
              type="button"
              onClick={() => {
                setIsEditing(!isEditing);
                if (isEditing) setIsDirty(false);
              }}
              className="text-sm font-medium text-primary hover:underline"
            >
              {isEditing ? "Cancel" : "Edit"}
            </button>
          </div>

          {isEditing ? (
            <form action={handleSubmit} className="space-y-4" onChange={markDirty}>
              <div>
                <label className="text-body-sm font-medium text-dark dark:text-white">
                  Full Name
                </label>
                <input
                  name="fullName"
                  type="text"
                  defaultValue={profile.fullName || ""}
                  placeholder="Enter your full name"
                  className="mt-2 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                />
              </div>
              <div>
                <label className="text-body-sm font-medium text-dark dark:text-white">
                  Email <span className="ml-1 text-red">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={profile.email}
                  placeholder="Enter your email"
                  className="mt-2 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                />
              </div>
              <div>
                <label className="text-body-sm font-medium text-dark dark:text-white">
                  Avatar URL
                </label>
                <input
                  name="avatarUrl"
                  type="url"
                  defaultValue={profile.avatarUrl || ""}
                  placeholder="https://example.com/avatar.png"
                  className="mt-2 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-sm">
              <InfoRow label="Full Name" value={profile.fullName || "—"} />
              <InfoRow label="Username" value={profile.username} />
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="Role" value={profile.role ?? "viewer"} capitalize />
              <InfoRow label="Language" value={profile.preferredLanguage === "id" ? "Bahasa Indonesia" : "English"} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <p className="text-sm text-dark-4 dark:text-dark-6">{label}</p>
      <p className="mt-1 text-2xl font-bold text-dark dark:text-white">{value}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-stroke pb-3 last:border-0 dark:border-dark-3">
      <span className="text-dark-4 dark:text-dark-6">{label}</span>
      <span className={`font-medium text-dark dark:text-white ${capitalize ? "capitalize" : ""}`}>
        {value}
      </span>
    </div>
  );
}
