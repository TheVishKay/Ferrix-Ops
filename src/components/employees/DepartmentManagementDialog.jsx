import { useState } from "react";
import { Plus, Edit2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { employeeService } from "@/services/employeeService";
import { useToast } from "@/components/ui/use-toast";

export function DepartmentManagementDialog({ departments, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await employeeService.createDepartment({ name: newName.trim(), is_active: true });
      setNewName("");
      toast({ title: "Success", description: "Department created successfully." });
      onUpdated();
    } catch (err) {
      setError(err.message || "Failed to create department");
      toast({
        title: "Error",
        description: err.message || "Failed to create department",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id, data) => {
    setLoading(true);
    setError(null);
    try {
      await employeeService.updateDepartment(id, data);
      setEditingId(null);
      toast({ title: "Success", description: "Department updated successfully." });
      onUpdated();
    } catch (err) {
      setError(err.message || "Failed to update department");
      toast({
        title: "Error",
        description: err.message || "Failed to update department",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Manage Departments
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Departments</DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <form onSubmit={handleCreate} className="flex gap-2 mb-4">
          <Input
            placeholder="New department name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !newName.trim()}>
            <Plus className="size-4" />
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="flex items-center justify-between p-2 border rounded-md bg-muted/20"
            >
              {editingId === dept.id ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={loading}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUpdate(dept.id, { name: editName })}
                    disabled={loading || !editName.trim()}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${!dept.is_active && "text-muted-foreground line-through"}`}
                    >
                      {dept.name}
                    </span>
                    {!dept.is_active && (
                      <Badge variant="secondary" className="text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => {
                        setEditingId(dept.id);
                        setEditName(dept.name);
                      }}
                      disabled={loading}
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    {dept.is_active ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleUpdate(dept.id, { is_active: false })}
                        disabled={loading}
                        title="Deactivate"
                      >
                        <XCircle className="size-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleUpdate(dept.id, { is_active: true })}
                        disabled={loading}
                        title="Reactivate"
                      >
                        <CheckCircle2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          {departments.length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-4">No departments found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
