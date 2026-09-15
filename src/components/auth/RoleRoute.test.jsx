import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import RoleRoute from "./RoleRoute";
import * as AuthContext from "../../contexts/AuthContext";
import { MemoryRouter } from "react-router-dom";

// Mock Navigate to easily check for redirects
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: vi.fn(() => <div data-testid="navigate-mock" />),
  };
});

// Mock the AuthContext
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

describe("RoleRoute", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const ProtectedContent = () => <div data-testid="protected-content">Protected Content</div>;

  it("renders null when loading is true", () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      loading: true,
      profile: null,
    });

    const { container } = render(
      <RoleRoute allowedRoles={["OWNER"]}>
        <ProtectedContent />
      </RoleRoute>
    );

    // It should render nothing
    expect(container.firstChild).toBeNull();
  });

  it("redirects to '/' when profile is null (not logged in)", () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      loading: false,
      profile: null,
    });

    render(
      <MemoryRouter>
        <RoleRoute allowedRoles={["OWNER"]}>
          <ProtectedContent />
        </RoleRoute>
      </MemoryRouter>
    );

    // Navigate mock should be rendered
    expect(screen.getByTestId("navigate-mock")).toBeDefined();
    // Protected content should NOT be rendered
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("redirects to '/' when profile role is not in allowedRoles", () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      loading: false,
      profile: { role: "EMPLOYEE" },
    });

    render(
      <MemoryRouter>
        <RoleRoute allowedRoles={["OWNER", "ACCOUNTS"]}>
          <ProtectedContent />
        </RoleRoute>
      </MemoryRouter>
    );

    // Navigate mock should be rendered
    expect(screen.getByTestId("navigate-mock")).toBeDefined();
    // Protected content should NOT be rendered
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("renders children when profile role is in allowedRoles", () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      loading: false,
      profile: { role: "OWNER" },
    });

    render(
      <MemoryRouter>
        <RoleRoute allowedRoles={["OWNER", "ACCOUNTS"]}>
          <ProtectedContent />
        </RoleRoute>
      </MemoryRouter>
    );

    // Navigate mock should NOT be rendered
    expect(screen.queryByTestId("navigate-mock")).toBeNull();
    // Protected content should be rendered
    expect(screen.getByTestId("protected-content")).toBeDefined();
  });
});
