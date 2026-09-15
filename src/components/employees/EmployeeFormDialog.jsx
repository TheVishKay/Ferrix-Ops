import { useState, useMemo } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { employeeService } from "@/services/employeeService";
import { useToast } from "@/components/ui/use-toast";

export function EmployeeFormDialog({ departments, designations, onSaved }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const activeDepartments = useMemo(() => {
    return (departments || []).filter((d) => d.is_active !== false);
  }, [departments]);

  const activeDesignations = useMemo(() => {
    return (designations || []).filter((d) => d.is_active !== false);
  }, [designations]);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    employee_code: "",
    department_id: "",
    designation_id: "",
    joining_date: "",
    date_of_birth: "",
    personal_phone: "",
    personal_email: "",
    address: "",
    emergency_contact: "",
  });

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await employeeService.createEmployee(formData);
      setOpen(false);
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        employee_code: "",
        department_id: "",
        designation_id: "",
        joining_date: "",
        date_of_birth: "",
        personal_phone: "",
        personal_email: "",
        address: "",
        emergency_contact: "",
      });
      toast({ title: "Success", description: "Employee created successfully." });
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || "Failed to create employee");
      toast({
        title: "Error",
        description: err.message || "Failed to create employee",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-1.5">
          <Plus className="size-3.5" /> Add Employee
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold hr-tone-cyan">Auth / Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  name="first_name"
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  name="last_name"
                  required
                  value={formData.last_name}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Company Email</Label>
                <Input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Initial Password</Label>
                <Input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold hr-tone-violet">Organization</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee Code</Label>
                <Input
                  name="employee_code"
                  required
                  value={formData.employee_code}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Joining Date</Label>
                <Input
                  type="date"
                  name="joining_date"
                  required
                  value={formData.joining_date}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  required
                  value={formData.department_id}
                  onValueChange={(val) => handleSelectChange("department_id", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Dept" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Select
                  required
                  value={formData.designation_id}
                  onValueChange={(val) => handleSelectChange("designation_id", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Desig" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDesignations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold hr-tone-lime">Personal Information (Secure)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  name="date_of_birth"
                  required
                  value={formData.date_of_birth}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Personal Phone</Label>
                <Input
                  type="tel"
                  name="personal_phone"
                  required
                  value={formData.personal_phone}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Personal Email</Label>
                <Input
                  type="email"
                  name="personal_email"
                  required
                  value={formData.personal_email}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Emergency Contact</Label>
                <Input
                  type="tel"
                  name="emergency_contact"
                  required
                  value={formData.emergency_contact}
                  onChange={handleChange}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Address</Label>
                <Input name="address" required value={formData.address} onChange={handleChange} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Provision Employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
