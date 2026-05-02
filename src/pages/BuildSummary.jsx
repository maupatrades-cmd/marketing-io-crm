import { useEffect } from "react";

const sections = [
  {
    title: "1. Marketing iO CRM — Overall Platform",
    items: [
      "Full CRM built on React + Tailwind + Base44 backend-as-a-service",
      "Dark theme with Marketing iO brand (purple #a764e6, pink #ec4899)",
      "Sidebar navigation with 14 sections; responsive mobile layout",
      "All data persisted via base44 entities (no custom backend needed)",
    ],
  },
  {
    title: "2. Entities (Database Schemas)",
    items: [
      "Client — business name, contact, status, package, debit info, onboarding flags",
      "Deal — pipeline stage, package, fees, closer, commission generation flags",
      "Lead — warm-lead scoring (7 criteria), source, CPC R87 tracking",
      "Commission — type, amount, rate, status, payroll month, clawback support",
      "Invoice — type, amount, VAT, due date, debit run tracking, failed debit count",
      "Contract — package, signed state, POPIA, cancellation terms",
      "Deliverable — phase (setup/recurring/once-off), status, file uploads, 5-day review window",
      "ClientAddOn — add-on service, bucket (A-E), go-live, months active",
      "MonthlyReport — report type, status, delivery method, PDF URL",
      "ClientActivityLog — event type, before/after values, logged by",
      "FNCReferral — direction (MiO↔FNC), funding status, R800 commission",
      "Task — assigned to, client, priority, due date, related deliverable",
      "InternalMessage — inbox/outbox, read receipts",
      "StaffMilestone — 5-deal batch tracking, backdated retainer unlocking",
      "StaffRecord — full 40+ field HR onboarding record with file uploads, consents, internal review fields",
    ],
  },
  {
    title: "3. Pages Built",
    items: [
      "/ — Owner Dashboard: KPI cards, revenue vs target chart, deal pipeline bar chart, alerts, recent activity, quick actions",
      "/clients — Client Management: list + search, status management, onboarding checklists, activity feed, task checklist",
      "/deals — Deal Pipeline: stage management, commission auto-generation on onboarding, package/fee editing",
      "/leads — Leads: warm-lead scoring, status workflow (pending → verified → converted), R87 CPC tracking",
      "/commissions — Commission Tracker: filter by type/status/month, approve/pay bulk actions, totals summary",
      "/invoices — Invoices: create, track, failed debit management, acceleration clause alerts",
      "/receipts — Receipts: payment confirmation records",
      "/activity — Activity Log: unified timeline across deals, leads, invoices, commissions",
      "/calendar — Calendar: task and deadline view",
      "/payroll — Payroll Report: monthly salary + commission rollup per staff member, CSV export",
      "/staff — Staff & HR: team grid, compensation package preview, hire staff invite, pending applications panel",
      "/products — Product Catalog: core packages, pulse packages, add-ons with pricing, commission buckets, delivery checklists",
      "/mail — Internal Mail: compose, inbox, outbox, read receipts",
      "/profile — Staff Profile: personal info, social links, birthday, job title",
      "/client-portal — Client Portal: client-facing dashboard with deliverables, invoices, reports, onboarding progress",
      "/onboarding-form — Public Staff Onboarding Form (no login required — shareable link)",
      "/design-preview — Design System reference page",
    ],
  },
  {
    title: "4. Staff Onboarding Form (/onboarding-form)",
    items: [
      "9-step multi-page wizard — public, no login required",
      "Step 1: Personal Identity — full legal name, SA ID (Luhn checksum validation), DOB, gender, race, nationality, marital status",
      "Step 2: Contact Details — primary/alt cell, email, WhatsApp, residential + postal address",
      "Step 3: Next of Kin — primary (required) + secondary (optional) emergency contacts",
      "Step 4: Employment — role, employment type, start date, CTC, probation, reporting line",
      "Step 5: Banking — bank, account type, account holder, account number, branch code",
      "Step 6: Tax & Education — SARS tax number, UIF, medical aid, pension, qualifications, languages, driver's licence",
      "Step 7: Work Experience — 2 previous employers, reason for leaving, sales/marketing summary, achievements",
      "Step 8: Document Uploads — ID copy, profile photo, bank letter, qualification certificate, driver's licence, payslip, 2× reference letters (max 5MB, JPG/PNG/PDF, drag-and-drop)",
      "Step 9: Consent & Sign-Off — 3 consent checkboxes, digital signature (typed name), date",
      "Per-step validation, progress bar, step indicator breadcrumbs",
      "Saves to StaffRecord entity on submission with status 'Submitted'",
    ],
  },
  {
    title: "5. Approval Workflow (Staff & HR page)",
    items: [
      "Pending Applications panel shown when unreviewed StaffRecord submissions exist",
      "One-click Approve button triggers automated workflow:",
      "  → Updates StaffRecord.application_status to 'Approved' + sets approved_date",
      "  → Sends welcome email to applicant with onboarding next-steps (email setup, contract, start date)",
      "  → Sends payroll action email to admin@marketingio.co.za with full employee details + setup checklist (email, payroll, UIF, contract, WhatsApp groups, system access)",
      "'Share Onboarding Form ↗' button links to /onboarding-form for sharing with candidates",
    ],
  },
  {
    title: "6. Compensation Package System (lib/compensationPackages.js)",
    items: [
      "Centralised utility used across Staff HR and Payroll Report",
      "calcPackage(role) returns: gross CTC, itemised components, itemised deductions (equipment), nett take-home",
      "ROLE_LABELS map for display names",
      "Package preview shown in 'Hire Staff' dialog when selecting a role",
    ],
  },
  {
    title: "7. Commission Logic (Deals page)",
    items: [
      "Auto-generates Commission records when deal marked 'client_onboarded'",
      "Setup commission: % of setup fee per package tier",
      "Monthly retainer commission: % of monthly retainer per package tier",
      "CPC lead fee (R87) and closure bonus (R200) on verified/won deals",
      "FNC referral commission (R800) tracked via FNCReferral entity",
    ],
  },
  {
    title: "8. SA ID Validation (lib/saIdValidation.js)",
    items: [
      "Validates 13-digit SA ID numbers with full Luhn checksum",
      "Extracts: date of birth, gender (from digit 6-10), citizenship status",
      "Age sanity check (16–100 years)",
      "Used in Staff Onboarding Form Step 1",
    ],
  },
];

export default function BuildSummary() {
  useEffect(() => {
    document.title = "Marketing iO CRM — Build Summary";
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans p-8 max-w-4xl mx-auto print:p-4">
      {/* Header */}
      <div className="mb-8 pb-6 border-b-2 border-purple-600">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Marketing iO CRM</h1>
            <p className="text-lg text-purple-700 font-semibold">Platform Build Summary</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Generated: {new Date().toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" })}</p>
            <p className="mt-1">Built on: Base44 Platform</p>
            <p>Stack: React · Tailwind · Base44 BaaS</p>
          </div>
        </div>
      </div>

      {/* Print button — hidden when printing */}
      <div className="print:hidden mb-6 flex gap-3">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors"
        >
          🖨 Print / Save as PDF
        </button>
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          ← Back to App
        </button>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {sections.map((section) => (
          <div key={section.title} className="break-inside-avoid">
            <h2 className="text-lg font-bold text-purple-700 mb-3 pb-1 border-b border-purple-100">
              {section.title}
            </h2>
            <ul className="space-y-1.5">
              {section.items.map((item, i) => (
                <li key={i} className={`text-sm text-gray-700 flex items-start gap-2 ${item.startsWith("  →") ? "ml-6" : ""}`}>
                  {!item.startsWith("  →") && (
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                  )}
                  {item.startsWith("  →") ? (
                    <span className="text-gray-600">{item.trim()}</span>
                  ) : (
                    item
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
        <span>Marketing iO CRM — Confidential</span>
        <span>Built with Base44 · {new Date().getFullYear()}</span>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}