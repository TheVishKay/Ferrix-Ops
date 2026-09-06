import { useState, useEffect, useCallback } from "react";
import { Loader2, UploadCloud, Trash2, FileText, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/constants/roles";

export default function ExpenseDocuments({ expenseId, expenseStatus, readOnly = false }) {
  const { user, profile } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchDocuments = useCallback(async () => {
    if (!expenseId) return;
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("expense_documents")
        .select("*")
        .eq("expense_id", expenseId)
        .order("uploaded_at", { ascending: false });

      if (fetchErr) throw fetchErr;
      setDocuments(data || []);
    } catch (err) {
      console.error("Failed to load documents:", err);
      setError("Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, [expenseId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = "";

    try {
      setUploading(true);
      setError(null);

      const uniqueSuffix = crypto.randomUUID();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${expenseId}/${uniqueSuffix}-${sanitizedName}`;

      // 1. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("expense-documents")
        .upload(storagePath, file);

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // 2. Insert metadata
      const { error: insertError } = await supabase.from("expense_documents").insert({
        expense_id: expenseId,
        storage_path: storagePath,
        original_file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        uploaded_by: user.id, // RLS requires this to match auth.uid()
      });

      if (insertError) {
        // Best-effort cleanup
        await supabase.storage.from("expense-documents").remove([storagePath]);
        throw new Error(`Metadata insertion failed: ${insertError.message}`);
      }

      await fetchDocuments();
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload document.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      setDeletingId(doc.id);
      setError(null);

      // 1. Delete metadata from public.expense_documents
      const { error: dbError } = await supabase.from("expense_documents").delete().eq("id", doc.id);

      if (dbError) {
        // Stop immediately if metadata deletion fails. Do NOT attempt Storage deletion.
        throw new Error(`Failed to delete metadata: ${dbError.message}`);
      }

      // Metadata deletion succeeded. Update UI immediately so document disappears.
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));

      // 2. Delete the Storage object
      const { error: storageError } = await supabase.storage
        .from("expense-documents")
        .remove([doc.storage_path]);

      if (storageError) {
        // Storage deletion failed, but metadata is already deleted.
        // Do NOT recreate the metadata row. Report the cleanup failure.
        console.warn("Storage cleanup failed:", storageError);
        setError("Document metadata removed, but Storage cleanup failed.");
        return;
      }
    } catch (err) {
      console.error("Delete error:", err);
      setError(err.message || "Failed to delete document.");
      // Refresh to ensure UI matches DB state
      await fetchDocuments();
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const { data, error } = await supabase.storage
        .from("expense-documents")
        .createSignedUrl(doc.storage_path, 3600, { download: true });

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to generate download link.");
    }
  };

  const canUpload =
    !readOnly &&
    (expenseStatus === "DRAFT" ||
      expenseStatus === "RETURNED_FOR_CORRECTION" ||
      profile?.role === ROLES.OWNER ||
      profile?.role === ROLES.ACCOUNTS);
  // Note: Employee can upload if DRAFT/RETURNED. ACCOUNTS/OWNER can upload technically via RLS but functionally we might restrict it. The plan says employee uploads.

  // Actually, limit employee uploads to DRAFT/RETURNED_FOR_CORRECTION based on RLS & workflow:
  const isEmployeeAndEditable =
    profile?.role === ROLES.EMPLOYEE &&
    (expenseStatus === "DRAFT" || expenseStatus === "RETURNED_FOR_CORRECTION");
  const isPrivileged = profile?.role === ROLES.OWNER || profile?.role === ROLES.ACCOUNTS;
  const showUpload = !readOnly && (isEmployeeAndEditable || isPrivileged);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Documents</h4>
        {showUpload && (
          <div>
            <input
              type="file"
              id={`upload-${expenseId}`}
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <label
              htmlFor={`upload-${expenseId}`}
              className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 cursor-pointer ${
                uploading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {uploading ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 size-3.5" />
              )}
              Upload Document
            </label>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded-md text-center border border-border border-dashed">
          No documents attached.
        </div>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => {
            const canDelete =
              !readOnly &&
              ((profile?.role === ROLES.EMPLOYEE && expenseStatus === "DRAFT") ||
                profile?.role === ROLES.OWNER);

            return (
              <li
                key={doc.id}
                className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card shadow-sm"
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1 mr-4">
                  <div className="bg-muted p-2 rounded-md shrink-0 text-muted-foreground">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-sm font-medium text-foreground truncate"
                      title={doc.original_file_name}
                    >
                      {doc.original_file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(doc.file_size / 1024).toFixed(1)} KB •{" "}
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => handleDownload(doc)}
                    title="Download"
                  >
                    <Download className="size-4 text-muted-foreground" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(doc)}
                      disabled={deletingId === doc.id}
                      title="Delete"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
