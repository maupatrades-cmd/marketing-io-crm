export function validatePassword(password) {
  const errors = [];
  
  if (password.length < 10) {
    errors.push('Password must be at least 10 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least 1 uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least 1 lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least 1 number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function getPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 10) strength++;
  if (password.length >= 16) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  
  if (strength <= 2) return { level: 'Weak', color: 'text-destructive' };
  if (strength <= 4) return { level: 'Fair', color: 'text-warning' };
  return { level: 'Strong', color: 'text-success' };
}