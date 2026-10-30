# Security and privacy

CUE handles creative material, venue data and safety decisions. The security case is part of the
product, not an appendix.

## Threat model

| Asset | Threat | Control |
|---|---|---|
| Unreleased artist content | leak, unauthorised upload | local by default; explicit permission; no upload path in the demo |
| Venue rig and power data | cross-tenant disclosure | tenant-scoped rows; production file/schema per tenant |
| Cue sheet and signatures | silent edit, release without sign-off | append-only audit; human signature; no automatic release |
| Show versions | post-approval edit | immutable approval record and signature |
| Agent output | wrong or uncited claim | citations, guardrails, explicit missing-evidence language |
| Safety decisions | automation bias | CUE advises; a named human signs; the crew decides |
| AI content | ownership ambiguity | labelled, attributable, model version, designer-owned on approval |

## Access

- Roles: designer, producer, venue crew, tour manager, admin.
- The UI hides actions the role cannot take; the server is the enforcement point.
- Production uses OIDC/SSO and server-side role checks. The demo has the role model but no IdP.
- Tenant header `X-CUE-Tenant` scopes every row in the store.
- Admin actions are audited.

## Store

- SQLite in the demo; PostgreSQL in production.
- Append-only audit: `audit(id, tenant, at, actor, action, object, detail, model_version, sources)`.
- Signatures, approvals and risk states are rows, not booleans in a file.
- Reset deletes only the current tenant's rows.
- Backup is a file copy in the demo; production uses PITR and a tested restore drill.

## Network

- No outbound network is required during a show week.
- The systemd unit denies outbound traffic by default.
- The public demo has no analytics, no CDN, no external font and no model call.
- The optional NPU broker is on-site; a missing model or endpoint returns an explicit error, never a
  silent CPU fallback.

## Exports

- Cue sheets print with a human signature line.
- Server exports carry a signature and a timestamp.
- Signed share links expire; the pilot uses 72 hours.
- The public demo exports locally in the browser; nothing is uploaded.

## AI

- Guardrails are in the agent and in the UI: cite, admit missing evidence, never change a cue, never
  sign safety, never release.
- Every proposal carries the model version and source IDs.
- A rejection is stored and the ranking recomputed.
- Safety sign-off is never automated.

## Incident response

1. Stop readiness with the kill switch; the show and cue sheet stay available.
2. Record the reason in the audit.
3. Notify the production office and, if artist content is involved, the artist's management.
4. Preserve the audit and the relevant assets; do not edit the show version.
5. Resume only after the producer signs the incident note.

## What is not claimed

The demo is not certified. OIDC, a DR drill, a penetration test, a WCAG audit and a procurement review
are pilot tasks. The architecture and the data-rights annex are ready for them.
