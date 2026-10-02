import { useState } from "react";
import { Lock, User } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

function SettingsSection({ title, subtitle, index, tone = "cyan", children }) {
  return (
    <section className="hr-card space-y-5">
      <div className="flex items-center gap-2 pb-4 border-b border-border">
        <span className={`hr-section-index hr-tone-${tone}`}>{index}</span>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldRow({ label, children }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="max-w-md">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { session, profile } = useAuth();
  const { toast } = useToast();

  const displayRole = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1).toLowerCase()
    : "Owner";

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "??";

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword) {
      toast({ title: "Error", description: "New password is required.", variant: "error" });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters.",
        variant: "error",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "error" });
      return;
    }

    try {
      setChangingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Success", description: "Password updated successfully." });
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "Failed to update password.",
        variant: "error",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Profile — read-only identity from auth */}
      <SettingsSection
        title="Account Identity"
        subtitle="Your account information as configured by the system administrator."
        index="01"
        tone="cyan"
      >
        <div className="flex items-center gap-4">
          <Avatar className="size-16 rounded-2xl">
            <AvatarFallback className="hr-avatar hr-tone-coral text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground">{profile?.full_name || "—"}</p>
            <p className="text-xs text-muted-foreground">{displayRole} · Meridian Workforce Ltd.</p>
          </div>
        </div>
        <Separator />
        <div className="space-y-4">
          <FieldRow label="Full Name">
            <Input
              value={profile?.full_name || ""}
              readOnly
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
          </FieldRow>
          <FieldRow label="Email Address">
            <Input
              type="email"
              value={session?.user?.email || ""}
              readOnly
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
          </FieldRow>
          <FieldRow label="Role">
            <Input
              value={displayRole}
              readOnly
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
          </FieldRow>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <User className="size-3 shrink-0" />
          To update your personal details, visit your{" "}
          <a href="/profile" className="underline underline-offset-2 hover:text-foreground">
            Profile page
          </a>
          .
        </p>
      </SettingsSection>

      {/* Security — functional password change */}
      <SettingsSection
        title="Security"
        subtitle="Update your account password."
        index="02"
        tone="coral"
      >
        <div className="space-y-4">
          <FieldRow label="New Password">
            <Input
              type="password"
              placeholder="Min. 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={changingPassword}
            />
          </FieldRow>
          <FieldRow label="Confirm Password">
            <Input
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={changingPassword}
            />
          </FieldRow>
          <div className="sm:ml-[200px]">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleChangePassword}
              disabled={changingPassword}
            >
              <Lock className="size-3.5" />
              {changingPassword ? "Updating…" : "Change Password"}
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* Notifications — coming soon */}
      <SettingsSection
        title="Notifications"
        subtitle="Notification preferences — coming soon."
        index="03"
        tone="amber"
      >
        <p className="text-sm text-muted-foreground py-4 text-center">
          Notification settings will be available in a future update.
        </p>
      </SettingsSection>

      {/* Appearance — coming soon */}
      <SettingsSection
        title="Appearance"
        subtitle="Theme and regional formatting — coming soon."
        index="04"
        tone="violet"
      >
        <p className="text-sm text-muted-foreground py-4 text-center">
          Appearance settings will be available in a future update.
        </p>
      </SettingsSection>
    </main>
  );
}
