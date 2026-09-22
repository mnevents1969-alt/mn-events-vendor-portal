import { useMemo, useState } from "react";
import { Search, BookOpen, RotateCcw, HelpCircle, Headphones, ChevronRight, ChevronDown, Phone, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { HELP_TOPICS, SUPPORT_PHONE, supportMailto } from "@/lib/helpContent";
import { PageHeader, Screen, EmptyState } from "@/components/ui";

const TOPIC_ICONS: Record<string, typeof BookOpen> = {
  "vendor-rules": BookOpen,
  cancellation: RotateCcw,
  faqs: HelpCircle,
  support: Headphones
};

export default function Help() {
  const { vendor } = useAuth();
  const [query, setQuery] = useState("");
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  const filteredTopics = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP_TOPICS;
    return HELP_TOPICS.filter((t) => t.title.toLowerCase().includes(q) || t.body.some((b) => b.toLowerCase().includes(q)));
  }, [query]);

  return (
    <Screen>
      <PageHeader title="Help & Rules" backTo="/" />
      <div className="px-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4">
          <Search size={18} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help, rules or payment questions"
            className="min-h-[48px] w-full bg-transparent text-[15px] text-ink outline-none"
          />
        </div>

        <p className="pb-2 pt-6 text-[13px] font-bold uppercase tracking-wide text-muted">Help topics</p>
        {filteredTopics.length === 0 ? (
          <EmptyState>No help topics match your search.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredTopics.map((t) => {
              const Icon = TOPIC_ICONS[t.slug] ?? HelpCircle;
              const open = openTopic === t.slug;
              return (
                <div
                  key={t.slug}
                  className={`overflow-hidden rounded-xl2 border border-border bg-card ${open ? "col-span-2" : ""}`}
                >
                  <button
                    onClick={() => setOpenTopic(open ? null : t.slug)}
                    className="flex w-full items-start justify-between gap-2 p-4 text-left"
                  >
                    <div className="flex flex-col items-start gap-2">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-bg text-primary">
                        <Icon size={18} />
                      </span>
                      <div>
                        <p className="text-[15px] font-extrabold text-ink">{t.title}</p>
                        <p className="text-[12px] leading-snug text-muted">{t.sub}</p>
                      </div>
                    </div>
                    {open ? <ChevronDown size={16} className="shrink-0 text-muted" /> : <ChevronRight size={16} className="shrink-0 text-muted" />}
                  </button>
                  {open && (
                    <div className="flex flex-col gap-2 border-t border-border px-4 py-3.5">
                      {t.body.map((line) => (
                        <p key={line} className="text-[13px] leading-relaxed text-ink">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 rounded-xl2 bg-gradient-to-br from-[#5B1640] to-[#7A2154] p-5 text-white">
          <p className="flex items-center gap-2 text-[15px] font-extrabold">
            <Phone size={16} /> Still need help?
          </p>
          <p className="mt-1 text-[13px] text-white/80">Speak with the MN Events team</p>
          <p className="mt-0.5 text-[18px] font-extrabold">{SUPPORT_PHONE}</p>
          <div className="mt-4 flex flex-col gap-2.5">
            <a
              href={`tel:${SUPPORT_PHONE}`}
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-white text-[13px] font-bold text-primary"
            >
              <Phone size={15} /> Call support
            </a>
            <a
              href={supportMailto("Vendor support request", vendor?.stall_name)}
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-full border border-white/40 text-[13px] font-bold text-white"
            >
              <Mail size={15} /> Raise a support ticket by email
            </a>
          </div>
        </div>
      </div>
    </Screen>
  );
}
