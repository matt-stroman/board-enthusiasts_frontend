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
    signInWithOAuth: vi.fn(),
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
    discordAuthEnabled: false,
    githubAuthEnabled: false,
    googleAuthEnabled: false,
    client: {
      auth: {
        updateUser: vi.fn(),
        signInWithPassword: vi.fn(),
        signInWithOAuth: vi.fn(),
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
    signInWithSocialAuth: vi.fn(),
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
  getHomeSpotlights: vi.fn(),
  getHomeOfferingSpotlights: vi.fn(),
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
  getPlayerFollowedStudios: vi.fn(),
  addStudioToPlayerFollows: vi.fn(),
  removeStudioFromPlayerFollows: vi.fn(),
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
  getTitleShowcaseMedia: vi.fn(),
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
    appEnv: "production" as "local" | "staging" | "production",
    apiBaseUrl: "http://127.0.0.1:8787",
    supabaseUrl: "http://127.0.0.1:55421",
    supabasePublishableKey: "publishable-key",
    turnstileSiteKey: null as string | null,
    discordAuthEnabled: false,
    githubAuthEnabled: false,
    googleAuthEnabled: false,
    landingMode: false,
  },
}));

vi.mock("./config", () => ({
  readAppConfig: () => configState.value,
}));

vi.mock("./auth", () => ({
  passwordRecoveryRedirectStorageKey: "be-auth-password-recovery-pending",
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
      discordAuthEnabled: false,
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
      appEnv: "production",
      apiBaseUrl: "http://127.0.0.1:8787",
      supabaseUrl: "http://127.0.0.1:55421",
      supabasePublishableKey: "publishable-key",
      turnstileSiteKey: null,
      discordAuthEnabled: false,
      githubAuthEnabled: false,
      googleAuthEnabled: false,
      landingMode: false,
    };

    Object.values(apiMocks).forEach((mockFn) => mockFn.mockReset());
    fallbackAuthClient.auth.updateUser.mockReset();
    fallbackAuthClient.auth.signInWithPassword.mockReset();
    fallbackAuthClient.auth.signInWithOAuth.mockReset();
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
    apiMocks.getHomeSpotlights.mockResolvedValue({ entries: [] });
    apiMocks.getHomeOfferingSpotlights.mockResolvedValue({ entries: [] });
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
    apiMocks.getPlayerFollowedStudios.mockResolvedValue({ studios: [] });
    apiMocks.addStudioToPlayerFollows.mockResolvedValue({ studioId: "studio-1", included: true, alreadyInRequestedState: false });
    apiMocks.removeStudioFromPlayerFollows.mockResolvedValue({ studioId: "studio-1", included: false, alreadyInRequestedState: false });
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
    apiMocks.getTitleShowcaseMedia.mockResolvedValue({ showcaseMedia: [] });
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
    apiMocks.getTitleShowcaseMedia.mockResolvedValue({ showcaseMedia: [] });
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

    expect(await screen.findByRole("heading", { level: 1, name: "Discover indie Board games in one place." })).toBeVisible();
    expect(screen.getByText("For Board Players And Builders")).toBeVisible();
    expect(screen.getByText(/The BE Game Index is live/i)).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Browse Index" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Offerings" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Install" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Get Board" }).some((link) => link.getAttribute("href") === "https://board.fun/")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Join the Board Enthusiasts Discord" }).some((link) => link.getAttribute("href") === "https://discord.gg/cz2zReWqcA")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Sign In" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "A better way to keep up with indie Board releases." })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Featured offerings will appear here." })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Why BE exists" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "For Players" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "For Developers" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Portfolio" })).toHaveAttribute("href", "https://mattstroman.com");
    expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", "https://www.linkedin.com/in/mattstromandev/");
    expect(screen.queryByRole("link", { name: "Player Sign In" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Developer Sign In" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join the list" })).not.toBeInTheDocument();
  });

  it("keeps Browse highlighted only on browse routes", async () => {
    renderApp("/");

    await screen.findByRole("heading", { level: 1, name: "Discover indie Board games in one place." });

    const homeBrowseLink = screen.getAllByRole("link", { name: "Browse" }).find((link) => link.getAttribute("href") === "/browse");
    expect(homeBrowseLink).toBeDefined();
    expect(homeBrowseLink).not.toHaveClass("active");

    await userEvent.click(homeBrowseLink as HTMLAnchorElement);

    expect(await screen.findByLabelText("Search")).toBeVisible();

    const activeBrowseLink = screen.getAllByRole("link", { name: "Browse" }).find((link) => link.getAttribute("href") === "/browse");
    expect(activeBrowseLink).toBeDefined();
    expect(activeBrowseLink).toHaveClass("active");

    const homeLink = screen.getAllByRole("link").find((link) => link.getAttribute("href") === "/");
    expect(homeLink).toBeDefined();

    await userEvent.click(homeLink as HTMLAnchorElement);

    await screen.findByRole("heading", { level: 1, name: "Discover indie Board games in one place." });

    const returnedHomeBrowseLink = screen.getAllByRole("link", { name: "Browse" }).find((link) => link.getAttribute("href") === "/browse");
    expect(returnedHomeBrowseLink).toBeDefined();
    expect(returnedHomeBrowseLink).not.toHaveClass("active");
  });

  it("renders the dedicated offerings page and links users back to the game index", async () => {
    renderApp("/offerings");

    expect(await screen.findByRole("heading", { level: 1, name: "Explore the BE ecosystem." })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Available Now" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Coming Soon" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "How BE fits together" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Browse Game Index" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "BE Game Index" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "BE YouTube" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Watch Channel" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/@boardenthusiasts",
    );
    expect(screen.getByRole("heading", { name: "Board Enthusiasts API" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open API Docs" })).toHaveAttribute(
      "href",
      "https://documenter.getpostman.com/view/3468151/2sBXiompb8",
    );
    expect(screen.getByRole("heading", { name: "BE GDK for Board" })).toBeVisible();
    expect(screen.queryByText("How to use this page")).not.toBeInTheDocument();
    expect(screen.queryByText("What BE includes")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join the list" })).not.toBeInTheDocument();
  });

  it("renders the install guide with the Board download and install links", async () => {
    renderApp("/install-guide");

    expect(await screen.findByRole("heading", { level: 1, name: "Install Guide" })).toBeVisible();
    expect(screen.getByText("Follow these steps to find an indie Board game and install it onto your Board today.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Browse the index and pick an indie title to install." })).toBeVisible();
    expect(screen.getByRole("link", { name: "BE Game Index" })).toHaveAttribute("href", "/browse");
    expect(screen.getByRole("link", { name: "Board Developer Bridge (bdb)" })).toHaveAttribute(
      "href",
      "https://dev.board.fun/#:~:text=Board%20Developer%20Bridge%20(bdb)",
    );
    expect(screen.getByRole("link", { name: "Developer Terms of Use" })).toHaveAttribute("href", "https://dev.board.fun/");
    expect(screen.getByText(/Check the agreement box to enable the download buttons/i)).toBeVisible();
    expect(screen.getByText(/Download the version for your operating system/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Board's instructions" })).toHaveAttribute(
      "href",
      "https://docs.dev.board.fun/getting-started/deploy#board-developer-bridge-bdb",
    );
  });

  it("renders the support page with the support email address", async () => {
    renderApp("/support");

    expect(await screen.findByRole("heading", { level: 1, name: "Contact Us" })).toBeVisible();
    expect(screen.getByText(/we're here to help/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "support@boardenthusiasts.com" })).toHaveAttribute(
      "href",
      "mailto:support@boardenthusiasts.com",
    );
    expect(screen.getByRole("link", { name: "Email Support" })).toHaveAttribute(
      "href",
      "mailto:support@boardenthusiasts.com",
    );
  });

  it("shows a friendly browse error message and points users to contact us when the site cannot be reached", async () => {
    apiMocks.listPublicStudios.mockRejectedValue(
      new Error("Could not reach the Board Enthusiasts API. Check that the local backend is running and the configured frontend API base URL is correct."),
    );
    apiMocks.listCatalogTitles.mockRejectedValue(
      new Error("Could not reach the Board Enthusiasts API. Check that the local backend is running and the configured frontend API base URL is correct."),
    );

    renderApp("/browse");

    expect(await screen.findByText("We couldn't reach Board Enthusiasts right now. Please check your connection and try again.")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Contact Us" }).some((link) => link.getAttribute("href") === "/support")).toBe(true);
    expect(screen.queryByText(/configured frontend API base URL/i)).not.toBeInTheDocument();
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
    expect(screen.queryByText(/Preview environment\./i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse" })).not.toBeInTheDocument();
  });

  it("keeps the landing shell free of preview-environment notices outside production", async () => {
    configState.value = {
      ...configState.value,
      appEnv: "staging",
      landingMode: true,
    };

    renderApp("/");

    expect(await screen.findByRole("heading", { level: 1, name: "BE where the Board community shows up first." })).toBeVisible();
    expect(screen.queryByRole("note", { name: "Preview environment notice" })).not.toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("checkbox", { name: /I want to create indie content for Board/i }));
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
      toggleLabels: ["I want to create indie content for Board."],
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
          lifecycleStatus: "active",
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

    renderApp("/browse");

    expect(await screen.findByLabelText("Search")).toBeVisible();
    expect(await screen.findByText("Lantern Drift")).toBeVisible();
    expect(apiMocks.listCatalogTitles).toHaveBeenCalledWith("http://127.0.0.1:8787");

    await userEvent.click(screen.getByRole("button", { name: /lantern drift/i }));

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Lantern Drift" })).toBeVisible();
    expect(screen.getByLabelText("Search")).toBeVisible();
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
          lifecycleStatus: "active",
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
          lifecycleStatus: "active",
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
        lifecycleStatus: "active" as const,
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

    expect(await screen.findByLabelText("Search")).toBeVisible();
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
    expect(screen.getByText("Release", { selector: "dt" })).toBeVisible();
    expect(screen.getAllByText("1.0.0").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Current release" })).toBeVisible();
    expect(screen.getByText("Configured")).toBeVisible();
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
    expect(screen.queryByRole("link", { name: /Get title/i })).not.toBeInTheDocument();
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
          lifecycleStatus: "active",
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

    expect(await screen.findByLabelText("Search")).toBeVisible();
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
          lifecycleStatus: "active",
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
          lifecycleStatus: "active",
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

    expect(await screen.findByLabelText("Search")).toBeVisible();
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
    renderApp("/developer");

    expect(await screen.findByRole("heading", { name: "Sign In" })).toBeVisible();
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Developer seed account")).not.toBeInTheDocument();
    expect(screen.queryByText("Moderator seed account")).not.toBeInTheDocument();
    expect(screen.queryByText(/Local default:/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create an account" })).toBeVisible();
    expect(screen.getByRole("button", { name: "I forgot my password" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Confirm email" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back to browse" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in with Google" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in with GitHub" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in with Discord" })).not.toBeInTheDocument();
  });

  it("shows enabled social sign-in providers and stores the intended return path", async () => {
    configState.value = {
      ...configState.value,
      discordAuthEnabled: true,
      githubAuthEnabled: true,
      googleAuthEnabled: true,
    };
    authState.value = {
      ...authState.value,
      discordAuthEnabled: true,
      githubAuthEnabled: true,
      googleAuthEnabled: true,
      signInWithSocialAuth: vi.fn(),
    };

    renderApp("/auth/signin?returnTo=%2Fdeveloper");

    await userEvent.click(await screen.findByRole("button", { name: "Sign in with Discord" }));

    expect(authState.value.signInWithSocialAuth).toHaveBeenCalledWith("discord", "sign-in", undefined);
    expect(window.sessionStorage.getItem("signin-oauth-return-to")).toBe("/developer");
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
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

    renderApp("/developer");

    expect(await screen.findByRole("heading", { name: "Become a Developer" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Become a Developer" })).toBeVisible();
    expect(screen.getByText(/Signed in as taylor\.marsh@boardtpl\.local/i)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Access not available" })).not.toBeInTheDocument();
  });

  it("restores the maintained studio workflow navigation inside /developer", async () => {
    seedDeveloperWorkspace();

    renderApp("/developer");

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

    renderApp("/developer");

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

    renderApp("/developer?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

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

    renderApp("/developer?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

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

    renderApp("/developer?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

    const visibilitySwitch = await screen.findByRole("switch", { name: "Title visibility" });
    expect(visibilitySwitch).toBeDisabled();

    await userEvent.hover(visibilitySwitch.parentElement as HTMLElement);

    expect(screen.getByText("Activate this title when you are ready for players to start discovering it.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Activate and list title" })).toBeVisible();
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

    renderApp("/developer?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

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

    renderApp("/developer?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

    expect(await screen.findByRole("heading", { name: "Lantern Drift" })).toBeVisible();

    const titleActionsSection = screen.getByText("Title actions").closest("section");
    expect(titleActionsSection).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Unarchive title" }));

    expect(await within(titleActionsSection as HTMLElement).findByText("Your local title rules are out of date. Apply the latest database migrations, then try again.")).toBeVisible();
    expect(screen.queryByText('new row for relation "titles" violates check constraint "titles_draft_private"')).not.toBeInTheDocument();
  });

  it("shows duplicate release version errors under the create action in plain language", async () => {
    seedDeveloperWorkspace();
    apiMocks.createTitleRelease.mockRejectedValue(new Error('duplicate key value violates unique constraint "title_releases_title_version_unique"'));

    renderApp("/developer?domain=releases&workflow=releases-create&studioId=studio-1&titleId=title-1");

    expect(await screen.findByRole("heading", { name: "Create Release" })).toBeVisible();

    const createReleaseButton = screen.getByText("Create release", { selector: "button" });
    const releaseCreateSection = createReleaseButton.closest("section");
    expect(releaseCreateSection).not.toBeNull();

    await userEvent.click(createReleaseButton);

    expect(
      await within(releaseCreateSection as HTMLElement).findByText("This title already has a release with version 1.0.0. Choose a different version and try again."),
    ).toBeVisible();
    expect(screen.queryByText('duplicate key value violates unique constraint "title_releases_title_version_unique"')).not.toBeInTheDocument();
  });

  it("restores the release overview without the old publish workflow", async () => {
    seedDeveloperWorkspace();

    renderApp("/developer?domain=releases&workflow=releases-overview&studioId=studio-1&titleId=title-1&releaseId=release-1");

    expect(await screen.findByRole("heading", { name: "Release Overview" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Open publish" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Release type/i)).toBeVisible();
    expect(screen.getByLabelText(/Acquisition URL/i)).toBeVisible();
    expect(screen.queryByLabelText(/Metadata revision/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Release" })).toBeVisible();
    expect(screen.getByLabelText(/Version/i)).toBeDisabled();
    expect(screen.getByLabelText(/Release type/i)).toBeDisabled();
    expect(screen.getByLabelText(/Acquisition URL/i)).toBeDisabled();
  });

  it("unlocks the release overview for editing only after the user clicks edit, then saves", async () => {
    seedDeveloperWorkspace();
    apiMocks.updateTitleRelease.mockResolvedValue({
      release: {
        id: "release-1",
        version: "1.0.1",
        status: "testing",
        isCurrent: true,
        createdAt: "2026-03-08T12:00:00Z",
        publishedAt: "2026-03-08T12:30:00Z",
        updatedAt: "2026-03-09T12:30:00Z",
      },
    });

    renderApp("/developer?domain=releases&workflow=releases-overview&studioId=studio-1&titleId=title-1&releaseId=release-1");

    expect(await screen.findByRole("heading", { name: "Release Overview" })).toBeVisible();

    const versionInput = screen.getByLabelText(/Version/i);
    const releaseTypeSelect = screen.getByLabelText(/Release type/i);
    const acquisitionUrlInput = screen.getByLabelText(/Acquisition URL/i);

    expect(versionInput).toBeDisabled();
    expect(releaseTypeSelect).toBeDisabled();
    expect(acquisitionUrlInput).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Edit Release" }));

    expect(versionInput).toBeEnabled();
    expect(releaseTypeSelect).toBeEnabled();
    expect(acquisitionUrlInput).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save Release" })).toBeVisible();

    await userEvent.clear(versionInput);
    await userEvent.type(versionInput, "1.0.1");
    await userEvent.selectOptions(releaseTypeSelect, "testing");
    await userEvent.clear(acquisitionUrlInput);
    await userEvent.type(acquisitionUrlInput, "https://example.com/titles/lantern-drift/v1-0-1");
    await userEvent.click(screen.getByRole("button", { name: "Save Release" }));

    await waitFor(() => {
      expect(apiMocks.updateTitleRelease).toHaveBeenCalledWith("http://127.0.0.1:8787", "developer-token", "title-1", "release-1", {
        version: "1.0.1",
        status: "testing",
        acquisitionUrl: "https://example.com/titles/lantern-drift/v1-0-1",
        expiresAt: null,
      });
    });

    expect(await screen.findByText("Release saved.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit Release" })).toBeVisible();
    expect(versionInput).toBeDisabled();
    expect(releaseTypeSelect).toBeDisabled();
    expect(acquisitionUrlInput).toBeDisabled();
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

    renderApp("/developer?domain=releases&workflow=releases-overview&studioId=studio-1&titleId=title-1&releaseId=release-2");

    expect(await screen.findByRole("heading", { name: "Release Overview" })).toBeVisible();
    const releaseSelect = screen.getByDisplayValue("1.0.1 (Testing)");
    expect(within(releaseSelect).getByRole("option", { name: "1.0.0 (Production)" })).toBeVisible();
    expect(within(releaseSelect).getByRole("option", { name: "1.0.1 (Testing)" })).toBeVisible();
  });

  it("blocks title deletion confirmation when the current password is invalid", async () => {
    seedDeveloperWorkspace();
    apiMocks.verifyCurrentUserPassword.mockRejectedValue(new Error("Current password is incorrect."));

    renderApp("/developer?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

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

    renderApp("/developer?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

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

    renderApp("/developer?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

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

    renderApp("/developer?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

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

    renderApp("/developer?domain=titles&workflow=titles-overview&studioId=studio-1&titleId=title-1");

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
    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));

    const registerDialog = await screen.findByRole("dialog", { name: "Create your account" });
    expect(within(registerDialog).getByRole("heading", { name: "Create your account" })).toBeVisible();
    const createAccountButton = within(registerDialog).getByRole("button", { name: "Create an account" });
    expect(
      within(registerDialog).getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i }),
    ).not.toBeChecked();
    expect(createAccountButton).toBeDisabled();

    await userEvent.type(within(registerDialog).getByRole("textbox", { name: /^Email/i }), "new.player@example.com");
    fireEvent.blur(within(registerDialog).getByRole("textbox", { name: /^Email/i }));
    await userEvent.type(within(registerDialog).getByLabelText(/^Password/i), "NewPlayer!123");
    fireEvent.blur(within(registerDialog).getByLabelText(/^Password/i));
    await completeLocalAntiSpamCheck(within(registerDialog));

    await waitFor(() => expect(createAccountButton).toBeEnabled());
    await userEvent.click(createAccountButton);

    expect(signUp).toHaveBeenCalledWith({
      email: "new.player@example.com",
      password: "NewPlayer!123",
      captchaToken: "local-development-turnstile-token",
      marketingOptIn: false,
      marketingConsentTextVersion: null,
    });
    expect(await screen.findByText(/Account created\. Check your email/i)).toBeVisible();
  });

  it("passes signup marketing consent when the user opts in during registration", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));

    const registerDialog = await screen.findByRole("dialog", { name: "Create your account" });
    await userEvent.type(within(registerDialog).getByRole("textbox", { name: /^Email/i }), "new.player@example.com");
    fireEvent.blur(within(registerDialog).getByRole("textbox", { name: /^Email/i }));
    await userEvent.type(within(registerDialog).getByLabelText(/^Password/i), "NewPlayer!123");
    fireEvent.blur(within(registerDialog).getByLabelText(/^Password/i));
    await userEvent.click(within(registerDialog).getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i }));
    await completeLocalAntiSpamCheck(within(registerDialog));
    await userEvent.click(within(registerDialog).getByRole("button", { name: "Create an account" }));

    expect(signUp).toHaveBeenCalledWith({
      email: "new.player@example.com",
      password: "NewPlayer!123",
      captchaToken: "local-development-turnstile-token",
      marketingOptIn: true,
      marketingConsentTextVersion: "account-signup-v1",
    });
  });

  it("validates registration fields on blur and keeps submit disabled until the required fields are ready", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));

    const registerDialog = await screen.findByRole("dialog", { name: "Create your account" });
    const createAccountButton = within(registerDialog).getByRole("button", { name: "Create an account" });

    await userEvent.type(within(registerDialog).getByRole("textbox", { name: /^Email/i }), "not-an-email");
    fireEvent.blur(within(registerDialog).getByRole("textbox", { name: /^Email/i }));
    expect(await within(registerDialog).findByText("Enter a valid email address.")).toBeVisible();

    await userEvent.type(within(registerDialog).getByLabelText(/^Password/i), "short");
    fireEvent.blur(within(registerDialog).getByLabelText(/^Password/i));
    expect(await within(registerDialog).findByText("Use at least 8 characters.")).toBeVisible();
    expect(within(registerDialog).getByText("Add an uppercase letter.")).toBeVisible();
    expect(within(registerDialog).getByText("Add a number.")).toBeVisible();
    expect(within(registerDialog).getByText("Add a special character.")).toBeVisible();

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
    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));

    let registerDialog = await screen.findByRole("dialog", { name: "Create your account" });
    await userEvent.type(within(registerDialog).getByRole("textbox", { name: /^Email/i }), "new.player@example.com");
    await userEvent.type(within(registerDialog).getByLabelText(/^Password/i), "NewPlayer!123");
    await userEvent.click(within(registerDialog).getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i }));

    const registerOverlay = registerDialog.parentElement?.parentElement?.parentElement;
    expect(registerOverlay).toBeInstanceOf(HTMLElement);
    await userEvent.click(registerOverlay as HTMLElement);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Create your account" })).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));
    registerDialog = await screen.findByRole("dialog", { name: "Create your account" });

    expect(within(registerDialog).getByRole("textbox", { name: /^Email/i })).toHaveValue("");
    expect(within(registerDialog).getByLabelText(/^Password/i)).toHaveValue("");
    expect(within(registerDialog).getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i })).not.toBeChecked();
  });

  it("restores the registration draft after the page remounts", async () => {
    const firstRender = renderApp("/auth/signin");

    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));
    const registerDialog = await screen.findByRole("dialog", { name: "Create your account" });

    await userEvent.type(within(registerDialog).getByRole("textbox", { name: /^Email/i }), "persisted.player@example.com");
    await userEvent.type(within(registerDialog).getByLabelText(/^Password/i), "Persisted!123");
    await userEvent.click(within(registerDialog).getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i }));

    firstRender.unmount();

    renderApp("/auth/signin");

    expect(screen.queryByRole("dialog", { name: "Create your account" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));
    const restoredDialog = await screen.findByRole("dialog", { name: "Create your account" });
    expect(within(restoredDialog).getByRole("textbox", { name: /^Email/i })).toHaveValue("persisted.player@example.com");
    expect(within(restoredDialog).getByLabelText(/^Password/i)).toHaveValue("Persisted!123");
    expect(within(restoredDialog).getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i })).toBeChecked();
  });

  it("does not reopen the registration modal automatically from stored draft state", async () => {
    window.sessionStorage.setItem(
      "signin-page-draft",
      JSON.stringify({
        registerModalOpen: true,
        registrationEmail: "persisted.player@example.com",
        registrationPassword: "Persisted!123",
        registrationMarketingOptIn: true,
      }),
    );

    renderApp("/auth/signin");

    await screen.findByRole("heading", { name: "Sign In" });
    expect(screen.queryByRole("dialog", { name: "Create your account" })).not.toBeInTheDocument();
  });

  it("shows connected-account signup options at the top of the registration modal when providers are enabled", async () => {
    configState.value = {
      ...configState.value,
      discordAuthEnabled: true,
      googleAuthEnabled: true,
    };
    authState.value = {
      ...authState.value,
      discordAuthEnabled: true,
      googleAuthEnabled: true,
      signInWithSocialAuth: vi.fn(),
    };

    renderApp("/auth/signin");

    await screen.findByRole("heading", { name: "Sign In" });
    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));

    const registerDialog = await screen.findByRole("dialog", { name: "Create your account" });
    expect(within(registerDialog).getByRole("button", { name: "Sign up with Google" })).toBeVisible();
    expect(within(registerDialog).getByRole("button", { name: "Sign up with Discord" })).toBeVisible();
    expect(within(registerDialog).getByRole("button", { name: "Login" })).toBeVisible();

    await userEvent.click(within(registerDialog).getByRole("checkbox", { name: /I want email updates from Board Enthusiasts/i }));
    await userEvent.click(within(registerDialog).getByRole("button", { name: "Sign up with Discord" }));
    expect(authState.value.signInWithSocialAuth).toHaveBeenCalledWith("discord", "sign-up", {
      marketingOptIn: true,
      marketingConsentTextVersion: "account-signup-v1",
    });
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
    await userEvent.click(screen.getByRole("button", { name: "I forgot my password" }));
    const recoveryDialog = await screen.findByRole("dialog", { name: "Reset your password" });
    expect(within(recoveryDialog).getByRole("heading", { name: "Reset your password" })).toBeVisible();

    await userEvent.type(within(recoveryDialog).getByLabelText(/Email address/i), "new.player@example.com");
    await completeLocalAntiSpamCheck(within(recoveryDialog));
    await userEvent.click(within(recoveryDialog).getByRole("button", { name: "Send link to email" }));

    expect(requestPasswordReset).toHaveBeenCalledWith("new.player@example.com", "local-development-turnstile-token");
    expect(await within(recoveryDialog).findByText(/If that email matches an account/i)).toBeVisible();
    expect(within(recoveryDialog).getByLabelText("Recovery code")).toBeVisible();
    expect(within(recoveryDialog).getByRole("button", { name: "Confirm code" })).toBeVisible();
  });

  it("routes password recovery callbacks from the site root into the reset-password screen", async () => {
    authState.value = {
      session: { access_token: "recovery-token" },
      currentUser: {
        subject: "user-1",
        displayName: "Test User",
        email: "new.player@example.com",
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
    window.sessionStorage.setItem("be-auth-password-recovery-pending", "true");

    renderApp("/");

    const recoveryDialog = await screen.findByRole("dialog", { name: "Set new password" });
    expect(await within(recoveryDialog).findByRole("heading", { name: "Set new password" })).toBeVisible();
    expect(window.sessionStorage.getItem("be-auth-password-recovery-pending")).toBeNull();
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
    await userEvent.click(screen.getByRole("button", { name: "I forgot my password" }));
    const recoveryDialog = await screen.findByRole("dialog", { name: "Reset your password" });

    await userEvent.type(within(recoveryDialog).getByLabelText(/Email address/i), "new.player@example.com");
    await completeLocalAntiSpamCheck(within(recoveryDialog));
    await userEvent.click(within(recoveryDialog).getByRole("button", { name: "Send link to email" }));
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
    await userEvent.click(screen.getByRole("button", { name: "I forgot my password" }));
    const recoveryDialog = await screen.findByRole("dialog", { name: "Reset your password" });

    await userEvent.type(within(recoveryDialog).getByLabelText(/Email address/i), "new.player@example.com");
    await completeLocalAntiSpamCheck(within(recoveryDialog));
    await userEvent.click(within(recoveryDialog).getByRole("button", { name: "Send link to email" }));
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

  it("lets the recovery request step route to registration or back to sign in", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: "I forgot my password" }));
    const recoveryDialog = await screen.findByRole("dialog", { name: "Reset your password" });

    await userEvent.click(within(recoveryDialog).getByRole("button", { name: "Return to login" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Reset your password" })).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "I forgot my password" }));
    const reopenedRecoveryDialog = await screen.findByRole("dialog", { name: "Reset your password" });
    await userEvent.click(within(reopenedRecoveryDialog).getByRole("button", { name: "Create an account" }));

    expect(await screen.findByRole("dialog", { name: "Create your account" })).toBeVisible();
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

  it("holds the sign-in page open for MFA step-up after password authentication succeeds", async () => {
    const signIn = vi.fn(async (email: string, _password: string) => {
      authState.value = {
        ...authState.value,
        session: { access_token: "player-token", user: { email } },
        currentUser: {
          subject: "user-1",
          displayName: "Olivia Bennett",
          email,
          emailVerified: true,
          identityProvider: "email",
          roles: ["player"],
          avatarUrl: null,
        },
      };
    });

    authState.value = {
      session: null,
      currentUser: null,
      loading: false,
      authError: null,
      discordAuthEnabled: false,
      githubAuthEnabled: false,
      googleAuthEnabled: false,
      client: {
        auth: {
          updateUser: vi.fn(),
          signInWithPassword: vi.fn(),
          signInWithOAuth: vi.fn(),
          mfa: {
            getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
              data: { currentLevel: "aal1", nextLevel: "aal2" },
              error: null,
            }),
            listFactors: vi.fn().mockResolvedValue({
              data: {
                all: [{ id: "factor-1", factor_type: "totp", status: "verified", friendly_name: "Authenticator app" }],
                totp: [{ id: "factor-1", factor_type: "totp", status: "verified", friendly_name: "Authenticator app" }],
              },
              error: null,
            }),
            challengeAndVerify: vi.fn(),
            enroll: vi.fn(),
            unenroll: vi.fn(),
          },
        },
      },
      signIn,
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
        displayName: "Olivia Bennett",
        userName: "olivia.bennett",
        firstName: "Olivia",
        lastName: "Bennett",
        email: "olivia.bennett@boardtpl.local",
        emailVerified: true,
        avatarUrl: null,
        avatarDataUrl: null,
        initials: "OB",
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

    renderApp("/auth/signin?returnTo=%2Fplayer");

    await screen.findByRole("heading", { name: "Sign In" });
    await userEvent.type(screen.getByLabelText("Email"), "olivia.bennett@boardtpl.local");
    await userEvent.type(screen.getByLabelText("Password"), "Player!123");
    await userEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByRole("dialog", { name: "Complete sign-in" })).toBeVisible();
    expect(screen.getByText("Enter the code from your authenticator app to finish signing in.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "My Games" })).not.toBeInTheDocument();
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

    await screen.findByRole("heading", { level: 1, name: "Discover indie Board games in one place." });
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

    await screen.findByRole("heading", { level: 1, name: "Discover indie Board games in one place." });
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
    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ email: "ava.new@boardtpl.local" });
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
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
    await userEvent.type(screen.getByLabelText(/^Current password$/i), "Player!123");
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

  it("lets oauth-created users set a local password from account settings", async () => {
    const getUserIdentities = vi
      .fn()
      .mockResolvedValue({
        data: {
          identities: [
            {
              id: "identity-discord",
              user_id: "auth-user-1",
              identity_id: "discord-1",
              provider: "discord",
              identity_data: {
                email: "ava.garcia@boardtpl.local",
              },
            },
          ],
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
        identityProvider: "discord",
        roles: ["player"],
        avatarUrl: null,
      },
      loading: false,
      authError: null,
      client: {
        auth: {
          getUserIdentities,
          updateUser,
          signInWithPassword: vi.fn(),
          unlinkIdentity: vi.fn(),
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

    renderApp("/player?workflow=account-settings");

    await screen.findByRole("heading", { name: "Account Settings" });
    expect(screen.getByRole("button", { name: "Set Password" })).toBeVisible();
    expect(screen.getByText(/does not have a Board Enthusiasts password yet/i)).toBeVisible();
    await userEvent.type(screen.getByLabelText(/^Password$/i), "NewPlayer!123");
    await userEvent.type(screen.getByLabelText(/^Confirm password$/i), "NewPlayer!123");
    await userEvent.click(screen.getByRole("button", { name: "Set Password" }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({
        password: "NewPlayer!123",
      });
    });
    expect(refreshCurrentUser).toHaveBeenCalled();
    expect(await screen.findByText("Password set. You can now sign in with your email and password too.")).toBeVisible();
  });

  it("shows connected accounts and lets players disconnect one when another sign-in option remains", async () => {
    const githubIdentity = {
      id: "identity-github",
      user_id: "auth-user-1",
      identity_id: "github-1",
      provider: "github",
      identity_data: {
        email: "ava.garcia@boardtpl.local",
      },
    };
    const getUserIdentities = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          identities: [
            {
              id: "identity-email",
              user_id: "auth-user-1",
              identity_id: "email-1",
              provider: "email",
              identity_data: {
                email: "ava.garcia@boardtpl.local",
              },
            },
            githubIdentity,
            {
              id: "identity-discord",
              user_id: "auth-user-1",
              identity_id: "discord-1",
              provider: "discord",
              identity_data: {
                email: "ava.garcia@boardtpl.local",
              },
            },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          identities: [
            {
              id: "identity-email",
              user_id: "auth-user-1",
              identity_id: "email-1",
              provider: "email",
              identity_data: {
                email: "ava.garcia@boardtpl.local",
              },
            },
            {
              id: "identity-discord",
              user_id: "auth-user-1",
              identity_id: "discord-1",
              provider: "discord",
              identity_data: {
                email: "ava.garcia@boardtpl.local",
              },
            },
          ],
        },
        error: null,
      });
    const unlinkIdentity = vi.fn().mockResolvedValue({
      data: {},
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
      githubAuthEnabled: true,
      discordAuthEnabled: true,
      client: {
        auth: {
          getUserIdentities,
          unlinkIdentity,
          linkIdentity: vi.fn(),
          updateUser: vi.fn(),
          signInWithPassword: vi.fn(),
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

    renderApp("/player?workflow=account-connected-accounts");

    await screen.findByRole("heading", { name: "Connected Accounts" });
    expect(screen.getByRole("button", { name: "Connected Accounts" })).toBeVisible();
    expect(screen.getByText("Connected accounts")).toBeVisible();
    expect(screen.getByText("GitHub")).toBeVisible();
    expect(screen.getAllByText("Discord").length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole("button", { name: "Disconnect" })[0]!);

    expect(await screen.findByRole("dialog", { name: "Disconnect GitHub?" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Disconnect Account" }));

    await waitFor(() => {
      expect(unlinkIdentity).toHaveBeenCalledWith(githubIdentity);
    });
    expect(refreshCurrentUser).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Disconnect GitHub?" })).not.toBeInTheDocument();
    });
    expect(await screen.findByText("GitHub disconnected. You can reconnect it any time.")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Connect" }).length).toBeGreaterThan(0);
  });

  it("prompts oauth-only users to set a password before disconnecting their last connected account", async () => {
    const getUserIdentities = vi.fn().mockResolvedValue({
      data: {
        identities: [
          {
            id: "identity-discord",
            user_id: "auth-user-1",
            identity_id: "discord-1",
            provider: "discord",
            identity_data: {
              email: "ava.garcia@boardtpl.local",
            },
          },
        ],
      },
      error: null,
    });
    const unlinkIdentity = vi.fn();

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
        identityProvider: "discord",
        roles: ["player"],
        avatarUrl: null,
      },
      loading: false,
      authError: null,
      client: {
        auth: {
          getUserIdentities,
          unlinkIdentity,
          updateUser: vi.fn(),
          signInWithPassword: vi.fn(),
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

    renderApp("/player?workflow=account-connected-accounts");

    await screen.findByRole("heading", { name: "Connected Accounts" });
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    expect(await screen.findByRole("dialog", { name: "Add a password first" })).toBeVisible();
    expect(screen.getByText(/before you disconnect your last connected sign-in option/i)).toBeVisible();
    expect(unlinkIdentity).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Go To Password" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Add a password first" })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("heading", { name: "Account Settings" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Set Password" })).toBeVisible();
  });

  it.each([
    [
      "raw svg markup",
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#fff"/><path d="M1 1h2v2H1z" fill="#000"/></svg>',
      'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%208%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23fff%22%2F%3E%3Cpath%20d%3D%22M1%201h2v2H1z%22%20fill%3D%22%23000%22%2F%3E%3C%2Fsvg%3E',
    ],
    [
      "a data url",
      "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%208%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23fff%22%2F%3E%3Cpath%20d%3D%22M1%201h2v2H1z%22%20fill%3D%22%23000%22%2F%3E%3C%2Fsvg%3E",
      "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%208%208%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23fff%22%2F%3E%3Cpath%20d%3D%22M1%201h2v2H1z%22%20fill%3D%22%23000%22%2F%3E%3C%2Fsvg%3E",
    ],
  ])("renders the MFA enrollment QR code when Supabase returns %s", async (_label, qrCode, expectedSrc) => {
    const enroll = vi.fn().mockResolvedValue({
      data: {
        id: "factor-1",
        friendly_name: "Board Enthusiasts Authenticator",
        totp: {
          qr_code: qrCode,
          secret: "KOCQLDVBGA6YKLRL43NDRM2XWIAW74NJ",
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
          updateUser: vi.fn(),
          signInWithPassword: vi.fn(),
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
            enroll,
            unenroll: vi.fn(),
          },
        },
      },
      signIn: vi.fn(),
      signInWithSocialAuth: vi.fn(),
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
    await userEvent.click(screen.getByRole("button", { name: "Set Up Authenticator App" }));

    const qrCodeImage = await screen.findByRole("img", { name: "Authenticator QR code" });
    expect(qrCodeImage).toHaveAttribute("src", expectedSrc);
    expect(enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "Board Enthusiasts Authenticator",
      issuer: "Board Enthusiasts",
    });
  });

  it("lets the user restart MFA setup when a stale unverified factor exists", async () => {
    const unenroll = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const enroll = vi.fn().mockResolvedValue({
      data: {
        id: "factor-2",
        friendly_name: "Board Enthusiasts Authenticator",
        totp: {
          qr_code: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#fff"/><path d="M1 1h2v2H1z" fill="#000"/></svg>',
          secret: "KOCQLDVBGA6YKLRL43NDRM2XWIAW74NJ",
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
          updateUser: vi.fn(),
          signInWithPassword: vi.fn(),
          mfa: {
            getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
              data: { currentLevel: "aal1", nextLevel: "aal1" },
              error: null,
            }),
            listFactors: vi.fn().mockResolvedValue({
              data: {
                all: [{ id: "factor-stale", factor_type: "totp", status: "unverified", friendly_name: "Board Enthusiasts Authenticator" }],
                totp: [{ id: "factor-stale", factor_type: "totp", status: "unverified", friendly_name: "Board Enthusiasts Authenticator" }],
              },
              error: null,
            }),
            challengeAndVerify: vi.fn(),
            enroll,
            unenroll,
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
    expect(await screen.findByText("Authenticator setup incomplete")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Restart Authenticator Setup" }));

    await screen.findByRole("img", { name: "Authenticator QR code" });
    expect(unenroll).toHaveBeenCalledWith({ factorId: "factor-stale" });
    expect(enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "Board Enthusiasts Authenticator",
      issuer: "Board Enthusiasts",
    });
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

    renderApp("/developer");

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

      renderApp("/developer");

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
        expect(within(avatarPanel as HTMLElement).getByText("studio-avatar.webp")).toBeVisible();
        expect(within(avatarPanel as HTMLElement).getByAltText("Avatar preview").getAttribute("src")).toMatch(/^data:image\/webp/);
        expect(within(logoPanel as HTMLElement).getByText("studio-logo.webp")).toBeVisible();
        expect(within(logoPanel as HTMLElement).getByAltText("Logo preview").getAttribute("src")).toMatch(/^data:image\/webp/);
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

  it("reduces oversized studio logo uploads locally before submission", async () => {
    const mockedImageProcessing = mockRasterImageProcessing({ width: 1200, height: 400, blobSize: 4096, blobType: "image/webp" });

    try {
      seedDeveloperWorkspace();

      renderApp("/developer");

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

      expect(await within(logoPanel as HTMLElement).findByText("studio-logo.webp")).toBeVisible();
      expect(within(logoPanel as HTMLElement).queryByText("Uploaded studio logo image must be 256 KB or smaller.")).not.toBeInTheDocument();
      expect(apiMocks.uploadStudioMedia).not.toHaveBeenCalled();
    } finally {
      mockedImageProcessing.restore();
    }
  });

  it("reduces oversized title card uploads locally before submission", async () => {
    const mockedImageProcessing = mockRasterImageProcessing({ width: 900, height: 1280, blobSize: 4096, blobType: "image/webp" });

    try {
      seedDeveloperWorkspace();

      renderApp("/developer?domain=titles&workflow=titles-create&studioId=studio-1");

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

      expect(await within(cardPanel as HTMLElement).findByText("card.webp")).toBeVisible();
      expect(within(cardPanel as HTMLElement).queryByText("Uploaded card image must be 1536 KB or smaller.")).not.toBeInTheDocument();
      expect(apiMocks.uploadTitleMediaAsset).not.toHaveBeenCalled();
    } finally {
      mockedImageProcessing.restore();
    }
  });

  it("shows the selected title card preview immediately after upload", async () => {
    seedDeveloperWorkspace();

    renderApp("/developer?domain=titles&workflow=titles-create&studioId=studio-1");

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

      expect(await within(cardPanel as HTMLElement).findByAltText("card media")).toHaveAttribute("src", expect.stringMatching(/^data:image\/webp/));
      expect(within(cardPanel as HTMLElement).getByText("card.webp")).toBeVisible();
      expect(within(cardPanel as HTMLElement).queryByText("No media")).not.toBeInTheDocument();
    } finally {
      readAsDataURLSpy.mockRestore();
      createElementSpy.mockRestore();
      globalThis.Image = originalImage;
    }
  });

  it("lets developers add multiple genres and remove only the selected chip in title create", async () => {
    seedDeveloperWorkspace();

    renderApp("/developer?domain=titles&workflow=titles-create&studioId=studio-1");

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

    renderApp("/developer?domain=titles&workflow=titles-create&studioId=studio-1");

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

    renderApp("/developer?domain=titles&workflow=titles-create&studioId=studio-1");

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
            lifecycleStatus: "active",
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

    renderApp("/developer?domain=titles&workflow=titles-metadata&studioId=studio-1&titleId=title-1");

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

    renderApp("/developer?domain=titles&workflow=titles-create&studioId=studio-1");

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

    renderApp("/developer");

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
      appEnv: "production",
      apiBaseUrl: "http://127.0.0.1:8787",
      supabaseUrl: "http://127.0.0.1:55421",
      supabasePublishableKey: "publishable-key",
      turnstileSiteKey: null,
      discordAuthEnabled: false,
      githubAuthEnabled: false,
      googleAuthEnabled: false,
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
      "Read the Board Enthusiasts privacy snapshot covering update-list signups, support requests, limited site analytics, and the hosted services used to run the community site.",
    );
    expect(ogTitleMeta.getAttribute("content")).toBe("Board Enthusiasts Privacy Snapshot | Board Players and Builders");
    expect(ogDescriptionMeta.getAttribute("content")).toBe(
      "Read the Board Enthusiasts privacy snapshot covering update-list signups, support requests, limited site analytics, and the hosted services used to run the community site.",
    );
    expect(ogUrlMeta.getAttribute("content")).toBe("https://boardenthusiasts.com/privacy");
    expect(twitterTitleMeta.getAttribute("content")).toBe("Board Enthusiasts Privacy Snapshot | Board Players and Builders");
    expect(twitterDescriptionMeta.getAttribute("content")).toBe(
      "Read the Board Enthusiasts privacy snapshot covering update-list signups, support requests, limited site analytics, and the hosted services used to run the community site.",
    );
    expect(canonicalLink.getAttribute("href")).toBe("https://boardenthusiasts.com/privacy");
    expect(screen.getByText(/anonymous analytics or browser storage identifiers/i)).toBeVisible();

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
      "Read the BE privacy snapshot covering account registration, optional social sign-in, catalog activity, developer submissions, support requests, and the hosted services used to run the live Board Enthusiasts experience.",
    );
    expect(ogTitleMeta.getAttribute("content")).toBe("BE Privacy Snapshot | For Board Players and Builders");
    expect(ogDescriptionMeta.getAttribute("content")).toBe(
      "Read the BE privacy snapshot covering account registration, optional social sign-in, catalog activity, developer submissions, support requests, and the hosted services used to run the live Board Enthusiasts experience.",
    );
    expect(ogUrlMeta.getAttribute("content")).toBe("https://boardenthusiasts.com/privacy");
    expect(twitterTitleMeta.getAttribute("content")).toBe("BE Privacy Snapshot | For Board Players and Builders");
    expect(twitterDescriptionMeta.getAttribute("content")).toBe(
      "Read the BE privacy snapshot covering account registration, optional social sign-in, catalog activity, developer submissions, support requests, and the hosted services used to run the live Board Enthusiasts experience.",
    );
    expect(canonicalLink.getAttribute("href")).toBe("https://boardenthusiasts.com/privacy");
    expect(screen.getByText(/optional profile and Board profile fields/i)).toBeVisible();
    expect(screen.getByText(/Cloudflare hosts the web and API surfaces and provides Turnstile plus internal analytics tooling/i)).toBeVisible();
    expect(screen.getByText(/If a developer chooses to list a studio, title, release, image, or related profile detail on BE/i)).toBeVisible();

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

    renderApp("/developer");

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
