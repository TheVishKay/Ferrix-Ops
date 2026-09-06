import { useState } from "react";
import { Plus, Edit2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
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

export function DesignationManagementDialog({ designations, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await employeeService.createDesignation({ name: newName.trim(), is_active: true });
      setNewName("");
      onUpdated();
    } catch (err) {
      setError(err.message || "Failed to create designation");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id, data) => {
    setLoading(true);
    setError(null);
    try {
      await employeeService.updateDesignation(id, data);
      setEditingId(null);
      onUpdated();
    } catch (err) {
      setError(err.message || "Failed to update designation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Manage Designations
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Designations</DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <form onSubmit={handleCreate} className="flex gap-2 mb-4">
          <Input
            placeholder="New designation name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !newName.trim()}>
            <Plus className="size-4" />
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {designations.map((desig) => (
            <div
              key={desig.id}
              className="flex items-center justify-between p-2 border rounded-md bg-muted/20"
            >
              {editingId === desig.id ? (
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
                    onClick={() => handleUpdate(desig.id, { name: editName })}
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
                      className={`text-sm font-medium ${!desig.is_active && "text-muted-foreground line-through"}`}
                    >
                      {desig.name}
                    </span>
                    {!desig.is_active && (
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
                        setEditingId(desig.id);
                        setEditName(desig.name);
                      }}
                      disabled={loading}
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    {desig.is_active ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleUpdate(desig.id, { is_active: false })}
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
                        onClick={() => handleUpdate(desig.id, { is_active: true })}
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
          {designations.length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-4">No designations found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
