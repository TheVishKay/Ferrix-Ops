import { useState } from "react";
import { MoreHorizontal, Edit2, Shield, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { employeeService } from "@/services/employeeService";

export function EmployeeActionsMenu({ employee, departments, designations, onUpdated }) {
  const [openState, setOpenState] = useState(null); // 'edit', 'status', 'role'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Edit Core Details State
  const [editForm, setEditForm] = useState({
    first_name: employee.first_name || "",
    last_name: employee.last_name || "",
    employee_code: employee.employee_code || "",
    department_id: employee.departments?.id || "",
    designation_id: employee.designations?.id || "",
    joining_date: employee.joining_date || "",
  });

  // Status State
  const [status, setStatus] = useState(employee.employment_status || "ACTIVE");

  // Role State
  const [role, setRole] = useState(employee.role || "EMPLOYEE");

  const closeDialog = () => {
    setOpenState(null);
    setError(null);
  };

  const handleEditChange = (e) => setEditForm({ ...editForm, [e.target.name]: e.target.value });
  const handleEditSelect = (name, value) => setEditForm({ ...editForm, [name]: value });

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await employeeService.updateEmployeeCore(employee.id, editForm);
      onUpdated();
      closeDialog();
    } catch (err) {
      setError(err.message || "Failed to update employee details");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await employeeService.updateEmployeeStatus(employee.id, status);
      onUpdated();
      closeDialog();
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await employeeService.updateEmployeeRole(employee.user_id, role);
      onUpdated();
      closeDialog();
    } catch (err) {
      setError(err.message || "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  // Filter only active departments and designations for the edit form
  const activeDepartments = departments.filter((d) => d.is_active !== false);
  const activeDesignations = designations.filter((d) => d.is_active !== false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-9 min-w-9"
            aria-label={`Options for ${employee.name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Management Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenState("edit")}>
            <Edit2 className="mr-2 size-4" />
            Edit Core Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenState("status")}>
            <Activity className="mr-2 size-4" />
            Change Status
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenState("role")}>
            <Shield className="mr-2 size-4" />
            Change Role
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Core Details Dialog */}
      <Dialog open={openState === "edit"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Core Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  name="first_name"
                  required
                  value={editForm.first_name}
                  onChange={handleEditChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  name="last_name"
                  required
                  value={editForm.last_name}
                  onChange={handleEditChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Employee Code</Label>
                <Input
                  name="employee_code"
                  required
                  value={editForm.employee_code}
                  onChange={handleEditChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Joining Date</Label>
                <Input
                  type="date"
                  name="joining_date"
                  required
                  value={editForm.joining_date}
                  onChange={handleEditChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  required
                  value={editForm.department_id}
                  onValueChange={(val) => handleEditSelect("department_id", val)}
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
                    {/* Add current if inactive to prevent breaking selection */}
                    {!activeDepartments.find((d) => d.id === editForm.department_id) &&
                      employee.departments?.name && (
                        <SelectItem key={editForm.department_id} value={editForm.department_id}>
                          {employee.departments.name} (Inactive)
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Select
                  required
                  value={editForm.designation_id}
                  onValueChange={(val) => handleEditSelect("designation_id", val)}
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
                    {!activeDesignations.find((d) => d.id === editForm.designation_id) &&
                      employee.designations?.name && (
                        <SelectItem key={editForm.designation_id} value={editForm.designation_id}>
                          {employee.designations.name} (Inactive)
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={openState === "status"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Employment Status</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStatusSubmit} className="space-y-4">
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <p className="text-sm text-muted-foreground">
              Select the new employment status. Setting to <strong>EXITED</strong> will permanently
              suspend the employee's login access.
            </p>
            <div className="space-y-2">
              <Label>Employment Status</Label>
              <Select required value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active (Normal Access)</SelectItem>
                  <SelectItem value="INACTIVE">Inactive (No actions permitted)</SelectItem>
                  <SelectItem value="EXITED">Exited (Login Suspended)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Status
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={openState === "role"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Employee Role</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRoleSubmit} className="space-y-4">
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <div className="space-y-2">
              <Label>System Role</Label>
              <Select required value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">EMPLOYEE (Standard Access)</SelectItem>
                  <SelectItem value="ACCOUNTS">ACCOUNTS (Financial Ops)</SelectItem>
                  <SelectItem value="OWNER">OWNER (Full Admin Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Role
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
