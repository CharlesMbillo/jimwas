# Microsoft 365 Outage Response & Resilience Lab

> **Simulation lab — not Microsoft production telemetry.** This project demonstrates incident detection, service degradation, recovery validation and post-incident review using a locally simulated dependency and a read-only health probe for Jimwas POS.

This lab lives in the Jimwas POS repository but is isolated under `ops/resilience-lab/`. It does not modify application runtime code, payment flows, Supabase data or production configuration.

## Objectives

- Observe the Jimwas POS public application endpoint using a configurable HTTP health probe.
- Simulate healthy, degraded, slow and unavailable dependency states locally.
- Produce machine-readable probe results and an incident summary.
- Exercise a safe response lifecycle: detect → assess → communicate → recover → review.
- Run automated tests in GitHub Actions.

## Architecture

```text
Jimwas POS (read-only HTTP endpoint)
            |
            v
   health-probe.mjs  -----> JSON result
            |
            +---- local simulation server
                         |
                         +-- /health      200 healthy
                         +-- /degraded    503 simulated degradation
                         +-- /slow        delayed response
                         +-- /unavailable 503 simulated outage
```

The simulator is local and deterministic. It does not send traffic to Microsoft, alter DNS, restart services, or inject faults into Jimwas POS.

## Requirements

- Node.js 20 or newer
- npm (no third-party runtime dependencies)

## Quick start

From this directory:

```bash
npm test
npm run lab
```

The lab starts a local simulator, probes four scenarios and prints JSON results. Exit code is non-zero if the lab itself fails.

## Probe Jimwas POS (read-only)

Copy `.env.example` values into your shell or pass the URL directly:

```bash
JIMWAS_HEALTH_URL=https://jimwas-yn.vercel.app/ npm run probe
```

PowerShell:

```powershell
$env:JIMWAS_HEALTH_URL = "https://jimwas-yn.vercel.app/"
npm run probe
```

This is an HTTP reachability check, not a complete application health contract. A successful HTTP response does not prove that authentication, checkout, inventory, M-Pesa, KCB Buni or Supabase operations are healthy. Do not probe private endpoints or expose secrets.

## Configuration

| Variable | Default | Purpose |
|---|---:|---|
| `JIMWAS_HEALTH_URL` | `http://127.0.0.1:4173/health` | Read-only endpoint to observe |
| `PROBE_TIMEOUT_MS` | `4000` | Per-request timeout |
| `PROBE_RETRIES` | `1` | Additional attempts after failure |
| `PROBE_RETRY_DELAY_MS` | `500` | Delay between attempts |

## Incident classification (lab defaults)

- **SEV-1:** widespread business-critical outage or loss of core transaction integrity.
- **SEV-2:** major degradation affecting a material user group or key workflow.
- **SEV-3:** limited degradation with a safe workaround.
- **SEV-4:** minor issue or informational event.

Severity must be based on verified customer and business impact, not the simulated HTTP status alone.

## Safety and scope

- All fault injection is restricted to the local simulator.
- The Jimwas probe is read-only and should target only a public, approved URL.
- No payment request, database write, credential collection, or production configuration change is performed.
- Microsoft service names in this project are used as the scenario context only. No Microsoft internal access or production incident data is claimed.
- The reported “430 million users” figure is not used as a verified metric by this lab.

## Incident lifecycle exercise

1. Run `npm run lab` and identify the non-healthy scenarios.
2. Record detection time, affected service, observed evidence and business impact.
3. Assign an incident commander and technical lead.
4. Communicate a factual update; separate confirmed facts from hypotheses.
5. Re-run the probe after the simulated service returns to healthy.
6. Complete [the incident runbook](docs/incident-runbook.md) and [RCA template](docs/rca-template.md).

## Repository layout

- `src/probe.mjs` — bounded, read-only HTTP probe.
- `src/simulator.mjs` — local simulated dependency.
- `src/run-lab.mjs` — executes the deterministic scenarios.
- `test/probe.test.mjs` — automated tests.
- `docs/` — response and post-incident templates.
- `.github/workflows/resilience-lab.yml` — CI.

## Jimwas integration roadmap

The first iteration deliberately uses a configurable public URL instead of assuming an application-specific health endpoint exists. A future Jimwas health contract can expose non-sensitive component status (frontend, Supabase connectivity and payment-provider configuration) without revealing secrets or performing transactions. Payment-provider checks should use provider-approved sandbox/status mechanisms and must never retry a payment merely because a client timed out.
