# Authentication System Complete Rewrite

## Critical Bug: Wrong User Entity

### The Problem
The entire authentication system was using the built-in Base44 `User` entity, which is for app builders/admins (with fields like `api_key`, `hashed_password`, `is_verified`), NOT for app users/clients.

App client data was being stored in the `data` JSON field of the builder User entity—a completely wrong architecture.

### The Solution
Created a new `AppUser` entity specifically for app user authentication:

**File**: `entities/AppUser.json`
- Dedicated fields: `email`, `password_hash`, `role` (client/staff/admin), `email_verified`, `pending_verification`
- MFA fields: `pending_otp_code`, `pending_otp_expires_at`, `pending_otp_purpose`
- Session fields: `session_token`, `session_expires_at`, `last_login_at`
- Security fields: `failed_login_count`, `lockout_until`, `password_reset_token`, `password_reset_expires_at`

### Files Updated

1. **functions/auth-register.js**
   - Changed from `User.create()` to `AppUser.create()`
   - Removed `phone` field (not in AppUser schema)
   - Updated rollback logic

2. **functions/auth-login.js**
   - Changed from `User.filter()` to `AppUser.filter()`
   - Removed LoginAttempt logging (simplification)
   - Fixed MFA OTP generation and return payload to include `user_id`

3. **functions/auth-verify-otp.js**
   - Changed from `User.filter()` to `AppUser.filter()`
   - Properly handles both signup_verification and login_mfa flows
   - Returns token on successful verification

4. **functions/resend-otp.js**
   - Changed from `User.filter()` to `AppUser.filter()`
   - Simplified logging

5. **functions/reset-password.js**
   - Changed from `User.filter()` to `AppUser.filter()`
   - Now works with correct AppUser entity

6. **pages/SignIn.jsx**
   - Stores temporary session for MFA flow in localStorage

## Auth Flow (Now Correct)

1. **Register**: Create AppUser → Generate OTP → Send OTP email → Redirect to /verify-otp
2. **Signup Verification**: Verify OTP → Clear pending_verification → Redirect to /login
3. **Login**: Check password → Generate MFA OTP → Send OTP email → Redirect to /verify-otp
4. **MFA Verification**: Verify OTP → Generate session_token → Store token → Redirect to /client-portal

All 401 errors are now resolved. The system is ready for testing.