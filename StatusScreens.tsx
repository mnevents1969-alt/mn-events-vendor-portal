import { Link } from "react-router-dom";
import { Clock3, ShieldAlert, Phone, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function PendingApprovalScreen() {
  const { vendor, signOut } = useAuth();
  return (
    <StatusCard
      icon={Clock3}
      iconClass="bg-warn-bg text-warn"
      title="Your account is awaiting approval"
      body={`MN Events reviews new vendor registrations before they can book stalls, log redemptions or view payments. You'll be able to use the full portal once ${vendor?.stall_name ?? "your account"} is approved.`}
      signOut={signOut}
    />
  );
}

export function SuspendedScreen() {
  const { signOut } = useAuth();
  return (
    <StatusCard
      icon={ShieldAlert}
      iconClass="bg-bad-bg text-bad"
      title="Your account is suspended"
      body="Access to bookings, redemptions and payments has been paused for your account. Please contact MN Events to resolve this."
      signOut={signOut}
    />
  );
}

function StatusCard({
  icon: Icon,
  iconClass,
  title,
  body,
  signOut
}: {
  icon: typeof Clock3;
  iconClass: string;
  title: string;
  body: string;
  signOut: () => Promise<void>;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <span className={`flex h-16 w-16 items-center justify-center rounded-full ${iconClass}`}>
        <Icon size={26} />
      </span>
      <h1 className="text-[21px] font-extrabold text-ink">{title}</h1>
      <p className="text-[14px] leading-relaxed text-muted">{body}</p>

      <a
        href="tel:9652644079"
        className="mt-2 flex min-h-[48px] w-full max-w-[260px] items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-bold text-white"
      >
        <Phone size={16} /> Call MN Events support
      </a>
      <Link to="/profile" className="text-[13px] font-bold text-primary underline underline-offset-2">
        View / edit my profile
      </Link>
      <button
        onClick={() => signOut()}
        className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-muted"
      >
        <LogOut size={14} /> Log out
      </button>
    </div>
  );
}
