import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Mail, Eye, EyeOff, Phone } from "lucide-react";
import { PageHeader, Screen, Card, Field, TextInput, PrimaryButton, LinkButton } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { savePendingRegistration } from "@/lib/pendingRegistration";

const STEPS = ["Business", "Products", "Documents", "Review"];

type FormState = {
  businessName: string;
  contactPerson: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  productCategory: string;
  productsToDisplay: string;
  gstin: string;
  pan: string;
  agree: boolean;
};

const initial: FormState = {
  businessName: "",
  contactPerson: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
  productCategory: "",
  productsToDisplay: "",
  gstin: "",
  pan: "",
  agree: false
};

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submitRegistration() {
    setBusy(true);
    setError(null);

    const email = form.email.trim();
    const profile = {
      email,
      stall_name: form.businessName.trim(),
      contact_person: form.contactPerson.trim() || null,
      phone: form.phone.trim() || null,
      product_category: form.productCategory.trim() || null,
      products_to_display: form.productsToDisplay.trim() || null,
      gstin: form.gstin.trim() || null,
      pan: form.pan.trim() || null
    };

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: { emailRedirectTo: `${window.location.origin}/login` }
    });

    if (signUpError) {
      setBusy(false);
      setError(
        /registered|exists/i.test(signUpError.message)
          ? "An account with this email already exists. Try signing in instead."
          : signUpError.message || "Could not create your account. Please try again."
      );
      return;
    }

    const user = signUpData.user;
    if (!user) {
      setBusy(false);
      setError("Something went wrong creating your account. Please try again.");
      return;
    }

    // Stash the profile details either way — if a session came back immediately we use it
    // right now; if email confirmation is required, AuthProvider finishes the insert on
    // the vendor's first real sign-in (see lib/pendingRegistration.ts).
    savePendingRegistration(profile);

    if (!signUpData.session) {
      setBusy(false);
      setNeedsEmailConfirm(true);
      setDone(true);
      return;
    }

    const { error: insertError } = await supabase.from("stall_vendors").insert({
      id: user.id,
      stall_name: profile.stall_name,
      contact_person: profile.contact_person,
      phone: profile.phone,
      email: profile.email,
      product_category: profile.product_category,
      products_to_display: profile.products_to_display,
      gstin: profile.gstin,
      pan: profile.pan,
      is_admin: false,
      status: "pending_approval"
    });
    setBusy(false);
    if (insertError) {
      setError("Your account was created, but we couldn't save your business profile. Please contact MN Events support.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Screen>
        <PageHeader title="Register your business" backTo="/login" />
        <div className="px-4 pt-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-good-bg text-good">
            {needsEmailConfirm ? <Mail size={26} /> : <Send size={26} />}
          </div>
          {needsEmailConfirm ? (
            <>
              <h2 className="mt-5 text-[20px] font-extrabold text-ink">Confirm your email</h2>
              <p className="mx-auto mt-2 max-w-xs text-[14px] text-muted">
                We've sent a confirmation link to <span className="font-semibold text-ink">{form.email.trim()}</span>. Open
                it, then sign in — MN Events will review your details and approve your account.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-5 text-[20px] font-extrabold text-ink">Registration submitted</h2>
              <p className="mx-auto mt-2 max-w-xs text-[14px] text-muted">
                MN Events will review your details and approve your account. You'll be contacted at{" "}
                <span className="font-semibold text-ink">{form.email.trim()}</span>.
              </p>
            </>
          )}
          <PrimaryButton className="mt-8" onClick={() => navigate("/login")}>
            Back to sign in
          </PrimaryButton>
        </div>
      </Screen>
    );
  }

  const step0Valid =
    form.businessName.trim() &&
    form.email.trim() &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword &&
    form.agree;

  return (
    <Screen>
      <PageHeader title="Register your business" backTo="/login" />
      <div className="px-4">
        <h2 className="text-[22px] font-extrabold text-ink">Set up your vendor profile</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">
          Add your business information once. These details will be reused when you apply for future stalls.
        </p>

        <div className="mt-5 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${
                  i === step ? "bg-primary text-white" : i < step ? "bg-primary/15 text-primary" : "bg-accent-bg text-muted"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-[11px] font-semibold ${i === step ? "text-primary" : "text-muted"}`}>{label}</span>
            </div>
          ))}
        </div>

        <Card className="mt-5">
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-[17px] font-bold text-ink">Business details</h3>
              <p className="-mt-2 text-[13px] text-muted">Use information that should appear on your booking records.</p>
              <Field label="Business / brand name">
                <TextInput value={form.businessName} onChange={(e) => update("businessName", e.target.value)} required />
              </Field>
              <Field label="Contact person">
                <TextInput value={form.contactPerson} onChange={(e) => update("contactPerson", e.target.value)} />
              </Field>
              <Field label="Mobile number">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-4">
                  <Phone size={18} className="shrink-0 text-muted" aria-hidden="true" />
                  <input
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    inputMode="tel"
                    className="min-h-[48px] w-full bg-transparent text-[15px] text-ink outline-none"
                  />
                </div>
              </Field>
              <Field label="Email address">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-4">
                  <Mail size={18} className="shrink-0 text-muted" aria-hidden="true" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    required
                    className="min-h-[48px] w-full bg-transparent text-[15px] text-ink outline-none"
                  />
                </div>
              </Field>
              <Field label="Password" hint="At least 8 characters. You'll use this to sign in.">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-4">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    className="min-h-[48px] w-full bg-transparent text-[15px] text-ink outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </Field>
              <Field label="Confirm password">
                <TextInput
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                />
              </Field>
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="-mt-2 text-[12px] font-semibold text-bad">Passwords do not match.</p>
              )}
              <Field label="Primary product category">
                <TextInput
                  value={form.productCategory}
                  onChange={(e) => update("productCategory", e.target.value)}
                  placeholder="e.g. Apparel & Lifestyle"
                />
              </Field>
              <label className="flex items-start gap-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  className="mt-0.5 h-[18px] w-[18px] accent-primary"
                  checked={form.agree}
                  onChange={(e) => update("agree", e.target.checked)}
                />
                I agree to the Vendor Terms and Privacy Policy.
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-[17px] font-bold text-ink">Products to display</h3>
              <Field label="What will you sell or showcase?" hint="A short description helps MN Events match you to the right events.">
                <textarea
                  value={form.productsToDisplay}
                  onChange={(e) => update("productsToDisplay", e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-[17px] font-bold text-ink">Business documents</h3>
              <p className="-mt-2 text-[13px] text-muted">GSTIN and PAN are optional.</p>
              <Field label="GSTIN (optional)">
                <TextInput value={form.gstin} onChange={(e) => update("gstin", e.target.value)} />
              </Field>
              <Field label="PAN (optional)">
                <TextInput value={form.pan} onChange={(e) => update("pan", e.target.value)} />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[17px] font-bold text-ink">Review</h3>
              <Review label="Business name" value={form.businessName} />
              <Review label="Contact person" value={form.contactPerson} />
              <Review label="Mobile" value={form.phone} />
              <Review label="Email" value={form.email} />
              <Review label="Category" value={form.productCategory} />
              <Review label="Products" value={form.productsToDisplay} />
              {error && <p role="alert" className="text-[13px] font-semibold text-bad">{error}</p>}
            </div>
          )}
        </Card>

        <div className="mt-5 flex flex-col gap-3">
          {step < STEPS.length - 1 ? (
            <PrimaryButton
              onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}
              disabled={step === 0 && !step0Valid}
            >
              Save &amp; continue
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={submitRegistration} disabled={busy} icon={Send}>
              {busy ? "Submitting…" : "Submit registration"}
            </PrimaryButton>
          )}
          {step > 0 && <LinkButton onClick={() => setStep((s) => s - 1)}>Back</LinkButton>}
        </div>
      </div>
    </Screen>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-[14px] last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
