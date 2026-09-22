import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "./Login";

const signInWithPassword = vi.fn();
const navigateMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => signInWithPassword(...args) } },
  setRememberPreference: vi.fn()
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

beforeEach(() => {
  signInWithPassword.mockReset();
  navigateMock.mockReset();
});

describe("Login", () => {
  it("renders the sign-in form with email, password, and remember-me controls", () => {
    renderLogin();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByText(/keep me signed in/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in to portal/i })).toBeInTheDocument();
  });

  it("requires email and password before the browser allows submission", () => {
    renderLogin();
    const emailInput = screen.getByPlaceholderText("you@example.com") as HTMLInputElement;
    expect(emailInput).toBeRequired();
  });

  it("navigates to / on successful sign-in", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText("you@example.com"), "vendor@example.com");
    await user.type(document.querySelector('input[type="password"]')!, "correct-horse-battery-staple");
    await user.click(screen.getByRole("button", { name: /sign in to portal/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/", { replace: true }));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "vendor@example.com", password: "correct-horse-battery-staple" });
  });

  it("shows a generic error on failed sign-in without leaking the underlying reason", async () => {
    signInWithPassword.mockResolvedValue({ data: null, error: { message: "Invalid login credentials" } });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText("you@example.com"), "vendor@example.com");
    await user.type(document.querySelector('input[type="password"]')!, "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in to portal/i }));

    expect(await screen.findByText(/don't match a vendor account/i)).toBeInTheDocument();
    expect(screen.queryByText(/invalid login credentials/i)).not.toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    renderLogin();
    const passwordInput = document.querySelector('input[name], input[type="password"], input[type="text"]') as HTMLInputElement;
    const toggle = screen.getAllByRole("button").find((b) => !/sign in/i.test(b.textContent ?? ""));
    expect(passwordInput).toHaveAttribute("type", "password");
    if (toggle) {
      await user.click(toggle);
      expect(document.querySelector('input[autocomplete="current-password"]')).toHaveAttribute("type", "text");
    }
  });

  it("disables the submit button while the sign-in request is in flight", async () => {
    let resolveSignIn!: (v: unknown) => void;
    signInWithPassword.mockReturnValue(new Promise((resolve) => (resolveSignIn = resolve)));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText("you@example.com"), "vendor@example.com");
    await user.type(document.querySelector('input[type="password"]')!, "correct-horse-battery-staple");
    await user.click(screen.getByRole("button", { name: /sign in to portal/i }));

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    resolveSignIn({ data: { session: {} }, error: null });
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });
});
