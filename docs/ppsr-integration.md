# PPSR B2G Integration — Implementation Status

## Overview

Direct Auto Wholesale integrates with the Australian PPSR (Personal Property Securities Register) B2G (Business-to-Government) API to lodge Motor Vehicle registrations against SPG 103956500 when purchasing vehicles.

**Account**: tra5851 (Account 101449050)
**SPG**: 103956500
**Spec version**: B2G Interface Specification v6.13 (Release R3)

## Architecture

```
Next.js API Route
  → lib/ppsr-lodge-service.ts   (provider interface, types, error mapping)
    → lib/ppsr-http.ts          (proxy-aware HTTP transport)
      → HTTPS_PROXY / Fixie     (static IP egress)
        → b2g.ppsr.gov.au       (SOAP 1.1, WS-Security)
```

### Key files

| File | Purpose |
|------|---------|
| `lib/ppsr-lodge-service.ts` | Provider interface, mock + real B2G providers, SOAP fault mapper, WS-Security builder |
| `lib/ppsr-http.ts` | Proxy-aware HTTP transport (`ppsrFetch`), proxy resolution, config validation |
| `lib/log-redact.ts` | Deep credential redaction for logging |
| `scripts/ppsr-initial-password-change.ts` | One-off script to change initial B2G password |
| `lib/__tests__/ppsr-http.test.ts` | 10 unit tests for HTTP transport layer |
| `lib/__tests__/log-redact.test.ts` | 15 unit tests for redaction utility |

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PPSR_USERNAME` | Yes | B2G account username (e.g. `tra5851`) |
| `PPSR_PASSWORD` | Yes | B2G account password (after initial change) |
| `PPSR_SPG_NUMBER` | Yes | Secured Party Group number (`103956500`) |
| `PPSR_API_BASE_URL` | Yes | `https://b2g-disc.ppsr.gov.au` (sandbox) or `https://b2g.ppsr.gov.au` (prod) |
| `PPSR_ENVIRONMENT` | No | `sandbox` (default) or `production` |
| `PPSR_PROVIDER` | No | `mock` (default) or `real` |
| `PPSR_REGISTRATION_FEE_CENTS` | No | Fee per lodgement in cents (default `600` = $6.00) |
| `PPSR_INITIAL_PASSWORD` | Script only | Initial password assigned by PPSR (for password change script) |
| `HTTPS_PROXY` / `HTTP_PROXY` / `FIXIE_URL` | Prod: Yes | Static IP proxy URL for IP whitelisting |

### Provider switching

Set `PPSR_PROVIDER=mock` for development (default) or `PPSR_PROVIDER=real` for live B2G calls.

The mock provider returns realistic fake data with a 500ms delay. The real provider will build and send SOAP envelopes once the WSDL is available.

## What's implemented

- [x] Proxy-aware HTTP transport with HTTPS_PROXY/HTTP_PROXY/FIXIE_URL support
- [x] Proxy validation (production requires proxy, sandbox warns)
- [x] WS-Security UsernameToken header builder
- [x] SOAP fault parser mapping PPSR error codes to typed exceptions
- [x] Error class hierarchy (Auth, Validation, Config, InsufficientCredit, IPNotWhitelisted, DuplicateRequest, IdempotencyExpired, Transient)
- [x] Mock provider returning realistic test data
- [x] Provider factory with env var switching
- [x] Initial password change script with safety guards
- [x] Credential redaction utility for all logging
- [x] Unit tests for HTTP transport (10 tests) and redaction (15 tests)

## What's NOT implemented (pending blockers)

- [ ] `CreateRegistrations` SOAP envelope builder (pending WSDL)
- [ ] `RetrieveRegistration` SOAP envelope builder (pending WSDL)
- [ ] Real B2G provider — currently throws "Not implemented"
- [ ] API route to trigger lodgement from the UI
- [ ] Grantor model (individual vs organisation) — pending David's decision
- [ ] Sandbox end-to-end testing
- [ ] Production cutover

## Blockers

### 1. WSDL from PPSR admin portal

**Owner**: Zhao Lin
**Status**: Waiting
**Impact**: Cannot build the CreateRegistrations SOAP envelope without the exact WSDL schema. The B2G Interface Specification documents the structure, but the WSDL defines the precise namespace URIs and element names.

**Next action**: Download the WSDL from the PPSR B2G admin portal and provide it for implementation.

### 2. Grantor model confirmation

**Owner**: David
**Status**: Waiting
**Impact**: Need to know whether grantors (sellers) are individuals or organisations (or both) to correctly populate the Grantor section of the registration request.

**Next action**: David to confirm the typical seller profile. Options:
- Individual only (name + DOB)
- Organisation only (ABN/ACN + name)
- Both (UI allows either)

### 3. B2G initial password change

**Owner**: Zhao Lin
**Status**: Ready to execute
**Impact**: PPSR assigns an initial password that MUST be changed before any other API operations work. The change script is built and tested.

**Next action**:
1. Set `PPSR_INITIAL_PASSWORD` in `.env` to the password from PPSR
2. Set `PPSR_PASSWORD` to the desired new password
3. Run: `npx tsx scripts/ppsr-initial-password-change.ts`
4. On success, update `.env` to use the new password and remove `PPSR_INITIAL_PASSWORD`

### 4. Static IP proxy setup

**Owner**: Zhao Lin
**Status**: Not started
**Impact**: PPSR requires IP whitelisting. Vercel has dynamic egress IPs, so a static IP proxy (Fixie, QuotaGuard, or similar) is needed.

**Next action**:
1. Choose and provision a static IP proxy service
2. Set `HTTPS_PROXY` (or `FIXIE_URL`) in Vercel environment variables
3. Submit the static IP to PPSR for whitelisting on both Discovery and Production endpoints

## Test plan

### Unit tests (can run now)
```bash
npx vitest run lib/__tests__/ppsr-http.test.ts
npx vitest run lib/__tests__/log-redact.test.ts
```

### Integration tests (after blockers resolved)

1. **Password change**: Run the password change script against Discovery endpoint
2. **Mock lodgement**: Set `PPSR_PROVIDER=mock` and verify the full flow from API route through mock provider
3. **Sandbox lodgement**: Set `PPSR_PROVIDER=real`, `PPSR_ENVIRONMENT=sandbox`, verify against Discovery endpoint:
   - Lodge a registration with a test VIN
   - Verify registration number returned
   - Retrieve the registration and confirm status
   - Test error handling (invalid VIN, duplicate request, etc.)
4. **Production cutover** (manual gate):
   - Switch `PPSR_API_BASE_URL` to production
   - Set `PPSR_ENVIRONMENT=production`
   - Lodge one real registration and verify in PPSR portal

## PPSR B2G API reference

- **Spec**: B2G Interface Specification v6.13 (Release R3)
- **Auth**: SOAP 1.1 with WS-Security UsernameToken (PasswordText)
- **Discovery endpoint**: `https://b2g-disc.ppsr.gov.au/PpsrB2GService/{version}/CollateralRegistration.svc/soap11`
- **Production endpoint**: `https://b2g.ppsr.gov.au/PpsrB2GService/{version}/CollateralRegistration.svc/soap11`
- **Key operation**: `CreateRegistrations` on Collateral Registration Service
- **Collateral class**: MotorVehicle, serial number type: VIN (17 chars)
- **Max registration duration**: 7 years
- **Fee**: $6.00 per lodgement (not returned in API response)
- **Idempotency**: `CustomersRequestMessageId` (UUID), PPSR deduplicates within 24 hours
- **TargetEnvironment**: Required SOAP header — "Discovery" or "Production"
