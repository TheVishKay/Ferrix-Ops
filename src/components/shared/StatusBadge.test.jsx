import { render, screen } from "@testing-library/react";
import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders correctly with an existing status (e.g., Active)", () => {
    render(<StatusBadge status="Active" />);
    const badge = screen.getByText("Active");
    expect(badge).toBeInTheDocument();

    // Status Active is mapped to tone 'lime'
    // Ensure the badge has the tone class applied to it.
    // The component wraps the text in a Badge component, so the classes are on the outer element.
    const container = badge.closest(".hr-status-badge");
    expect(container).toHaveClass("hr-tone-lime");
  });

  it("renders correctly with an existing status using statusLabelMap (e.g., READY_FOR_REVIEW)", () => {
    render(<StatusBadge status="READY_FOR_REVIEW" />);
    // "READY_FOR_REVIEW" should map to "For Review"
    const badge = screen.getByText("For Review");
    expect(badge).toBeInTheDocument();

    // Status READY_FOR_REVIEW maps to tone 'violet'
    const container = badge.closest(".hr-status-badge");
    expect(container).toHaveClass("hr-tone-violet");
  });

  it("falls back to cyan tone and original string if status is unknown", () => {
    render(<StatusBadge status="UNKNOWN_STATUS" />);
    const badge = screen.getByText("UNKNOWN_STATUS");
    expect(badge).toBeInTheDocument();

    // Default tone is 'cyan'
    const container = badge.closest(".hr-status-badge");
    expect(container).toHaveClass("hr-tone-cyan");
  });

  it("renders correctly with an empty status", () => {
    // Should fallback gracefully without breaking
    const { container } = render(<StatusBadge status="" />);
    const badgeElement = container.querySelector(".hr-status-badge");
    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveClass("hr-tone-cyan");
  });
});
