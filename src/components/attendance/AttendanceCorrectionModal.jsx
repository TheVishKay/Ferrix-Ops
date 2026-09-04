import { useEffect, useRef } from "react";
import { X, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const displayStatus = {
  PRESENT: "Present",
  HALF_DAY: "Half Day",
  ABSENT: "Absent",
  LEAVE: "On Leave",
  INCOMPLETE: "Incomplete",
};

const dtFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "numeric",
  hour12: true,
});

// ---------------------------------------------------------------------------
// Datetime conversion helpers
//
// isoToLocalInput:
//   A UTC ISO from Supabase must be converted to local time before being
//   assigned to <input type="datetime-local">. new Date(iso).getFullYear()
//   etc. return local values, so this produces the correct local representation.
//
// localInputToISO:
//   A datetime-local value "YYYY-MM-DDTHH:mm" has no TZ. The HTML spec
//   (and browsers) treat new Date("YYYY-MM-DDTHH:mm") as local time.
//   .toISOString() converts to UTC. This is the correct interpretation:
//   the user sees their local time and we send the corresponding UTC instant.
// ---------------------------------------------------------------------------

export function isoToLocalInput(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function localInputToISO(datetimeLocalValue) {
  if (!datetimeLocalValue) return null;
  return new Date(datetimeLocalValue).toISOString();
}

// ---------------------------------------------------------------------------
// Final-state prediction — COALESCE semantics.
//
// The backend review_attendance_correction() RPC resolves the final
// attendance values as:
//
//   final_status    = COALESCE(requested_status,    original.status)
//   final_check_in  = COALESCE(requested_check_in,  original.check_in_at)
//   final_check_out = COALESCE(requested_check_out, original.check_out_at)
//
// A NULL (or empty-string) requested value means "preserve the original".
// It does NOT clear an existing timestamp.
//
// Parameters:
//   effectiveRequestedStatus — "" (no change) or a requested status string.
//                              Callers must translate isIncomplete's locked
//                              PRESENT before passing here.
//   requestedCheckIn         — "" (no override) or a datetime-local string.
//                              Callers must pass "" for isIncomplete check-in
//                              (payload sends null → COALESCE keeps original).
//   requestedCheckOut        — "" (no override) or a datetime-local string.
//   record                   — the original attendance record row.
//
// Returns boolean presence only. Deliberately avoids mixing datetime-local
// strings (form values) with UTC ISO strings (record values) — the two types
// are not compared; only value-existence (truthy/falsy) is used.
// ---------------------------------------------------------------------------

function predictFinalPresence(
  effectiveRequestedStatus,
  requestedCheckIn,
  requestedCheckOut,
  record,
) {
  // "" or null → COALESCE → preserve original.
  // Non-empty datetime-local string → override → that field is present.
  const finalStatus = effectiveRequestedStatus || record.status;
  const finalHasCheckIn = requestedCheckIn ? true : !!record.check_in_at;
  const finalHasCheckOut = requestedCheckOut ? true : !!record.check_out_at;
  return { finalStatus, finalHasCheckIn, finalHasCheckOut };
}

// ---------------------------------------------------------------------------
// Structural validity — mirrors the backend CHECK constraint and the
// final-state validation in review_attendance_correction() exactly.
//
// From migration 002, attendance_status_consistency:
//
//   PRESENT / HALF_DAY  → check_in required,      check_out required
//   INCOMPLETE          → check_in required,      check_out must be absent
//   ABSENT  / LEAVE     → check_in must be absent, check_out must be absent
// ---------------------------------------------------------------------------

function isStructurallyValid({ finalStatus, finalHasCheckIn, finalHasCheckOut }) {
  switch (finalStatus) {
    case "PRESENT":
    case "HALF_DAY":
      return finalHasCheckIn && finalHasCheckOut;
    case "INCOMPLETE":
      return finalHasCheckIn && !finalHasCheckOut;
    case "ABSENT":
    case "LEAVE":
      return !finalHasCheckIn && !finalHasCheckOut;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Props:
 *   record          — the full attendance record row (mapped)
 *   form            — { requestedStatus, requestedCheckIn, requestedCheckOut, reason }
 *   onFormChange    — (patch) => void
 *   onClose         — () => void
 *   onSubmit        — (payload) => void
 *   submitting      — boolean
 *   error           — string | null
 */
export default function AttendanceCorrectionModal({
  record,
  form,
  onFormChange,
  onClose,
  onSubmit,
  submitting,
  error,
}) {
  const dialogRef = useRef(null);

  // Forgotten-checkout mode: INCOMPLETE with check_in but no check_out.
  // requestedStatus is locked to PRESENT; only checkout is collected.
  // This prevents submitting INCOMPLETE + non-null checkout which would
  // fail the review RPC's final-state validation.
  const isIncomplete =
    record?.status === "INCOMPLETE" && !!record?.check_in_at && !record?.check_out_at;

  // When ABSENT or LEAVE is selected, timestamp fields must be hidden/cleared.
  // Backend pre-flight: ABSENT/LEAVE cannot carry any timestamps.
  const isAbsentOrLeave = form.requestedStatus === "ABSENT" || form.requestedStatus === "LEAVE";

  // Open dialog imperatively on mount.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  // Handle native "cancel" (Escape) — prevent default close, delegate to onClose.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e) => {
      e.preventDefault();
      if (!submitting) onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [submitting, onClose]);

  // Client-side validation.
  const hasChange = (() => {
    if (isIncomplete) return !!form.requestedCheckOut;
    if (isAbsentOrLeave) return true; // the status change is the change
    return !!form.requestedStatus || !!form.requestedCheckIn || !!form.requestedCheckOut;
  })();

  const isTimestampOrderError =
    !isAbsentOrLeave &&
    !!form.requestedCheckIn &&
    !!form.requestedCheckOut &&
    new Date(form.requestedCheckOut) < new Date(form.requestedCheckIn);

  // -------------------------------------------------------------------------
  // Final-state prediction (COALESCE semantics).
  //
  // For forgotten-checkout mode the submitted RPC payload is:
  //   p_requested_status  = "PRESENT"  (locked)
  //   p_requested_check_in = null      (COALESCE keeps original check_in)
  //   p_requested_check_out = provided by user
  //
  // We pass the equivalent effective arguments so predictFinalPresence
  // models what the backend will actually resolve — not the raw form state.
  // -------------------------------------------------------------------------
  const effectiveRequestedStatus = isIncomplete ? "PRESENT" : form.requestedStatus;
  // isIncomplete: payload sends null for check-in → COALESCE preserves original.
  // Represent that as "" (empty = no override) so predictFinalPresence uses the
  // original record value for presence computation.
  const effectiveRequestedCheckIn = isIncomplete ? "" : form.requestedCheckIn;

  const finalPresence = predictFinalPresence(
    effectiveRequestedStatus,
    effectiveRequestedCheckIn,
    form.requestedCheckOut,
    record,
  );
  const { finalStatus, finalHasCheckIn, finalHasCheckOut } = finalPresence;
  const finalStateValid = isStructurallyValid(finalPresence);

  // Fixable invalidity: final state is PRESENT/HALF_DAY but the required
  // timestamps have not been provided yet. Timestamp inputs are visible in
  // this case (isAbsentOrLeave is false), so the user can supply them.
  // Excluded for isIncomplete: hasChange already gates on requestedCheckOut,
  // and the "required" input label already communicates the requirement.
  const isMissingTimestamps =
    !finalStateValid &&
    (finalStatus === "PRESENT" || finalStatus === "HALF_DAY") &&
    !isAbsentOrLeave &&
    !isIncomplete;

  // Impossible transition: the correction is structurally invalid AND cannot
  // be made valid through the visible form inputs — because the current
  // COALESCE-based RPC contract provides no mechanism to clear an existing
  // timestamp (NULL = preserve, not clear).
  //
  // Primary case: PRESENT/HALF_DAY/INCOMPLETE → ABSENT/LEAVE when the
  // original record carries timestamps that cannot be nulled via the RPC.
  //
  // The forgotten-checkout in-progress state (isIncomplete && no checkout
  // yet) is fixable, so it is explicitly excluded.
  const impossibleTransition = !finalStateValid && !isMissingTimestamps && !isIncomplete;

  const isValid =
    form.reason.trim().length > 0 && hasChange && !isTimestampOrderError && finalStateValid;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    onSubmit({
      // Forgotten-checkout always targets PRESENT.
      // Generic: "" => null => COALESCE keeps original status.
      p_requested_status: isIncomplete ? "PRESENT" : form.requestedStatus || null,

      // For forgotten-checkout: send null check-in so COALESCE in
      // review_attendance_correction keeps the original value cleanly.
      p_requested_check_in: isIncomplete
        ? null
        : isAbsentOrLeave
          ? null
          : localInputToISO(form.requestedCheckIn),

      p_requested_check_out: isAbsentOrLeave ? null : localInputToISO(form.requestedCheckOut),

      p_reason: form.reason.trim(),
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className="hr-correction-modal"
      aria-labelledby="correction-modal-title"
      aria-modal="true"
    >
      <form onSubmit={handleSubmit} noValidate>
        {/* Header */}
        <div className="hr-correction-modal-header">
          <div>
            <h2
              id="correction-modal-title"
              className="font-display text-base font-bold text-foreground"
            >
              {isIncomplete ? "Request Checkout Correction" : "Request Attendance Correction"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {record?.attendance_date}
              {" · "}
              {displayStatus[record?.status] ?? record?.status}
            </p>
          </div>
          <button
            type="button"
            className="hr-correction-close"
            aria-label="Close modal"
            onClick={onClose}
            disabled={submitting}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="hr-correction-modal-body">
          {/* Context summary */}
          <div className="hr-correction-context">
            <div className="hr-correction-context-row">
              <span className="label">Date</span>
              <span className="value">{record?.attendance_date ?? "—"}</span>
            </div>
            <div className="hr-correction-context-row">
              <span className="label">Current Status</span>
              <span className="value">
                {displayStatus[record?.status] ?? record?.status ?? "—"}
              </span>
            </div>
            {record?.check_in_at && (
              <div className="hr-correction-context-row">
                <span className="label">Current Check-In</span>
                <span className="value">{dtFormatter.format(new Date(record.check_in_at))}</span>
              </div>
            )}
            {record?.check_out_at && (
              <div className="hr-correction-context-row">
                <span className="label">Current Check-Out</span>
                <span className="value">{dtFormatter.format(new Date(record.check_out_at))}</span>
              </div>
            )}
          </div>

          <div className="hr-correction-fields">
            {/* Forgotten-checkout: informational note */}
            {isIncomplete && (
              <p className="text-xs text-muted-foreground">
                This record has no check-out. Submitting a correction will request status{" "}
                <strong className="text-foreground">Present</strong> with your intended check-out
                time.
              </p>
            )}

            {/*
             * Status selector — generic mode only.
             *
             * Options: PRESENT, HALF_DAY, ABSENT, LEAVE.
             * INCOMPLETE is intentionally omitted: there is no useful
             * correction scenario that targets INCOMPLETE as the final state
             * (a timestamp-only fix uses null status → COALESCE keeps original).
             *
             * NOTE: The repository (migrations/comments) does not define any
             * status transition rules/matrix. No such rules are invented here.
             * All four statuses are offered; the backend's pre-flight and
             * final-state validation remain authoritative.
             */}
            {!isIncomplete && (
              <div className="hr-correction-field">
                <label className="hr-correction-label" htmlFor="cr-status">
                  Requested Status
                  <span className="hr-correction-label-hint">
                    optional — blank keeps the original
                  </span>
                </label>
                <select
                  id="cr-status"
                  className="hr-correction-select"
                  value={form.requestedStatus}
                  disabled={submitting}
                  onChange={(e) => {
                    const val = e.target.value;
                    onFormChange({
                      requestedStatus: val,
                      // Clear timestamps when switching to ABSENT/LEAVE —
                      // backend rejects ABSENT/LEAVE with any timestamp.
                      ...(val === "ABSENT" || val === "LEAVE"
                        ? { requestedCheckIn: "", requestedCheckOut: "" }
                        : {}),
                    });
                  }}
                >
                  <option value="">— No change —</option>
                  <option value="PRESENT">Present</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LEAVE">On Leave</option>
                </select>
              </div>
            )}

            {/* Timestamp fields — generic mode, not ABSENT/LEAVE */}
            {!isAbsentOrLeave && !isIncomplete && (
              <>
                <div className="hr-correction-field">
                  <label className="hr-correction-label" htmlFor="cr-checkin">
                    Requested Check-In
                    <span className="hr-correction-label-hint">optional</span>
                  </label>
                  <input
                    id="cr-checkin"
                    type="datetime-local"
                    className="hr-correction-input"
                    value={form.requestedCheckIn}
                    disabled={submitting}
                    onChange={(e) => onFormChange({ requestedCheckIn: e.target.value })}
                  />
                </div>
                <div className="hr-correction-field">
                  <label className="hr-correction-label" htmlFor="cr-checkout">
                    Requested Check-Out
                    <span className="hr-correction-label-hint">optional</span>
                  </label>
                  <input
                    id="cr-checkout"
                    type="datetime-local"
                    className="hr-correction-input"
                    value={form.requestedCheckOut}
                    disabled={submitting}
                    onChange={(e) => onFormChange({ requestedCheckOut: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* Forgotten-checkout: checkout only */}
            {isIncomplete && (
              <div className="hr-correction-field">
                <label className="hr-correction-label" htmlFor="cr-checkout-inc">
                  Intended Check-Out Time
                  <span className="hr-correction-label-required">required</span>
                </label>
                <input
                  id="cr-checkout-inc"
                  type="datetime-local"
                  className="hr-correction-input"
                  value={form.requestedCheckOut}
                  disabled={submitting}
                  required
                  onChange={(e) => onFormChange({ requestedCheckOut: e.target.value })}
                />
              </div>
            )}

            {/* Client-side validation messages (UX only — DB is authoritative) */}
            {isTimestampOrderError && (
              <p className="hr-correction-validation-error" role="alert">
                Check-out time cannot be before check-in time.
              </p>
            )}
            {/*
             * impossibleTransition: the correction cannot be represented under
             * the current RPC contract. NULL does not clear existing timestamps
             * (COALESCE semantics), so a status that requires no timestamps
             * cannot be applied to a record that already has them.
             * Do not claim timestamps will be removed — they will not be.
             */}
            {impossibleTransition && (
              <p className="hr-correction-validation-error" role="alert">
                {(finalStatus === "ABSENT" || finalStatus === "LEAVE") &&
                (finalHasCheckIn || finalHasCheckOut)
                  ? "Changing to Absent or On Leave requires no timestamps, but this record\u2019s existing check-in/check-out times cannot be removed through a correction request."
                  : "This correction would result in an invalid attendance state and cannot be submitted."}
              </p>
            )}
            {/*
             * isMissingTimestamps: final state is PRESENT/HALF_DAY but the
             * required timestamps have not been provided yet. This is fixable —
             * the timestamp inputs below are visible and available to fill.
             */}
            {isMissingTimestamps && (
              <p className="hr-correction-validation-error" role="alert">
                Present and Half Day status require both check-in and check-out times.
              </p>
            )}
            {!isIncomplete && !hasChange && (
              <p className="hr-correction-validation-error" role="alert">
                Please select at least one change to request.
              </p>
            )}

            {/* Reason — always required */}
            <div className="hr-correction-field">
              <label className="hr-correction-label" htmlFor="cr-reason">
                Reason
                <span className="hr-correction-label-required">required</span>
              </label>
              <textarea
                id="cr-reason"
                className="hr-correction-textarea"
                placeholder="Explain the reason for this correction…"
                rows={3}
                value={form.reason}
                disabled={submitting}
                required
                onChange={(e) => onFormChange({ reason: e.target.value })}
              />
            </div>
          </div>

          {/* Server / RPC error */}
          {error && (
            <div className="hr-correction-error" role="alert">
              <AlertCircle className="size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="hr-correction-modal-footer">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting || !isValid} className="gap-2">
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Submit Request
          </Button>
        </div>
      </form>
    </dialog>
  );
}
