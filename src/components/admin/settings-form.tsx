"use client";

import { useState, useTransition } from "react";
import { Toast, type ToastTone } from "@/components/admin/toast";
import { saveSettings } from "@/lib/actions/admin";

type Setting = { key: string; value: string | null };
type Agency = { id: string; name: string; records_officer_email: string | null };

/** Grouped so the page reads as sections rather than one long list of keys. */
const GROUPS: { title: string; note?: string; keys: string[] }[] = [
  {
    title: "The organization",
    keys: ["org_ein", "mailing_address", "contact_email", "form_990_url"],
  },
  {
    title: "Money",
    note: "Donations link out. Nothing is taken on this site.",
    keys: ["donate_url", "donate_amounts"],
  },
  {
    title: "Explorer",
    note: "The scenarios the Explorer costs out, and where its figures come from.",
    keys: [
      "explorer_url",
      "explorer_home_district",
      "explorer_data_asof",
      "explorer_sources_list",
      "scenario_a_pct",
      "scenario_b_flat",
    ],
  },
  {
    title: "Reports",
    keys: ["reports_next_report_note", "levy_status_note", "contract_status_note"],
  },
  { title: "Records Desk", keys: ["request_template_path"] },
  { title: "Partners", keys: ["partners_note"] },
  {
    title: "Social",
    keys: ["social_facebook", "social_instagram", "social_linkedin", "social_x"],
  },
];

const LABELS: Record<string, string> = {
  org_ein: "EIN",
  mailing_address: "Mailing address",
  contact_email: "Contact email",
  form_990_url: "Form 990 and financials link",
  donate_url: "Donate page link",
  donate_amounts: "Suggested amounts, comma separated",
  explorer_url: "Explorer link, if it has its own home",
  explorer_home_district: "Home district, the one the Explorer reads as you",
  explorer_data_asof: "Data current as of",
  explorer_sources_list: "Additional sources",
  scenario_a_pct: "Scenario A, percent across the board",
  scenario_b_flat: "Scenario B, flat amount",
  reports_next_report_note: "Next report note",
  levy_status_note: "Levy status note",
  contract_status_note: "Contract talks status note",
  request_template_path: "Request template file path",
  partners_note: "Other partners",
  social_facebook: "Facebook",
  social_instagram: "Instagram",
  social_linkedin: "LinkedIn",
  social_x: "X",
};

export function SettingsForm({
  settings,
  agencies,
}: {
  settings: Setting[];
  agencies: Agency[];
}) {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [pending, startTransition] = useTransition();

  const byKey = new Map(settings.map((s) => [s.key, s.value ?? ""]));
  const grouped = new Set(GROUPS.flatMap((g) => g.keys));
  // Anything seeded later shows up here rather than being quietly uneditable.
  const ungrouped = settings.map((s) => s.key).filter((key) => !grouped.has(key));

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveSettings(form);
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
    });
  }

  const field = (key: string) => (
    <div className="field field-wide" key={key}>
      <label htmlFor={`setting-${key}`}>{LABELS[key] ?? key}</label>
      <input id={`setting-${key}`} name={`setting.${key}`} defaultValue={byKey.get(key) ?? ""} />
      <p className="counter">{key}</p>
    </div>
  );

  return (
    <>
      <form className="admin-form" onSubmit={onSubmit}>
        {GROUPS.map((group) => (
          <fieldset className="field-wide rollcall" key={group.title}>
            <legend>{group.title}</legend>
            {group.note ? <p className="admin-help">{group.note}</p> : null}
            {group.keys.filter((key) => byKey.has(key)).map(field)}
          </fieldset>
        ))}

        <fieldset className="field-wide rollcall">
          <legend>Records officer addresses</legend>
          <p className="admin-help">
            Published on the Records Desk page, next to the office they belong to.
          </p>
          {agencies.map((agency) => (
            <div className="field field-wide" key={agency.id}>
              <label htmlFor={`agency-${agency.id}`}>{agency.name}</label>
              <input
                id={`agency-${agency.id}`}
                name={`agency.${agency.id}`}
                type="email"
                defaultValue={agency.records_officer_email ?? ""}
              />
            </div>
          ))}
        </fieldset>

        {ungrouped.length > 0 ? (
          <fieldset className="field-wide rollcall">
            <legend>Other</legend>
            {ungrouped.map(field)}
          </fieldset>
        ) : null}

        <div className="admin-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving" : "Save settings"}
          </button>
        </div>
      </form>

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? "ok"}
        onDismiss={() => setToast(null)}
      />
    </>
  );
}
