import type { CurrentUserResponse } from "@board-enthusiasts/migration-contract";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { mockRasterImageProcessing } from "./test/image-processing";

const fallbackAuthClient = vi.hoisted(() => ({
  auth: {
    updateUser: vi.fn(),
    signInWithPassword: vi.fn(),
    mfa: {
      getAuthenticatorAssuranceLevel: vi.fn(),
      listFactors: vi.fn(),
      challengeAndVerify: vi.fn(),
      enroll: vi.fn(),
      unenroll: vi.fn(),
    },
  },
}));

const authState = vi.hoisted(() => ({
  value: {
    session: null as { access_token: string; user?: { email?: string; new_email?: string } } | null,
    currentUser: null as CurrentUserResponse | null,
    loading: false,
    authError: null,
    client: {
      auth: {
        updateUser: vi.fn(),
        signInWithPassword: vi.fn(),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn(),
          listFactors: vi.fn(),
          challengeAndVerify: vi.fn(),
          enroll: vi.fn(),
          unenroll: vi.fn(),
        },
      },
    },
    signIn: vi.fn(),
    signUp: vi.fn(),
    requestPasswordReset: vi.fn(),
    verifyEmailCode: vi.fn(),
    verifyRecoveryCode: vi.fn(),
    updatePassword: vi.fn(),
    signOut: vi.fn(),
    refreshCurrentUser: vi.fn(),
  } as any,
}));

const apiMocks = vi.hoisted(() => ({
  createMarketingSignup: vi.fn(),
  createSupportIssueReport: vi.fn(),
  getBoardProfile: vi.fn(),
  listPublicStudios: vi.fn(),
  listCatalogTitles: vi.fn(),
  getPublicStudio: vi.fn(),
  getCatalogTitle: vi.fn(),
  listGenres: vi.fn(),
  listAgeRatingAuthorities: vi.fn(),
  getUserNameAvailability: vi.fn(),
  getUserProfile: vi.fn(),
  getDeveloperEnrollment: vi.fn(),
  getCurrentUserNotifications: vi.fn(),
  markCurrentUserNotificationRead: vi.fn(),
  getPlayerLibrary: vi.fn(),
  addTitleToPlayerLibrary: vi.fn(),
  removeTitleFromPlayerLibrary: vi.fn(),
  getPlayerWishlist: vi.fn(),
  addTitleToPlayerWishlist: vi.fn(),
  removeTitleFromPlayerWishlist: vi.fn(),
  getPlayerTitleReports: vi.fn(),
  createPlayerTitleReport: vi.fn(),
  getPlayerTitleReport: vi.fn(),
  addPlayerTitleReportMessage: vi.fn(),
  updateUserProfile: vi.fn(),
  verifyCurrentUserPassword: vi.fn(),
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
  listStudioTitles: vi.fn(),
  createTitle: vi.fn(),
  getDeveloperTitle: vi.fn(),
  updateTitle: vi.fn(),
  activateTitle: vi.fn(),
  archiveTitle: vi.fn(),
  unarchiveTitle: vi.fn(),
  deleteTitle: vi.fn(),
  upsertTitleMetadata: vi.fn(),
  getTitleMetadataVersions: vi.fn(),
  activateTitleMetadataVersion: vi.fn(),
  getTitleMediaAssets: vi.fn(),
  upsertTitleMediaAsset: vi.fn(),
  uploadTitleMediaAsset: vi.fn(),
  deleteTitleMediaAsset: vi.fn(),
  getDeveloperTitleReports: vi.fn(),
  getDeveloperTitleReport: vi.fn(),
  addDeveloperTitleReportMessage: vi.fn(),
  getTitleReleases: vi.fn(),
  createTitleRelease: vi.fn(),
  updateTitleRelease: vi.fn(),
  activateTitleRelease: vi.fn(),
  getStudioIntegrationConnections: vi.fn(),
  createStudioIntegrationConnection: vi.fn(),
  getTitleIntegrationBindings: vi.fn(),
  createTitleIntegrationBinding: vi.fn(),
  updateTitleIntegrationBinding: vi.fn(),
  deleteTitleIntegrationBinding: vi.fn(),
  searchModerationDevelopers: vi.fn(),
  getVerifiedDeveloperState: vi.fn(),
  setVerifiedDeveloperState: vi.fn(),
  getModerationTitleReports: vi.fn(),
  getModerationTitleReport: vi.fn(),
  addModerationTitleReportMessage: vi.fn(),
  validateModerationTitleReport: vi.fn(),
  invalidateModerationTitleReport: vi.fn(),
}));

const configState = vi.hoisted(() => ({
  value: {
    apiBaseUrl: "http://127.0.0.1:8787",
    supabaseUrl: "http://127.0.0.1:55421",
    supabasePublishableKey: "publishable-key",
    turnstileSiteKey: null as string | null,
    landingMode: false,
  },
}));

vi.mock("./config", () => ({
  readAppConfig: () => configState.value,
}));

vi.mock("./auth", () => ({
  useAuth: () => ({
    client: authState.value.client ?? fallbackAuthClient,
    ...authState.value,
  }),
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

async function completeLocalAntiSpamCheck(scope: typeof screen | ReturnType<typeof within> = screen) {
  const checkbox = scope.queryByRole("checkbox", { name: /Local anti-spam check \(development only\)/i });
  if (checkbox && !(checkbox as HTMLInputElement).checked) {
    await userEvent.click(checkbox);
  }
}

function buildNearLimitCopy(segments: readonly string[], maxLength: number, reserve = 24): string {
  const cleanedSegments = segments.map((segment) => segment.trim()).filter(Boolean);
  let value = cleanedSegments.join(" ");
  const targetLength = Math.max(1, maxLength - reserve);

  if (value.length >= targetLength) {
    return value.slice(0, maxLength).trim();
  }

  let index = 0;
  while (value.length < targetLength) {
    value = `${value} ${cleanedSegments[index % cleanedSegments.length]}`.trim();
    index += 1;
  }

  return value.slice(0, maxLength).trim();
}

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    authState.value = {
      session: null,
      currentUser: null,
      loading: false,
      authError: null,
      client: {
        auth: {
          updateUser: vi.fn(),
          signInWithPassword: vi.fn(),
          mfa: {
            getAuthenticatorAssuranceLevel: vi.fn(),
            listFactors: vi.fn(),
            challengeAndVerify: vi.fn(),
            enroll: vi.fn(),
            unenroll: vi.fn(),
          },
        },
      },
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };
    configState.value = {
      apiBaseUrl: "http://127.0.0.1:8787",
      supabaseUrl: "http://127.0.0.1:55421",
      supabasePublishableKey: "publishable-key",
      turnstileSiteKey: null,
      landingMode: false,
    };

    Object.values(apiMocks).forEach((mockFn) => mockFn.mockReset());
    fallbackAuthClient.auth.updateUser.mockReset();
    fallbackAuthClient.auth.signInWithPassword.mockReset();
    fallbackAuthClient.auth.mfa.getAuthenticatorAssuranceLevel.mockReset();
    fallbackAuthClient.auth.mfa.listFactors.mockReset();
    fallbackAuthClient.auth.mfa.challengeAndVerify.mockReset();
    fallbackAuthClient.auth.mfa.enroll.mockReset();
    fallbackAuthClient.auth.mfa.unenroll.mockReset();
    authState.value.client.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
      error: null,
    });
    authState.value.client.auth.mfa.listFactors.mockResolvedValue({
      data: { all: [], totp: [] },
      error: null,
    });
    fallbackAuthClient.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
      error: null,
    });
    fallbackAuthClient.auth.mfa.listFactors.mockResolvedValue({
      data: { all: [], totp: [] },
      error: null,
    });
    apiMocks.listPublicStudios.mockResolvedValue({ studios: [] });
    apiMocks.listCatalogTitles.mockResolvedValue({ titles: [], paging: { pageNumber: 1, pageSize: 48, totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false } });
    apiMocks.listGenres.mockResolvedValue({
      genres: [
        { slug: "adventure", displayName: "Adventure" },
        { slug: "co-op", displayName: "Co-op" },
        { slug: "family", displayName: "Family" },
        { slug: "puzzle", displayName: "Puzzle" },
        { slug: "strategy", displayName: "Strategy" },
        { slug: "utility", displayName: "Utility" },
      ],
    });
    apiMocks.listAgeRatingAuthorities.mockResolvedValue({
      ageRatingAuthorities: [
        { code: "ESRB", displayName: "ESRB" },
        { code: "PEGI", displayName: "PEGI" },
        { code: "USK", displayName: "USK" },
        { code: "CERO", displayName: "CERO" },
        { code: "ACB", displayName: "ACB" },
      ],
    });
    apiMocks.getBoardProfile.mockResolvedValue({
      boardProfile: {
        boardUserId: "board_emma_torres",
        displayName: "Emma Torres",
        avatarUrl: null,
        linkedAt: "2026-03-08T12:00:00Z",
        lastSyncedAt: "2026-03-08T12:00:00Z",
      },
    });
    apiMocks.getUserNameAvailability.mockResolvedValue({
      userNameAvailability: {
        requestedUserName: "new.player",
        normalizedUserName: "new.player",
        available: true,
      },
    });
    apiMocks.getCurrentUserNotifications.mockResolvedValue({ notifications: [] });
    apiMocks.markCurrentUserNotificationRead.mockImplementation(async (_baseUrl: string, _token: string, notificationId: string) => ({
      notification: {
        id: notificationId,
        category: "title_report",
        title: "Notification",
        body: "Notification preview",
        actionUrl: "/player?workflow=reported-titles&reportId=report-1",
        isRead: true,
        readAt: "2026-03-08T12:05:00Z",
        createdAt: "2026-03-08T12:00:00Z",
        updatedAt: "2026-03-08T12:05:00Z",
      },
    }));
    apiMocks.getPlayerLibrary.mockResolvedValue({ titles: [] });
    apiMocks.getPlayerWishlist.mockResolvedValue({ titles: [] });
    apiMocks.getPlayerTitleReports.mockResolvedValue({ reports: [] });
    apiMocks.getModerationTitleReports.mockResolvedValue({ reports: [] });
    apiMocks.getDeveloperEnrollment.mockResolvedValue({
      developerEnrollment: {
        status: "not_enrolled",
        actionRequiredBy: "none",
        developerAccessEnabled: false,
        verifiedDeveloper: false,
        canSubmitRequest: true,
      },
    });
    apiMocks.listManagedStudios.mockResolvedValue({ studios: [] });
    apiMocks.listStudioLinks.mockResolvedValue({ links: [] });
    apiMocks.listStudioTitles.mockResolvedValue({ titles: [] });
    apiMocks.getTitleMetadataVersions.mockResolvedValue({ metadataVersions: [] });
    apiMocks.getTitleMediaAssets.mockResolvedValue({ mediaAssets: [] });
    apiMocks.getDeveloperTitleReports.mockResolvedValue({ reports: [] });
    apiMocks.getTitleReleases.mockResolvedValue({ releases: [] });
    apiMocks.getStudioIntegrationConnections.mockResolvedValue({ integrationConnections: [] });
    apiMocks.getTitleIntegrationBindings.mockResolvedValue({ integrationBindings: [] });
    apiMocks.searchModerationDevelopers.mockResolvedValue({ developers: [] });
  });

  function seedDeveloperWorkspace(): void {
    const studioDescription = buildNearLimitCopy(
      [
        "Blue Harbor Games builds cooperative adventures with approachable controls, readable interfaces, and strong living-room play support.",
        "Its public studio profile is expected to carry enough editorial copy, support context, and publishing detail to stress the real overview layout instead of looking fine only with placeholder content.",
        "The local developer workspace should be validated against this kind of fuller production-style copy so spacing, panel sizing, and content hierarchy problems surface immediately."
      ],
      1600,
    );
    const titleShortDescription = buildNearLimitCopy(
      [
        "Guide glowing paper boats through a midnight canal festival without snuffing the flame while coordinating routes, lantern colors, and crowd-safe pacing across every neighborhood bridge.",
        "This summary is intentionally close to the practical card limit."
      ],
      220,
      12,
    );
    const titleDescription = buildNearLimitCopy(
      [
        "Lantern Drift is a polished family puzzle adventure about redirecting currents, rotating lock-gates, and setting up cooperative route plans while the city prepares for its largest night market celebration.",
        "The metadata is intentionally long so the developer workspace, browse cards, and detail views have to accommodate a realistic amount of editorial copy, feature framing, and accessibility context.",
        "Studios use this area to explain session length, replay value, cooperative expectations, readability choices, and the practical difference between the current build and earlier revisions."
      ],
      1600,
    );

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
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    apiMocks.getDeveloperEnrollment.mockResolvedValue({
      developerEnrollment: {
        status: "enrolled",
        actionRequiredBy: "none",
        developerAccessEnabled: true,
        verifiedDeveloper: false,
        canSubmitRequest: true,
      },
    });
    apiMocks.listManagedStudios.mockResolvedValue({
      studios: [
        {
          id: "studio-1",
          slug: "blue-harbor-games",
          displayName: "Blue Harbor Games",
          description: studioDescription,
          avatarUrl: "/seed-catalog/studios/blue-harbor-games/avatar.svg",
          logoUrl: "/seed-catalog/studios/blue-harbor-games/logo.svg",
          bannerUrl: "/seed-catalog/studios/blue-harbor-games/banner.svg",
          role: "owner",
          links: [
            { id: "studio-link-1", label: "Website", url: "https://blue-harbor-games.example", createdAt: "2026-03-08T12:00:00Z", updatedAt: "2026-03-08T12:00:00Z" },
            { id: "studio-link-2", label: "Support", url: "https://blue-harbor-games.example/support", createdAt: "2026-03-08T12:00:00Z", updatedAt: "2026-03-08T12:00:00Z" },
            { id: "studio-link-3", label: "Discord", url: "https://discord.gg/blueharborgames", createdAt: "2026-03-08T12:00:00Z", updatedAt: "2026-03-08T12:00:00Z" },
          ],
        },
      ],
    });
    apiMocks.listStudioLinks.mockResolvedValue({
      links: [
        { id: "studio-link-1", label: "Website", url: "https://blue-harbor-games.example", createdAt: "2026-03-08T12:00:00Z", updatedAt: "2026-03-08T12:00:00Z" },
        { id: "studio-link-2", label: "Support", url: "https://blue-harbor-games.example/support", createdAt: "2026-03-08T12:00:00Z", updatedAt: "2026-03-08T12:00:00Z" },
        { id: "studio-link-3", label: "Discord", url: "https://discord.gg/blueharborgames", createdAt: "2026-03-08T12:00:00Z", updatedAt: "2026-03-08T12:00:00Z" },
      ],
    });
    apiMocks.listStudioTitles.mockResolvedValue({
      titles: [
        {
          id: "title-1",
          studioId: "studio-1",
          studioSlug: "blue-harbor-games",
          studioDisplayName: "Blue Harbor Games",
          slug: "lantern-drift",
          contentKind: "game",
          lifecycleStatus: "active",
          visibility: "listed",
          isReported: false,
          currentMetadataRevision: 3,
          displayName: "Lantern Drift",
          shortDescription: titleShortDescription,
          description: titleDescription,
          genreDisplay: "Adventure, Puzzle, Family",
          minPlayers: 1,
          maxPlayers: 4,
          ageRatingAuthority: "ESRB",
          ageRatingValue: "E10+",
          minAgeYears: 10,
          playerCountDisplay: "1-4 players",
          ageDisplay: "ESRB E10+",
          cardImageUrl: "/seed-catalog/lantern-drift/card.png",
          logoImageUrl: "/seed-catalog/lantern-drift/logo.png",
          acquisitionUrl: "https://blue-harbor-games.example/titles/lantern-drift",
        },
      ],
    });
    apiMocks.getDeveloperTitle.mockResolvedValue({
      title: {
        id: "title-1",
        studioId: "studio-1",
        studioSlug: "blue-harbor-games",
        slug: "lantern-drift",
        displayName: "Lantern Drift",
        shortDescription: titleShortDescription,
        description: titleDescription,
        genreSlugs: ["adventure", "puzzle", "family"],
        contentKind: "game",
        lifecycleStatus: "active",
        visibility: "listed",
        genreDisplay: "Adventure, Puzzle, Family",
        minPlayers: 1,
        maxPlayers: 4,
        ageRatingAuthority: "ESRB",
        ageRatingValue: "E10+",
        minAgeYears: 10,
        playerCountDisplay: "1-4 players",
        ageDisplay: "ESRB E10+",
        currentMetadataRevision: 3,
        acquisitionUrl: "https://blue-harbor-games.example/titles/lantern-drift",
        currentRelease: {
          id: "release-1",
          version: "1.0.0",
        },
      },
    });
    apiMocks.getTitleMetadataVersions.mockResolvedValue({
      metadataVersions: [
        {
          revisionNumber: 3,
          displayName: "Lantern Drift",
          shortDescription: titleShortDescription,
          description: titleDescription,
          genreSlugs: ["adventure", "puzzle", "family"],
          genreDisplay: "Adventure, Puzzle, Family",
          minPlayers: 1,
          maxPlayers: 4,
          playerCountDisplay: "1-4 players",
          ageRatingAuthority: "ESRB",
          ageRatingValue: "E10+",
          minAgeYears: 10,
          ageDisplay: "ESRB E10+",
          isFrozen: true,
          isCurrent: true,
          createdAt: "2026-03-08T12:00:00Z",
          updatedAt: "2026-03-08T12:00:00Z",
        },
      ],
    });
    apiMocks.getTitleMediaAssets.mockResolvedValue({
      mediaAssets: [
        {
          id: "media-1",
          mediaRole: "card",
          sourceUrl: "/seed-catalog/lantern-drift/card.png",
          altText: "Lantern Drift card art",
          mimeType: "image/png",
          width: 900,
          height: 1280,
          createdAt: "2026-03-08T12:00:00Z",
          updatedAt: "2026-03-08T12:00:00Z",
        },
        {
          id: "media-2",
          mediaRole: "hero",
          sourceUrl: "/seed-catalog/lantern-drift/hero.png",
          altText: "Lantern Drift hero art",
          mimeType: "image/png",
          width: 1600,
          height: 900,
          createdAt: "2026-03-08T12:00:00Z",
          updatedAt: "2026-03-08T12:00:00Z",
        },
        {
          id: "media-3",
          mediaRole: "logo",
          sourceUrl: "/seed-catalog/lantern-drift/logo.png",
          altText: "Lantern Drift logo",
          mimeType: "image/png",
          width: 1200,
          height: 400,
          createdAt: "2026-03-08T12:00:00Z",
          updatedAt: "2026-03-08T12:00:00Z",
        },
      ],
    });
    apiMocks.getDeveloperTitleReports.mockResolvedValue({ reports: [] });
    apiMocks.getTitleReleases.mockResolvedValue({
      releases: [
        {
          id: "release-1",
          version: "1.0.0",
          status: "production",
          isCurrent: true,
          createdAt: "2026-03-08T12:00:00Z",
          publishedAt: "2026-03-08T12:30:00Z",
        },
      ],
    });
    apiMocks.getStudioIntegrationConnections.mockResolvedValue({
      integrationConnections: [
        {
          id: "connection-1",
          supportedPublisher: { displayName: "itch.io", homepageUrl: "https://itch.io" },
          customPublisherDisplayName: null,
          customPublisherHomepageUrl: null,
          isEnabled: true,
        },
      ],
    });
    apiMocks.getTitleIntegrationBindings.mockResolvedValue({
      integrationBindings: [
        {
          id: "binding-1",
          integrationConnectionId: "connection-1",
          acquisitionUrl: "https://example.com/titles/lantern-drift",
          acquisitionLabel: "View on itch.io",
          isPrimary: true,
          isEnabled: true,
          integrationConnection: {
            id: "connection-1",
            supportedPublisher: { displayName: "itch.io", homepageUrl: "https://itch.io" },
            customPublisherDisplayName: null,
            customPublisherHomepageUrl: null,
            isEnabled: true,
          },
        },
      ],
    });
  }

  it("renders the live BE front door and signed-out shell navigation", async () => {
    renderApp("/");

    expect(await screen.findByRole("heading", { level: 1, name: "BE where the Board community shows up first." })).toBeVisible();
    expect(screen.getByText("For Board Players And Builders")).toBeVisible();
    expect(screen.getByText(/The BE Library is live/i)).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Browse Library" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Install" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Get Board" }).some((link) => link.getAttribute("href") === "https://board.fun/")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Join the Board Enthusiasts Discord" }).some((link) => link.getAttribute("href") === "https://discord.gg/cz2zReWqcA")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Sign In" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "BE Library" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "BE Discord" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "BE Emulator for Board" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Portfolio" })).toHaveAttribute("href", "https://mattstroman.com");
    expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", "https://www.linkedin.com/in/mattstromandev/");
    expect(screen.queryByRole("link", { name: "Player Sign In" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Developer Sign In" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join the list" })).not.toBeInTheDocument();
  });

  it("renders the signed-in account avatar in the shell and user menu", async () => {
    authState.value = {
      session: { access_token: "player-token" },
      currentUser: {
        subject: "user-1",
        displayName: "Emma Torres",
        email: "emma.torres@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["player"],
        avatarUrl: "https://cdn.boardenthusiasts.com/avatars/emma.png",
      },
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    renderApp("/");

    const avatarButton = screen.getByRole("button", { name: "Open account for player" });
    expect(within(avatarButton).getByRole("img", { name: "Emma Torres avatar" })).toHaveAttribute(
      "src",
      "https://cdn.boardenthusiasts.com/avatars/emma.png",
    );

    await userEvent.click(avatarButton);

    expect(screen.getAllByRole("img", { name: "Emma Torres avatar" })).toHaveLength(2);
  });

  it("renders the production landing mode surface when enabled", async () => {
    configState.value = {
      ...configState.value,
      landingMode: true,
    };

    renderApp("/");

    expect(await screen.findByRole("heading", { level: 1, name: "BE where the Board community shows up first." })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Get Board" }).some((link) => link.getAttribute("href") === "https://board.fun/")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Get Updates" }).every((link) => link.getAttribute("href") === "#signup")).toBe(true);
    expect(screen.getByRole("heading", { name: "BE App Launcher for Board" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "BE Emulator for Board" })).toBeVisible();
    expect(screen.getByText("For Developers")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "contact@boardenthusiasts.com" }).some((link) => link.getAttribute("href") === "mailto:contact@boardenthusiasts.com")).toBe(true);
    expect(screen.getByRole("button", { name: "Join the list" })).toBeVisible();
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Board Enthusiasts is an independent community project and is not affiliated with, endorsed by, or sponsored by Harris Hill Products, Inc. or Board.",
    );
    expect(screen.queryByRole("link", { name: "Browse" })).not.toBeInTheDocument();
  });

  it("submits the landing-page signup form", async () => {
    configState.value = {
      ...configState.value,
      landingMode: true,
    };
    apiMocks.createMarketingSignup.mockResolvedValue({
      accepted: true,
      duplicate: false,
      signup: {
        email: "matt@example.com",
        firstName: "Matt",
        status: "subscribed",
        lifecycleStatus: "waitlisted",
        roleInterests: ["player", "developer"],
        source: "landing_page",
        consentedAt: "2026-03-12T18:00:00Z",
        updatedAt: "2026-03-12T18:00:00Z",
      },
    });

    renderApp("/");

    await userEvent.type(await screen.findByPlaceholderText("Taylor"), "Matt");
    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "matt@example.com");
    await userEvent.click(screen.getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /I want to discover and follow new Board games and apps/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /I want to create third-party content for Board/i }));
    await completeLocalAntiSpamCheck();
    await userEvent.click(screen.getByRole("button", { name: "Join the list" }));

    await waitFor(() => {
      expect(apiMocks.createMarketingSignup).toHaveBeenCalledWith("http://127.0.0.1:8787", {
        email: "matt@example.com",
        firstName: "Matt",
        source: "landing_page",
        consentTextVersion: "landing-page-v1",
        turnstileToken: "local-development-turnstile-token",
        roleInterests: ["player", "developer"],
      });
    });
    expect(await screen.findByText(/You are on the list/i)).toBeVisible();
  });

  it("keeps first name optional, marks consent required, and enables submit after consent", async () => {
    configState.value = {
      ...configState.value,
      landingMode: true,
    };

    renderApp("/");

    expect(await screen.findByText("First name (optional)")).toBeVisible();
    expect(screen.getByText((content, node) => node?.textContent === "Email updates *")).toBeVisible();

    const submitButton = screen.getByRole("button", { name: "Join the list" });
    expect(submitButton).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    expect(submitButton).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i }));
    expect(submitButton).toBeEnabled();
  });

  it("allows clicking submit before turnstile completes and shows a helpful error", async () => {
    configState.value = {
      ...configState.value,
      landingMode: true,
      turnstileSiteKey: "turnstile-site-key",
    };

    renderApp("/");

    await userEvent.type(await screen.findByPlaceholderText("you@example.com"), "alex@example.com");
    await userEvent.click(screen.getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i }));
    await userEvent.click(screen.getByRole("button", { name: "Join the list" }));

    expect(await screen.findByText("Please complete the anti-spam check below and try again.")).toBeVisible();
    expect(apiMocks.createMarketingSignup).not.toHaveBeenCalled();
  });

  it("does not render the custom anti-spam panel while the turnstile widget is loading", async () => {
    configState.value = {
      ...configState.value,
      landingMode: true,
      turnstileSiteKey: "turnstile-site-key",
    };

    renderApp("/");

    expect(screen.queryByText("Anti-spam check")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading anti-spam check…")).not.toBeInTheDocument();
  });

  it("renders a local anti-spam simulator on loopback when no real turnstile key is configured", async () => {
    configState.value = {
      ...configState.value,
      landingMode: true,
      turnstileSiteKey: null,
    };

    renderApp("/");

    expect(await screen.findByRole("checkbox", { name: /Local anti-spam check \(development only\)/i })).toBeVisible();
  });

  it.each([
    {
      name: "submits with no explicit role interests",
      toggleLabels: [] as string[],
      expectedRoleInterests: [] as string[],
    },
    {
      name: "submits with only the player role interest",
      toggleLabels: ["I want to discover and follow new Board games and apps."],
      expectedRoleInterests: ["player"],
    },
    {
      name: "submits with only the developer role interest",
      toggleLabels: ["I want to create third-party content for Board."],
      expectedRoleInterests: ["developer"],
    },
  ])("$name", async ({ toggleLabels, expectedRoleInterests }) => {
    configState.value = {
      ...configState.value,
      landingMode: true,
    };
    apiMocks.createMarketingSignup.mockResolvedValue({
      accepted: true,
      duplicate: false,
      signup: {
        email: "alex@example.com",
        firstName: "Alex",
        status: "subscribed",
        lifecycleStatus: "waitlisted",
        roleInterests: expectedRoleInterests,
        source: "landing_page",
        consentedAt: "2026-03-12T18:00:00Z",
        updatedAt: "2026-03-12T18:00:00Z",
      },
    });

    renderApp("/");

    await userEvent.type(await screen.findByPlaceholderText("Taylor"), "Alex");
    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    await userEvent.click(screen.getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i }));
    for (const label of toggleLabels) {
      await userEvent.click(screen.getByRole("checkbox", { name: label }));
    }
    await completeLocalAntiSpamCheck();
    await userEvent.click(screen.getByRole("button", { name: "Join the list" }));

    await waitFor(() => {
      expect(apiMocks.createMarketingSignup).toHaveBeenCalledWith("http://127.0.0.1:8787", {
        email: "alex@example.com",
        firstName: "Alex",
        source: "landing_page",
        consentTextVersion: "landing-page-v1",
        turnstileToken: "local-development-turnstile-token",
        roleInterests: expectedRoleInterests,
      });
    });
  });

  it("lets the user one-click report a landing signup issue through the internal support endpoint", async () => {
    configState.value = {
      ...configState.value,
      landingMode: true,
    };
    apiMocks.createMarketingSignup.mockRejectedValue(new Error("Could not reach the Board Enthusiasts API."));
    apiMocks.createSupportIssueReport.mockResolvedValue({ accepted: true });

    renderApp("/");

    await userEvent.type(await screen.findByPlaceholderText("Taylor"), "Taylor");
    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "taylor@example.com");
    await userEvent.click(screen.getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i }));
    await completeLocalAntiSpamCheck();
    await userEvent.click(screen.getByRole("button", { name: "Join the list" }));

    expect(await screen.findByText(/We couldn't submit your signup right now/i)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Report the issue" }));

    await waitFor(() => {
      expect(apiMocks.createSupportIssueReport).toHaveBeenCalledWith(
        "http://127.0.0.1:8787",
        expect.objectContaining({
          category: "email_signup",
          firstName: "Taylor",
          email: "taylor@example.com",
          apiBaseUrl: "http://127.0.0.1:8787",
          errorMessage: "We couldn't submit your signup right now. Please try again, or report the issue and we'll help you out.",
          technicalDetails: expect.stringContaining("Could not reach the Board Enthusiasts API."),
        }),
      );
    });
    expect(await screen.findByText("Issue report sent. We'll take a look.")).toBeVisible();
    expect(screen.queryByText(/We couldn't submit your signup right now/i)).not.toBeInTheDocument();
  });

  it("falls back to a manual support email link when automatic issue reporting fails", async () => {
    configState.value = {
      ...configState.value,
      landingMode: true,
    };
    apiMocks.createMarketingSignup.mockRejectedValue(new Error("Could not reach the Board Enthusiasts API."));
    apiMocks.createSupportIssueReport.mockRejectedValue(new Error("Support report delivery failed."));

    renderApp("/");

    await userEvent.type(await screen.findByPlaceholderText("Taylor"), "Taylor");
    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "taylor@example.com");
    await userEvent.click(screen.getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i }));
    await completeLocalAntiSpamCheck();
    await userEvent.click(screen.getByRole("button", { name: "Join the list" }));
    await screen.findByText(/We couldn't submit your signup right now/i);

    await userEvent.click(screen.getByRole("button", { name: "Report the issue" }));

    expect(await screen.findByText("We couldn't send the issue report automatically right now.")).toBeVisible();
    expect(screen.queryByText(/We couldn't submit your signup right now/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email support instead" })).toHaveAttribute(
      "href",
      "mailto:support@boardenthusiasts.com?subject=%5BBug%20Report%5D%20Email%20signup%20issue",
    );
  });

  it("routes the landing shell updates link back to the signup section from privacy", async () => {
    configState.value = {
      ...configState.value,
      landingMode: true,
    };

    renderApp("/privacy");

    expect(await screen.findByRole("heading", { name: "Board Enthusiasts Privacy Snapshot" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Get Updates" }).every((link) => link.getAttribute("href") === "/#signup")).toBe(true);
  });

  it("opens title quick view from browse results without leaving the results page", async () => {
    apiMocks.listCatalogTitles.mockResolvedValue({
      titles: [
        {
          id: "title-1",
          studioId: "studio-1",
          studioSlug: "blue-harbor-games",
          studioDisplayName: "Blue Harbor Games",
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
          logoImageUrl: null,
          acquisitionUrl: "https://example.com/lantern-drift",
        },
      ],
      paging: { pageNumber: 1, pageSize: 48, totalCount: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
    });
    apiMocks.getCatalogTitle.mockResolvedValue({
      title: {
        id: "title-1",
        studioId: "studio-1",
        studioSlug: "blue-harbor-games",
        studioDisplayName: "Blue Harbor Games",
        slug: "lantern-drift",
        displayName: "Lantern Drift",
        shortDescription: "Guide glowing paper boats through midnight canals.",
        description: "Tilt waterways, spin lock-gates, and weave through fireworks across the river.",
        genreDisplay: "Puzzle, Family",
        contentKind: "game",
        visibility: "listed",
        lifecycleStatus: "published",
        isReported: false,
        currentMetadataRevision: 2,
        playerCountDisplay: "1-4 players",
        ageDisplay: "ESRB E",
        acquisitionUrl: "https://example.com/lantern-drift",
        logoImageUrl: null,
        acquisition: {
          url: "https://example.com/lantern-drift",
          label: "Open publisher page",
          providerDisplayName: "Blue Harbor Games Direct",
          providerHomepageUrl: "https://example.com",
        },
        currentRelease: {
          id: "release-1",
          titleId: "title-1",
          version: "1.0.0",
          status: "published",
          isCurrent: true,
          publishedAt: "2026-03-08T12:00:00Z",
          createdAt: "2026-03-08T12:00:00Z",
          updatedAt: "2026-03-08T12:00:00Z",
        },
        mediaAssets: [],
        updatedAt: "2026-03-08T12:00:00Z",
      },
    });

    renderApp("/browse");

    expect(await screen.findByRole("heading", { name: "Browse" })).toBeVisible();
    expect(await screen.findByText("Lantern Drift")).toBeVisible();
    expect(apiMocks.listCatalogTitles).toHaveBeenCalledWith("http://127.0.0.1:8787");

    await userEvent.click(screen.getByRole("button", { name: /lantern drift/i }));

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Lantern Drift" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Browse" })).toBeVisible();
    expect(apiMocks.getCatalogTitle).toHaveBeenCalledWith("http://127.0.0.1:8787", "blue-harbor-games", "lantern-drift", null);
  });

  it("applies the restored live studio-scoped search filters without leaving the studio page", async () => {
    apiMocks.getPublicStudio.mockResolvedValue({
      studio: {
        id: "studio-1",
        slug: "harborlight-mechanics",
        displayName: "Harborlight Mechanics",
        description: "Utility-driven support apps and polished tabletop helpers.",
        avatarUrl: null,
        logoUrl: null,
        bannerUrl: null,
        links: [],
        createdAt: "2026-03-08T12:00:00Z",
        updatedAt: "2026-03-08T12:00:00Z",
      },
    });
    apiMocks.listCatalogTitles.mockResolvedValue({
      titles: [
        {
          id: "title-1",
          studioId: "studio-1",
          studioSlug: "harborlight-mechanics",
          studioDisplayName: "Harborlight Mechanics",
          slug: "cinderline-workshop",
          contentKind: "game",
          lifecycleStatus: "published",
          visibility: "listed",
          isReported: false,
          currentMetadataRevision: 1,
          displayName: "Cinderline Workshop",
          shortDescription: "Restore traveling maker caravans.",
          genreDisplay: "Workshop, Crafting, Puzzle",
          minPlayers: 1,
          maxPlayers: 2,
          playerCountDisplay: "1-2 players",
          ageRatingAuthority: "ESRB",
          ageRatingValue: "E",
          minAgeYears: 6,
          ageDisplay: "ESRB E",
          cardImageUrl: null,
          logoImageUrl: null,
          acquisitionUrl: "https://example.com/cinderline-workshop",
        },
        {
          id: "title-2",
          studioId: "studio-1",
          studioSlug: "harborlight-mechanics",
          studioDisplayName: "Harborlight Mechanics",
          slug: "signal-harbor",
          contentKind: "app",
          lifecycleStatus: "published",
          visibility: "listed",
          isReported: false,
          currentMetadataRevision: 1,
          displayName: "Signal Harbor",
          shortDescription: "Monitor fleet status, player sessions, and maintenance notices.",
          genreDisplay: "Utility, Dashboard, Community",
          minPlayers: 1,
          maxPlayers: 1,
          playerCountDisplay: "1 player",
          ageRatingAuthority: "ESRB",
          ageRatingValue: "E",
          minAgeYears: 6,
          ageDisplay: "ESRB E",
          cardImageUrl: null,
          logoImageUrl: null,
          acquisitionUrl: "https://example.com/signal-harbor",
        },
      ],
      paging: { pageNumber: 1, pageSize: 48, totalCount: 2, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
    });

    renderApp("/studios/harborlight-mechanics");

    expect(await screen.findByRole("heading", { name: "Harborlight Mechanics" })).toBeVisible();
    expect(screen.getByText("2 titles")).toBeVisible();
    expect(screen.getByText("Cinderline Workshop")).toBeVisible();
    expect(screen.getByText("Signal Harbor")).toBeVisible();

    await userEvent.type(screen.getByLabelText("Search"), "signal");

    expect(screen.getByText("Signal Harbor")).toBeVisible();
    expect(screen.queryByText("Cinderline Workshop")).not.toBeInTheDocument();
    expect(screen.getByText("Showing results 1 - 1 of 1")).toBeVisible();
  });

  it("shows the visible browse result range for the current page", async () => {
    apiMocks.listCatalogTitles.mockResolvedValue({
      titles: Array.from({ length: 22 }, (_, index) => ({
        id: `title-${index + 1}`,
        studioId: "studio-1",
        studioSlug: "blue-harbor-games",
        studioDisplayName: "Blue Harbor Games",
        slug: `title-${index + 1}`,
        contentKind: "game" as const,
        lifecycleStatus: "published" as const,
        visibility: "listed" as const,
        isReported: false,
        currentMetadataRevision: 1,
        displayName: `Title ${String(index + 1).padStart(2, "0")}`,
        shortDescription: `Description ${index + 1}`,
        genreDisplay: "Puzzle",
        minPlayers: 1,
        maxPlayers: 4,
        playerCountDisplay: "1-4 players",
        ageRatingAuthority: "ESRB",
        ageRatingValue: "E",
        minAgeYears: 6,
        ageDisplay: "ESRB E",
        cardImageUrl: null,
        logoImageUrl: null,
        acquisitionUrl: `https://example.com/title-${index + 1}`,
      })),
      paging: { pageNumber: 1, pageSize: 48, totalCount: 22, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
    });

    renderApp("/browse");

    expect(await screen.findByRole("heading", { name: "Browse" })).toBeVisible();
    expect(screen.getByText("Showing results 1 - 10 of 22")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Showing results 11 - 20 of 22")).toBeVisible();
  });

  it("moves release version into the hero area for player title detail views", async () => {
    authState.value = {
      session: { access_token: "player-token" },
      currentUser: {
        subject: "user-1",
        displayName: "Taylor Marsh",
        email: "taylor.marsh@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["player"],
      },
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };
    apiMocks.getCatalogTitle.mockResolvedValue({
      title: {
        id: "title-1",
        studioId: "studio-1",
        studioSlug: "blue-harbor-games",
        studioDisplayName: "Blue Harbor Games",
        slug: "lantern-drift",
        displayName: "Lantern Drift",
        shortDescription: "Guide glowing paper boats through midnight canals.",
        description: "Tilt waterways, spin lock-gates, and weave through fireworks across the river.",
        genreDisplay: "Puzzle, Family",
        contentKind: "game",
        visibility: "listed",
        lifecycleStatus: "active",
        isReported: false,
        currentMetadataRevision: 2,
        playerCountDisplay: "1-4 players",
        ageDisplay: "ESRB E",
        acquisitionUrl: "https://example.com/lantern-drift",
        logoImageUrl: null,
        acquisition: {
          url: "https://example.com/lantern-drift",
          label: "Open publisher page",
          providerDisplayName: "Blue Harbor Games Direct",
          providerHomepageUrl: "https://example.com",
        },
        currentRelease: {
          id: "release-1",
          titleId: "title-1",
          version: "1.0.0",
          status: "production",
          isCurrent: true,
          publishedAt: "2026-03-08T12:00:00Z",
          createdAt: "2026-03-08T12:00:00Z",
          updatedAt: "2026-03-08T12:00:00Z",
        },
        mediaAssets: [],
        updatedAt: "2026-03-08T12:00:00Z",
      },
    });

    renderApp("/browse/blue-harbor-games/lantern-drift");

    expect(await screen.findByRole("heading", { name: "Lantern Drift" })).toBeVisible();
    expect(screen.getByText("Current version", { exact: false })).toBeVisible();
    expect(screen.getByText("1.0.0")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Current release" })).not.toBeInTheDocument();
    expect(screen.queryByText("Configured")).not.toBeInTheDocument();
  });

  it("shows an unavailable notice for unlisted titles that remain in a player's collection", async () => {
    authState.value = {
      session: { access_token: "player-token" },
      currentUser: {
        subject: "user-1",
        displayName: "Taylor Marsh",
        email: "taylor.marsh@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["player"],
      },
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };
    apiMocks.getPlayerLibrary.mockResolvedValue({
      titles: [
        {
          id: "title-1",
          studioId: "studio-1",
          studioSlug: "blue-harbor-games",
          studioDisplayName: "Blue Harbor Games",
          slug: "lantern-drift",
          contentKind: "game",
          lifecycleStatus: "active",
          visibility: "unlisted",
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
          logoImageUrl: null,
          acquisitionUrl: null,
        },
      ],
    });
    apiMocks.getPlayerWishlist.mockResolvedValue({ titles: [] });
    apiMocks.getCatalogTitle.mockResolvedValue({
      title: {
        id: "title-1",
        studioId: "studio-1",
        studioSlug: "blue-harbor-games",
        studioDisplayName: "Blue Harbor Games",
        slug: "lantern-drift",
        displayName: "Lantern Drift",
        shortDescription: "Guide glowing paper boats through midnight canals.",
        description: "Tilt waterways, spin lock-gates, and weave through fireworks across the river.",
        genreDisplay: "Puzzle, Family",
        contentKind: "game",
        visibility: "unlisted",
        lifecycleStatus: "active",
        isReported: false,
        currentMetadataRevision: 2,
        playerCountDisplay: "1-4 players",
        ageDisplay: "ESRB E",
        acquisitionUrl: null,
        logoImageUrl: null,
        acquisition: undefined,
        currentRelease: {
          id: "release-1",
          version: "1.0.0",
          publishedAt: "2026-03-08T12:00:00Z",
        },
        mediaAssets: [],
        updatedAt: "2026-03-08T12:00:00Z",
      },
    });

    renderApp("/browse/blue-harbor-games/lantern-drift");

    expect(await screen.findByRole("heading", { name: "Lantern Drift" })).toBeVisible();
    expect(screen.getByText(/unlisted and no longer available/i)).toBeVisible();
    expect(apiMocks.getCatalogTitle).toHaveBeenCalledWith("http://127.0.0.1:8787", "blue-harbor-games", "lantern-drift", "player-token");
  });

  it("prefers a title logo on browse cards when one is available", async () => {
    apiMocks.listCatalogTitles.mockResolvedValue({
      titles: [
        {
          id: "title-1",
          studioId: "studio-1",
          studioSlug: "blue-harbor-games",
          studioDisplayName: "Blue Harbor Games",
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
          logoImageUrl: "https://example.com/lantern-drift-logo.png",
          acquisitionUrl: "https://example.com/lantern-drift",
        },
      ],
      paging: { pageNumber: 1, pageSize: 48, totalCount: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
    });

    renderApp("/browse");

    expect(await screen.findByRole("heading", { name: "Browse" })).toBeVisible();
    expect(screen.getByAltText("Lantern Drift logo")).toBeVisible();
  });

  it("filters browse results by adjustable minimum and maximum player range", async () => {
    apiMocks.listCatalogTitles.mockResolvedValue({
      titles: [
        {
          id: "title-1",
          studioId: "studio-1",
          studioSlug: "blue-harbor-games",
          studioDisplayName: "Blue Harbor Games",
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
          logoImageUrl: null,
          acquisitionUrl: "https://example.com/lantern-drift",
        },
        {
          id: "title-2",
          studioId: "studio-2",
          studioSlug: "tiny-orbit-forge",
          studioDisplayName: "Tiny Orbit Forge",
          slug: "orbital-crew",
          contentKind: "game",
          lifecycleStatus: "published",
          visibility: "listed",
          isReported: false,
          currentMetadataRevision: 1,
          displayName: "Orbital Crew",
          shortDescription: "Coordinate a large bridge crew across emergency drills.",
          genreDisplay: "Strategy, Co-op",
          minPlayers: 5,
          maxPlayers: 8,
          playerCountDisplay: "5-8 players",
          ageRatingAuthority: "ESRB",
          ageRatingValue: "E10+",
          minAgeYears: 10,
          ageDisplay: "ESRB E10+",
          cardImageUrl: null,
          logoImageUrl: null,
          acquisitionUrl: "https://example.com/orbital-crew",
        },
      ],
      paging: { pageNumber: 1, pageSize: 48, totalCount: 2, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
    });

    renderApp("/browse");

    expect(await screen.findByRole("heading", { name: "Browse" })).toBeVisible();
    expect(screen.getByText("Lantern Drift")).toBeVisible();
    expect(screen.getByText("Orbital Crew")).toBeVisible();

    fireEvent.change(screen.getByRole("slider", { name: /minimum players/i }), { target: { value: "5" } });

    expect(screen.queryByText("Lantern Drift")).not.toBeInTheDocument();
    expect(screen.getByText("Orbital Crew")).toBeVisible();

    fireEvent.change(screen.getByRole("slider", { name: /maximum players/i }), { target: { value: "5" } });

    expect(screen.queryByText("Lantern Drift")).not.toBeInTheDocument();
    expect(screen.getByText("Orbital Crew")).toBeVisible();
    expect(screen.getByText("1 titles")).toBeVisible();
  });

  it("redirects protected routes to sign in when unauthenticated", async () => {
    renderApp("/develop");

    expect(await screen.findByRole("heading", { name: "Sign In" })).toBeVisible();
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Developer seed account")).not.toBeInTheDocument();
    expect(screen.queryByText("Moderator seed account")).not.toBeInTheDocument();
    expect(screen.queryByText(/Local default:/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register now" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Recover access" })).toBeVisible();
  });

  it("shows the become-a-developer workflow to signed-in players without developer access", async () => {
    authState.value = {
      session: { access_token: "player-token" },
      currentUser: {
        subject: "user-1",
        displayName: "Taylor Marsh",
        email: "taylor.marsh@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["player"],
      },
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };
    apiMocks.getDeveloperEnrollment.mockResolvedValue({
      developerEnrollment: {
        status: "not_enrolled",
        actionRequiredBy: "developer",
        developerAccessEnabled: false,
        verifiedDeveloper: false,
        canSubmitRequest: true,
      },
    });

    renderApp("/develop");

    expect(await screen.findByRole("heading", { name: "Become a Developer" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Become a Developer" })).toBeVisible();
    expect(screen.getByText(/Signed in as taylor\.marsh@boardtpl\.local/i)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Access not available" })).not.toBeInTheDocument();
  });

  it("restores the maintained studio workflow navigation inside /develop", async () => {
    seedDeveloperWorkspace();

    renderApp("/develop");

    expect(await screen.findByRole("button", { name: "Studios" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Overview" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Studio Overview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Studio Settings" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create studio" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Create title" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create release" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("shows the correct selector stack for each develop domain", async () => {
    seedDeveloperWorkspace();

    renderApp("/develop");

    await screen.findByRole("button", { name: "Studios" });
    let sidebar = screen.getByText("Section").closest("aside");
    expect(sidebar).not.toBeNull();
    expect(within(sidebar as HTMLElement).getAllByRole("combobox")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Titles" }));
    expect(screen.getByRole("button", { name: "Create studio" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Create title" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Create release" })).not.toBeInTheDocument();
    sidebar = screen.getByText("Section").closest("aside");
    expect(sidebar).not.toBeNull();
    expect(within(sidebar as HTMLElement).getAllByRole("combobox")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Releases" }));
    expect(screen.getByRole("button", { name: "Create studio" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Create title" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Create release" })).toBeVisible();
    sidebar = screen.getByText("Section").closest("aside");
    expect(sidebar).not.toBeNull();
    expect(within(sidebar as HTMLElement).getAllByRole("combobox")).toHaveLength(3);
  });

  it("restores the maintained title overview as summary cards instead of inline editors", async () => {
    seedDeveloperWorkspace();

    renderApp("/develop?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

    expect(await screen.findByRole("heading", { name: "Lantern Drift" })).toBeVisible();
    expect(screen.getAllByText("Lantern Drift").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Overview" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Metadata" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reports" })).toBeVisible();
    expect(screen.queryByText("Revision history")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save metadata" })).not.toBeInTheDocument();
    expect(screen.queryByText("Title slug")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit overview" })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Title visibility" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Activate and list title" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open current release" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Open metadata" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete title" })).toBeVisible();
  });

  it("toggles title visibility directly from the title overview", async () => {
    seedDeveloperWorkspace();
    apiMocks.updateTitle.mockResolvedValue({
      title: {
        id: "title-1",
        studioId: "studio-1",
        studioSlug: "blue-harbor-games",
        slug: "lantern-drift",
        displayName: "Lantern Drift",
        shortDescription: "A thoughtful puzzle adventure.",
        description: "A thoughtful puzzle adventure.",
        genreSlugs: ["adventure", "puzzle"],
        contentKind: "game",
        lifecycleStatus: "active",
        visibility: "unlisted",
        genreDisplay: "Adventure, Puzzle",
        minPlayers: 1,
        maxPlayers: 4,
        ageRatingAuthority: "ESRB",
        ageRatingValue: "E10+",
        minAgeYears: 10,
        playerCountDisplay: "1-4 players",
        ageDisplay: "ESRB E10+",
        currentMetadataRevision: 3,
        acquisitionUrl: null,
        currentRelease: {
          id: "release-1",
          version: "1.0.0",
        },
      },
    });

    renderApp("/develop?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

    const visibilitySwitch = await screen.findByRole("switch", { name: "Title visibility" });
    expect(visibilitySwitch).toHaveAttribute("aria-checked", "true");

    await userEvent.click(visibilitySwitch);

    expect(apiMocks.updateTitle).toHaveBeenCalledWith("http://127.0.0.1:8787", "developer-token", "title-1", {
      contentKind: "game",
      visibility: "unlisted",
    });
  });

  it("explains why the title visibility switch is disabled for draft titles", async () => {
    seedDeveloperWorkspace();
    apiMocks.getDeveloperTitle.mockResolvedValue({
      title: {
        id: "title-1",
        studioId: "studio-1",
        studioSlug: "blue-harbor-games",
        slug: "lantern-drift",
        displayName: "Lantern Drift",
        shortDescription: "A thoughtful puzzle adventure.",
        description: "A thoughtful puzzle adventure.",
        genreSlugs: ["adventure", "puzzle"],
        contentKind: "game",
        lifecycleStatus: "draft",
        visibility: "unlisted",
        genreDisplay: "Adventure, Puzzle",
        minPlayers: 1,
        maxPlayers: 4,
        ageRatingAuthority: "ESRB",
        ageRatingValue: "E10+",
        minAgeYears: 10,
        playerCountDisplay: "1-4 players",
        ageDisplay: "ESRB E10+",
        currentMetadataRevision: 3,
        acquisitionUrl: null,
        currentRelease: null,
      },
    });

    renderApp("/develop?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

    const visibilitySwitch = await screen.findByRole("switch", { name: "Title visibility" });
    expect(visibilitySwitch).toBeDisabled();

    await userEvent.hover(visibilitySwitch.parentElement as HTMLElement);

    expect(screen.getByText("Create a release first, then activate the title before you list it.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Activate and list title" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open releases" })).toBeVisible();
  });

  it("lets archived titles be unarchived while keeping other overview actions disabled", async () => {
    seedDeveloperWorkspace();
    apiMocks.getDeveloperTitle.mockResolvedValue({
      title: {
        id: "title-1",
        studioId: "studio-1",
        studioSlug: "blue-harbor-games",
        slug: "lantern-drift",
        displayName: "Lantern Drift",
        shortDescription: "A thoughtful puzzle adventure.",
        description: "A thoughtful puzzle adventure.",
        genreSlugs: ["adventure", "puzzle"],
        contentKind: "game",
        lifecycleStatus: "archived",
        visibility: "unlisted",
        genreDisplay: "Adventure, Puzzle",
        minPlayers: 1,
        maxPlayers: 4,
        ageRatingAuthority: "ESRB",
        ageRatingValue: "E10+",
        minAgeYears: 10,
        playerCountDisplay: "1-4 players",
        ageDisplay: "ESRB E10+",
        currentMetadataRevision: 3,
        acquisitionUrl: null,
        currentRelease: {
          id: "release-1",
          version: "1.0.0",
        },
      },
    });
    apiMocks.unarchiveTitle.mockResolvedValue({
      title: {
        id: "title-1",
        studioId: "studio-1",
        studioSlug: "blue-harbor-games",
        slug: "lantern-drift",
        displayName: "Lantern Drift",
        shortDescription: "A thoughtful puzzle adventure.",
        description: "A thoughtful puzzle adventure.",
        genreSlugs: ["adventure", "puzzle"],
        contentKind: "game",
        lifecycleStatus: "draft",
        visibility: "unlisted",
        genreDisplay: "Adventure, Puzzle",
        minPlayers: 1,
        maxPlayers: 4,
        ageRatingAuthority: "ESRB",
        ageRatingValue: "E10+",
        minAgeYears: 10,
        playerCountDisplay: "1-4 players",
        ageDisplay: "ESRB E10+",
        currentMetadataRevision: 3,
        acquisitionUrl: null,
        currentRelease: {
          id: "release-1",
          version: "1.0.0",
        },
      },
    });

    renderApp("/develop?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

    expect(await screen.findByRole("heading", { name: "Lantern Drift" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Unarchive title" })).toBeEnabled();
    expect(screen.getByRole("switch", { name: "Title visibility" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Open current release" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive title" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete title" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Unarchive title" }));

    expect(apiMocks.unarchiveTitle).toHaveBeenCalledWith("http://127.0.0.1:8787", "developer-token", "title-1");
  });

  it("shows unarchive failures under the title actions section instead of the page header", async () => {
    seedDeveloperWorkspace();
    apiMocks.getDeveloperTitle.mockResolvedValue({
      title: {
        id: "title-1",
        studioId: "studio-1",
        studioSlug: "blue-harbor-games",
        slug: "lantern-drift",
        displayName: "Lantern Drift",
        shortDescription: "A thoughtful puzzle adventure.",
        description: "A thoughtful puzzle adventure.",
        genreSlugs: ["adventure", "puzzle"],
        contentKind: "game",
        lifecycleStatus: "archived",
        visibility: "unlisted",
        genreDisplay: "Adventure, Puzzle",
        minPlayers: 1,
        maxPlayers: 4,
        ageRatingAuthority: "ESRB",
        ageRatingValue: "E10+",
        minAgeYears: 10,
        playerCountDisplay: "1-4 players",
        ageDisplay: "ESRB E10+",
        currentMetadataRevision: 3,
        acquisitionUrl: null,
        currentRelease: null,
      },
    });
    apiMocks.unarchiveTitle.mockRejectedValue(new Error('new row for relation "titles" violates check constraint "titles_draft_private"'));

    renderApp("/develop?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

    expect(await screen.findByRole("heading", { name: "Lantern Drift" })).toBeVisible();

    const titleActionsSection = screen.getByText("Title actions").closest("section");
    expect(titleActionsSection).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Unarchive title" }));

    expect(await within(titleActionsSection as HTMLElement).findByText("Your local title rules are out of date. Apply the latest database migrations, then try again.")).toBeVisible();
    expect(screen.queryByText('new row for relation "titles" violates check constraint "titles_draft_private"')).not.toBeInTheDocument();
  });

  it("restores the release overview without the old publish workflow", async () => {
    seedDeveloperWorkspace();

    renderApp("/develop?domain=releases&workflow=releases-overview&studioId=studio-1&titleId=title-1&releaseId=release-1");

    expect(await screen.findByRole("heading", { name: "Release Overview" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Open publish" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Release type/i)).toBeVisible();
    expect(screen.getByLabelText(/Acquisition URL/i)).toBeVisible();
    expect(screen.queryByLabelText(/Metadata revision/i)).not.toBeInTheDocument();
  });

  it("keeps older releases selectable after a newer release is created", async () => {
    seedDeveloperWorkspace();
    apiMocks.getTitleReleases.mockResolvedValue({
      releases: [
        {
          id: "release-2",
          version: "1.0.1",
          status: "testing",
          isCurrent: false,
          createdAt: "2026-03-09T12:00:00Z",
          publishedAt: "2026-03-09T12:30:00Z",
          updatedAt: "2026-03-09T12:30:00Z",
        },
        {
          id: "release-1",
          version: "1.0.0",
          status: "production",
          isCurrent: true,
          createdAt: "2026-03-08T12:00:00Z",
          publishedAt: "2026-03-08T12:30:00Z",
          updatedAt: "2026-03-08T12:30:00Z",
        },
      ],
    });

    renderApp("/develop?domain=releases&workflow=releases-overview&studioId=studio-1&titleId=title-1&releaseId=release-2");

    expect(await screen.findByRole("heading", { name: "Release Overview" })).toBeVisible();
    const releaseSelect = screen.getByDisplayValue("1.0.1 (Testing)");
    expect(within(releaseSelect).getByRole("option", { name: "1.0.0 (Production)" })).toBeVisible();
    expect(within(releaseSelect).getByRole("option", { name: "1.0.1 (Testing)" })).toBeVisible();
  });

  it("blocks title deletion confirmation when the current password is invalid", async () => {
    seedDeveloperWorkspace();
    apiMocks.verifyCurrentUserPassword.mockRejectedValue(new Error("Current password is incorrect."));

    renderApp("/develop?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

    await screen.findByRole("heading", { name: "Lantern Drift" });
    await userEvent.click(screen.getByRole("button", { name: "Delete title" }));

    const passwordDialog = await screen.findByRole("dialog", { name: "Delete Lantern Drift" });
    await userEvent.type(within(passwordDialog).getByLabelText(/Current password/i), "wrong-password");
    await userEvent.click(within(passwordDialog).getByRole("button", { name: "Continue" }));

    expect(apiMocks.verifyCurrentUserPassword).toHaveBeenCalledWith("http://127.0.0.1:8787", "developer-token", {
      currentPassword: "wrong-password",
    });
    expect(await within(passwordDialog).findByText("Current password is incorrect.")).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Confirm deletion of Lantern Drift" })).not.toBeInTheDocument();
  });

  it("advances to the second delete confirmation when the current password is valid", async () => {
    seedDeveloperWorkspace();
    apiMocks.verifyCurrentUserPassword.mockResolvedValue({ verified: true });

    renderApp("/develop?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

    await screen.findByRole("heading", { name: "Lantern Drift" });
    await userEvent.click(screen.getByRole("button", { name: "Delete title" }));

    const passwordDialog = await screen.findByRole("dialog", { name: "Delete Lantern Drift" });
    await userEvent.type(within(passwordDialog).getByLabelText(/Current password/i), "Developer!123");
    await userEvent.click(within(passwordDialog).getByRole("button", { name: "Continue" }));

    expect(apiMocks.verifyCurrentUserPassword).toHaveBeenCalledWith("http://127.0.0.1:8787", "developer-token", {
      currentPassword: "Developer!123",
    });
    expect(await screen.findByRole("dialog", { name: "Confirm deletion of Lantern Drift" })).toBeVisible();
  });

  it("submits the delete password step when Enter is pressed in the password field", async () => {
    seedDeveloperWorkspace();
    apiMocks.verifyCurrentUserPassword.mockResolvedValue({ verified: true });

    renderApp("/develop?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

    await screen.findByRole("heading", { name: "Lantern Drift" });
    await userEvent.click(screen.getByRole("button", { name: "Delete title" }));

    const passwordDialog = await screen.findByRole("dialog", { name: "Delete Lantern Drift" });
    const passwordField = within(passwordDialog).getByLabelText(/Current password/i);
    await userEvent.type(passwordField, "Developer!123{enter}");

    expect(apiMocks.verifyCurrentUserPassword).toHaveBeenCalledWith("http://127.0.0.1:8787", "developer-token", {
      currentPassword: "Developer!123",
    });
    expect(await screen.findByRole("dialog", { name: "Confirm deletion of Lantern Drift" })).toBeVisible();
  });

  it("clears the delete password when the user goes back from the second confirmation step", async () => {
    seedDeveloperWorkspace();
    apiMocks.verifyCurrentUserPassword.mockResolvedValue({ verified: true });

    renderApp("/develop?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

    await screen.findByRole("heading", { name: "Lantern Drift" });
    await userEvent.click(screen.getByRole("button", { name: "Delete title" }));

    const passwordDialog = await screen.findByRole("dialog", { name: "Delete Lantern Drift" });
    await userEvent.type(within(passwordDialog).getByLabelText(/Current password/i), "Developer!123");
    await userEvent.click(within(passwordDialog).getByRole("button", { name: "Continue" }));

    const confirmationDialog = await screen.findByRole("dialog", { name: "Confirm deletion of Lantern Drift" });
    await userEvent.click(within(confirmationDialog).getByRole("button", { name: "Back" }));

    const returnedPasswordDialog = await screen.findByRole("dialog", { name: "Delete Lantern Drift" });
    expect(within(returnedPasswordDialog).getByLabelText(/Current password/i)).toHaveValue("");
  });

  it("submits the second delete confirmation step when Enter is pressed in the title field", async () => {
    seedDeveloperWorkspace();
    apiMocks.verifyCurrentUserPassword.mockResolvedValue({ verified: true });
    apiMocks.deleteTitle.mockResolvedValue(undefined);

    renderApp("/develop?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

    await screen.findByRole("heading", { name: "Lantern Drift" });
    await userEvent.click(screen.getByRole("button", { name: "Delete title" }));

    const passwordDialog = await screen.findByRole("dialog", { name: "Delete Lantern Drift" });
    await userEvent.type(within(passwordDialog).getByLabelText(/Current password/i), "Developer!123");
    await userEvent.click(within(passwordDialog).getByRole("button", { name: "Continue" }));

    const confirmationDialog = await screen.findByRole("dialog", { name: "Confirm deletion of Lantern Drift" });
    const titleField = within(confirmationDialog).getByLabelText(/Title name/i);
    await userEvent.type(titleField, "Lantern Drift{enter}");

    expect(apiMocks.deleteTitle).toHaveBeenCalledWith("http://127.0.0.1:8787", "developer-token", "title-1", {
      currentPassword: "Developer!123",
      confirmationTitleName: "Lantern Drift",
    });
  });

  it("submits self-service registration from the sign-in page", async () => {
    const signUp = vi.fn().mockResolvedValue({ requiresEmailConfirmation: true });
    authState.value = {
      session: null,
      currentUser: null,
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp,
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    renderApp("/auth/signin");

    await screen.findByRole("heading", { name: "Sign In" });
    await userEvent.click(screen.getByRole("button", { name: "Register now" }));

    const registerDialog = await screen.findByRole("dialog", { name: "Create account" });
    expect(within(registerDialog).getByRole("heading", { name: "Create account" })).toBeVisible();
    const createAccountButton = within(registerDialog).getByRole("button", { name: "Create account" });
    expect(createAccountButton).toBeDisabled();
    await userEvent.click(within(registerDialog).getByRole("button", { name: "Upload image" }));
    expect(within(registerDialog).getByText("Optional. Recommended 512 x 512 px. Max 256 KB.")).toBeVisible();
    await userEvent.click(within(registerDialog).getByRole("button", { name: "Avatar URL" }));

    await userEvent.type(within(registerDialog).getByLabelText(/Username/i), "new.player");
    fireEvent.blur(within(registerDialog).getByLabelText(/Username/i));
    await userEvent.type(within(registerDialog).getByLabelText(/Email/i), "new.player@example.com");
    fireEvent.blur(within(registerDialog).getByLabelText(/Email/i));
    await userEvent.type(within(registerDialog).getByLabelText(/First name/i), "New");
    await userEvent.type(within(registerDialog).getByLabelText(/Last name/i), "Player");
    await userEvent.type(within(registerDialog).getByLabelText(/^Password/i), "NewPlayer!123");
    fireEvent.blur(within(registerDialog).getByLabelText(/^Password/i));
    await userEvent.type(within(registerDialog).getByLabelText(/^Confirm password/i), "NewPlayer!123");
    fireEvent.blur(within(registerDialog).getByLabelText(/^Confirm password/i));
    await completeLocalAntiSpamCheck(within(registerDialog));

    expect(await within(registerDialog).findByText("✓ Available")).toBeVisible();
    await waitFor(() => expect(createAccountButton).toBeEnabled());
    await userEvent.click(createAccountButton);

    expect(signUp).toHaveBeenCalledWith({
      userName: "new.player",
      email: "new.player@example.com",
      password: "NewPlayer!123",
      firstName: "New",
      lastName: "Player",
      avatarUrl: null,
      avatarDataUrl: null,
      captchaToken: "local-development-turnstile-token",
    });
    expect(await screen.findByText(/Account created\. Check your email/i)).toBeVisible();
  });

  it("validates registration fields on blur and keeps submit disabled until the username is available", async () => {
    apiMocks.getUserNameAvailability.mockResolvedValue({
      userNameAvailability: {
        requestedUserName: "taken.player",
        normalizedUserName: "taken.player",
        available: false,
      },
    });
    authState.value = {
      session: null,
      currentUser: null,
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    renderApp("/auth/signin");

    await screen.findByRole("heading", { name: "Sign In" });
    await userEvent.click(screen.getByRole("button", { name: "Register now" }));

    const registerDialog = await screen.findByRole("dialog", { name: "Create account" });
    const createAccountButton = within(registerDialog).getByRole("button", { name: "Create account" });

    await userEvent.type(within(registerDialog).getByLabelText(/Username/i), "taken.player");
    fireEvent.blur(within(registerDialog).getByLabelText(/Username/i));
    expect(await within(registerDialog).findByText("✕ Unavailable")).toBeVisible();

    await userEvent.type(within(registerDialog).getByLabelText(/Email/i), "not-an-email");
    fireEvent.blur(within(registerDialog).getByLabelText(/Email/i));
    expect(await within(registerDialog).findByText("Enter a valid email address.")).toBeVisible();

    await userEvent.type(within(registerDialog).getByLabelText(/^Password/i), "short");
    fireEvent.blur(within(registerDialog).getByLabelText(/^Password/i));
    expect(await within(registerDialog).findByText("Use at least 8 characters.")).toBeVisible();
    expect(within(registerDialog).getByText("Add an uppercase letter.")).toBeVisible();
    expect(within(registerDialog).getByText("Add a number.")).toBeVisible();
    expect(within(registerDialog).getByText("Add a special character.")).toBeVisible();

    await userEvent.type(within(registerDialog).getByLabelText(/^Confirm password/i), "different");
    fireEvent.blur(within(registerDialog).getByLabelText(/^Confirm password/i));
    expect(await within(registerDialog).findByText("Passwords must match.")).toBeVisible();

    expect(createAccountButton).toBeDisabled();
  });

  it("clears the registration form each time the modal opens", async () => {
    authState.value = {
      session: null,
      currentUser: null,
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    renderApp("/auth/signin");

    await screen.findByRole("heading", { name: "Sign In" });
    await userEvent.click(screen.getByRole("button", { name: "Register now" }));

    let registerDialog = await screen.findByRole("dialog", { name: "Create account" });
    await userEvent.type(within(registerDialog).getByLabelText(/Username/i), "new.player");
    await userEvent.type(within(registerDialog).getByLabelText(/Email/i), "new.player@example.com");
    await userEvent.type(within(registerDialog).getByLabelText(/First name/i), "New");
    await userEvent.type(within(registerDialog).getByLabelText(/Last name/i), "Player");
    await userEvent.type(within(registerDialog).getByLabelText(/^Password/i), "NewPlayer!123");
    await userEvent.type(within(registerDialog).getByLabelText(/^Confirm password/i), "NewPlayer!123");
    await userEvent.type(within(registerDialog).getByLabelText(/^Avatar URL$/i), "https://example.com/avatar.png");

    await userEvent.click(within(registerDialog).getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Create account" })).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Register now" }));
    registerDialog = await screen.findByRole("dialog", { name: "Create account" });

    expect(within(registerDialog).getByLabelText(/Username/i)).toHaveValue("");
    expect(within(registerDialog).getByLabelText(/Email/i)).toHaveValue("");
    expect(within(registerDialog).getByLabelText(/First name/i)).toHaveValue("");
    expect(within(registerDialog).getByLabelText(/Last name/i)).toHaveValue("");
    expect(within(registerDialog).getByLabelText(/^Password/i)).toHaveValue("");
    expect(within(registerDialog).getByLabelText(/^Confirm password/i)).toHaveValue("");
    expect(within(registerDialog).getByLabelText(/^Avatar URL$/i)).toHaveValue("");
  });

  it("restores the registration draft after the page remounts", async () => {
    const firstRender = renderApp("/auth/signin");

    await userEvent.click(screen.getByRole("button", { name: "Register now" }));
    const registerDialog = await screen.findByRole("dialog", { name: "Create account" });

    await userEvent.type(within(registerDialog).getByLabelText(/Username/i), "persisted.player");
    await userEvent.type(within(registerDialog).getByLabelText(/Email/i), "persisted.player@example.com");
    await userEvent.type(within(registerDialog).getByLabelText(/^Avatar URL$/i), "https://example.com/persisted-avatar.png");

    firstRender.unmount();

    renderApp("/auth/signin");

    const restoredDialog = await screen.findByRole("dialog", { name: "Create account" });
    expect(within(restoredDialog).getByLabelText(/Username/i)).toHaveValue("persisted.player");
    expect(within(restoredDialog).getByLabelText(/Email/i)).toHaveValue("persisted.player@example.com");
    expect(within(restoredDialog).getByLabelText(/^Avatar URL$/i)).toHaveValue("https://example.com/persisted-avatar.png");
  });

  it("requests password recovery from the sign-in page", async () => {
    const requestPasswordReset = vi.fn().mockResolvedValue(undefined);
    authState.value = {
      session: null,
      currentUser: null,
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset,
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    renderApp("/auth/signin");

    await screen.findByRole("heading", { name: "Sign In" });
    await userEvent.click(screen.getByRole("button", { name: "Recover access" }));
    const recoveryDialog = await screen.findByRole("dialog", { name: "Recover access" });
    expect(within(recoveryDialog).getByRole("heading", { name: "Recover access" })).toBeVisible();

    await userEvent.type(within(recoveryDialog).getByLabelText("Email"), "new.player@example.com");
    await completeLocalAntiSpamCheck(within(recoveryDialog));
    await userEvent.click(within(recoveryDialog).getByRole("button", { name: "Send recovery email" }));

    expect(requestPasswordReset).toHaveBeenCalledWith("new.player@example.com", "local-development-turnstile-token");
    expect(await within(recoveryDialog).findByText(/If that email matches an account/i)).toBeVisible();
    expect(within(recoveryDialog).getByLabelText("Recovery code")).toBeVisible();
    expect(within(recoveryDialog).getByRole("button", { name: "Confirm code" })).toBeVisible();
  });

  it("advances recovery from code verification to password reset and returns to sign in after save", async () => {
    const requestPasswordReset = vi.fn().mockResolvedValue(undefined);
    const verifyRecoveryCode = vi.fn().mockImplementation(async () => {
      authState.value = {
        ...authState.value,
        session: { access_token: "recovery-token" },
        currentUser: {
          subject: "user-1",
          displayName: "Test User",
          email: "new.player@example.com",
          emailVerified: true,
          identityProvider: "email",
          roles: ["player"],
        },
      };
    });
    const updatePassword = vi.fn().mockResolvedValue(undefined);
    const signOut = vi.fn().mockImplementation(async () => {
      authState.value = {
        ...authState.value,
        session: null,
        currentUser: null,
      };
    });
    authState.value = {
      session: null,
      currentUser: null,
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset,
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode,
      updatePassword,
      signOut,
      refreshCurrentUser: vi.fn(),
    };

    renderApp("/auth/signin");

    await screen.findByRole("heading", { name: "Sign In" });
    await userEvent.click(screen.getByRole("button", { name: "Recover access" }));
    const recoveryDialog = await screen.findByRole("dialog", { name: "Recover access" });

    await userEvent.type(within(recoveryDialog).getByLabelText("Email"), "new.player@example.com");
    await completeLocalAntiSpamCheck(within(recoveryDialog));
    await userEvent.click(within(recoveryDialog).getByRole("button", { name: "Send recovery email" }));
    await userEvent.type(within(recoveryDialog).getByLabelText("Recovery code"), "123456");
    await userEvent.click(within(recoveryDialog).getByRole("button", { name: "Confirm code" }));

    expect(verifyRecoveryCode).toHaveBeenCalledWith("new.player@example.com", "123456");
    expect(await within(recoveryDialog).findByRole("heading", { name: "Set new password" })).toBeVisible();

    await userEvent.type(within(recoveryDialog).getByLabelText("New password"), "NewPlayer!123");
    await userEvent.type(within(recoveryDialog).getByLabelText("Confirm password"), "NewPlayer!123");
    await userEvent.click(within(recoveryDialog).getByRole("button", { name: "Save new password" }));

    expect(updatePassword).toHaveBeenCalledWith("NewPlayer!123");
    expect(signOut).toHaveBeenCalledWith({ tolerateNetworkFailure: true });
    expect(await screen.findByRole("heading", { name: "Sign In" })).toBeVisible();
  });

  it("returns to sign in after password recovery even if sign out hits a transient fetch failure", async () => {
    const requestPasswordReset = vi.fn().mockResolvedValue(undefined);
    const verifyRecoveryCode = vi.fn().mockImplementation(async () => {
      authState.value = {
        ...authState.value,
        session: { access_token: "recovery-token" },
        currentUser: {
          subject: "user-1",
          displayName: "Test User",
          email: "new.player@example.com",
          emailVerified: true,
          identityProvider: "email",
          roles: ["player"],
        },
      };
    });
    const updatePassword = vi.fn().mockResolvedValue(undefined);
    const signOut = vi.fn().mockImplementation(async () => {
      authState.value = {
        ...authState.value,
        session: null,
        currentUser: null,
      };
    });

    authState.value = {
      session: null,
      currentUser: null,
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset,
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode,
      updatePassword,
      signOut,
      refreshCurrentUser: vi.fn(),
    };

    signOut.mockImplementationOnce(async () => {
      authState.value = {
        ...authState.value,
        session: null,
        currentUser: null,
      };
      throw new Error("Failed to fetch");
    });

    renderApp("/auth/signin");

    await screen.findByRole("heading", { name: "Sign In" });
    await userEvent.click(screen.getByRole("button", { name: "Recover access" }));
    const recoveryDialog = await screen.findByRole("dialog", { name: "Recover access" });

    await userEvent.type(within(recoveryDialog).getByLabelText("Email"), "new.player@example.com");
    await completeLocalAntiSpamCheck(within(recoveryDialog));
    await userEvent.click(within(recoveryDialog).getByRole("button", { name: "Send recovery email" }));
    await userEvent.type(within(recoveryDialog).getByLabelText("Recovery code"), "123456");
    await userEvent.click(within(recoveryDialog).getByRole("button", { name: "Confirm code" }));
    await userEvent.type(within(recoveryDialog).getByLabelText("New password"), "NewPlayer!123");
    await userEvent.type(within(recoveryDialog).getByLabelText("Confirm password"), "NewPlayer!123");
    await userEvent.click(within(recoveryDialog).getByRole("button", { name: "Save new password" }));

    expect(updatePassword).toHaveBeenCalledWith("NewPlayer!123");
    expect(signOut).toHaveBeenCalledWith({ tolerateNetworkFailure: true });
    expect(await screen.findByRole("heading", { name: "Sign In" })).toBeVisible();
    expect(screen.getByText("Password updated. Sign in with your new password.")).toBeVisible();
  });

  it("validates empty sign-in fields before calling auth and supports password reveal", async () => {
    const signIn = vi.fn();
    authState.value = {
      session: null,
      currentUser: null,
      loading: false,
      authError: null,
      signIn,
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    renderApp("/auth/signin");

    await screen.findByRole("heading", { name: "Sign In" });
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput.type).toBe("text");

    await userEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Email is required.")).toBeVisible();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("skips password visibility toggles during tab navigation", async () => {
    renderApp("/auth/signin");

    await screen.findByRole("heading", { name: "Sign In" });
    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const signInButton = screen.getByRole("button", { name: "Sign In" });

    emailInput.focus();
    expect(emailInput).toHaveFocus();

    await userEvent.tab();
    expect(passwordInput).toHaveFocus();

    await userEvent.tab();
    expect(signInButton).toHaveFocus();
  });

  it("does not redirect away from sign in until the current user bootstrap completes", async () => {
    authState.value = {
      session: { access_token: "pending-token" },
      currentUser: null,
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    renderApp("/auth/signin?returnTo=%2Fplayer");

    expect(await screen.findByRole("heading", { name: "Sign In" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Player Workspace" })).not.toBeInTheDocument();
  });

  it("renders the restored signed-in shell account menu links", async () => {
    authState.value = {
      session: { access_token: "player-token" },
      currentUser: {
        subject: "user-1",
        displayName: "Emma Torres",
        email: "emma.torres@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["player", "developer", "moderator"],
      },
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    renderApp("/");

    await screen.findByRole("heading", { level: 1, name: "BE where the Board community shows up first." });
    await userEvent.click(screen.getByRole("button", { name: /open account/i }));

    expect(screen.getByRole("button", { name: "Profile" })).toBeVisible();
    expect(screen.getByRole("button", { name: "My Games" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Wishlist" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reported Titles" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Developer Console" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Moderate" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Account Settings" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign Out" })).toBeVisible();
  });

  it("renders the restored notification menu, unread badge, and marks a notification read on open", async () => {
    authState.value = {
      session: { access_token: "player-token" },
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
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };
    apiMocks.getCurrentUserNotifications.mockResolvedValue({
      notifications: [
        {
          id: "notification-1",
          category: "title_report",
          title: "Moderator follow-up on your report",
          body: "Open the report thread in Play.",
          actionUrl: "/player?workflow=reported-titles&reportId=report-1",
          isRead: false,
          readAt: null,
          createdAt: "2026-03-08T12:00:00Z",
          updatedAt: "2026-03-08T12:00:00Z",
        },
      ],
    });

    renderApp("/");

    await screen.findByRole("heading", { level: 1, name: "BE where the Board community shows up first." });
    await userEvent.click(screen.getByRole("button", { name: "Open notifications" }));

    expect(await screen.findByText("Moderator follow-up on your report")).toBeVisible();
    expect(screen.getByText("Title Report")).toBeVisible();
    expect(screen.getByText("1 unread")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /moderator follow-up on your report/i }));

    await waitFor(() => {
      expect(apiMocks.markCurrentUserNotificationRead).toHaveBeenCalledWith("http://127.0.0.1:8787", "player-token", "notification-1");
    });
  });

  it("hides developer-only report messages from the player reported titles workflow", async () => {
    authState.value = {
      session: { access_token: "player-token" },
      currentUser: {
        subject: "user-1",
        displayName: "Ava Garcia",
        email: "ava.garcia@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["player"],
      },
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };
    apiMocks.getUserProfile.mockResolvedValue({
      profile: {
        subject: "user-1",
        displayName: "Ava Garcia",
        userName: "ava.garcia",
        firstName: "Ava",
        lastName: "Garcia",
        email: "ava.garcia@boardtpl.local",
        emailVerified: true,
        avatarUrl: null,
        avatarDataUrl: null,
        initials: "AG",
        updatedAt: "2026-03-08T12:00:00Z",
      },
    });
    apiMocks.getPlayerTitleReports.mockResolvedValue({
      reports: [
        {
          id: "report-1",
          titleId: "title-1",
          studioId: "studio-1",
          studioSlug: "blue-harbor-games",
          studioDisplayName: "Blue Harbor Games",
          titleSlug: "compass-echo",
          titleDisplayName: "Compass Echo",
          titleShortDescription: "Coordinate routes across hidden currents.",
          genreDisplay: "Puzzle, Family",
          currentMetadataRevision: 2,
          status: "needs_developer_response",
          reason: "The install guidance references a companion feature that is not visible in the current testing build.",
          createdAt: "2026-03-08T09:10:00Z",
          updatedAt: "2026-03-08T10:05:00Z",
          resolvedAt: null,
          messageCount: 2,
        },
      ],
    });
    apiMocks.getPlayerTitleReport.mockResolvedValue({
      report: {
        report: {
          id: "report-1",
          titleId: "title-1",
          studioId: "studio-1",
          studioSlug: "blue-harbor-games",
          studioDisplayName: "Blue Harbor Games",
          titleSlug: "compass-echo",
          titleDisplayName: "Compass Echo",
          titleShortDescription: "Coordinate routes across hidden currents.",
          genreDisplay: "Puzzle, Family",
          currentMetadataRevision: 2,
          reporterSubject: "user-1",
          reporterUserName: "ava.garcia",
          reporterDisplayName: "Ava Garcia",
          reporterEmail: "ava.garcia@boardtpl.local",
          status: "needs_developer_response",
          reason: "The install guidance references a companion feature that is not visible in the current testing build.",
          createdAt: "2026-03-08T09:10:00Z",
          updatedAt: "2026-03-08T10:05:00Z",
          resolvedAt: null,
          messageCount: 2,
        },
        resolutionNote: null,
        resolvedBy: null,
        messages: [
          {
            id: "message-1",
            authorSubject: "user-1",
            authorUserName: "ava.garcia",
            authorDisplayName: "Ava Garcia",
            authorEmail: "ava.garcia@boardtpl.local",
            authorRole: "player",
            audience: "all",
            message: "I expected to see the synced clue board mentioned in the listing, but I cannot find it.",
            createdAt: "2026-03-08T09:10:00Z",
          },
          {
            id: "message-2",
            authorSubject: "user-2",
            authorUserName: "alex.rivera",
            authorDisplayName: "Alex Rivera",
            authorEmail: "alex.rivera@boardtpl.local",
            authorRole: "moderator",
            audience: "developer",
            message: "Please confirm whether this feature is intentionally hidden in testing or if the listing needs an update.",
            createdAt: "2026-03-08T10:05:00Z",
          },
        ],
      },
    });

    renderApp("/player?workflow=reported-titles&reportId=report-1");

    expect(await screen.findByRole("heading", { name: "Reported Titles" })).toBeVisible();
    expect(await screen.findByText("I expected to see the synced clue board mentioned in the listing, but I cannot find it.")).toBeVisible();
    expect(screen.queryByText("Please confirm whether this feature is intentionally hidden in testing or if the listing needs an update.")).not.toBeInTheDocument();
    expect(screen.queryByText(/developer only/i)).not.toBeInTheDocument();
  });

  it("restores an in-progress player profile edit after the page remounts", async () => {
    authState.value = {
      session: { access_token: "player-token" },
      currentUser: {
        subject: "user-1",
        displayName: "Ava Garcia",
        email: "ava.garcia@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["player"],
        avatarUrl: null,
      },
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    apiMocks.getUserProfile.mockResolvedValue({
      profile: {
        subject: "user-1",
        displayName: "Ava Garcia",
        userName: "ava.garcia",
        firstName: "Ava",
        lastName: "Garcia",
        email: "ava.garcia@boardtpl.local",
        emailVerified: true,
        avatarUrl: null,
        avatarDataUrl: null,
        initials: "AG",
        updatedAt: "2026-03-08T12:00:00Z",
      },
    });

    const firstRender = renderApp("/player?workflow=account-profile");

    await screen.findByRole("heading", { name: "Profile" });
    await userEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    await userEvent.clear(screen.getByRole("textbox", { name: /display name/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /display name/i }), "Draft Ava");
    await userEvent.type(screen.getByLabelText(/^Avatar URL$/i), "https://example.com/draft-avatar.png");

    firstRender.unmount();

    renderApp("/player?workflow=account-profile");

    await screen.findByRole("heading", { name: "Profile" });
    expect(screen.getByRole("button", { name: "Save Profile" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: /display name/i })).toHaveValue("Draft Ava");
    expect(screen.getByLabelText(/^Avatar URL$/i)).toHaveValue("https://example.com/draft-avatar.png");
  });

  it("lets players request an email change from account settings", async () => {
    const updateUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          email: "ava.garcia@boardtpl.local",
          new_email: "ava.new@boardtpl.local",
        },
      },
      error: null,
    });
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: {
        session: { access_token: "player-token" },
        user: { email: "ava.garcia@boardtpl.local" },
      },
      error: null,
    });
    const refreshCurrentUser = vi.fn();

    authState.value = {
      session: {
        access_token: "player-token",
        user: {
          email: "ava.garcia@boardtpl.local",
        },
      },
      currentUser: {
        subject: "user-1",
        displayName: "Ava Garcia",
        email: "ava.garcia@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["player"],
        avatarUrl: null,
      },
      loading: false,
      authError: null,
      client: {
        auth: {
          updateUser,
          signInWithPassword,
          mfa: {
            getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
              data: { currentLevel: "aal1", nextLevel: "aal1" },
              error: null,
            }),
            listFactors: vi.fn().mockResolvedValue({
              data: { all: [], totp: [] },
              error: null,
            }),
            challengeAndVerify: vi.fn(),
            enroll: vi.fn(),
            unenroll: vi.fn(),
          },
        },
      },
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser,
    };

    apiMocks.getUserProfile.mockResolvedValue({
      profile: {
        subject: "user-1",
        displayName: "Ava Garcia",
        userName: "ava.garcia",
        firstName: "Ava",
        lastName: "Garcia",
        email: "ava.garcia@boardtpl.local",
        emailVerified: true,
        avatarUrl: null,
        avatarDataUrl: null,
        initials: "AG",
        updatedAt: "2026-03-08T12:00:00Z",
      },
    });
    apiMocks.getDeveloperEnrollment.mockResolvedValue({
      developerEnrollment: {
        developerAccessEnabled: false,
        verifiedDeveloper: false,
      },
    });
    apiMocks.getPlayerLibrary.mockResolvedValue({ titles: [] });
    apiMocks.getPlayerWishlist.mockResolvedValue({ titles: [] });
    apiMocks.getPlayerTitleReports.mockResolvedValue({ reports: [] });
    apiMocks.updateUserProfile.mockResolvedValue({
      profile: {
        subject: "user-1",
        displayName: "Ava Garcia",
        userName: "ava.garcia",
        firstName: "Ava",
        lastName: "Garcia",
        email: "ava.garcia@boardtpl.local",
        emailVerified: true,
        avatarUrl: null,
        avatarDataUrl: null,
        initials: "AG",
        updatedAt: "2026-03-08T12:30:00Z",
      },
    });

    renderApp("/player?workflow=account-settings");

    await screen.findByRole("heading", { name: "Account Settings" });
    await userEvent.click(screen.getByRole("button", { name: "Edit Settings" }));
    await userEvent.clear(screen.getByRole("textbox", { name: /^email$/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /^email$/i }), "ava.new@boardtpl.local");
    await userEvent.type(screen.getByLabelText(/^Current password$/i), "Player!123");
    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "ava.garcia@boardtpl.local",
        password: "Player!123",
      });
      expect(updateUser).toHaveBeenCalledWith({ email: "ava.new@boardtpl.local" });
    });
    expect(apiMocks.updateUserProfile).toHaveBeenCalledWith("http://127.0.0.1:8787", "player-token", {
      firstName: "Ava",
      lastName: "Garcia",
    });
    expect(refreshCurrentUser).toHaveBeenCalled();
    expect(await screen.findByText("Settings updated. Confirm the email change from the message sent to ava.new@boardtpl.local.")).toBeVisible();
    expect(screen.getByText("Confirmation sent")).toBeVisible();
    expect(screen.getByText(/confirm the change from the email sent to ava\.new@boardtpl\.local/i)).toBeVisible();
  });

  it("lets players change their password from account settings", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: {
        session: { access_token: "player-token" },
        user: { email: "ava.garcia@boardtpl.local" },
      },
      error: null,
    });
    const updateUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          email: "ava.garcia@boardtpl.local",
        },
      },
      error: null,
    });

    authState.value = {
      session: {
        access_token: "player-token",
        user: {
          email: "ava.garcia@boardtpl.local",
        },
      },
      currentUser: {
        subject: "user-1",
        displayName: "Ava Garcia",
        email: "ava.garcia@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["player"],
        avatarUrl: null,
      },
      loading: false,
      authError: null,
      client: {
        auth: {
          updateUser,
          signInWithPassword,
          mfa: {
            getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
              data: { currentLevel: "aal1", nextLevel: "aal1" },
              error: null,
            }),
            listFactors: vi.fn().mockResolvedValue({
              data: { all: [], totp: [] },
              error: null,
            }),
            challengeAndVerify: vi.fn(),
            enroll: vi.fn(),
            unenroll: vi.fn(),
          },
        },
      },
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };

    apiMocks.getUserProfile.mockResolvedValue({
      profile: {
        subject: "user-1",
        displayName: "Ava Garcia",
        userName: "ava.garcia",
        firstName: "Ava",
        lastName: "Garcia",
        email: "ava.garcia@boardtpl.local",
        emailVerified: true,
        avatarUrl: null,
        avatarDataUrl: null,
        initials: "AG",
        updatedAt: "2026-03-08T12:00:00Z",
      },
    });
    apiMocks.getDeveloperEnrollment.mockResolvedValue({
      developerEnrollment: {
        developerAccessEnabled: false,
        verifiedDeveloper: false,
      },
    });
    apiMocks.getPlayerLibrary.mockResolvedValue({ titles: [] });
    apiMocks.getPlayerWishlist.mockResolvedValue({ titles: [] });
    apiMocks.getPlayerTitleReports.mockResolvedValue({ reports: [] });

    renderApp("/player?workflow=account-settings");

    await screen.findByRole("heading", { name: "Account Settings" });
    await userEvent.type(screen.getAllByLabelText(/^Current password$/i)[1]!, "Player!123");
    await userEvent.type(screen.getByLabelText(/^New password$/i), "NewPlayer!123");
    await userEvent.type(screen.getByLabelText(/^Confirm password$/i), "NewPlayer!123");
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "ava.garcia@boardtpl.local",
        password: "Player!123",
      });
      expect(updateUser).toHaveBeenCalledWith({
        password: "NewPlayer!123",
        current_password: "Player!123",
      });
    });
    expect(await screen.findByText("Password updated.")).toBeVisible();
  });

  it("keeps developer-only report messages visible to moderators", async () => {
    authState.value = {
      session: { access_token: "moderator-token" },
      currentUser: {
        subject: "user-2",
        displayName: "Alex Rivera",
        email: "alex.rivera@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["moderator"],
      },
      loading: false,
      authError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };
    apiMocks.getModerationTitleReports.mockResolvedValue({
      reports: [
        {
          id: "report-1",
          titleId: "title-1",
          studioId: "studio-1",
          studioSlug: "blue-harbor-games",
          studioDisplayName: "Blue Harbor Games",
          titleSlug: "compass-echo",
          titleDisplayName: "Compass Echo",
          titleShortDescription: "Coordinate routes across hidden currents.",
          genreDisplay: "Puzzle, Family",
          currentMetadataRevision: 2,
          reporterSubject: "user-1",
          reporterUserName: "ava.garcia",
          reporterDisplayName: "Ava Garcia",
          reporterEmail: "ava.garcia@boardtpl.local",
          status: "needs_developer_response",
          reason: "The install guidance references a companion feature that is not visible in the current testing build.",
          createdAt: "2026-03-08T09:10:00Z",
          updatedAt: "2026-03-08T10:05:00Z",
          resolvedAt: null,
          messageCount: 2,
        },
      ],
    });
    apiMocks.getModerationTitleReport.mockResolvedValue({
      report: {
        report: {
          id: "report-1",
          titleId: "title-1",
          studioId: "studio-1",
          studioSlug: "blue-harbor-games",
          studioDisplayName: "Blue Harbor Games",
          titleSlug: "compass-echo",
          titleDisplayName: "Compass Echo",
          titleShortDescription: "Coordinate routes across hidden currents.",
          genreDisplay: "Puzzle, Family",
          currentMetadataRevision: 2,
          reporterSubject: "user-1",
          reporterUserName: "ava.garcia",
          reporterDisplayName: "Ava Garcia",
          reporterEmail: "ava.garcia@boardtpl.local",
          status: "needs_developer_response",
          reason: "The install guidance references a companion feature that is not visible in the current testing build.",
          createdAt: "2026-03-08T09:10:00Z",
          updatedAt: "2026-03-08T10:05:00Z",
          resolvedAt: null,
          messageCount: 2,
        },
        resolutionNote: null,
        resolvedBy: null,
        messages: [
          {
            id: "message-1",
            authorSubject: "user-1",
            authorUserName: "ava.garcia",
            authorDisplayName: "Ava Garcia",
            authorEmail: "ava.garcia@boardtpl.local",
            authorRole: "player",
            audience: "all",
            message: "I expected to see the synced clue board mentioned in the listing, but I cannot find it.",
            createdAt: "2026-03-08T09:10:00Z",
          },
          {
            id: "message-2",
            authorSubject: "user-2",
            authorUserName: "alex.rivera",
            authorDisplayName: "Alex Rivera",
            authorEmail: "alex.rivera@boardtpl.local",
            authorRole: "moderator",
            audience: "developer",
            message: "Please confirm whether this feature is intentionally hidden in testing or if the listing needs an update.",
            createdAt: "2026-03-08T10:05:00Z",
          },
        ],
      },
    });

    renderApp("/moderate?workflow=reports-review&reportId=report-1");

    expect(await screen.findByRole("heading", { name: "Moderate" })).toBeVisible();
    expect(await screen.findByText("Please confirm whether this feature is intentionally hidden in testing or if the listing needs an update.")).toBeVisible();
    expect(screen.getByText(/developer only/i)).toBeVisible();
  });

  it("keeps the studio slug helper empty until the display name has a value", async () => {
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
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };
    apiMocks.getDeveloperEnrollment.mockResolvedValue({
      developerEnrollment: {
        status: "enrolled",
        actionRequiredBy: "none",
        developerAccessEnabled: true,
        verifiedDeveloper: false,
        canSubmitRequest: true,
      },
    });

    renderApp("/develop");

    await screen.findByRole("button", { name: "Create studio" });
    await userEvent.click(screen.getByRole("button", { name: "Create studio" }));

    const createStudioHeading = await screen.findByRole("heading", { name: "Create Studio" });
    const createStudioPanel = createStudioHeading.closest("form");
    expect(createStudioPanel).not.toBeNull();

    const nameInput = within(createStudioPanel!).getByRole("textbox", { name: /studio display name/i });
    expect(within(createStudioPanel!).queryByText(/^Slug:/)).not.toBeInTheDocument();

    await userEvent.type(nameInput, "Signal Harbor Studio");

    await waitFor(() => {
      const slugValue = within(createStudioPanel!).getByText("signal-harbor-studio");
      expect(slugValue).toBeVisible();
    expect(slugValue.closest("p")?.textContent).toBe("SLUG: signal-harbor-studio");
    });
  });

  it("supports studio avatar and media previews from url and upload in the create studio flow", async () => {
    seedDeveloperWorkspace();
    const mockedImageProcessing = mockRasterImageProcessing({ width: 400, height: 400 });
    try {
      apiMocks.createStudio.mockResolvedValue({
        studio: {
          id: "studio-2",
          slug: "signal-harbor-studio",
          displayName: "Signal Harbor Studio",
          description: "A coastal co-op studio profile.",
          avatarUrl: null,
          logoUrl: null,
          bannerUrl: null,
          role: "owner",
          links: [],
        },
      });
      apiMocks.uploadStudioMedia.mockResolvedValue({
        studio: {
          id: "studio-2",
          slug: "signal-harbor-studio",
          displayName: "Signal Harbor Studio",
          description: "A coastal co-op studio profile.",
          avatarUrl: "/uploads/avatar.png",
          logoUrl: "/uploads/logo.png",
          bannerUrl: null,
          role: "owner",
          links: [],
        },
      });

      renderApp("/develop");

      await screen.findByRole("button", { name: "Studios" });
      await userEvent.click(screen.getAllByRole("button", { name: "Create studio" })[0]);

      const createStudioForm = (await screen.findByRole("heading", { name: "Create Studio" })).closest("form");
      expect(createStudioForm).not.toBeNull();

      const avatarPanel = within(createStudioForm as HTMLElement).getByText("Avatar").closest("section");
      const logoPanel = within(createStudioForm as HTMLElement).getByText("Logo").closest("section");
      expect(avatarPanel).not.toBeNull();
      expect(logoPanel).not.toBeNull();
      expect(within(avatarPanel as HTMLElement).getByText("Optional. Recommended 512 x 512 px. Max 256 KB.")).toBeVisible();
      expect(within(logoPanel as HTMLElement).getByText("Optional. Recommended raster size 1200 x 400 px. SVG also supported. Max 256 KB.")).toBeVisible();

      await userEvent.type(within(createStudioForm as HTMLElement).getByRole("textbox", { name: /studio display name/i }), "Signal Harbor Studio");
      await userEvent.type(within(createStudioForm as HTMLElement).getByRole("textbox", { name: /description/i }), "A coastal co-op studio profile.");
      await userEvent.type(within(avatarPanel as HTMLElement).getByLabelText("URL"), "https://example.com/avatar.png");
      await userEvent.type(within(logoPanel as HTMLElement).getByLabelText("URL"), "https://example.com/logo.png");

      await waitFor(() => {
        expect(within(avatarPanel as HTMLElement).getByAltText("Avatar preview")).toHaveAttribute("src", "https://example.com/avatar.png");
        expect(within(logoPanel as HTMLElement).getByAltText("Logo preview")).toHaveAttribute("src", "https://example.com/logo.png");
      });

      const [avatarUploadInput, logoUploadInput] = (createStudioForm as HTMLElement).querySelectorAll('input[type="file"]');
      expect(avatarUploadInput).not.toBeUndefined();
      expect(logoUploadInput).not.toBeUndefined();

      await userEvent.upload(avatarUploadInput as HTMLInputElement, new File(["avatar-bytes"], "studio-avatar.png", { type: "image/png" }));
      await userEvent.upload(logoUploadInput as HTMLInputElement, new File(["logo-bytes"], "studio-logo.png", { type: "image/png" }));

      await waitFor(() => {
        expect(within(avatarPanel as HTMLElement).getByText("studio-avatar.png")).toBeVisible();
        expect(within(avatarPanel as HTMLElement).getByAltText("Avatar preview").getAttribute("src")).toMatch(/^data:image\/png/);
        expect(within(logoPanel as HTMLElement).getByText("studio-logo.png")).toBeVisible();
        expect(within(logoPanel as HTMLElement).getByAltText("Logo preview").getAttribute("src")).toMatch(/^data:image\/png/);
      });

      await userEvent.click(within(createStudioForm as HTMLElement).getByRole("button", { name: "Create studio" }));

      await waitFor(() => {
        expect(apiMocks.createStudio).toHaveBeenCalledWith("http://127.0.0.1:8787", "developer-token", expect.objectContaining({ avatarUrl: null, logoUrl: null }));
        expect(apiMocks.uploadStudioMedia).toHaveBeenCalledWith("http://127.0.0.1:8787", "developer-token", "studio-2", "avatar", expect.any(File));
        expect(apiMocks.uploadStudioMedia).toHaveBeenCalledWith("http://127.0.0.1:8787", "developer-token", "studio-2", "logo", expect.any(File));
      });
    } finally {
      mockedImageProcessing.restore();
    }
  });

  it("rejects oversized studio logo uploads before submission", async () => {
    seedDeveloperWorkspace();

    renderApp("/develop");

    await screen.findByRole("button", { name: "Studios" });
    await userEvent.click(screen.getAllByRole("button", { name: "Create studio" })[0]);

    const createStudioForm = (await screen.findByRole("heading", { name: "Create Studio" })).closest("form");
    expect(createStudioForm).not.toBeNull();

    const [, logoUploadInput] = (createStudioForm as HTMLElement).querySelectorAll('input[type="file"]');
    expect(logoUploadInput).not.toBeUndefined();
    const logoPanel = within(createStudioForm as HTMLElement).getByText("Logo").closest("section");
    expect(logoPanel).not.toBeNull();

    await userEvent.upload(
      logoUploadInput as HTMLInputElement,
      new File([new Uint8Array(256 * 1024 + 1)], "studio-logo.png", { type: "image/png" }),
    );

    expect(await within(logoPanel as HTMLElement).findByText("Uploaded studio logo image must be 256 KB or smaller.")).toBeVisible();
    expect(apiMocks.uploadStudioMedia).not.toHaveBeenCalled();
  });

  it("rejects oversized title card uploads before submission", async () => {
    seedDeveloperWorkspace();

    renderApp("/develop?domain=titles&workflow=titles-create&studioId=studio-1");

    const createTitleForm = (await screen.findByRole("heading", { name: "Create Title" })).closest("form");
    expect(createTitleForm).not.toBeNull();

    const [cardUploadInput] = (createTitleForm as HTMLElement).querySelectorAll('input[type="file"]');
    expect(cardUploadInput).not.toBeUndefined();
    const cardPanel = within(createTitleForm as HTMLElement).getByText("card").closest("section");
    expect(cardPanel).not.toBeNull();

    await userEvent.upload(
      cardUploadInput as HTMLInputElement,
      new File([new Uint8Array(1536 * 1024 + 1)], "card.png", { type: "image/png" }),
    );

    expect(await within(cardPanel as HTMLElement).findByText("Uploaded card image must be 1536 KB or smaller.")).toBeVisible();
    expect(apiMocks.uploadTitleMediaAsset).not.toHaveBeenCalled();
  });

  it("shows the selected title card preview immediately after upload", async () => {
    seedDeveloperWorkspace();

    renderApp("/develop?domain=titles&workflow=titles-create&studioId=studio-1");

    const createTitleForm = (await screen.findByRole("heading", { name: "Create Title" })).closest("form");
    expect(createTitleForm).not.toBeNull();

    const [cardUploadInput] = (createTitleForm as HTMLElement).querySelectorAll('input[type="file"]');
    expect(cardUploadInput).not.toBeUndefined();
    const cardPanel = within(createTitleForm as HTMLElement).getByText("card").closest("section");
    expect(cardPanel).not.toBeNull();

    const cardImage = new File([new Uint8Array([137, 80, 78, 71])], "card.png", { type: "image/png" });
    Object.defineProperty(cardImage, "size", { value: 1024 });

    const readAsDataURLSpy = vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function mockReadAsDataURL(this: FileReader, blob: Blob) {
      const file = blob as File;
      const dataUrl = file.name.endsWith(".webp") ? "data:image/webp;base64,preview" : "data:image/png;base64,source";
      setTimeout(() => {
        Object.defineProperty(this, "result", { configurable: true, value: dataUrl });
        this.onload?.({ target: this } as ProgressEvent<FileReader>);
      }, 0);
    });

    const originalImage = globalThis.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 900;
      naturalHeight = 1280;
      width = 900;
      height = 1280;

      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    // @ts-expect-error test double
    globalThis.Image = MockImage;

    const originalCreateElement = document.createElement.bind(document);
    const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" })));
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "canvas") {
        Object.defineProperty(element, "getContext", {
          configurable: true,
          value: () => ({ drawImage: vi.fn() }),
        });
        Object.defineProperty(element, "toBlob", {
          configurable: true,
          value: toBlob,
        });
      }
      return element;
    }) as typeof document.createElement);

    try {
      await userEvent.upload(cardUploadInput as HTMLInputElement, cardImage);

      expect(await within(cardPanel as HTMLElement).findByAltText("card media")).toHaveAttribute("src", expect.stringMatching(/^data:image\//));
      expect(within(cardPanel as HTMLElement).getByText("card.png")).toBeVisible();
      expect(within(cardPanel as HTMLElement).queryByText("No media")).not.toBeInTheDocument();
    } finally {
      readAsDataURLSpy.mockRestore();
      createElementSpy.mockRestore();
      globalThis.Image = originalImage;
    }
  });

  it("lets developers add multiple genres and remove only the selected chip in title create", async () => {
    seedDeveloperWorkspace();

    renderApp("/develop?domain=titles&workflow=titles-create&studioId=studio-1");

    const createTitleForm = (await screen.findByRole("heading", { name: "Create Title" })).closest("form");
    expect(createTitleForm).not.toBeNull();

    await userEvent.click(within(createTitleForm as HTMLElement).getByRole("button", { name: "Adventure" }));
    await userEvent.click(within(createTitleForm as HTMLElement).getByRole("button", { name: "Family" }));

    expect(within(createTitleForm as HTMLElement).getByRole("button", { name: "Remove Adventure" })).toBeVisible();
    expect(within(createTitleForm as HTMLElement).getByRole("button", { name: "Remove Family" })).toBeVisible();

    await userEvent.click(within(createTitleForm as HTMLElement).getByRole("button", { name: "Remove Adventure" }));

    expect(within(createTitleForm as HTMLElement).queryByRole("button", { name: "Remove Adventure" })).not.toBeInTheDocument();
    expect(within(createTitleForm as HTMLElement).getByRole("button", { name: "Remove Family" })).toBeVisible();
  });

  it("lets developers add a custom genre locally with Enter and persists it only when the title is saved", async () => {
    seedDeveloperWorkspace();
    window.sessionStorage.setItem(
      "develop-workspace-state",
      JSON.stringify({
        workspace: { domain: "titles", workflow: "titles-create", studioId: "studio-1", titleId: "", releaseId: "" },
        studioCreateDraft: {
          displayName: "",
          slug: "",
          description: "",
          logo: { url: "", previewUrl: "", fileName: null },
          banner: { url: "", previewUrl: "", fileName: null },
          links: [{ label: "", url: "" }],
        },
        studioCreateTouched: {},
        titleCreate: {
          studioId: "studio-1",
          touched: {},
          draft: {
            displayName: "Compass Echo",
            slug: "compass-echo-new",
            contentKind: "app",
            lifecycleStatus: "draft",
            visibility: "private",
            genres: [],
            genreInput: "",
            ageRatingAuthorityInput: "",
            shortDescription: "Plot expedition routes and track secrets.",
            description: "Plot expedition routes, track secrets, and sync clue boards.",
            minPlayers: 1,
            maxPlayers: 4,
            ageRatingAuthority: "ESRB",
            ageRatingValue: "E",
            minAgeYears: 10,
            media: {
              card: { url: "", altText: "" },
              hero: { url: "", altText: "" },
              logo: { url: "", altText: "" },
            },
          },
        },
        selectedReportId: null,
        reportReply: "",
      }),
    );
    apiMocks.createTitle.mockResolvedValue({
      title: {
        id: "title-2",
      },
    });
    apiMocks.listStudioTitles.mockResolvedValue({
      titles: [
        {
          id: "title-2",
          studioId: "studio-1",
          studioSlug: "blue-harbor-games",
          studioDisplayName: "Blue Harbor Games",
          slug: "compass-echo",
          contentKind: "app",
          lifecycleStatus: "draft",
          visibility: "private",
          isReported: false,
          currentMetadataRevision: 1,
          displayName: "Compass Echo",
          shortDescription: "Plot expedition routes and track secrets.",
          description: "Plot expedition routes, track secrets, and sync clue boards.",
          genreDisplay: "NewGenre",
          minPlayers: 1,
          maxPlayers: 4,
          ageRatingAuthority: "ESRB",
          ageRatingValue: "E",
          minAgeYears: 10,
          playerCountDisplay: "1-4 players",
          ageDisplay: "ESRB E",
          cardImageUrl: null,
          logoImageUrl: null,
          acquisitionUrl: null,
        },
      ],
    });
    apiMocks.getDeveloperTitle.mockResolvedValue({
      title: {
        id: "title-2",
        studioId: "studio-1",
        studioSlug: "blue-harbor-games",
        slug: "compass-echo",
        displayName: "Compass Echo",
        shortDescription: "Plot expedition routes and track secrets.",
        description: "Plot expedition routes, track secrets, and sync clue boards.",
        genreSlugs: ["newgenre"],
        contentKind: "app",
        lifecycleStatus: "draft",
        visibility: "private",
        genreDisplay: "NewGenre",
        minPlayers: 1,
        maxPlayers: 4,
        ageRatingAuthority: "ESRB",
        ageRatingValue: "E",
        minAgeYears: 10,
        playerCountDisplay: "1-4 players",
        ageDisplay: "ESRB E",
        acquisitionUrl: null,
        currentReleaseId: null,
        mediaAssets: [],
        createdAt: null,
        updatedAt: null,
      },
    });
    apiMocks.getTitleMetadataVersions.mockResolvedValue({
      metadataVersions: [
        {
          revisionNumber: 1,
          displayName: "Compass Echo",
          shortDescription: "Plot expedition routes and track secrets.",
          description: "Plot expedition routes, track secrets, and sync clue boards.",
          genreSlugs: ["newgenre"],
          genreDisplay: "NewGenre",
          minPlayers: 1,
          maxPlayers: 4,
          playerCountDisplay: "1-4 players",
          ageRatingAuthority: "ESRB",
          ageRatingValue: "E",
          minAgeYears: 10,
          ageDisplay: "ESRB E",
          isFrozen: false,
          isCurrent: true,
          createdAt: "2026-03-08T12:00:00Z",
          updatedAt: "2026-03-08T12:00:00Z",
        },
      ],
    });

    renderApp("/develop?domain=titles&workflow=titles-create&studioId=studio-1");

    const createTitleForm = (await screen.findByRole("heading", { name: "Create Title" })).closest("form");
    expect(createTitleForm).not.toBeNull();

    await userEvent.type(within(createTitleForm as HTMLElement).getByRole("textbox", { name: /genres/i }), "NewGenre");
    await userEvent.keyboard("{Enter}");

    expect(within(createTitleForm as HTMLElement).getByRole("button", { name: "Remove NewGenre" })).toBeVisible();

    await userEvent.click(within(createTitleForm as HTMLElement).getByRole("button", { name: /create title/i }));

    await waitFor(() => {
      expect(apiMocks.createTitle).toHaveBeenCalledWith(
        "http://127.0.0.1:8787",
        "developer-token",
        "studio-1",
        expect.objectContaining({
          metadata: expect.objectContaining({
            genreSlugs: ["NewGenre"],
          }),
        }),
      );
    });
  });

  it("restores legacy cached title-create drafts without crashing when fields change", async () => {
    seedDeveloperWorkspace();
    window.sessionStorage.setItem(
      "develop-workspace-state",
      JSON.stringify({
        workspace: { domain: "titles", workflow: "titles-create", studioId: "studio-1", titleId: "", releaseId: "" },
        studioCreateDraft: {
          displayName: "",
          slug: "",
          description: "",
          logo: { url: "", previewUrl: "", fileName: null },
          banner: { url: "", previewUrl: "", fileName: null },
          links: [{ label: "", url: "" }],
        },
        studioCreateTouched: {},
        titleCreate: {
          studioId: "studio-1",
          touched: {},
          draft: {
            displayName: "Legacy Draft",
            slug: "legacy-draft",
            contentKind: "game",
            lifecycleStatus: "draft",
            visibility: "private",
            genres: ["puzzle"],
            shortDescription: "",
            description: "Older cached drafts did not include every modern field.",
            minPlayers: 1,
            maxPlayers: 4,
            ageRatingAuthority: "ESRB",
            ageRatingValue: "E",
            minAgeYears: 10,
          },
        },
        selectedReportId: null,
        reportReply: "",
      }),
    );

    renderApp("/develop?domain=titles&workflow=titles-create&studioId=studio-1");

    const createTitleForm = (await screen.findByRole("heading", { name: "Create Title" })).closest("form");
    expect(createTitleForm).not.toBeNull();

    const shortDescriptionField = within(createTitleForm as HTMLElement).getByRole("textbox", { name: /short description/i });
    await userEvent.type(shortDescriptionField, "Legacy drafts still edit safely.");

    expect(shortDescriptionField).toHaveValue("Legacy drafts still edit safely.");
    expect(screen.getByRole("heading", { name: "Create Title" })).toBeVisible();
  });

  it("normalizes legacy metadata token values and removes only the selected genre in edit mode", async () => {
    seedDeveloperWorkspace();
    window.sessionStorage.setItem(
      "develop-workspace-state",
      JSON.stringify({
        workspace: { domain: "titles", workflow: "titles-metadata", studioId: "studio-1", titleId: "title-1", releaseId: "" },
        studioCreateDraft: {
          displayName: "",
          slug: "",
          description: "",
          logo: { url: "", previewUrl: "", fileName: null },
          banner: { url: "", previewUrl: "", fileName: null },
          links: [{ label: "", url: "" }],
        },
        studioCreateTouched: {},
        titleMetadata: {
          titleId: "title-1",
          editing: true,
          touched: {},
          draft: {
            displayName: "Lantern Drift",
            slug: "lantern-drift",
            contentKind: "game",
            lifecycleStatus: "published",
            visibility: "listed",
            genres: ["Adventure", "Puzzle", "Family"],
            genreInput: "",
            ageRatingAuthorityInput: "",
            shortDescription: "Guide glowing paper boats through midnight canals.",
            description: "Tilt waterways, spin lock-gates, and weave through fireworks across the river.",
            minPlayers: 1,
            maxPlayers: 4,
            ageRatingAuthority: "esrb",
            ageRatingValue: "E10+",
            minAgeYears: 10,
            media: {
              card: { url: "", altText: "" },
              hero: { url: "", altText: "" },
              logo: { url: "", altText: "" },
            },
          },
        },
        selectedReportId: null,
        reportReply: "",
      }),
    );

    renderApp("/develop?domain=titles&workflow=titles-metadata&studioId=studio-1&titleId=title-1");

    const metadataForm = (await screen.findByRole("textbox", { name: /display name/i })).closest("form");
    expect(metadataForm).not.toBeNull();

    await waitFor(() => {
      expect(within(metadataForm as HTMLElement).getByRole("button", { name: "Remove Adventure" })).toBeVisible();
    });

    await userEvent.click(within(metadataForm as HTMLElement).getByRole("button", { name: "Remove Adventure" }));

    expect(within(metadataForm as HTMLElement).queryByRole("button", { name: "Remove Adventure" })).not.toBeInTheDocument();
    expect(within(metadataForm as HTMLElement).getByRole("button", { name: "Remove Puzzle" })).toBeVisible();
    expect(within(metadataForm as HTMLElement).getByRole("button", { name: "Remove Family" })).toBeVisible();

    await userEvent.click(within(metadataForm as HTMLElement).getByRole("button", { name: "PEGI" }));

    expect(within(metadataForm as HTMLElement).getByRole("button", { name: "Remove PEGI" })).toBeVisible();
  });

  it("keeps genres usable when the age rating authority catalog request fails", async () => {
    seedDeveloperWorkspace();
    apiMocks.listAgeRatingAuthorities.mockRejectedValue(new Error("Could not find the table 'public.age_rating_authorities' in the schema cache"));

    renderApp("/develop?domain=titles&workflow=titles-create&studioId=studio-1");

    const createTitleForm = (await screen.findByRole("heading", { name: "Create Title" })).closest("form");
    expect(createTitleForm).not.toBeNull();

    const genresInput = within(createTitleForm as HTMLElement).getByRole("textbox", { name: /genres/i });
    await userEvent.type(genresInput, "Puzz");

    expect(within(createTitleForm as HTMLElement).getByRole("button", { name: "Puzzle" })).toBeVisible();

    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(within(createTitleForm as HTMLElement).getByRole("button", { name: "Remove Puzzle" })).toBeVisible();
    });

    expect(within(createTitleForm as HTMLElement).queryByText(/public\.age_rating_authorities/i)).not.toBeInTheDocument();

    await userEvent.click(within(createTitleForm as HTMLElement).getByRole("button", { name: "Remove Puzzle" }));

    expect(within(createTitleForm as HTMLElement).queryByRole("button", { name: "Remove Puzzle" })).not.toBeInTheDocument();

    await userEvent.type(genresInput, "Puzz");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(within(createTitleForm as HTMLElement).getByRole("button", { name: "Remove Puzzle" })).toBeVisible();
    });
  });

  it("updates studio links immediately when switching studio contexts in the overview", async () => {
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
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      verifyEmailCode: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
      refreshCurrentUser: vi.fn(),
    };
    apiMocks.getDeveloperEnrollment.mockResolvedValue({
      developerEnrollment: {
        status: "enrolled",
        actionRequiredBy: "none",
        developerAccessEnabled: true,
        verifiedDeveloper: false,
        canSubmitRequest: true,
      },
    });
    apiMocks.listManagedStudios.mockResolvedValue({
      studios: [
        { id: "studio-1", slug: "pine-labs", displayName: "Pine Labs", description: "Pine Labs profile.", avatarUrl: null, logoUrl: null, bannerUrl: null, role: "owner", links: [] },
        { id: "studio-2", slug: "blue-fairy-games", displayName: "Blue Fairy Games", description: "Blue Fairy Games profile.", avatarUrl: null, logoUrl: null, bannerUrl: null, role: "owner", links: [] },
        { id: "studio-3", slug: "great-gobs", displayName: "Great Gobs", description: "Great Gobs profile.", avatarUrl: null, logoUrl: null, bannerUrl: null, role: "owner", links: [] },
      ],
    });
    apiMocks.listStudioLinks.mockImplementation(async (_baseUrl: string, _token: string, studioId: string) => {
      const linksByStudio: Record<string, Array<{ id: string; label: string; url: string; createdAt: string; updatedAt: string }>> = {
        "studio-1": [{ id: "link-1", label: "Website", url: "https://pine-labs.example", createdAt: "2026-03-08T12:00:00Z", updatedAt: "2026-03-08T12:00:00Z" }],
        "studio-2": [{ id: "link-2", label: "LinkedIn", url: "https://linkedin.example/blue-fairy-games", createdAt: "2026-03-08T12:00:00Z", updatedAt: "2026-03-08T12:00:00Z" }],
        "studio-3": [{ id: "link-3", label: "Discord", url: "https://discord.example/great-gobs", createdAt: "2026-03-08T12:00:00Z", updatedAt: "2026-03-08T12:00:00Z" }],
      };
      return { links: linksByStudio[studioId] ?? [] };
    });
    apiMocks.listStudioTitles.mockResolvedValue({ titles: [] });

    renderApp("/develop");

    await screen.findByRole("heading", { name: "Studio links" });
    await screen.findByText("https://pine-labs.example");

    const studioSelect = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(studioSelect, "studio-2");

    await waitFor(() => {
      expect(screen.getByText("https://linkedin.example/blue-fairy-games")).toBeVisible();
      expect(screen.queryByText("https://pine-labs.example")).not.toBeInTheDocument();
    });

    await userEvent.selectOptions(studioSelect, "studio-3");

    await waitFor(() => {
      expect(screen.getByText("https://discord.example/great-gobs")).toBeVisible();
      expect(screen.queryByText("https://linkedin.example/blue-fairy-games")).not.toBeInTheDocument();
    });
  });

  it("publishes route-specific metadata for the landing privacy page", async () => {
    configState.value = {
      apiBaseUrl: "http://127.0.0.1:8787",
      supabaseUrl: "http://127.0.0.1:55421",
      supabasePublishableKey: "publishable-key",
      turnstileSiteKey: null,
      landingMode: true,
    };

    const descriptionMeta = document.createElement("meta");
    descriptionMeta.setAttribute("name", "description");
    descriptionMeta.setAttribute("content", "default description");
    document.head.appendChild(descriptionMeta);

    const ogTitleMeta = document.createElement("meta");
    ogTitleMeta.setAttribute("property", "og:title");
    ogTitleMeta.setAttribute("content", "default og title");
    document.head.appendChild(ogTitleMeta);

    const ogDescriptionMeta = document.createElement("meta");
    ogDescriptionMeta.setAttribute("property", "og:description");
    ogDescriptionMeta.setAttribute("content", "default og description");
    document.head.appendChild(ogDescriptionMeta);

    const ogUrlMeta = document.createElement("meta");
    ogUrlMeta.setAttribute("property", "og:url");
    ogUrlMeta.setAttribute("content", "https://boardenthusiasts.com/");
    document.head.appendChild(ogUrlMeta);

    const twitterTitleMeta = document.createElement("meta");
    twitterTitleMeta.setAttribute("name", "twitter:title");
    twitterTitleMeta.setAttribute("content", "default twitter title");
    document.head.appendChild(twitterTitleMeta);

    const twitterDescriptionMeta = document.createElement("meta");
    twitterDescriptionMeta.setAttribute("name", "twitter:description");
    twitterDescriptionMeta.setAttribute("content", "default twitter description");
    document.head.appendChild(twitterDescriptionMeta);

    const canonicalLink = document.createElement("link");
    canonicalLink.setAttribute("rel", "canonical");
    canonicalLink.setAttribute("href", "https://boardenthusiasts.com/");
    document.head.appendChild(canonicalLink);

    renderApp("/privacy");

    expect(await screen.findByRole("heading", { name: "Board Enthusiasts Privacy Snapshot" })).toBeVisible();
    expect(document.title).toBe("Board Enthusiasts Privacy Snapshot | Board Players and Builders");
    expect(descriptionMeta.getAttribute("content")).toBe(
      "Read the Board Enthusiasts privacy snapshot covering launch-list signup data, direct contact requests, and the hosted services used to support the Board community site.",
    );
    expect(ogTitleMeta.getAttribute("content")).toBe("Board Enthusiasts Privacy Snapshot | Board Players and Builders");
    expect(ogDescriptionMeta.getAttribute("content")).toBe(
      "Read the Board Enthusiasts privacy snapshot covering launch-list signup data, direct contact requests, and the hosted services used to support the Board community site.",
    );
    expect(ogUrlMeta.getAttribute("content")).toBe("https://boardenthusiasts.com/privacy");
    expect(twitterTitleMeta.getAttribute("content")).toBe("Board Enthusiasts Privacy Snapshot | Board Players and Builders");
    expect(twitterDescriptionMeta.getAttribute("content")).toBe(
      "Read the Board Enthusiasts privacy snapshot covering launch-list signup data, direct contact requests, and the hosted services used to support the Board community site.",
    );
    expect(canonicalLink.getAttribute("href")).toBe("https://boardenthusiasts.com/privacy");

    descriptionMeta.remove();
    ogTitleMeta.remove();
    ogDescriptionMeta.remove();
    ogUrlMeta.remove();
    twitterTitleMeta.remove();
    twitterDescriptionMeta.remove();
    canonicalLink.remove();
  });

  it("publishes route-specific metadata for the live privacy page", async () => {
    const descriptionMeta = document.createElement("meta");
    descriptionMeta.setAttribute("name", "description");
    descriptionMeta.setAttribute("content", "default description");
    document.head.appendChild(descriptionMeta);

    const ogTitleMeta = document.createElement("meta");
    ogTitleMeta.setAttribute("property", "og:title");
    ogTitleMeta.setAttribute("content", "default og title");
    document.head.appendChild(ogTitleMeta);

    const ogDescriptionMeta = document.createElement("meta");
    ogDescriptionMeta.setAttribute("property", "og:description");
    ogDescriptionMeta.setAttribute("content", "default og description");
    document.head.appendChild(ogDescriptionMeta);

    const ogUrlMeta = document.createElement("meta");
    ogUrlMeta.setAttribute("property", "og:url");
    ogUrlMeta.setAttribute("content", "https://boardenthusiasts.com/");
    document.head.appendChild(ogUrlMeta);

    const twitterTitleMeta = document.createElement("meta");
    twitterTitleMeta.setAttribute("name", "twitter:title");
    twitterTitleMeta.setAttribute("content", "default twitter title");
    document.head.appendChild(twitterTitleMeta);

    const twitterDescriptionMeta = document.createElement("meta");
    twitterDescriptionMeta.setAttribute("name", "twitter:description");
    twitterDescriptionMeta.setAttribute("content", "default twitter description");
    document.head.appendChild(twitterDescriptionMeta);

    const canonicalLink = document.createElement("link");
    canonicalLink.setAttribute("rel", "canonical");
    canonicalLink.setAttribute("href", "https://boardenthusiasts.com/");
    document.head.appendChild(canonicalLink);

    renderApp("/privacy");

    expect(await screen.findByRole("heading", { name: "BE Privacy Snapshot" })).toBeVisible();
    expect(document.title).toBe("BE Privacy Snapshot | For Board Players and Builders");
    expect(descriptionMeta.getAttribute("content")).toBe(
      "Read the BE privacy snapshot covering account registration, library activity, developer submissions, direct contact requests, and the hosted services that power the live Board Enthusiasts experience.",
    );
    expect(ogTitleMeta.getAttribute("content")).toBe("BE Privacy Snapshot | For Board Players and Builders");
    expect(ogDescriptionMeta.getAttribute("content")).toBe(
      "Read the BE privacy snapshot covering account registration, library activity, developer submissions, direct contact requests, and the hosted services that power the live Board Enthusiasts experience.",
    );
    expect(ogUrlMeta.getAttribute("content")).toBe("https://boardenthusiasts.com/privacy");
    expect(twitterTitleMeta.getAttribute("content")).toBe("BE Privacy Snapshot | For Board Players and Builders");
    expect(twitterDescriptionMeta.getAttribute("content")).toBe(
      "Read the BE privacy snapshot covering account registration, library activity, developer submissions, direct contact requests, and the hosted services that power the live Board Enthusiasts experience.",
    );
    expect(canonicalLink.getAttribute("href")).toBe("https://boardenthusiasts.com/privacy");
    expect(screen.getByText(/create and secure accounts, run the live library and workspace flows/i)).toBeVisible();

    descriptionMeta.remove();
    ogTitleMeta.remove();
    ogDescriptionMeta.remove();
    ogUrlMeta.remove();
    twitterTitleMeta.remove();
    twitterDescriptionMeta.remove();
    canonicalLink.remove();
  });

  it("shows the same studio media controls in the edit studio flow", async () => {
    seedDeveloperWorkspace();
    window.sessionStorage.setItem(
      "develop-workspace-state",
      JSON.stringify({
        workspace: { domain: "studios", workflow: "studios-overview", studioId: "studio-1", titleId: "", releaseId: "" },
        studioCreateDraft: {
          displayName: "",
          slug: "",
          description: "",
          logo: { url: "", previewUrl: "", fileName: null },
          banner: { url: "", previewUrl: "", fileName: null },
          links: [{ label: "", url: "" }],
        },
        studioCreateTouched: {},
        studioOverview: {
          studioId: "studio-1",
          editing: true,
          touched: {},
          draft: {
            displayName: "Blue Harbor Games",
            slug: "blue-harbor-games",
            description: "Blue Harbor Games builds cooperative adventures with approachable controls.",
            logo: {
              url: "/seed-catalog/studios/blue-harbor-games/logo.svg",
              previewUrl: "/seed-catalog/studios/blue-harbor-games/logo.svg",
              fileName: null,
            },
            banner: {
              url: "/seed-catalog/studios/blue-harbor-games/banner.svg",
              previewUrl: "/seed-catalog/studios/blue-harbor-games/banner.svg",
              fileName: null,
            },
            links: [{ id: "studio-link-1", label: "Website", url: "https://blue-harbor-games.example" }],
          },
        },
        selectedReportId: null,
        reportReply: "",
      }),
    );

    renderApp("/develop");

    const editStudioForm = (await screen.findByRole("heading", { name: "Edit Studio" })).closest("form");
    expect(editStudioForm).not.toBeNull();

    const editLogoPanel = within(editStudioForm as HTMLElement).getByText("Logo").closest("section");
    const editBannerPanel = within(editStudioForm as HTMLElement).getByText("Banner").closest("section");
    expect(editLogoPanel).not.toBeNull();
    expect(editBannerPanel).not.toBeNull();
    expect(within(editLogoPanel as HTMLElement).getByAltText("Logo preview")).toHaveAttribute("src", "/seed-catalog/studios/blue-harbor-games/logo.svg");
    expect(within(editBannerPanel as HTMLElement).getByAltText("Banner preview")).toHaveAttribute("src", "/seed-catalog/studios/blue-harbor-games/banner.svg");
    expect(within(editLogoPanel as HTMLElement).getByLabelText("URL")).toHaveValue("/seed-catalog/studios/blue-harbor-games/logo.svg");
    expect(within(editBannerPanel as HTMLElement).getByLabelText("URL")).toHaveValue("/seed-catalog/studios/blue-harbor-games/banner.svg");
  });
});
