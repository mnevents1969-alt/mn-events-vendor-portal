import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Register from "./Register";

const signUp = vi.fn();
const insert = vi.fn();
const navigateMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { signUp: (...args: unknown[]) => signUp(...args) },
    from: () => ({ insert: (...args: unknown[]) => insert(...args) })
  }
}));

vi.mock("@/lib/pendingRegistration", () => ({
  savePendingRegistration: vi.fn()
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
}

beforeEach(() => {
  signUp.mockReset();
  insert.mockReset();
  navigateMock.mockReset();
});

describe("Register", () => {
  it("renders the first step (Business details) with the step indicator", () => {
    renderRegister();
    expect(screen.getByText("Business details")).toBeInTheDocument();
    expect(screen.getByText("Business")).toBeInTheDocument();
    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("keeps 'Save & continue' disabled until the required step-0 fields and the terms checkbox are filled", async () => {
    const user = userEvent.setup();
    const { container } = renderRegister();
    const continueBtn = screen.getByRole("button", { name: /save & continue/i });
    expect(continueBtn).toBeDisabled();

    const inputs = container.querySelectorAll("input");
    const businessName = inputs[0];
    const email = container.querySelector('input[type="email"]')!;
    const password = container.querySelector('input[autocomplete="new-password"]')!;
    const confirmPassword = container.querySelectorAll('input[autocomplete="new-password"]')[1];

    await user.type(businessName, "Bloom & Bake");
    await user.type(email, "vendor@example.com");
    await user.type(password, "supersecret1");
    await user.type(confirmPassword, "supersecret1");
    // Still disabled — the terms checkbox hasn't been checked yet.
    expect(continueBtn).toBeDisabled();

    const agree = screen.getByText(/vendor terms and privacy policy/i).closest("label")!.querySelector("input")!;
    await user.click(agree);
    expect(continueBtn).toBeEnabled();
  });

  it("shows a mismatch warning when confirm-password differs from password", async () => {
    const user = userEvent.setup();
    const { container } = renderRegister();
    const password = container.querySelector('input[autocomplete="new-password"]')!;
    const confirmPassword = container.querySelectorAll('input[autocomplete="new-password"]')[1];

    await user.type(password, "supersecret1");
    await user.type(confirmPassword, "different");
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("does not gate on password length below 8 chars (continue stays disabled)", async () => {
    const user = userEvent.setup();
    const { container } = renderRegister();
    const continueBtn = screen.getByRole("button", { name: /save & continue/i });

    const businessName = container.querySelectorAll("input")[0];
    const email = container.querySelector('input[type="email"]')!;
    const password = container.querySelector('input[autocomplete="new-password"]')!;
    const confirmPassword = container.querySelectorAll('input[autocomplete="new-password"]')[1];
    const agree = screen.getByText(/vendor terms and privacy policy/i).closest("label")!.querySelector("input")!;

    await user.type(businessName, "Bloom & Bake");
    await user.type(email, "vendor@example.com");
    await user.type(password, "short1");
    await user.type(confirmPassword, "short1");
    await user.click(agree);

    expect(continueBtn).toBeDisabled();
  });

  it("advances through all four steps and calls signUp with the trimmed profile on submit", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u1" }, session: { access_token: "t" } }, error: null });
    insert.mockImplementation(() => Promise.resolve({ error: null }));

    const user = userEvent.setup();
    const { container } = renderRegister();

    const businessName = container.querySelectorAll("input")[0];
    const email = container.querySelector('input[type="email"]')!;
    const password = container.querySelector('input[autocomplete="new-password"]')!;
    const confirmPassword = container.querySelectorAll('input[autocomplete="new-password"]')[1];
    const agree = screen.getByText(/vendor terms and privacy policy/i).closest("label")!.querySelector("input")!;

    await user.type(businessName, "  Bloom & Bake  ");
    await user.type(email, "  vendor@example.com  ");
    await user.type(password, "supersecret1");
    await user.type(confirmPassword, "supersecret1");
    await user.click(agree);

    await user.click(screen.getByRole("button", { name: /save & continue/i })); // -> step 1 (Products)
    expect(screen.getByText("Products to display")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save & continue/i })); // -> step 2 (Documents)
    expect(screen.getByText("Business documents")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save & continue/i })); // -> step 3 (Review)
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /submit registration/i }));

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "vendor@example.com", password: "supersecret1" })
    );
  });

  it("shows a friendly message (not the raw Supabase error) when the email is already registered", async () => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "User already registered" } });
    const user = userEvent.setup();
    const { container } = renderRegister();

    const businessName = container.querySelectorAll("input")[0];
    const email = container.querySelector('input[type="email"]')!;
    const password = container.querySelector('input[autocomplete="new-password"]')!;
    const confirmPassword = container.querySelectorAll('input[autocomplete="new-password"]')[1];
    const agree = screen.getByText(/vendor terms and privacy policy/i).closest("label")!.querySelector("input")!;

    await user.type(businessName, "Bloom & Bake");
    await user.type(email, "vendor@example.com");
    await user.type(password, "supersecret1");
    await user.type(confirmPassword, "supersecret1");
    await user.click(agree);
    await user.click(screen.getByRole("button", { name: /save & continue/i }));
    await user.click(screen.getByRole("button", { name: /save & continue/i }));
    await user.click(screen.getByRole("button", { name: /save & continue/i }));
    await user.click(screen.getByRole("button", { name: /submit registration/i }));

    expect(await screen.findByText(/account with this email already exists/i)).toBeInTheDocument();
  });
});
