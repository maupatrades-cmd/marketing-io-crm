# KPI Tracking System

Per-role performance dashboard with monthly, quarterly, and custom period tracking based on Role Playbooks.

## Overview

**KPI System Architecture:**
- `KPITarget` entity: Defines targets per role per metric
- `lib/kpiCalculator.js`: Calculation engine for each metric (data-driven from CRM)
- `/my-kpis`: Individual staff KPI dashboard
- `/team-kpis`: Owner/Admin team performance view (with alerts)
- Widgets: Mini KPI cards on Profile & Owner Dashboard

---

## KPI Targets by Role

### FIELD AGENT (8 targets)
| Metric | Target | Period | Direction | Unit |
|--------|--------|--------|-----------|------|
| New Deals Closed | 3 | monthly | minimum | deals |
| Discovery Visits | 60 | monthly | minimum | visits |
| Pipeline Value | R30,000 | monthly | minimum | ZAR |
| CRM Data Quality | 100 | monthly | minimum | % |
| Add-on Upsells | 2 | monthly | minimum | upsells |
| Response Time | 24 | daily | maximum | hours |
| Daily Visits/Touchpoints | 3 | daily | minimum | visits |
| Weekly Proposals | 5 | weekly | minimum | proposals |

### CPC (8 targets)
| Metric | Target | Period | Direction | Unit |
|--------|--------|--------|-----------|------|
| Qualified Leads | 30 | monthly | minimum | leads |
| Closure Conversion Rate | 25 | monthly | minimum | % |
| Daily Calls | 30 | daily | minimum | calls |
| Client Check-ins | 10 | monthly | minimum | calls |
| Upsells to Existing | 3 | monthly | minimum | upsells |
| Response Time | 4 | daily | maximum | hours |
| CRM Data Quality | 100 | monthly | minimum | % |
| 7-Criteria Qualification | 100 | monthly | minimum | % |

### ADMIN (6 targets)
| Metric | Target | Period | Direction | Unit |
|--------|--------|--------|-----------|------|
| Contracts Loaded | 5 | weekly | minimum | contracts |
| Onboarding Form Follow-up | 3 | monthly | maximum | days |
| Invoice Dispatch by 1st | 1 | monthly | maximum | day |
| Debit Failure Follow-up | 24 | daily | maximum | hours |
| Monthly Reports by 5th | 5 | monthly | maximum | day |
| Form Completion Rate | 90 | monthly | minimum | % |

### OWNER/FOUNDER (5 targets)
| Metric | Target | Period | Direction | Unit |
|--------|--------|--------|-----------|------|
| Monthly Revenue (MRR) | R100,000 | monthly | minimum | ZAR |
| New Clients Signed | 10 | monthly | minimum | clients |
| Client Retention | 90 | quarterly | minimum | % |
| Staff Satisfaction | 8 | quarterly | minimum | out of 10 |
| Pipeline Health | R250,000 | monthly | minimum | ZAR |

### HEAD OF TECH (5 targets)
| Metric | Target | Period | Direction | Unit |
|--------|--------|--------|-----------|------|
| Bucket B Setup SLA | 95 | monthly | minimum | % |
| Website Uptime | 99 | monthly | minimum | % |
| Avg Setup Time | 25 | monthly | maximum | days |
| Bug Resolution Time | 3 | monthly | maximum | days |
| AI Chatbot Active Clients | — | monthly | — | clients |

### DRIVER/PHOTO-EVIDENCE (3 targets)
| Metric | Target | Period | Direction | Unit |
|--------|--------|--------|-----------|------|
| Photo Evidence Upload Rate | 100 | monthly | minimum | % |
| On-time Arrival Rate | 95 | monthly | minimum | % |

---

## Calculation Logic (Examples)

### new_deals_closed
COUNT of Deal records WHERE:
- closer_id = current_user
- stage = "closed_won"
- client_onboarded_date in current period

### discovery_visits
COUNT of Task records WHERE:
- assigned_to = current_user
- title contains "discovery"
- status = "done"
- completed_at in current period

### qualified_leads_per_month
COUNT of Lead records WHERE:
- created_by = current_user
- status = "qualified"
- created_at in current period

### monthly_revenue_zar (Owner)
SUM of Invoice.total WHERE:
- status = "paid"
- paid_date in current period

### bucket_b_setup_within_sla_pct (Head of Tech)
COUNT(deliverables completed on time) / COUNT(all deliverables) * 100

---

## Status Badges

| Status | Condition | Color |
|--------|-----------|-------|
| ✓ On Track | actual ≥ target (minimum) OR actual ≤ target (maximum) | Green |
| ⚠ At Risk | 50–100% of target met | Amber |
| ✗ Below Target | < 50% of target met | Red |

---

## Pages & Routes

### /my-kpis
**Access:** All logged-in staff (see their own KPIs)
- Period selector: daily, weekly, monthly, quarterly
- Grid of KPI cards with:
  - Metric name + unit
  - Actual vs Target values
  - Progress bar
  - Status badge
  - Last updated timestamp

### /team-kpis
**Access:** Owner + Admin only
- Team alerts (top 5 below-target metrics)
- Period selector
- Per-staff row showing KPI progress
- Click to drill into individual staff member details
- Modal detail view with all metrics for selected person

---

## Widgets

### MyKPIsWidget
Shows top 3 monthly KPIs on Staff Profile page
- Quick progress bars
- "View All KPIs" link to /my-kpis

### TeamKPIsWidget
Shows on Owner Dashboard
- Team member alerts (below-target metrics)
- "View Team KPIs" link to /team-kpis
- Only renders for owner/admin

---

## Seed Function

Run: **seedKPITargets** (backend function)
- Clears existing targets
- Inserts all 41 KPI targets for 6 roles
- Returns count of seeded targets

---

## Integration with CRM Data

KPI calculations pull live data from:
- Deal entity (closer_id, stage, setup_fee, monthly_retainer)
- Task entity (assigned_to, status, completed_at, title)
- Lead entity (created_by, status)
- Invoice entity (total, status, paid_date)
- Deliverable entity (phase, approved_date, soft_sla_days)
- Client entity (status, monthly_retainer)
- ClientAddOn entity (add_on, status)

No manual entry required — all calculations are live from CRM.

---

## Notes

- **Estimates:** Some metrics use approximations (e.g., response time, call volume) when exact data isn't readily available in CRM. Flagged in UI.
- **Timezone:** All dates are in Africa/Johannesburg timezone
- **Refresh:** KPI data recalculates on page load (no background worker)
- **Protected Files:** No changes to compensationPackages, LogSale, contract code, email templates, or commission logic