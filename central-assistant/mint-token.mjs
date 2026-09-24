/**
 * TEST-ONLY identity mint (Stage 2). Production minting is module-side (Stage 4)
 * and MUST source the role from the module's real resolved identity (`req.rbac`,
 * the forwarded SAILERP role) — NEVER the mock `req.user.role`; see identity.mjs.
 *
 *   IDENTITY_SIGNING_KEY=... node mint-token.mjs '{"userId":"u1","role":"Sail Admin","tenantDomain":"pilot"}' [ttlSec]
 */
import { signIdentity } from './identity.mjs';

const key = process.env.IDENTITY_SIGNING_KEY;
if (!key) { console.error('IDENTITY_SIGNING_KEY required'); process.exit(1); }
const identity = JSON.parse(process.argv[2] || '{}');
const ttl = parseInt(process.argv[3] || '60', 10);
console.log(signIdentity(identity, key, ttl));
