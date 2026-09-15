import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import Header from "../Header";
import { useAuth } from "../../../contexts/AuthContext";
import { BrowserRouter } from "react-router-dom";

// Mock the AuthContext
vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Helper function to render component with router
const renderHeader = () => {
  return render(
    <BrowserRouter>
      <Header title="Dashboard" />
    </BrowserRouter>
  );
};

describe("Header Initials Calculation", () => {
  it("renders '??' when profile is null", () => {
    useAuth.mockReturnValue({ profile: null });
    renderHeader();
    expect(screen.getByText("??")).toBeInTheDocument();
  });

  it("renders '??' when full_name is undefined", () => {
    useAuth.mockReturnValue({ profile: { role: "EMPLOYEE" } });
    renderHeader();
    expect(screen.getByText("??")).toBeInTheDocument();
  });

  it("renders '??' when full_name is empty string", () => {
    useAuth.mockReturnValue({ profile: { full_name: "", role: "EMPLOYEE" } });
    renderHeader();
    expect(screen.getByText("??")).toBeInTheDocument();
  });

  it("renders 'J' for single word name 'John'", () => {
    useAuth.mockReturnValue({ profile: { full_name: "John", role: "EMPLOYEE" } });
    renderHeader();
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("renders 'JD' for two word name 'John Doe'", () => {
    useAuth.mockReturnValue({ profile: { full_name: "John Doe", role: "EMPLOYEE" } });
    renderHeader();
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("renders 'JD' for three word name 'John Doe Smith'", () => {
    useAuth.mockReturnValue({ profile: { full_name: "John Doe Smith", role: "EMPLOYEE" } });
    renderHeader();
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("handles extra spaces properly 'John   Doe'", () => {
    useAuth.mockReturnValue({ profile: { full_name: "John   Doe", role: "EMPLOYEE" } });
    renderHeader();
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("handles lowercase names and converts to uppercase 'john doe'", () => {
    useAuth.mockReturnValue({ profile: { full_name: "john doe", role: "EMPLOYEE" } });
    renderHeader();
    expect(screen.getByText("JD")).toBeInTheDocument();
  });
});
