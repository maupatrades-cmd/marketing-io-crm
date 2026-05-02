/**
 * Validates a South African ID number (13 digits, Luhn checksum).
 * Returns { valid: boolean, error: string | null, dob: Date | null, gender: string | null, citizen: boolean | null }
 */
export function validateSAId(idNumber) {
  if (!idNumber) return { valid: false, error: "ID number is required" };
  const id = idNumber.replace(/\s/g, "");
  if (!/^\d{13}$/.test(id)) return { valid: false, error: "ID number must be exactly 13 digits" };

  // Date of birth: YYMMDD
  const year = parseInt(id.substring(0, 2));
  const month = parseInt(id.substring(2, 4));
  const day = parseInt(id.substring(4, 6));
  const fullYear = year >= 0 && year <= new Date().getFullYear() % 100 ? 2000 + year : 1900 + year;

  if (month < 1 || month > 12) return { valid: false, error: "Invalid date in ID number" };
  const dob = new Date(fullYear, month - 1, day);
  if (isNaN(dob.getTime()) || dob.getDate() !== day) return { valid: false, error: "Invalid date of birth in ID number" };

  // Age sanity check
  const age = (new Date() - dob) / (1000 * 60 * 60 * 24 * 365.25);
  if (age < 16 || age > 100) return { valid: false, error: "ID number implies an unrealistic age" };

  // Gender: digit 6 (0-4 = female, 5-9 = male)
  const genderDigit = parseInt(id.substring(6, 10));
  const gender = genderDigit < 5000 ? "female" : "male";

  // Citizenship: digit 10 (0 = citizen, 1 = permanent resident)
  const citizen = id[10] === "0";

  // Luhn checksum
  let odd = 0, even = "";
  for (let i = id.length - 2; i >= 0; i -= 2) odd += parseInt(id[i]);
  for (let i = id.length - 3; i >= 0; i -= 2) even += id[i];
  const evenSum = String(parseInt(even) * 2).split("").reduce((s, d) => s + parseInt(d), 0);
  const total = odd + evenSum;
  const checkDigit = (10 - (total % 10)) % 10;
  if (checkDigit !== parseInt(id[12])) return { valid: false, error: "ID number failed checksum validation" };

  return { valid: true, error: null, dob, gender, citizen, fullYear };
}

export function formatIdDisplay(idNumber) {
  const id = (idNumber || "").replace(/\D/g, "").substring(0, 13);
  return id;
}