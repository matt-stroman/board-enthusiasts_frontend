# board_third-party-lib_frontend

A frontend interface for Board Third Party Library users to browse the catalog and for developers to manage their organizations and titles.

Planning artifacts for the web UI live in [`planning/`](planning/README.md).

## Current Structure

- `Board.ThirdPartyLibrary.Frontend.slnx`: frontend solution
- `src/Board.ThirdPartyLibrary.Frontend.Web/`: Blazor Web App
- `tests/Board.ThirdPartyLibrary.Frontend.Web.Tests/`: route smoke tests
- `planning/`: frontend planning, ADRs, and wireframes

## Local Workflow

Install frontend dependencies once:

```bash
npm install
```

Build Tailwind CSS:

```bash
npm run css:build
```

Run the web app:

```bash
npm run start
```

For authenticated flows such as `/signin`, local Keycloak must be running on `https://localhost:8443`, the backend API must be available on `https://localhost:7085`, the frontend should be served locally at `https://localhost:7277`, and local registration/verification emails are captured in Mailpit at `https://localhost:8025`.
From the repo root, the simplest setup is:

```bash
python ./scripts/dev.py web --watch-css
```

Run the frontend tests:

```bash
npm run test
```
