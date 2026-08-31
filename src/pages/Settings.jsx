import { useState } from "react";
import { Bell, Lock, Moon, Palette, Save, Shield, Sun, User } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

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

function ToggleRow({ label, subtitle, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="shrink-0 mt-0.5" />
    </div>
  );
}

export default function Settings() {
  // Profile state
  const [name, setName] = useState("Admin");
  const [email, setEmail] = useState("admin@meridianworks.in");
  const [phone, setPhone] = useState("+91 98765 00001");
  const [role, setRole] = useState("HR Administrator");

  // Notifications state
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [leaveAlerts, setLeaveAlerts] = useState(true);
  const [billAlerts, setBillAlerts] = useState(true);
  const [taskAlerts, setTaskAlerts] = useState(false);
  const [attendanceAlerts, setAttendanceAlerts] = useState(true);

  // Appearance
  const [theme, setTheme] = useState("system");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [currency, setCurrency] = useState("INR");

  // Saved toast state
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Profile */}
      <SettingsSection title="Profile" subtitle="Update your personal and contact information." index="01" tone="cyan">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 rounded-2xl">
            <AvatarFallback className="hr-avatar hr-tone-coral text-xl">AV</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground">Admin</p>
            <p className="text-xs text-muted-foreground">HR Administrator · Meridian Workforce Ltd.</p>
            <Button variant="outline" size="sm" className="mt-2 text-xs">Change Photo</Button>
          </div>
        </div>
        <Separator />
        <div className="space-y-4">
          <FieldRow label="Full Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FieldRow>
          <FieldRow label="Email Address">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FieldRow>
          <FieldRow label="Phone">
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FieldRow>
          <FieldRow label="Role">
            <Input value={role} readOnly className="bg-muted text-muted-foreground cursor-not-allowed" />
          </FieldRow>
        </div>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection title="Notifications" subtitle="Control which alerts reach you." index="02" tone="amber">
        <div className="space-y-3 divide-y divide-border">
          <ToggleRow label="Email Notifications" subtitle="Receive a daily digest via email." checked={emailNotifs} onChange={setEmailNotifs} />
          <div className="pt-3 space-y-3">
            <ToggleRow label="Leave Request Alerts" subtitle="Notify when an employee submits a leave request." checked={leaveAlerts} onChange={setLeaveAlerts} />
            <ToggleRow label="Bill & Expense Alerts" subtitle="Notify when a bill is submitted for approval." checked={billAlerts} onChange={setBillAlerts} />
            <ToggleRow label="Task Updates" subtitle="Notify on task status changes." checked={taskAlerts} onChange={setTaskAlerts} />
            <ToggleRow label="Attendance Corrections" subtitle="Notify when an attendance correction is raised." checked={attendanceAlerts} onChange={setAttendanceAlerts} />
          </div>
        </div>
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection title="Appearance" subtitle="Customise the look and regional formatting." index="03" tone="violet">
        <div className="space-y-4">
          <FieldRow label="Theme">
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System Default</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Date Format">
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Currency">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">₹ Indian Rupee (INR)</SelectItem>
                <SelectItem value="USD">$ US Dollar (USD)</SelectItem>
                <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      </SettingsSection>

      {/* Security */}
      <SettingsSection title="Security" subtitle="Manage your password and session settings." index="04" tone="coral">
        <div className="space-y-4">
          <FieldRow label="Current Password">
            <Input type="password" placeholder="••••••••" />
          </FieldRow>
          <FieldRow label="New Password">
            <Input type="password" placeholder="Min. 8 characters" />
          </FieldRow>
          <FieldRow label="Confirm Password">
            <Input type="password" placeholder="Repeat new password" />
          </FieldRow>
          <div className="sm:ml-[200px]">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Lock className="size-3.5" /> Change Password
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        {saved && (
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
            ✓ Settings saved
          </p>
        )}
        <Button variant="outline" size="sm">Discard Changes</Button>
        <Button size="sm" className="gap-1.5" onClick={handleSave}>
          <Save className="size-3.5" /> Save Settings
        </Button>
      </div>
    </main>
  );
}
