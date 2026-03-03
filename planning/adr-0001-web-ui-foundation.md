# ADR 0001: Web UI Foundation

## Status

Accepted on March 2, 2026.

## Context

The project now has a backend MVP surface through Wave 5:

- public catalog browse and detail
- Keycloak-backed identity and current-user profile
- organization and membership management
- title, metadata, media, release, artifact, and acquisition management

The team wants to introduce a browser-based UI now to validate the existing vertical slice and gather product feedback before moving further into the less certain Wave 6 and Wave 7 areas.

The web UI must:

- support both a public player-facing library and an authenticated developer console
- stay aligned with the repository's API-first architecture
- remain responsive on desktop, tablet, and mobile
- avoid risky browser-side token handling
- use Tailwind CSS for faster layout and styling work

## Decision

The first web UI will be built as a **single Blazor Web App on .NET 10** with **Tailwind CSS** and a **server-mediated authentication/session model**.

Specific decisions:

- **App topology:** one web app containing the public library, developer console, and account routes
- **Framework:** Blazor Web App
- **Target framework:** `net10.0`
- **Rendering approach:** server-first rendering for public routes, with interactivity added per page or component where needed
- **Developer surface interactivity:** interactive server components for form-heavy management flows
- **Authentication model:** backend-for-frontend style session handling with secure cookies, not browser-persisted access tokens
- **Styling approach:** Tailwind CSS with a small design-token layer and curated SVG icons

## Rationale

### One app instead of two

One app is the right default here because:

- the public and developer experiences depend on the same domain data
- account and auth state can be shared cleanly
- deployment, hosting, routing, and branding remain simpler
- the product is still early enough that separate app boundaries would create overhead without clear payoff

We can still preserve internal separation through route groups, layouts, services, and feature folders.

### Blazor Web App instead of a separate JavaScript-first stack

Blazor is the pragmatic fit because:

- it keeps the implementation inside the team's existing .NET investment
- it fits the repo's established technology direction
- it avoids splitting the project into C# backend plus a separate dominant frontend ecosystem
- it supports hybrid rendering patterns suitable for both public pages and interactive tooling

### Server-first rendering for public routes

The public catalog benefits from server-first rendering because:

- the first paint is fast
- direct links to organizations and titles work naturally
- pages remain useful even when JavaScript hydration is delayed
- the catalog experience is closer to content browsing than to an app-like dashboard

### Server-mediated auth instead of browser token storage

The current API auth surface returns tokens from the callback endpoint, but for a web client we choose to handle the callback server-side and convert that into a secure application session.

This reduces risk and complexity by:

- avoiding access-token and refresh-token storage in `localStorage` or similar browser persistence
- keeping token refresh concerns off the browser client
- making auth-aware page rendering simpler

## Consequences

### Positive

- stronger alignment with the existing repo direction
- simpler development workflow for a .NET-focused codebase
- safer authentication handling for the browser app
- a single user-facing product surface with shared navigation and identity context

### Negative

- the web UI will not be a static-only deployable artifact
- interactive server components add server connection/state considerations
- some frontend libraries and examples in the broader web ecosystem will be React-first, so equivalent Blazor patterns will sometimes need more deliberate selection

## Follow-Up

Near-term follow-up items created by this decision:

1. Scaffold the frontend as a Blazor Web App.
2. Add Tailwind CSS build tooling and a design-token layer.
3. Implement a public shell and a developer shell.
4. Add session-based sign-in and sign-out flow handling.
5. Extend the API contract for stronger catalog browse support, starting with genre filtering or sorting and pagination metadata.
