using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Board.ThirdPartyLibrary.Frontend.Web.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Board.ThirdPartyLibrary.Frontend.Web.Tests;

public sealed class AppRouteSmokeTests : IClassFixture<AppRouteSmokeTests.TestWebApplicationFactory>
{
    private readonly HttpClient client;

    public AppRouteSmokeTests(TestWebApplicationFactory factory)
    {
        client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });
    }

    [Theory]
    [InlineData("/", "Board Enthusiasts")]
    [InlineData("/games", "Star Blasters")]
    [InlineData("/organizations/stellar-forge", "Stellar Forge")]
    [InlineData("/player/games", "My Games")]
    [InlineData("/player/wishlist", "No wishlist items yet")]
    [InlineData("/games/stellar-forge/star-blasters", "View on itch.io")]
    [InlineData("/develop", "Stellar Forge")]
    [InlineData("/develop/organizations/new", "Create organization")]
    [InlineData("/develop/organizations/11111111-1111-1111-1111-111111111111", "Edit organization")]
    [InlineData("/develop/organizations/11111111-1111-1111-1111-111111111111/settings", "Save changes")]
    [InlineData("/develop/organizations/11111111-1111-1111-1111-111111111111/titles", "Manage title metadata")]
    [InlineData("/develop/organizations/11111111-1111-1111-1111-111111111111/titles/new", "Create title")]
    [InlineData("/develop/titles/33333333-3333-3333-3333-333333333333", "Save title settings")]
    [InlineData("/develop/titles/33333333-3333-3333-3333-333333333333/metadata", "Save metadata")]
    [InlineData("/develop/titles/33333333-3333-3333-3333-333333333333/media", "Configure card, hero, and logo media")]
    [InlineData("/develop/titles/33333333-3333-3333-3333-333333333333/releases", "Create release")]
    [InlineData("/develop/titles/33333333-3333-3333-3333-333333333333/acquisition", "Current bindings")]
    [InlineData("/account", "Player library access")]
    [InlineData("/account/profile", "Public profile")]
    [InlineData("/account/settings", "Account Settings")]
    [InlineData("/signin?error=identity-provider-unavailable", "Sign in is unavailable right now")]
    [InlineData("/signin?error=identity-provider-session-expired", "Sign-in session expired")]
    public async Task Route_ReturnsSuccessfulResponse_WithExpectedMarker(string route, string expectedContent)
    {
        var response = await client.GetAsync(route);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains(expectedContent, content);
    }

    [Fact]
    public async Task DevelopRoute_WithPlayerOnlyAccount_ShowsDeveloperOnboarding()
    {
        using var factory = new TestWebApplicationFactory(
            new TestApiData(
                CurrentUser: new CurrentUserResponse(
                    "user-456",
                    "Player One",
                    "player@boardtpl.local",
                    true,
                    null,
                    ["player"]),
                ManagedOrganizations: new DeveloperOrganizationListResponse([])));

        using var playerClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await playerClient.GetAsync("/develop");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Become a Developer", content);
        Assert.DoesNotContain("Managed organizations", content);
        Assert.DoesNotContain("Current status", content, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Step 1", content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task LegacyDeveloperAccessRoute_ReturnsNotFoundPage()
    {
        var response = await client.GetAsync("/account/developer-access");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AccountSettingsRoute_ShowsKeycloakProfileEditActions()
    {
        var response = await client.GetAsync("/account/settings");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("/auth/update-profile?returnUrl=%2Faccount%2Fsettings", content);
        Assert.Contains("Edit username", content);
        Assert.Contains("Edit first name", content);
        Assert.Contains("Edit last name", content);
        Assert.Contains("Edit email address", content);
    }

    public sealed class TestWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly TestApiData data;

        public TestWebApplicationFactory()
            : this(TestApiData.Default)
        {
        }

        internal TestWebApplicationFactory(TestApiData data)
        {
            this.data = data;
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton(data);
                services.RemoveAll<IBoardLibraryApiClient>();
                services.AddSingleton<IBoardLibraryApiClient, StubBoardLibraryApiClient>();

                services.AddSingleton(new TestAuthClaimsProvider(BuildClaims(data.CurrentUser)));

                services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                    options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                    options.DefaultScheme = TestAuthHandler.SchemeName;
                }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
            });
        }

        private static IReadOnlyList<Claim> BuildClaims(CurrentUserResponse currentUser)
        {
            var claims = new List<Claim>
            {
                new("sub", currentUser.Subject),
                new(ClaimTypes.Name, currentUser.DisplayName ?? currentUser.Subject)
            };

            if (!string.IsNullOrWhiteSpace(currentUser.Email))
            {
                claims.Add(new Claim(ClaimTypes.Email, currentUser.Email));
            }

            claims.AddRange(currentUser.Roles.Select(role => new Claim(ClaimTypes.Role, role)));
            return claims;
        }
    }

    public sealed record TestApiData(
        CurrentUserResponse CurrentUser,
        UserProfile? UserProfile = null,
        DeveloperEnrollmentResponse? DeveloperEnrollment = null,
        BoardProfile? BoardProfile = null,
        DeveloperOrganizationListResponse? ManagedOrganizations = null)
    {
        public static TestApiData Default { get; } = new(
            CurrentUser: new CurrentUserResponse(
                "user-123",
                "Local Admin",
                "admin@boardtpl.local",
                true,
                null,
                ["admin", "developer", "player"]),
            UserProfile: new UserProfile(
                "user-123",
                "Local Admin",
                "local-admin",
                "Local",
                "Admin",
                "admin@boardtpl.local",
                true,
                null,
                null,
                "LA",
                DateTime.Parse("2026-03-01T18:00:00Z")),
            DeveloperEnrollment: new DeveloperEnrollmentResponse(
                new DeveloperEnrollment(
                    "enrolled",
                    "none",
                    true,
                    false,
                    true)),
            BoardProfile: new BoardProfile(
                "board_user_12345",
                "BoardKiddo",
                "https://cdn.board.fun/users/board_user_12345/avatar.png",
                DateTime.Parse("2026-03-01T18:00:00Z"),
                DateTime.Parse("2026-03-01T18:00:00Z")),
            ManagedOrganizations: new DeveloperOrganizationListResponse(
                [
                    new DeveloperOrganizationSummary(
                        Guid.Parse("11111111-1111-1111-1111-111111111111"),
                        "stellar-forge",
                        "Stellar Forge",
                        "Family co-op studio.",
                        "https://cdn.example.com/orgs/stellar-forge.png",
                        "owner")
                ]));
    }

    private sealed class StubBoardLibraryApiClient(TestApiData data) : IBoardLibraryApiClient
    {
        public Task<CatalogTitleListResponse> GetCatalogTitlesAsync(CatalogBrowseRequest request, CancellationToken cancellationToken = default)
        {
            var allTitles = new[]
            {
                new CatalogTitleSummary(
                    Guid.Parse("33333333-3333-3333-3333-333333333333"),
                    Guid.Parse("11111111-1111-1111-1111-111111111111"),
                    "stellar-forge",
                    "star-blasters",
                    "game",
                    "testing",
                    "listed",
                    2,
                    "Star Blasters",
                    "Family space battles in short rounds.",
                    "Action, Shooter",
                    1,
                    4,
                    "1-4 players",
                    "ESRB",
                    "E10+",
                    10,
                    "ESRB E10+",
                    "https://cdn.example.com/titles/star-blasters/card.png",
                    "https://stellar-forge.itch.io/star-blasters"),
                new CatalogTitleSummary(
                    Guid.Parse("44444444-4444-4444-4444-444444444444"),
                    Guid.Parse("11111111-1111-1111-1111-111111111111"),
                    "stellar-forge",
                    "puzzle-grove",
                    "game",
                    "published",
                    "listed",
                    1,
                    "Puzzle Grove",
                    "A quiet co-op puzzle journey.",
                    "Puzzle, Family",
                    1,
                    2,
                    "1-2 players",
                    "ESRB",
                    "E",
                    6,
                    "ESRB E",
                    "https://cdn.example.com/titles/puzzle-grove/card.png",
                    null)
            };

            var filtered = allTitles.AsEnumerable();

            if (!string.IsNullOrWhiteSpace(request.OrganizationSlug))
            {
                filtered = filtered.Where(candidate =>
                    string.Equals(candidate.OrganizationSlug, request.OrganizationSlug, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(request.ContentKind))
            {
                filtered = filtered.Where(candidate =>
                    string.Equals(candidate.ContentKind, request.ContentKind, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(request.Genre))
            {
                filtered = filtered.Where(candidate =>
                    string.Equals(candidate.GenreDisplay, request.Genre, StringComparison.OrdinalIgnoreCase));
            }

            var ordered = string.Equals(request.Sort, "genre", StringComparison.OrdinalIgnoreCase)
                ? filtered.OrderBy(candidate => candidate.GenreDisplay).ThenBy(candidate => candidate.DisplayName)
                : filtered.OrderBy(candidate => candidate.DisplayName).ThenBy(candidate => candidate.OrganizationSlug);

            var result = ordered.ToArray();
            var pageSize = request.PageSize <= 0 ? 12 : request.PageSize;
            var pageNumber = request.PageNumber <= 0 ? 1 : request.PageNumber;
            var totalPages = result.Length == 0 ? 0 : (int)Math.Ceiling(result.Length / (double)pageSize);
            var skip = (pageNumber - 1) * pageSize;
            var page = result.Skip(skip).Take(pageSize).ToArray();

            return Task.FromResult(
                new CatalogTitleListResponse(
                    page,
                    new CatalogPaging(
                        pageNumber,
                        pageSize,
                        result.Length,
                        totalPages,
                        pageNumber > 1 && totalPages > 0,
                        pageNumber < totalPages)));
        }

        public Task<CatalogTitle?> GetCatalogTitleAsync(string organizationSlug, string titleSlug, CancellationToken cancellationToken = default) =>
            Task.FromResult<CatalogTitle?>(
                new CatalogTitle(
                    Guid.Parse("33333333-3333-3333-3333-333333333333"),
                    Guid.Parse("11111111-1111-1111-1111-111111111111"),
                    "stellar-forge",
                    "star-blasters",
                    "game",
                    "testing",
                    "listed",
                    2,
                    "Star Blasters",
                    "Family space battles in short rounds.",
                    "Pilot colorful starships through family-friendly arena battles built for the Board console.",
                    "Arcade Shooter",
                    1,
                    4,
                    "1-4 players",
                    "ESRB",
                    "E10+",
                    10,
                    "ESRB E10+",
                    "https://cdn.example.com/titles/star-blasters/card.png",
                    "https://stellar-forge.itch.io/star-blasters",
                    [
                        new TitleMediaAsset(
                            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                            "hero",
                            "https://cdn.example.com/titles/star-blasters/hero.png",
                            "Full-screen battle scene.",
                            "image/png",
                            1920,
                            1080,
                            DateTime.Parse("2026-03-02T18:00:00Z"),
                            DateTime.Parse("2026-03-02T18:00:00Z"))
                    ],
                    new CurrentTitleRelease(
                        Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                        "1.0.0",
                        2,
                        DateTime.Parse("2026-03-02T19:00:00Z")),
                    new PublicTitleAcquisition(
                        "https://stellar-forge.itch.io/star-blasters",
                        "View on itch.io",
                        "itch.io",
                        "https://itch.io/"),
                    DateTime.Parse("2026-03-02T18:00:00Z"),
                    DateTime.Parse("2026-03-02T18:10:00Z")));

        public Task<OrganizationListResponse> GetPublicOrganizationsAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new OrganizationListResponse(
                [
                    new OrganizationSummary(
                        Guid.Parse("11111111-1111-1111-1111-111111111111"),
                        "stellar-forge",
                        "Stellar Forge",
                        "Family co-op studio.",
                        "https://cdn.example.com/orgs/stellar-forge.png",
                        DateTime.Parse("2026-03-01T18:00:00Z"),
                        DateTime.Parse("2026-03-01T18:00:00Z"))
                ]));

        public Task<OrganizationSummary?> GetPublicOrganizationBySlugAsync(string slug, CancellationToken cancellationToken = default) =>
            Task.FromResult<OrganizationSummary?>(
                string.Equals(slug, "stellar-forge", StringComparison.OrdinalIgnoreCase)
                    ? new OrganizationSummary(
                        Guid.Parse("11111111-1111-1111-1111-111111111111"),
                        "stellar-forge",
                        "Stellar Forge",
                        "Family co-op studio.",
                        "https://cdn.example.com/orgs/stellar-forge.png",
                        DateTime.Parse("2026-03-01T18:00:00Z"),
                        DateTime.Parse("2026-03-01T18:00:00Z"))
                    : null);

        public Task<CurrentUserResponse?> GetCurrentUserAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<CurrentUserResponse?>(data.CurrentUser);

        public Task<UserProfile?> GetCurrentUserProfileAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<UserProfile?>(data.UserProfile ?? new UserProfile(data.CurrentUser.Subject, data.CurrentUser.DisplayName, null, null, null, data.CurrentUser.Email, data.CurrentUser.EmailVerified, null, null, "U", DateTime.UtcNow));

        public Task<UserProfileResponse> UpdateCurrentUserProfileAsync(UpdateUserProfileRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(new UserProfileResponse(
                (data.UserProfile ?? new UserProfile(data.CurrentUser.Subject, data.CurrentUser.DisplayName, null, null, null, data.CurrentUser.Email, data.CurrentUser.EmailVerified, null, null, "U", DateTime.UtcNow))
                with
                {
                    DisplayName = request.DisplayName
                }));

        public Task<UserProfileResponse> SetCurrentUserAvatarUrlAsync(string avatarUrl, CancellationToken cancellationToken = default) =>
            Task.FromResult(new UserProfileResponse(
                (data.UserProfile ?? new UserProfile(data.CurrentUser.Subject, data.CurrentUser.DisplayName, null, null, null, data.CurrentUser.Email, data.CurrentUser.EmailVerified, null, null, "U", DateTime.UtcNow))
                with
                {
                    AvatarUrl = avatarUrl,
                    AvatarDataUrl = null
                }));

        public Task<UserProfileResponse> UploadCurrentUserAvatarAsync(ApiUploadFile avatarFile, CancellationToken cancellationToken = default) =>
            Task.FromResult(new UserProfileResponse(
                (data.UserProfile ?? new UserProfile(data.CurrentUser.Subject, data.CurrentUser.DisplayName, null, null, null, data.CurrentUser.Email, data.CurrentUser.EmailVerified, null, null, "U", DateTime.UtcNow))
                with
                {
                    AvatarUrl = null,
                    AvatarDataUrl = $"data:{avatarFile.ContentType};base64,{Convert.ToBase64String(avatarFile.Content)}"
                }));

        public Task<UserProfileResponse> RemoveCurrentUserAvatarAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(new UserProfileResponse(
                (data.UserProfile ?? new UserProfile(data.CurrentUser.Subject, data.CurrentUser.DisplayName, null, null, null, data.CurrentUser.Email, data.CurrentUser.EmailVerified, null, null, "U", DateTime.UtcNow))
                with
                {
                    AvatarUrl = null,
                    AvatarDataUrl = null
                }));

        public Task<BoardProfile?> GetBoardProfileAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(data.BoardProfile);

        public Task<DeveloperEnrollmentResponse> GetDeveloperEnrollmentAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(
                data.DeveloperEnrollment
                ?? new DeveloperEnrollmentResponse(
                    new DeveloperEnrollment(
                        "not_enrolled",
                        "none",
                        false,
                        true)));

        public Task<DeveloperEnrollmentResponse> SubmitDeveloperEnrollmentAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(
                data.DeveloperEnrollment
                ?? new DeveloperEnrollmentResponse(
                    new DeveloperEnrollment(
                        "enrolled",
                        "none",
                        true,
                        false)));

        public Task<DeveloperOrganizationListResponse> GetManagedOrganizationsAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(data.ManagedOrganizations ?? new DeveloperOrganizationListResponse([]));

        public Task<OrganizationResponse> CreateOrganizationAsync(CreateOrganizationRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new OrganizationResponse(
                    new OrganizationSummary(
                        Guid.Parse("12121212-1212-1212-1212-121212121212"),
                        request.Slug,
                        request.DisplayName,
                        request.Description,
                        request.LogoUrl,
                        DateTime.Parse("2026-03-04T10:00:00Z"),
                        DateTime.Parse("2026-03-04T10:00:00Z"))));

        public Task<OrganizationResponse> UpdateOrganizationAsync(Guid organizationId, UpdateOrganizationRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new OrganizationResponse(
                    new OrganizationSummary(
                        organizationId,
                        request.Slug,
                        request.DisplayName,
                        request.Description,
                        request.LogoUrl,
                        DateTime.Parse("2026-03-04T10:00:00Z"),
                        DateTime.Parse("2026-03-04T10:30:00Z"))));

        public Task<DeveloperTitleListResponse> GetOrganizationTitlesAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new DeveloperTitleListResponse(
                    [
                        new CatalogTitleSummary(
                            Guid.Parse("33333333-3333-3333-3333-333333333333"),
                            organizationId,
                            "stellar-forge",
                            "star-blasters",
                            "game",
                            "testing",
                            "listed",
                            2,
                            "Star Blasters",
                            "Family space battles in short rounds.",
                            "Arcade Shooter",
                            1,
                            4,
                            "1-4 players",
                            "ESRB",
                            "E10+",
                            10,
                            "ESRB E10+",
                            "https://cdn.example.com/titles/star-blasters/card.png",
                            "https://stellar-forge.itch.io/star-blasters")
                    ]));

        public Task<DeveloperTitleResponse> CreateTitleAsync(Guid organizationId, CreateDeveloperTitleRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new DeveloperTitleResponse(
                    BuildDeveloperTitle(
                        Guid.Parse("34343434-3434-3434-3434-343434343434"),
                        organizationId,
                        request.Slug,
                        request.ContentKind,
                        request.LifecycleStatus,
                        request.Visibility,
                        request.Metadata)));

        public Task<DeveloperTitle?> GetDeveloperTitleAsync(Guid titleId, CancellationToken cancellationToken = default) =>
            Task.FromResult<DeveloperTitle?>(
                BuildDeveloperTitle(
                    titleId,
                    Guid.Parse("11111111-1111-1111-1111-111111111111"),
                    "star-blasters",
                    "game",
                    "testing",
                    "listed",
                    new UpsertTitleMetadataRequest(
                        "Star Blasters",
                        "Family space battles in short rounds.",
                        "Pilot colorful starships through family-friendly arena battles built for the Board console.",
                        "Arcade Shooter",
                        1,
                        4,
                        "ESRB",
                        "E10+",
                        10)));

        public Task<DeveloperTitleResponse> UpdateTitleAsync(Guid titleId, UpdateDeveloperTitleRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new DeveloperTitleResponse(
                    BuildDeveloperTitle(
                        titleId,
                        Guid.Parse("11111111-1111-1111-1111-111111111111"),
                        request.Slug,
                        request.ContentKind,
                        request.LifecycleStatus,
                        request.Visibility,
                        new UpsertTitleMetadataRequest(
                            "Star Blasters",
                            "Family space battles in short rounds.",
                            "Pilot colorful starships through family-friendly arena battles built for the Board console.",
                            "Arcade Shooter",
                            1,
                            4,
                            "ESRB",
                            "E10+",
                            10))));

        public Task<DeveloperTitleResponse> UpsertTitleMetadataAsync(Guid titleId, UpsertTitleMetadataRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new DeveloperTitleResponse(
                    BuildDeveloperTitle(
                        titleId,
                        Guid.Parse("11111111-1111-1111-1111-111111111111"),
                        "star-blasters",
                        "game",
                        "testing",
                        "listed",
                        request)));

        public Task<TitleMetadataVersionListResponse> GetTitleMetadataVersionsAsync(Guid titleId, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new TitleMetadataVersionListResponse(
                    [
                        new TitleMetadataVersion(
                            2,
                            true,
                            false,
                            "Star Blasters",
                            "Family space battles in short rounds.",
                            "Pilot colorful starships through family-friendly arena battles built for the Board console.",
                            "Arcade Shooter",
                            1,
                            4,
                            "1-4 players",
                            "ESRB",
                            "E10+",
                            10,
                            "ESRB E10+",
                            DateTime.Parse("2026-03-04T10:00:00Z"),
                            DateTime.Parse("2026-03-04T10:00:00Z")),
                        new TitleMetadataVersion(
                            1,
                            false,
                            true,
                            "Star Blasters",
                            "Initial copy.",
                            "Initial metadata revision.",
                            "Arcade Shooter",
                            1,
                            4,
                            "1-4 players",
                            "ESRB",
                            "E10+",
                            10,
                            "ESRB E10+",
                            DateTime.Parse("2026-03-03T10:00:00Z"),
                            DateTime.Parse("2026-03-03T10:00:00Z"))
                    ]));

        public Task<DeveloperTitleResponse> ActivateTitleMetadataVersionAsync(Guid titleId, int revisionNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new DeveloperTitleResponse(
                    BuildDeveloperTitle(
                        titleId,
                        Guid.Parse("11111111-1111-1111-1111-111111111111"),
                        "star-blasters",
                        "game",
                        "testing",
                        "listed",
                        new UpsertTitleMetadataRequest(
                            "Star Blasters",
                            revisionNumber == 1 ? "Initial copy." : "Family space battles in short rounds.",
                            revisionNumber == 1 ? "Initial metadata revision." : "Pilot colorful starships through family-friendly arena battles built for the Board console.",
                            "Arcade Shooter",
                            1,
                            4,
                            "ESRB",
                            "E10+",
                            10))));

        public Task<TitleMediaAssetListResponse> GetTitleMediaAssetsAsync(Guid titleId, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new TitleMediaAssetListResponse(
                    [
                        new TitleMediaAsset(
                            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                            "card",
                            "https://cdn.example.com/titles/star-blasters/card.png",
                            "Card art.",
                            "image/png",
                            640,
                            360,
                            DateTime.Parse("2026-03-04T10:00:00Z"),
                            DateTime.Parse("2026-03-04T10:00:00Z"))
                    ]));

        public Task<TitleMediaAssetResponse> UpsertTitleMediaAssetAsync(Guid titleId, string mediaRole, UpsertTitleMediaAssetRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new TitleMediaAssetResponse(
                    new TitleMediaAsset(
                        Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                        mediaRole,
                        request.SourceUrl,
                        request.AltText,
                        request.MimeType,
                        request.Width,
                        request.Height,
                        DateTime.Parse("2026-03-04T10:00:00Z"),
                        DateTime.Parse("2026-03-04T10:05:00Z"))));

        public Task<TitleMediaAssetResponse> UploadTitleMediaAssetAsync(Guid titleId, string mediaRole, ApiUploadFile mediaFile, string? altText, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new TitleMediaAssetResponse(
                    new TitleMediaAsset(
                        Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                        mediaRole,
                        $"https://localhost/uploads/title-media/{titleId:D}/{mediaRole}/{mediaFile.FileName}",
                        altText,
                        mediaFile.ContentType,
                        null,
                        null,
                        DateTime.Parse("2026-03-04T10:00:00Z"),
                        DateTime.Parse("2026-03-04T10:05:00Z"))));

        public Task DeleteTitleMediaAssetAsync(Guid titleId, string mediaRole, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task<TitleReleaseListResponse> GetTitleReleasesAsync(Guid titleId, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new TitleReleaseListResponse(
                    [
                        new TitleRelease(
                            Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
                            "1.0.0",
                            "published",
                            2,
                            true,
                            DateTime.Parse("2026-03-04T12:00:00Z"),
                            DateTime.Parse("2026-03-04T11:00:00Z"),
                            DateTime.Parse("2026-03-04T12:00:00Z"))
                    ]));

        public Task<TitleReleaseResponse> CreateTitleReleaseAsync(Guid titleId, UpsertTitleReleaseRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new TitleReleaseResponse(
                    new TitleRelease(
                        Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
                        request.Version,
                        "draft",
                        request.MetadataRevisionNumber,
                        false,
                        null,
                        DateTime.Parse("2026-03-04T13:00:00Z"),
                        DateTime.Parse("2026-03-04T13:00:00Z"))));

        public Task<TitleReleaseResponse> UpdateTitleReleaseAsync(Guid titleId, Guid releaseId, UpsertTitleReleaseRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new TitleReleaseResponse(
                    new TitleRelease(
                        releaseId,
                        request.Version,
                        "draft",
                        request.MetadataRevisionNumber,
                        false,
                        null,
                        DateTime.Parse("2026-03-04T13:00:00Z"),
                        DateTime.Parse("2026-03-04T13:10:00Z"))));

        public Task<TitleReleaseResponse> PublishTitleReleaseAsync(Guid titleId, Guid releaseId, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new TitleReleaseResponse(
                    new TitleRelease(
                        releaseId,
                        "1.0.0",
                        "published",
                        2,
                        false,
                        DateTime.Parse("2026-03-04T14:00:00Z"),
                        DateTime.Parse("2026-03-04T13:00:00Z"),
                        DateTime.Parse("2026-03-04T14:00:00Z"))));

        public Task<DeveloperTitleResponse> ActivateTitleReleaseAsync(Guid titleId, Guid releaseId, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new DeveloperTitleResponse(
                    BuildDeveloperTitle(
                        titleId,
                        Guid.Parse("11111111-1111-1111-1111-111111111111"),
                        "star-blasters",
                        "game",
                        "testing",
                        "listed",
                        new UpsertTitleMetadataRequest(
                            "Star Blasters",
                            "Family space battles in short rounds.",
                            "Pilot colorful starships through family-friendly arena battles built for the Board console.",
                            "Arcade Shooter",
                            1,
                            4,
                            "ESRB",
                            "E10+",
                            10))));

        public Task<TitleReleaseResponse> WithdrawTitleReleaseAsync(Guid titleId, Guid releaseId, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new TitleReleaseResponse(
                    new TitleRelease(
                        releaseId,
                        "1.0.0",
                        "withdrawn",
                        2,
                        false,
                        null,
                        DateTime.Parse("2026-03-04T13:00:00Z"),
                        DateTime.Parse("2026-03-04T15:00:00Z"))));

        public Task<ReleaseArtifactListResponse> GetReleaseArtifactsAsync(Guid titleId, Guid releaseId, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new ReleaseArtifactListResponse(
                    [
                        new ReleaseArtifact(
                            Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"),
                            "apk",
                            "fun.board.starblasters",
                            100,
                            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                            104857600,
                            DateTime.Parse("2026-03-04T14:00:00Z"),
                            DateTime.Parse("2026-03-04T14:00:00Z"))
                    ]));

        public Task<ReleaseArtifactResponse> CreateReleaseArtifactAsync(Guid titleId, Guid releaseId, UpsertReleaseArtifactRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new ReleaseArtifactResponse(
                    new ReleaseArtifact(
                        Guid.Parse("abababab-abab-abab-abab-abababababab"),
                        request.ArtifactKind,
                        request.PackageName,
                        request.VersionCode,
                        request.Sha256,
                        request.FileSizeBytes,
                        DateTime.Parse("2026-03-04T14:30:00Z"),
                        DateTime.Parse("2026-03-04T14:30:00Z"))));

        public Task DeleteReleaseArtifactAsync(Guid titleId, Guid releaseId, Guid artifactId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task<IntegrationConnectionListResponse> GetOrganizationIntegrationConnectionsAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new IntegrationConnectionListResponse(
                    [
                        new IntegrationConnection(
                            Guid.Parse("abababab-1111-1111-1111-111111111111"),
                            organizationId,
                            null,
                            null,
                            "itch.io",
                            "https://itch.io/",
                            null,
                            true,
                            DateTime.Parse("2026-03-04T10:00:00Z"),
                            DateTime.Parse("2026-03-04T10:00:00Z"))
                    ]));

        public Task<IntegrationConnectionResponse> CreateOrganizationIntegrationConnectionAsync(Guid organizationId, UpsertIntegrationConnectionRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new IntegrationConnectionResponse(
                    new IntegrationConnection(
                        Guid.Parse("abababab-4444-4444-4444-444444444444"),
                        organizationId,
                        request.SupportedPublisherId,
                        null,
                        request.CustomPublisherDisplayName,
                        request.CustomPublisherHomepageUrl,
                        request.Configuration,
                        request.IsEnabled,
                        DateTime.Parse("2026-03-04T16:00:00Z"),
                        DateTime.Parse("2026-03-04T16:00:00Z"))));

        public Task<TitleIntegrationBindingListResponse> GetTitleIntegrationBindingsAsync(Guid titleId, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new TitleIntegrationBindingListResponse(
                    [
                        new TitleIntegrationBinding(
                            Guid.Parse("abababab-2222-2222-2222-222222222222"),
                            titleId,
                            Guid.Parse("abababab-1111-1111-1111-111111111111"),
                            new IntegrationConnection(
                                Guid.Parse("abababab-1111-1111-1111-111111111111"),
                                Guid.Parse("11111111-1111-1111-1111-111111111111"),
                                null,
                                null,
                                "itch.io",
                                "https://itch.io/",
                                null,
                                true,
                                DateTime.Parse("2026-03-04T10:00:00Z"),
                                DateTime.Parse("2026-03-04T10:00:00Z")),
                            "https://stellar-forge.itch.io/star-blasters",
                            "View on itch.io",
                            null,
                            true,
                            true,
                            DateTime.Parse("2026-03-04T10:30:00Z"),
                            DateTime.Parse("2026-03-04T10:30:00Z"))
                    ]));

        public Task<TitleIntegrationBindingResponse> CreateTitleIntegrationBindingAsync(Guid titleId, UpsertTitleIntegrationBindingRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new TitleIntegrationBindingResponse(
                    new TitleIntegrationBinding(
                        Guid.Parse("abababab-3333-3333-3333-333333333333"),
                        titleId,
                        request.IntegrationConnectionId,
                        new IntegrationConnection(
                            request.IntegrationConnectionId,
                            Guid.Parse("11111111-1111-1111-1111-111111111111"),
                            null,
                            null,
                            "itch.io",
                            "https://itch.io/",
                            null,
                            true,
                            DateTime.Parse("2026-03-04T10:00:00Z"),
                            DateTime.Parse("2026-03-04T10:00:00Z")),
                        request.AcquisitionUrl,
                        request.AcquisitionLabel,
                        request.Configuration,
                        request.IsPrimary,
                        request.IsEnabled,
                        DateTime.Parse("2026-03-04T15:00:00Z"),
                        DateTime.Parse("2026-03-04T15:00:00Z"))));

        public Task<TitleIntegrationBindingResponse> UpdateTitleIntegrationBindingAsync(Guid titleId, Guid bindingId, UpsertTitleIntegrationBindingRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new TitleIntegrationBindingResponse(
                    new TitleIntegrationBinding(
                        bindingId,
                        titleId,
                        request.IntegrationConnectionId,
                        new IntegrationConnection(
                            request.IntegrationConnectionId,
                            Guid.Parse("11111111-1111-1111-1111-111111111111"),
                            null,
                            null,
                            "itch.io",
                            "https://itch.io/",
                            null,
                            true,
                            DateTime.Parse("2026-03-04T10:00:00Z"),
                            DateTime.Parse("2026-03-04T10:00:00Z")),
                        request.AcquisitionUrl,
                        request.AcquisitionLabel,
                        request.Configuration,
                        request.IsPrimary,
                        request.IsEnabled,
                        DateTime.Parse("2026-03-04T15:00:00Z"),
                        DateTime.Parse("2026-03-04T15:10:00Z"))));

        public Task DeleteTitleIntegrationBindingAsync(Guid titleId, Guid bindingId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        private static DeveloperTitle BuildDeveloperTitle(
            Guid titleId,
            Guid organizationId,
            string slug,
            string contentKind,
            string lifecycleStatus,
            string visibility,
            UpsertTitleMetadataRequest metadata) =>
            new(
                titleId,
                organizationId,
                "stellar-forge",
                slug,
                contentKind,
                lifecycleStatus,
                visibility,
                2,
                metadata.DisplayName,
                metadata.ShortDescription,
                metadata.Description,
                metadata.GenreDisplay,
                metadata.MinPlayers,
                metadata.MaxPlayers,
                "1-4 players",
                metadata.AgeRatingAuthority,
                metadata.AgeRatingValue,
                metadata.MinAgeYears,
                $"{metadata.AgeRatingAuthority} {metadata.AgeRatingValue}",
                "https://cdn.example.com/titles/star-blasters/card.png",
                "https://stellar-forge.itch.io/star-blasters",
                [
                    new TitleMediaAsset(
                        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                        "card",
                        "https://cdn.example.com/titles/star-blasters/card.png",
                        "Card art.",
                        "image/png",
                        640,
                        360,
                        DateTime.Parse("2026-03-04T10:00:00Z"),
                        DateTime.Parse("2026-03-04T10:00:00Z"))
                ],
                new CurrentTitleRelease(
                    Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
                    "1.0.0",
                    2,
                    DateTime.Parse("2026-03-04T12:00:00Z")),
                new PublicTitleAcquisition(
                    "https://stellar-forge.itch.io/star-blasters",
                    "View on itch.io",
                    "itch.io",
                    "https://itch.io/"),
                Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
                DateTime.Parse("2026-03-04T10:00:00Z"),
                DateTime.Parse("2026-03-04T12:00:00Z"));
    }

    private sealed class TestAuthClaimsProvider(IReadOnlyList<Claim> claims)
    {
        public IReadOnlyList<Claim> Claims { get; } = claims;
    }

    private sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string SchemeName = "Test";
        private readonly TestAuthClaimsProvider claimsProvider;

        public TestAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder,
            TestAuthClaimsProvider claimsProvider)
            : base(options, logger, encoder)
        {
            this.claimsProvider = claimsProvider;
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var identity = new ClaimsIdentity(claimsProvider.Claims, SchemeName);
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, SchemeName);
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }
}
