import { useState, useEffect } from "react";
import { User, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { employeeService } from "@/services/employeeService";

export default function Profile() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [employeeData, setEmployeeData] = useState(null);
  const [personalData, setPersonalData] = useState(null);

  const [formData, setFormData] = useState({
    date_of_birth: "",
    personal_phone: "",
    personal_email: "",
    address: "",
    emergency_contact: "",
  });

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        setLoading(true);
        if (!userId) return;

        // Fetch Employee record
        const { data: emp, error: empError } = await supabase
          .from("employees")
          .select("id, employee_code, joining_date, departments(name), designations(name)")
          .eq("user_id", userId)
          .single();

        if (empError) throw empError;

        if (mounted) {
          setEmployeeData(emp);

          // Fetch Personal Info
          try {
            const pi = await employeeService.getEmployeePersonalInfo(emp.id);
            setPersonalData(pi);
            setFormData({
              date_of_birth: pi.date_of_birth || "",
              personal_phone: pi.personal_phone || "",
              personal_email: pi.personal_email || "",
              address: pi.address || "",
              emergency_contact: pi.emergency_contact || "",
            });
          } catch (piErr) {
            console.error("Personal info not found:", piErr);
          }
        }
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (personalData) {
        // Update
        await employeeService.updatePersonalInfo(employeeData.id, formData);
      } else {
        // Insert (if missing)
        const { error: insErr } = await supabase.from("employee_personal_info").insert({
          employee_id: employeeData.id,
          ...formData,
        });
        if (insErr) throw insErr;
      }
      setSuccess("Profile updated successfully!");
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-destructive">
        <User className="mb-2 size-8" />
        <p className="font-semibold">{error}</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="hr-card p-6">
        <h2 className="mb-4 font-display text-xl font-bold tracking-tight text-foreground">
          Organizational Details
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <Label className="text-muted-foreground">Employee Code</Label>
            <p className="font-medium">{employeeData?.employee_code || "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Department</Label>
            <p className="font-medium">{employeeData?.departments?.name || "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Designation</Label>
            <p className="font-medium">{employeeData?.designations?.name || "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Joining Date</Label>
            <p className="font-medium">{employeeData?.joining_date || "—"}</p>
          </div>
        </div>
      </div>

      <div className="hr-card p-6">
        <h2 className="mb-4 font-display text-xl font-bold tracking-tight text-foreground">
          Personal Information
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Personal Phone</Label>
              <Input
                type="tel"
                name="personal_phone"
                value={formData.personal_phone}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Personal Email</Label>
              <Input
                type="email"
                name="personal_email"
                value={formData.personal_email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Emergency Contact</Label>
              <Input
                type="tel"
                name="emergency_contact"
                value={formData.emergency_contact}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-span-1 md:col-span-2 space-y-2">
              <Label>Home Address</Label>
              <Input name="address" value={formData.address} onChange={handleChange} required />
            </div>
          </div>

          {success && <p className="text-sm font-medium text-emerald-600">{success}</p>}
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save Changes
          </Button>
        </form>
      </div>
    </main>
  );
}
