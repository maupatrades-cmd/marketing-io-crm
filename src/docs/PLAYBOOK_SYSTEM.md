# Playbook & Scripts Library

One-tap access to cold openers, discovery frameworks, objection handlers, and closing scripts from the Role Playbooks PDF.

## Overview

**Playbook System Architecture:**
- `Playbook` entity: Scripts, frameworks, checklists, and templates
- `/playbooks` page: Searchable library with role-based filtering
- `QuickScriptsWidget`: 3 random scripts on dashboard for quick reference
- Favorites: Staff can star scripts for quick access
- Edit access: Owner only (can refine scripts over time)

---

## Playbook Categories

| Category | Description | Available To |
|----------|-------------|--------------|
| **cold_outreach** | Door-to-door, phone, email openers | Field Agent, CPC |
| **discovery** | 5-phase framework, qualification criteria | Field Agent, CPC, Admin |
| **objection_handler** | Responses to common buyer objections | Field Agent, CPC |
| **closing** | 3 closing techniques (soft, assumptive, calendar) | Field Agent, CPC |
| **follow_up** | Post-proposal sequences, renewal calls, welcome calls | Field Agent, CPC, Admin |
| **upsell** | Add-on pitches to existing clients | CPC |
| **escalation** | When/how to escalate to owner | Field Agent, CPC, Admin |
| **daily_routine** | Hour-by-hour schedule + KPIs per role | Field Agent, CPC, Admin |

---

## Content Types

| Type | Description | Copy Feature |
|------|-------------|--------------|
| **script** | Word-for-word dialog to use | ✓ Copy to clipboard |
| **framework** | Multi-step structure/checklist | — |
| **checklist** | Daily or task checklist | — |
| **template** | Email/form template | ✓ Copy to clipboard |

---

## Seeded Playbooks

### FIELD AGENT (8 records)
1. **cold_door_to_door** — Door-to-door opener (script)
2. **cold_phone_opener** — Phone cold call opener (script)
3. **discovery_5_phases** — Discovery conversation framework (framework)
4. **closing_3_approaches** — Soft, assumptive, calendar closes (script)
5. **followup_3_touches** — 24h, 3-day, 7-day follow-up sequence (framework)
6. **objection_no_money** — "I don't have budget" response (objection_handler)
7. **objection_busy_not_interested** — "I'm busy / not interested" response (objection_handler)
8. **objection_things_are_fine** — "Things are fine" response (objection_handler)

### CPC (4 records)
9. **cpc_cold_call_opener** — CPC-specific phone opener (script)
10. **cpc_7_criteria_qualification** — Lead qualification framework (framework)
11. **cpc_existing_client_upsell** — Call existing clients with add-ons (script)
12. **cpc_disqualification_polite** — Professional disqualification (script)

### ADMIN (3 records)
13. **admin_welcome_call** — Welcome call within 24h of signing (framework)
14. **admin_failed_debit_followup** — Payment failure follow-up (script)
15. **admin_renewal_call** — Month 11 renewal conversation (framework)

### DAILY ROUTINES (3 records)
16. **field_agent_daily_routine** — 8am–5pm schedule + daily KPIs (checklist)
17. **cpc_daily_routine** — CPC daily call blocks + targets (checklist)
18. **admin_daily_routine** — Operations schedule + key metrics (checklist)

---

## Page Features

### /playbooks (all staff)

**Search & Filter:**
- Full-text search across title, description, and content
- 8 category tabs (Cold Outreach, Discovery, Objections, etc.)
- Shows only playbooks visible to user's role

**Playbook Cards:**
- Title + short description
- Content type badge (script, framework, checklist, template)
- For objection handlers: "Customer says" / "You say" visual differentiation
- [Expand] to see full content + usage notes
- [Copy] button for scripts/templates (copies to clipboard)
- [❤ Favorite] toggle (saves to localStorage per user)
- [Edit] button (owner only) to refine content

**Owner Edit Mode:**
- Full-content editor
- Usage notes editor
- Save/cancel buttons
- All staff see updated playbooks immediately on refresh

### Dashboard Widget

**QuickScriptsWidget** (on OwnerDashboard):
- Shows 3 random scripts relevant to current user's role
- Copy button on each script
- "View All Scripts" link to /playbooks
- Auto-refreshes on page load

---

## Favorites System

**How It Works:**
- Click ❤ on any playbook (if `is_favorite_eligible = true`)
- Stored in localStorage: `playbook_favorites_{user.email}`
- Favorites are personal and persist across sessions
- Visual indicator: heart filled in pink

**Use Case:**
Staff can build a personal library of most-used scripts for instant access.

---

## Role-Based Visibility

| Role | Can See | Access Level |
|------|---------|--------------|
| **field_agent** | 8 field agent playbooks | Read-only |
| **cpc** | Field agent scripts + 4 CPC playbooks | Read-only |
| **admin** | CPC scripts + 3 admin playbooks | Read-only |
| **founder** | All 18 playbooks | Read + Edit |
| **head_of_tech** | — | None (can add later) |
| **driver** | — | None (can add later) |

---

## Integration Points

### Sidebar Navigation
- "Playbooks" menu item (BookOpen icon) visible to ALL staff
- Route: `/playbooks`

### Dashboard Widgets
- `QuickScriptsWidget` on OwnerDashboard
- Shows 3 random role-specific scripts
- Refreshes on page load

### Pages Added
- `pages/Playbooks.jsx` — Main library page
- `components/playbook/QuickScriptsWidget.jsx` — Dashboard widget

---

## Editing Workflow (Owner Only)

1. Navigate to `/playbooks`
2. Find playbook to edit
3. Click [Expand] to view content
4. Click [Edit]
5. Modify `full_content` and/or `usage_notes`
6. Click [Save]
7. Changes are immediate (no refresh needed)
8. All staff see updated playbooks on next page load

---

## Seed Function

**Backend function:** `seedPlaybooks`
- Clears all existing playbooks
- Inserts 18 new playbook records
- Returns count of seeded playbooks
- Owner access only (403 if not founder role)

**Run manually:**
- Dashboard → Code → Functions → seedPlaybooks → Test
- Or call from admin UI if exposed

---

## Data Structure

```json
{
  "code": "cold_door_to_door",
  "title": "Cold outreach opener — door-to-door / walk-in",
  "category": "cold_outreach",
  "visible_to_roles": ["field_agent"],
  "content_type": "script",
  "short_description": "Opening line for door-to-door prospecting",
  "full_content": "Hi, my name is [Name] from Marketing iO...",
  "related_objection": null,
  "usage_notes": "Use when cold-calling on foot. Keep it conversational...",
  "is_favorite_eligible": true
}
```

---

## Future Enhancements

- Add playbooks for Head of Tech (Bucket B setup SLA guides, etc.)
- Add playbooks for Driver (Photo evidence upload checklists)
- Search shortcuts (#coldopen, #discovery, etc.)
- Sharing: Staff can create team notes on playbooks
- Version history: Track edits to playbooks over time
- Training mode: Quiz staff on playbook knowledge

---

## Protected Files

✅ No changes to:
- `compensationPackages.js`
- `LogSale.jsx`
- Contract code
- Email templates
- Commission logic
- Any business rule logic

Playbook library is **read-only reference material** — does not affect operations.