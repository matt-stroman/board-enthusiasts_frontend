# Web UI MVP Brief

## Table of Contents

- [Purpose](#purpose)
- [Product Scope](#product-scope)
- [Recommended Technical Direction](#recommended-technical-direction)
- [Rendering And Authentication Model](#rendering-and-authentication-model)
- [UX Direction](#ux-direction)
- [Information Architecture](#information-architecture)
- [MVP Route Map](#mvp-route-map)
- [Data Fetching And Caching Strategy](#data-fetching-and-caching-strategy)
- [Loading, Error, And Empty States](#loading-error-and-empty-states)
- [Acquisition UX Direction](#acquisition-ux-direction)
- [Accessibility And Media Rules](#accessibility-and-media-rules)
- [Testing Baseline](#testing-baseline)
- [Required Backend Follow-Ups](#required-backend-follow-ups)
- [Recommended Implementation Order](#recommended-implementation-order)

## Purpose

This document captures the agreed MVP direction for the first browser-based UI for Board Third Party Library.

It converts current product discussion into an implementation-ready brief for the initial web client.

## Product Scope

The MVP web UI is one application with two user-facing surfaces:

- a public library experience for players and general browsing
- an authenticated developer console for organizations, titles, releases, media, and acquisition setup

Wave 6 commerce and Wave 7 Board-native install flows remain out of scope for this web MVP.

## Recommended Technical Direction

Recommended stack:

- **Framework:** Blazor Web App on .NET 10
- **Styling:** Tailwind CSS with a small design-token layer for colors, spacing, type, radius, and motion
- **Icons:** curated SVG subset from Glyph Icons Pro
- **Hosting model:** one deployed web app, separate from the backend API, consuming the existing API contract

Why this is the pragmatic fit here:

- it stays aligned with the repo's current .NET-first direction
- it avoids introducing a second dominant language/runtime stack for the team
- it supports a single app containing both public and authenticated surfaces cleanly
- it works well with server-mediated authentication, which is the safer fit for web

## Rendering And Authentication Model

Recommended rendering model:

- render public catalog routes server-first for fast first paint, direct-link friendliness, and sharable detail pages
- add interactivity only where the page benefits from it, such as catalog browsing controls, carousels, and developer forms
- keep developer routes interactive, but still within the same app shell

Recommended auth model:

- treat the web app as a backend-for-frontend style client
- do not store access tokens or refresh tokens in browser local storage
- complete the login flow server-side, then maintain a secure application session cookie for the web app
- let the web app call the backend API on behalf of the signed-in user

This keeps the browser simpler and reduces token-handling risk.

## UX Direction

The public library should borrow the compelling parts of Board's first-party presentation without forcing Board's exact device UX onto every browser size.

Direction for the public surface:

- desktop and tablet should emphasize a large hero area with title art, title summary, metadata chips, and a horizontal card rail
- mobile should keep the same visual identity, but collapse to a stacked layout with a swipe-friendly rail and vertically prioritized detail content
- the first release should ship one primary browse mode inspired by Board's hero-plus-rail presentation
- a compact grid/list fallback can be added later if real usage shows a need

Direction for the developer surface:

- use a clean workspace layout optimized for efficiency, clarity, and low-friction CRUD work
- favor obvious sectioning, inline validation, and stable page structure over visual novelty
- keep actions near the data they affect

## Information Architecture

Information architecture is the app's content and navigation structure: which areas exist, what each area is responsible for, and how users move between them.

Recommended top-level structure:

- **Public library:** browse catalog, filter or sort content, and open a title details page
- **Developer console:** manage the signed-in user's organizations and the content belonging to those organizations
- **Account area:** view the current user, roles, Board profile, and sign-in state

Recommended primary navigation:

- `Library`
- `Develop`
- `Account`

Recommended developer console structure:

- organization overview
- organization settings
- memberships
- titles
- per-title workspace with tabs for overview, metadata, media, releases, artifacts, and acquisition

This keeps the user model simple:

- players stay in library routes
- developers move into a clearly separate management area
- shared account/profile concerns live outside both

## MVP Route Map

Recommended initial routes:

### Public routes

- `/`
  - landing page that immediately surfaces featured or recent catalog content
- `/library`
  - primary public catalog browse route
- `/library/:organizationSlug/:titleSlug`
  - public title detail route
- `/organizations/:slug`
  - public organization profile with that organization's visible titles

### Account routes

- `/account`
  - current user summary, roles, and sign-in status
- `/account/board-profile`
  - Board profile link or edit flow
- `/signin`
  - sign-in handoff route
- `/signout`
  - sign-out handoff route

### Developer routes

- `/develop`
  - developer home and organization switcher
- `/develop/organizations/new`
  - create organization
- `/develop/organizations/:organizationId`
  - organization overview
- `/develop/organizations/:organizationId/settings`
  - organization update and delete actions
- `/develop/organizations/:organizationId/memberships`
  - membership management
- `/develop/organizations/:organizationId/titles`
  - title list and create-title entry point
- `/develop/organizations/:organizationId/titles/new`
  - create title
- `/develop/titles/:titleId`
  - title overview
- `/develop/titles/:titleId/metadata`
  - current metadata editing and revision history entry point
- `/develop/titles/:titleId/media`
  - card, hero, and logo management
- `/develop/titles/:titleId/releases`
  - release list and release actions
- `/develop/titles/:titleId/acquisition`
  - title acquisition bindings
- `/develop/organizations/:organizationId/integrations`
  - reusable organization-level integration connections

Recommended initial navigation behavior:

- public routes use a consumer-facing shell
- developer routes use a workspace shell with persistent organization context
- when a developer belongs to multiple organizations, the active organization should be visible and easy to switch

## Data Fetching And Caching Strategy

The MVP should prefer predictable freshness over aggressive persistence.

Recommended approach:

- keep caching in memory for the current browser session only
- do not persist catalog API responses to local storage for MVP
- cache public catalog responses briefly and revalidate on navigation
- invalidate targeted cached data immediately after successful developer mutations
- use optimistic UI only for small, reversible interactions; prefer server-confirmed updates for title, release, and acquisition mutations

Suggested baseline freshness policy:

- public library lists and details: short-lived cache, around 30 to 60 seconds
- developer read models: fetch on route entry and refetch after mutations
- account/profile data: cache for the active session and refetch when auth state changes

This balances responsiveness against stale-data confusion while the platform is still evolving quickly.

## Loading, Error, And Empty States

Recommended standards:

- never freeze the entire page during a background request
- show skeletons for initial catalog loading
- show inline progress indicators for route-local operations
- disable only the action currently being submitted, not the whole screen
- keep previous data visible during refreshes when practical
- use inline field validation for form problems and toast/banner messaging for operation results

MVP-specific behaviors:

- public library empty state should explain why no titles are shown and suggest clearing filters
- developer empty states should include the next obvious action, such as creating an organization or first title
- auth failures should route users to sign-in with a clear return path
- 403 and 404 states in developer routes should be distinct so membership problems are not confused with missing resources

## Acquisition UX Direction

The acquisition workflow should stay intentionally generic in the MVP.

Recommended developer flow:

- choose an existing organization-level connection or create one in context
- prefer supported publisher presets first
- allow a custom publisher fallback when no supported preset fits
- for each title, designate one primary active external acquisition destination

Recommended public flow:

- show one primary acquisition action on the title detail page
- label the action using the configured binding label when present
- show provider identity when it helps the player understand where they are going
- open external purchase/download destinations clearly as outbound actions

This fits the current backend contract and avoids overfitting the UI to provider capabilities that are still uncertain.

## Accessibility And Media Rules

Baseline accessibility rules:

- keyboard-accessible navigation and interactive controls
- visible focus states
- no motion that is required to understand page state
- respect reduced-motion preferences
- strong contrast for text over artwork-heavy hero backgrounds
- touch targets sized for tablet and phone use

Baseline media rules:

- `altText` is required for all card, hero, and logo assets in the UI workflow
- missing media should render with intentional fallbacks, not broken-image boxes
- the UI should preview cropping and layout behavior before save when possible
- exact recommended dimensions should be decided with mockups before implementation hardens them into validation rules

## Testing Baseline

Recommended minimum test coverage for the web UI:

- component tests for navigation, auth guards, and key presentation states
- integration tests for API client and session/auth flows
- end-to-end browser tests for critical paths

Critical MVP end-to-end paths:

- public library browse to title detail
- sign-in and sign-out
- create organization
- create title
- update title metadata
- manage media
- create and publish release metadata
- manage acquisition connection and title binding

## Required Backend Follow-Ups

The current API surface is good enough to start UI scaffolding, but at least these contract additions should be planned before the public library is treated as complete:

### Required before catalog UX is considered feature-complete

- add public catalog sorting and filtering support for genre

### Strongly recommended next

- add pagination or an explicit capped result contract for `GET /catalog`
- add explicit sort options for public catalog browsing beyond genre if the list is expected to grow quickly
- consider text search once the catalog has enough volume for it to matter

Notes on current pressure points:

- `GET /catalog` currently filters only by `organizationSlug` and `contentKind`
- public catalog list responses do not yet expose pagination metadata
- media is URL-based today, so the frontend cannot yet offer first-party uploads

## Recommended Implementation Order

1. Create a frontend ADR confirming Blazor Web App, Tailwind CSS, and server-mediated auth/session handling for the web app.
2. Add frontend scaffolding with app shells for public, developer, and account areas.
3. Implement sign-in, sign-out, and current-user session handling.
4. Implement public library list and title detail routes against the existing API.
5. Add the developer console shell and organization switcher.
6. Implement organization CRUD and memberships.
7. Implement title CRUD and metadata management.
8. Implement media management with required alt text.
9. Implement release and artifact management.
10. Implement integration connections and title acquisition binding management.
11. Add end-to-end tests for the critical flows.
12. Tighten API contracts for catalog sorting, filtering, and pagination based on the first public UI pass.
