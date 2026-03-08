import type { CurrentUserResponse } from "@board-enthusiasts/migration-contract";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const authState = vi.hoisted(() => ({
  value: {
    session: null as { access_token: string } | null,
    currentUser: null as CurrentUserResponse | null,
    loading: false,
    authError: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refreshCurrentUser: vi.fn(),
  },
}));

const apiMocks = vi.hoisted(() => ({
  listPublicStudios: vi.fn(),
  listCatalogTitles: vi.fn(),
  getPublicStudio: vi.fn(),
  getCatalogTitle: vi.fn(),
  getUserProfile: vi.fn(),
  getDeveloperEnrollment: vi.fn(),
  updateUserProfile: vi.fn(),
  enrollAsDeveloper: vi.fn(),
  listManagedStudios: vi.fn(),
  createStudio: vi.fn(),
  updateStudio: vi.fn(),
  deleteStudio: vi.fn(),
  listStudioLinks: vi.fn(),
  createStudioLink: vi.fn(),
  updateStudioLink: vi.fn(),
  deleteStudioLink: vi.fn(),
  uploadStudioMedia: vi.fn(),
  searchModerationDevelopers: vi.fn(),
  getVerifiedDeveloperState: vi.fn(),
  setVerifiedDeveloperState: vi.fn(),
}));

vi.mock("./config", () => ({
  readAppConfig: () => ({
    apiBaseUrl: "http://127.0.0.1:8787",
    supabaseUrl: "http://127.0.0.1:54321",
    supabaseAnonKey: "anon-key",
  }),
}));

vi.mock("./auth", () => ({
  useAuth: () => authState.value,
  hasPlatformRole: (roles: string[], required: "player" | "developer" | "moderator") => {
    if (required === "player") {
      return roles.length > 0;
    }

    if (required === "developer") {
      return ["developer", "verified_developer", "moderator", "admin", "super_admin"].some((role) => roles.includes(role));
    }

    return ["moderator", "admin", "super_admin"].some((role) => roles.includes(role));
  },
}));

vi.mock("./api", () => apiMocks);

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Wave 3 App", () => {
  beforeEach(() => {
    authState.value = {
      session: null,
      currentUser: null,
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    Object.values(apiMocks).forEach((mockFn) => mockFn.mockReset());
    apiMocks.listPublicStudios.mockResolvedValue({ studios: [] });
    apiMocks.listCatalogTitles.mockResolvedValue({ titles: [], paging: { pageNumber: 1, pageSize: 100, totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false } });
    apiMocks.listManagedStudios.mockResolvedValue({ studios: [] });
    apiMocks.listStudioLinks.mockResolvedValue({ links: [] });
    apiMocks.searchModerationDevelopers.mockResolvedValue({ developers: [] });
  });

  it("renders browse results from the maintained catalog surface", async () => {
    apiMocks.listCatalogTitles.mockResolvedValue({
      titles: [
        {
          id: "title-1",
          studioId: "studio-1",
          studioSlug: "blue-harbor-games",
          slug: "lantern-drift",
          contentKind: "game",
          lifecycleStatus: "published",
          visibility: "listed",
          isReported: false,
          currentMetadataRevision: 2,
          displayName: "Lantern Drift",
          shortDescription: "Guide glowing paper boats through midnight canals.",
          genreDisplay: "Puzzle, Family",
          minPlayers: 1,
          maxPlayers: 4,
          playerCountDisplay: "1-4 players",
          ageRatingAuthority: "ESRB",
          ageRatingValue: "E",
          minAgeYears: 6,
          ageDisplay: "ESRB E",
          cardImageUrl: null,
          acquisitionUrl: "https://example.com/lantern-drift",
        },
      ],
      paging: { pageNumber: 1, pageSize: 100, totalCount: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
    });

    renderApp("/browse");

    expect(await screen.findByRole("heading", { name: "Browse" })).toBeVisible();
    expect(await screen.findByText("Lantern Drift")).toBeVisible();
    expect(apiMocks.listCatalogTitles).toHaveBeenCalledWith("http://127.0.0.1:8787");
  });

  it("redirects protected routes to sign in when unauthenticated", async () => {
    renderApp("/develop");

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(screen.getByDisplayValue("emma.torres@boardtpl.local")).toBeVisible();
  });

  it("auto-generates a studio slug from the display name", async () => {
    authState.value = {
      session: { access_token: "developer-token" },
      currentUser: {
        subject: "user-1",
        displayName: "Emma Torres",
        email: "emma.torres@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["player", "developer"],
      },
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    renderApp("/develop");

    await screen.findByRole("heading", { name: "Developer Console" });
    const createStudioPanel = screen.getByRole("heading", { name: "Create studio" }).closest("section");
    expect(createStudioPanel).not.toBeNull();

    const textboxes = within(createStudioPanel!).getAllByRole("textbox");
    const nameInput = textboxes[0]!;
    const slugInput = textboxes[1]!;

    await userEvent.type(nameInput, "Signal Harbor Studio");

    await waitFor(() => {
      expect(slugInput).toHaveValue("signal-harbor-studio");
    });
  });
});
