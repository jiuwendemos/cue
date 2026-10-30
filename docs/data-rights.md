# Data-rights annex (pilot template)

This is the short annex a production company and a venue can sign before a 90-day pilot. It is a
template, not legal advice.

## 1. Roles

- **Production company** is the controller of the show, cue, budget and crew data.
- **Venue** is the controller of its rig, power, sightline and load-in profiles.
- **CUE** is a processor for the pilot, and a controller only for its own telemetry-free demo assets.

## 2. Data categories

| Category | Examples | Default location | Retention |
|---|---|---|---|
| Show design | setlist, looks, video map, blocking, cues | production network | per tour, then 30 days |
| Venue profile | stage, rig, power, sightlines, last verified | production network | per tour, then 30 days |
| Rights | track, video, likeness, territory, expiry | production network | per tour + 7 years for approvals |
| Human decisions | signatures, approvals, risk states, audit | production network | 7 years or the contractual audit window |
| Artist content | unreleased audio, video, stems | local by default | deleted on tour close |
| Pilot metrics | iterations, cue changes, cost avoided | aggregated, no personal data | 2 years |

No category is uploaded to a public cloud by default. Any upload needs written permission and a row in
the rights register.

## 3. Artist content

- Unreleased audio, video, stems, rehearsal footage and likeness stay on the production network.
- The optional NPU path is on-site inference, not an upload. It is sold as privacy, not as compute.
- Any sample used in a public demo needs written demo-use permission, not only a pilot NDA.
- The public demo uses no artist content. Its track is synthesised and its visuals are generated.

## 4. AI and ownership

- AI-assisted looks and video are labelled with the model version and the inference path.
- The production company owns the approved output; the model operator owns the model and the
  pre-existing library.
- The designer is the author of the approved show. The system proposes and checks.
- Safety sign-off is a human signature and is never generated or automated.

## 5. Territory and expiry

- Every music, video and likeness asset has a territory and a window in the rights register.
- A show outside the window is a readiness failure, not a warning that can be clicked away.
- An expired asset must be replaced or re-cleared before the first show after expiry.
- Broadcast, streaming and recording are separate rights from live performance.

## 6. Security

- OIDC/SSO, server-side roles and per-tenant isolation in production.
- Signed exports with a 72-hour expiry and a watermark.
- Encryption at rest and in transit; per-tenant keys.
- Offline operation during a show week; no outbound network required.
- Kill switch for readiness only; the show and cue sheet stay available.

## 7. Deletion and return

- On tour close, the production company can export the show, cue sheet, approvals and audit.
- Artist content is deleted on request within 30 days.
- Aggregated pilot metrics may be retained for the pilot review, with no personal or artist data.
- The processor returns or deletes all personal data on termination, except where audit law requires
  retention.

## 8. Sub-processors and integrations

- Vectorworks, WYSIWYG, Capture, Depence², grandMA3, disguise, Notch, Resolume, DAM, calendar,
  accounting, Slack/Teams and Jira are customer systems or vendors. Each needs its own data-processing
  terms.
- No sub-processor receives artist content without written permission.
- Cross-tenant sharing is off by default; if enabled, it is anonymised cause labels and factor ranges
  only.

## 9. Safety

- CUE advises on rigging, power, glare, sightlines and structural load. The crew and the venue's
  competent person decide and sign.
- No cue is released to the venue without a named human signature.
- Laser, structural and fire safety require the venue's own competent person and local regulations.

## 10. Contact

`data@cue.example.invalid` — replace with the pilot contact before signature.
