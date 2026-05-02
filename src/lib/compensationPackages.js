// Shared compensation package config — single source of truth for all salary/deduction views

export const EQUIPMENT_DEDUCTIONS = {
  owner: [],
  field_agent: [],
  cpc: [
    { name: "PC / Software", amount: 650 },
    { name: "Work Phone", amount: 350 },
    { name: "Airtime", amount: 250 },
    { name: "Uniform", amount: 150 },
  ],
  admin: [],
};

export const SALARY_COMPONENTS = {
  field_agent: [
    { name: "Basic Salary", amount: 4410 },
    { name: "Travel Allowance", amount: 1200 },
    { name: "Airtime Allowance", amount: 500 },
    { name: "Meal Allowance", amount: 390 },
  ],
  cpc: [
    { name: "Basic Salary", amount: 2500 },
    { name: "Airtime Allowance", amount: 500 },
    { name: "Performance Allowance", amount: 2890 },
  ],
  admin: [
    { name: "Basic Salary", amount: 4890 },
    { name: "Office Allowance", amount: 1000 },
  ],
  owner: [
    { name: "Owner CTC", amount: 10000 },
  ],
};

export const ROLE_LABELS = {
  field_agent: "Field Agent",
  cpc: "CPC",
  admin: "Admin",
  owner: "Owner / Founder",
};

/**
 * Calculate gross CTC, total equipment deductions, and nett take-home for a given role.
 * @param {string} role
 * @returns {{ gross: number, deductionItems: Array, totalDeductions: number, nett: number } | null}
 */
export function calcPackage(role) {
  const components = SALARY_COMPONENTS[role];
  if (!components) return null;
  const deductionItems = EQUIPMENT_DEDUCTIONS[role] || [];
  const gross = components.reduce((s, c) => s + c.amount, 0);
  const totalDeductions = deductionItems.reduce((s, d) => s + d.amount, 0);
  const nett = gross - totalDeductions;
  return { gross, components, deductionItems, totalDeductions, nett };
}