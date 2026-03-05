# Web UI Wireframes

## Purpose

These are low-fidelity wireframes for the initial web UI routes. They are intended to settle structure, hierarchy, and responsive behavior before visual mockups and implementation details harden.

They are intentionally schematic rather than pixel-accurate.

## Global Shells

### Public shell

Used by:

- `/`
- `/library`
- `/player/library`
- `/player/wishlist`
- `/library/:organizationSlug/:titleSlug`
- `/organizations/:slug`
- `/account`
- `/account/board-profile`

Desktop structure:

```text
+----------------------------------------------------------------------------------+
| Brand | Library | Developers | Account/Login                           Search   |
+----------------------------------------------------------------------------------+
| Page content                                                                    |
|                                                                                  |
|                                                                                  |
+----------------------------------------------------------------------------------+
| Footer: links / help / legal / API                                               |
+----------------------------------------------------------------------------------+
```

Mobile structure:

```text
+--------------------------------------+
| Brand                      Menu/Search|
+--------------------------------------+
| Page content                         |
|                                      |
+--------------------------------------+
```

### Developer shell

Used by:

- `/develop/organizations/*`
- `/develop/titles/*`

Desktop structure:

```text
+----------------------------------------------------------------------------------+
| Brand | Develop | Library | Account                                              |
+----------------------------------------------------------------------------------+
| Org switcher | Section nav | Main workspace                              Actions |
|              |             |                                                      |
|              |             |                                                      |
|              |             |                                                      |
+----------------------------------------------------------------------------------+
```

Mobile structure:

```text
+--------------------------------------+
| Brand                     Menu/Profile|
+--------------------------------------+
| Active org                           |
+--------------------------------------+
| Section nav tabs / select            |
+--------------------------------------+
| Main workspace                       |
+--------------------------------------+
```

## Route Wireframes

## `/`

Goal:

- immediately communicate what the library is
- surface strong visual catalog content
- give both players and developers a clear next action

Desktop:

```text
+----------------------------------------------------------------------------------+
| Header                                                                           |
+----------------------------------------------------------------------------------+
| Hero title / copy                | Featured title art                            |
| Browse library button            |                                               |
| Developer sign-in button         |                                               |
+----------------------------------------------------------------------------------+
| Featured rail                                                                       |
| [card] [card] [card] [card] [card]                                                 |
+----------------------------------------------------------------------------------+
| Browse by kind: [Games] [Apps]                                                    |
+----------------------------------------------------------------------------------+
| Recently updated titles                                                           |
| [wide card] [wide card] [wide card]                                               |
+----------------------------------------------------------------------------------+
```

Mobile:

```text
+--------------------------------------+
| Header                               |
+--------------------------------------+
| Hero copy                            |
| Browse library                       |
| Developer sign-in                    |
+--------------------------------------+
| Featured rail                        |
| [card][card][card]                   |
+--------------------------------------+
| Browse by kind                       |
+--------------------------------------+
| Recently updated                     |
| [stacked card]                       |
| [stacked card]                       |
+--------------------------------------+
```

## `/library`

Goal:

- deliver the Board-inspired browse experience in a web-appropriate layout

Desktop:

```text
+----------------------------------------------------------------------------------+
| Header                                                                           |
+----------------------------------------------------------------------------------+
| Filters: Kind | Genre | Org | Sort | Clear                                       |
+----------------------------------------------------------------------------------+
| Hero spotlight for selected title                                                |
| +--------------------------------------+----------------------------------------+ |
| | Metadata chips                        | Hero art                               | |
| | Display name                          |                                        | |
| | Short description                     |                                        | |
| | Primary action                        |                                        | |
| +--------------------------------------+----------------------------------------+ |
+----------------------------------------------------------------------------------+
| Horizontal title rail                                                            |
| [card][card][card][card][card][card][card]                                      |
+----------------------------------------------------------------------------------+
| Pagination / load more                                                           |
+----------------------------------------------------------------------------------+
```

Mobile:

```text
+--------------------------------------+
| Header                               |
+--------------------------------------+
| Filter drawer button | Sort          |
+--------------------------------------+
| Hero art                             |
| Metadata chips                       |
| Title                                |
| Short description                    |
| Primary action                       |
+--------------------------------------+
| Swipe rail                           |
| [card][card][card]                   |
+--------------------------------------+
| More titles                          |
+--------------------------------------+
```

Notes:

- on desktop and tablet, the rail selects which title is spotlighted
- on mobile, the selected title remains visible above the rail, but layout becomes vertical
- the first implementation should keep one primary browse mode instead of adding multiple view toggles

## `/library/:organizationSlug/:titleSlug`

Goal:

- provide a media-rich title details page with a clear acquisition action

Desktop:

```text
+----------------------------------------------------------------------------------+
| Breadcrumbs                                                                      |
+----------------------------------------------------------------------------------+
| Logo | Title | Metadata chips                                                    |
| Short description                                                                |
| Primary acquisition button                                                       |
| Secondary provider info                                                          |
+----------------------------------------------------------------------------------+
| Large hero media                                                                 |
+----------------------------------------------------------------------------------+
| About                                                                            |
| Full description                                                                 |
+----------------------------------------------------------------------------------+
| Media gallery                                                                    |
| [card art] [hero art] [logo]                                                     |
+----------------------------------------------------------------------------------+
| Current release summary | Organization summary                                   |
+----------------------------------------------------------------------------------+
```

Mobile:

```text
+--------------------------------------+
| Breadcrumbs                          |
+--------------------------------------+
| Hero art                             |
| Title                                |
| Metadata chips                       |
| Primary acquisition                  |
| Provider info                        |
+--------------------------------------+
| About                                |
+--------------------------------------+
| Media gallery                        |
+--------------------------------------+
| Current release                      |
+--------------------------------------+
```

## `/organizations/:slug`

Goal:

- showcase a publisher/developer organization and its visible catalog

Desktop:

```text
+----------------------------------------------------------------------------------+
| Org logo | Org name                                                              |
| Org description                                                                  |
+----------------------------------------------------------------------------------+
| Visible titles                                                                   |
| [card][card][card][card]                                                         |
+----------------------------------------------------------------------------------+
```

## `/account`

Goal:

- show sign-in state and current-user identity clearly without exposing backend role codes

```text
+----------------------------------------------+
| Account                                      |
+----------------------------------------------+
| Display name                                 |
| Email                                        |
| Player access                                |
| Developer access                             |
| Board profile status                         |
| Sign out                                     |
+----------------------------------------------+
```

## `/account/board-profile`

Goal:

- let the user view, add, update, or remove Board profile linkage

```text
+------------------------------------------------------+
| Board profile                                        |
+------------------------------------------------------+
| State: linked / not linked                           |
| boardUserId                                          |
| displayName                                          |
| avatarUrl                                            |
| Save                                                 |
| Remove link                                          |
+------------------------------------------------------+
```

## `/player/library`

Goal:

- make the authenticated player library the default post-sign-in landing route

```text
+----------------------------------------------------------------------------------+
| Player library                                                                   |
+----------------------------------------------------------------------------------+
| Signed-in player summary | planned owned titles                                  |
+----------------------------------------------------------------------------------+
| Planned cards: owned titles | collections | favorites                            |
+----------------------------------------------------------------------------------+
```

## `/player/wishlist`

Goal:

- reserve the authenticated route where wishlist entries will live later

```text
+----------------------------------------------------------------------------------+
| Wishlist                                                                         |
+----------------------------------------------------------------------------------+
| Empty-state explanation                                                          |
| CTA back to public library                                                       |
+----------------------------------------------------------------------------------+
```

## `/develop`

Goal:

- act as a developer onboarding gate for players and orient enabled developers quickly

Desktop:

```text
+----------------------------------------------------------------------------------+
| Active organization picker                                                       |
+----------------------------------------------------------------------------------+
| Quick actions: New organization | New title | Manage integrations                |
+----------------------------------------------------------------------------------+
| Organizations summary                                                            |
| [org card] [org card] [org card]                                                 |
+----------------------------------------------------------------------------------+
| Recent developer activity placeholders                                           |
+----------------------------------------------------------------------------------+
```

Player-only state:

```text
+----------------------------------------------------------------------------------+
| Register as a developer                                                          |
+----------------------------------------------------------------------------------+
| Player-first explanation                                                         |
| Current status: not requested / pending / rejected                               |
| CTA: submit registration request                                                 |
+----------------------------------------------------------------------------------+
```

## `/moderation/developer-enrollment-requests`

Goal:

- give moderators a single queue for reviewing developer registrations with fast filters and in-thread follow-up actions

```text
+----------------------------------------------------------------------------------+
| Developer enrollment queue                                                       |
+----------------------------------------------------------------------------------+
| KPI strip: pending | awaiting applicant | reviewed                               |
| Filter pills: all | waiting on moderators | waiting on applicants | reviewed     |
+----------------------------------------------------------------------------------+
| [request card] applicant | requested at | approve | reject | request info        |
| [request card] thread history | attachments | reviewed state                      |
+----------------------------------------------------------------------------------+
```

## `/develop/organizations/:organizationId`

Goal:

- provide the organization home for all related management tasks

```text
+----------------------------------------------------------------------------------+
| Org header: name, slug, description                                              |
+----------------------------------------------------------------------------------+
| Tabs: Overview | Settings | Memberships | Titles | Integrations                  |
+----------------------------------------------------------------------------------+
| KPI strip: titles count | members count | active integrations                    |
+----------------------------------------------------------------------------------+
| Recent titles / shortcuts                                                        |
+----------------------------------------------------------------------------------+
```

## `/develop/organizations/:organizationId/titles`

Goal:

- let developers find and enter a title workspace quickly

```text
+----------------------------------------------------------------------------------+
| Titles                                                   [Create title]          |
+----------------------------------------------------------------------------------+
| Filter/search later                                                               |
+----------------------------------------------------------------------------------+
| [Title row/card] status visibility release acquisition                            |
| [Title row/card] status visibility release acquisition                            |
| [Title row/card] status visibility release acquisition                            |
+----------------------------------------------------------------------------------+
```

## `/develop/organizations/:organizationId/titles/new`

Goal:

- create a title with the minimum required initial metadata

```text
+----------------------------------------------------------------------------------+
| New title                                                                        |
+----------------------------------------------------------------------------------+
| Slug                                                                             |
| Content kind                                                                     |
| Lifecycle status                                                                 |
| Visibility                                                                       |
| Initial metadata                                                                 |
| - display name                                                                   |
| - short description                                                              |
| - description                                                                    |
| - genre display                                                                  |
| - min/max players                                                                |
| - age rating authority/value/min age                                             |
| Save                                                                             |
+----------------------------------------------------------------------------------+
```

## `/develop/titles/:titleId`

Goal:

- show the title's current status and the next actions

```text
+----------------------------------------------------------------------------------+
| Title header: display name, slug, lifecycle, visibility                          |
+----------------------------------------------------------------------------------+
| Tabs: Overview | Metadata | Media | Releases | Acquisition                       |
+----------------------------------------------------------------------------------+
| Current metadata summary                                                         |
| Current release summary                                                          |
| Current acquisition summary                                                      |
+----------------------------------------------------------------------------------+
```

## `/develop/titles/:titleId/metadata`

Goal:

- manage current metadata and revision history

```text
+----------------------------------------------------------------------------------+
| Current metadata editor                                                          |
+----------------------------------------------------------------------------------+
| Form fields                                                                      |
+----------------------------------------------------------------------------------+
| Save draft / save changes                                                        |
+----------------------------------------------------------------------------------+
| Revision history                                                                 |
| [rev 3 current] [activate]                                                       |
| [rev 2] [activate]                                                               |
| [rev 1] [activate]                                                               |
+----------------------------------------------------------------------------------+
```

## `/develop/titles/:titleId/media`

Goal:

- manage the three fixed media slots with required alt text

```text
+----------------------------------------------------------------------------------+
| Media slots                                                                      |
+----------------------------------------------------------------------------------+
| Card asset                                                                       |
| sourceUrl | altText | width | height                                             |
| preview                                                                          |
| save / delete                                                                    |
+----------------------------------------------------------------------------------+
| Hero asset                                                                       |
| sourceUrl | altText | width | height                                             |
| preview                                                                          |
| save / delete                                                                    |
+----------------------------------------------------------------------------------+
| Logo asset                                                                       |
| sourceUrl | altText | width | height                                             |
| preview                                                                          |
| save / delete                                                                    |
+----------------------------------------------------------------------------------+
```

## `/develop/titles/:titleId/releases`

Goal:

- manage release history and active release state

```text
+----------------------------------------------------------------------------------+
| Releases                                                     [Create release]    |
+----------------------------------------------------------------------------------+
| Release rows/cards: version | status | metadata revision | published date        |
| Actions: view | update draft | publish | activate | withdraw                     |
+----------------------------------------------------------------------------------+
| Selected release detail                                                           |
| Artifact rows                                                                     |
+----------------------------------------------------------------------------------+
```

## `/develop/organizations/:organizationId/integrations`

Goal:

- manage reusable organization-level publisher connections

```text
+----------------------------------------------------------------------------------+
| Integration connections                                       [New connection]   |
+----------------------------------------------------------------------------------+
| Supported publisher or custom publisher                                             |
| isEnabled | summary | edit | delete                                              |
+----------------------------------------------------------------------------------+
```

## `/develop/titles/:titleId/acquisition`

Goal:

- attach a title to one or more integration connections and select the primary one

```text
+----------------------------------------------------------------------------------+
| Acquisition bindings                                         [New binding]       |
+----------------------------------------------------------------------------------+
| Binding rows: provider | acquisition URL | primary | enabled | edit | delete     |
+----------------------------------------------------------------------------------+
| Public preview: primary button label and provider display                          |
+----------------------------------------------------------------------------------+
```

## Responsive Notes

- The public library's Board-inspired hero-plus-rail layout should be preserved on larger screens where it adds drama and browsing clarity.
- Below tablet widths, content should stack vertically and place the primary action above lower-priority supporting details.
- Developer workflows should prioritize dense clarity over decorative layout shifts.
- No controller-specific interaction patterns are required for this web UI.
