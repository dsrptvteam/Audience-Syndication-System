# Deployment Troubleshooting - Vercel Production Deploy

## Overview

Document the journey from initial deployment attempt to successful production deployment, including all errors encountered and solutions applied.

## Timeline of Issues & Resolutions

### Issue 1: ESLint Unused Variables Error
**Date:** January 29, 2026
**Full Error:**
```
Error: 'processingTime' is assigned a value but never used.  @typescript-eslint/no-unused-vars
Error: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
Error: 'CardDescription' is defined but never used.  @typescript-eslint/no-unused-vars
```
**Root Cause:** Strict ESLint configuration flagging unused variables
**Files Modified:**
- app/api/cron/daily/route.ts
- app/api/purchases/upload/route.ts
- app/dashboard/purchases/page.tsx
- lib/sftp-helper.ts
- .eslintrc.json

**Solution Applied:**
1. Used `processingTime` in response JSON
2. Changed `catch (error)` to `catch { }` (empty catch blocks)
3. Removed unused imports
4. Updated ESLint config to allow underscore-prefixed unused vars:
```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ]
  }
}
```

**Commits:** b9a1537, a9cd313, 53330ea, b1374f5
**Status:** ✅ Resolved

---

### Issue 2: Next.js Route Export Error
**Date:** January 29, 2026
**Full Error:**
```
Type error: Route "app/api/auth/[...nextauth]/route.ts" does not match the required types of a Next.js Route.
  "authOptions" is not a valid Route export field.
```
**Root Cause:** Next.js App Router only allows specific exports (GET, POST, etc.) from route files
**Files Modified:**
- app/api/auth/[...nextauth]/route.ts
- lib/auth.ts (created)
- lib/auth-helper.ts

**Solution Applied:**
1. Created separate `/lib/auth.ts` file for authOptions configuration
2. Simplified route file to only export handlers:
```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```
3. Updated imports in auth-helper.ts

**Commit:** 244cf80
**Status:** ✅ Resolved

---

### Issue 3: Zod Error Property Name Change
**Date:** January 29, 2026
**Full Error:**
```
Type error: Property 'errors' does not exist on type 'ZodError<...>'.
```
**Root Cause:** Zod v3+ uses `.issues` instead of `.errors` on ZodError
**Files Modified:**
- app/api/audience/route.ts
- app/api/clients/route.ts
- app/api/process/route.ts
- app/api/meta/sync/route.ts

**Solution Applied:**
Changed all instances of `validationResult.error.errors` to `validationResult.error.issues`

**Commit:** 82915e3
**Status:** ✅ Resolved

---

### Issue 4: TypeScript Implicit Any Errors
**Date:** January 29, 2026
**Full Error:**
```
error TS7006: Parameter 'c' implicitly has an 'any' type.
error TS7006: Parameter 'log' implicitly has an 'any' type.
error TS7006: Parameter 'm' implicitly has an 'any' type.
```
**Root Cause:** `strict: true` in tsconfig.json requires explicit types for all parameters
**Files Modified:**
- app/api/audience/stats/route.ts
- app/api/cron/daily/route.ts
- app/api/cron/test/route.ts
- app/api/meta/sync/history/route.ts
- app/api/meta/sync/route.ts
- app/api/process/history/route.ts
- app/api/purchases/history/route.ts
- lib/sftp-helper.ts

**Solution Applied:**
Added explicit type annotations to all map callback parameters:
```typescript
// Before
audienceMembers.map((m) => ({...}))

// After
audienceMembers.map((m: { email: string | null; phone: string | null; ... }) => ({...}))
```

**Commit:** 7a732ae
**Status:** ✅ Resolved

---

### Issue 5: Unused FileInfo Interface
**Date:** January 29, 2026
**Full Error:**
```
Error: 'FileInfo' is defined but never used. @typescript-eslint/no-unused-vars
```
**Root Cause:** FileInfo interface was left over after removing type predicate
**Files Modified:**
- lib/sftp-helper.ts

**Solution Applied:**
Removed the unused `FileInfo` interface definition

**Commit:** 653ab82
**Status:** ✅ Resolved

---

### Issue 6: Prisma 7 datasourceUrl Error
**Date:** January 29, 2026
**Full Error:**
```
Type error: Object literal may only specify known properties, and 'datasourceUrl' does not exist in type 'Subset<PrismaClientOptions, PrismaClientOptions>'.
```
**Root Cause:** Attempted to use Prisma 7 syntax with incorrect configuration
**Files Modified:**
- lib/db.ts
- prisma/schema.prisma

**Solution Applied:**
Reverted to standard PrismaClient without datasourceUrl option:
```typescript
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient();
```

**Commit:** 3d14668
**Status:** ✅ Resolved

---

### Issue 7: Prisma 7 Schema URL Not Supported
**Date:** January 29, 2026
**Error Code:** P1012
**Full Error:**
```
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: The datasource property `url` is no longer supported in schema files.
Move connection URLs for Migrate to `prisma.config.ts` and pass either `adapter`
for a direct database connection or `accelerateUrl` for Accelerate to the `PrismaClient` constructor.
```
**Root Cause:** Prisma 7 breaking change - datasource URL configuration completely changed
**Files Modified:**
- package.json

**Solution Applied:**
Downgraded Prisma from v7 to v5.22.0 which supports traditional URL configuration:
```json
{
  "dependencies": {
    "@prisma/client": "^5.22.0"
  },
  "devDependencies": {
    "prisma": "^5.22.0"
  }
}
```

**Commit:** b825eb7
**Status:** ✅ Resolved

---

### Issue 8: SSH2 Native Module Webpack Error
**Date:** January 29, 2026
**Full Error:**
```
Module parse failed: Unexpected character '�' (1:0)
You may need an appropriate loader to handle this file type.
./node_modules/ssh2/lib/protocol/crypto/build/Release/sshcrypto.node
```
**Root Cause:** Native Node.js modules (ssh2) cannot be bundled by webpack in serverless environment
**Files Modified:**
- next.config.mjs

**Solution Applied:**
Externalized ssh2 and ssh2-sftp-client from webpack bundling:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('ssh2', 'ssh2-sftp-client');
    }
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['ssh2', 'ssh2-sftp-client'],
  },
};

export default nextConfig;
```

**Commit:** ced0a0b
**Status:** ✅ Resolved

---

## Key Learnings

### 1. ESLint Configuration
- Use `caughtErrorsIgnorePattern` for catch clause variables
- Empty catch blocks `catch { }` are valid ES2019+ syntax
- Remove unused imports/interfaces immediately when refactoring

### 2. Next.js App Router Constraints
- Route files can only export specific HTTP method handlers
- Move configuration objects to separate files in `/lib`
- Import configurations where needed

### 3. Zod API Differences
- Zod v3+ uses `.issues` not `.errors` on ZodError
- Always check library documentation for API changes

### 4. TypeScript Strict Mode
- `strict: true` requires explicit types everywhere
- Add type annotations to callback parameters
- Prisma result types may need explicit typing in map callbacks

### 5. Prisma Version Compatibility
- Prisma 7 has major breaking changes
- Downgrade to Prisma 5.x for traditional configuration
- Always lock Prisma versions in production

### 6. Native Modules in Serverless
- Native Node.js modules must be externalized from webpack
- Use Next.js config to exclude problematic packages
- Two config points: `webpack.externals` + `serverComponentsExternalPackages`

---

## Environment Variables Configured

Total: 13 environment variables set in Vercel

**Database:**
- `DATABASE_URL` - Supabase pooler connection
- `DIRECT_URL` - Supabase direct connection

**Authentication:**
- `NEXTAUTH_URL` - Production URL
- `NEXTAUTH_SECRET` - 32-char random string

**Security:**
- `SFTP_ENCRYPTION_KEY` - AES-256-GCM key (64-char hex)
- `CRON_SECRET` - Cron endpoint protection

**Email Service:**
- `RESEND_API_KEY`
- `EMAIL_FROM`

**Meta API:**
- `META_APP_ID`
- `META_APP_SECRET`
- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID`
- `META_AUDIENCE_ID`

---

## Final Configuration

### Repository
- **GitHub:** dsrptvteam/Audience-Syndication-System
- **Branch:** main (protected)
- **Development Branch:** claude/init-nextjs-setup-ooyEu

### Build Settings
- **Framework:** Next.js 14.2.35
- **Build Command:** `prisma generate && next build`
- **Output Directory:** .next
- **Install Command:** npm install
- **Node.js Version:** 18.x

### Key Dependencies
- Prisma: 5.22.0 (downgraded from 7.x)
- Next.js: 14.2.35
- TypeScript: 5.x
- Zod: 4.3.6

---

## Troubleshooting Checklist for Future Deployments

- [ ] Run `npx tsc --noEmit` locally before pushing
- [ ] Run `npm run lint` to catch ESLint errors
- [ ] Check for unused imports/variables
- [ ] Verify Prisma version compatibility
- [ ] Test native modules are externalized
- [ ] Confirm all environment variables are set in Vercel
- [ ] Check branch protection and PR workflow
- [ ] Monitor deployment logs closely
- [ ] Verify database migrations applied
- [ ] Test authentication flows post-deploy

---

## Commands for Local Testing

```bash
# TypeScript check
npx tsc --noEmit

# ESLint check
npm run lint

# Local build test
npm run build

# Prisma generate
npx prisma generate
```

---

## Resources Referenced

- Prisma Documentation: https://www.prisma.io/docs
- Next.js Webpack Configuration: https://nextjs.org/docs/app/api-reference/next-config-js/webpack
- Vercel Deployment Documentation: https://vercel.com/docs
- TypeScript ESLint Rules: https://typescript-eslint.io/rules/no-unused-vars
- Zod Documentation: https://zod.dev

---

## Summary

| Issue | Root Cause | Solution | Commits |
|-------|------------|----------|---------|
| ESLint unused vars | Strict rules | Empty catch, use values | 4 |
| Route export | App Router constraint | Move to lib/ | 1 |
| Zod .errors | API change | Use .issues | 1 |
| Implicit any | Strict TS | Add types | 1 |
| Unused interface | Refactoring leftover | Remove | 1 |
| Prisma datasourceUrl | Wrong config | Revert to standard | 1 |
| Prisma 7 URL | Breaking change | Downgrade to v5 | 1 |
| SSH2 webpack | Native modules | Externalize | 1 |

**Total Issues Resolved:** 8
**Total Commits:** 11

---

**Document Generated:** January 29, 2026
**Last Updated:** January 29, 2026
