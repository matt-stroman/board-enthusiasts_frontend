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
    [InlineData("/", "Board Third Party Library")]
    [InlineData("/library", "Star Blasters")]
    [InlineData("/player/library", "Player Library")]
    [InlineData("/player/wishlist", "No wishlist items yet")]
    [InlineData("/library/stellar-forge/star-blasters", "View on itch.io")]
    [InlineData("/develop", "Stellar Forge")]
    [InlineData("/account", "Player library access")]
    [InlineData("/account/developer-access", "Developer Access")]
    [InlineData("/signin?error=identity-provider-unavailable", "Sign in is unavailable right now")]
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
        Assert.Contains("Become A Developer", content);
        Assert.DoesNotContain("Managed organizations", content);
    }

    [Fact]
    public async Task DeveloperAccessRoute_WithPlayerOnlyAccount_ShowsEnrollmentAction()
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

        var response = await playerClient.GetAsync("/account/developer-access");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Enable developer access", content);
        Assert.Contains("stored in Keycloak", content, StringComparison.OrdinalIgnoreCase);
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

                services.AddSingleton(new TestAuthClaimsProvider(
                [
                    new Claim("sub", "user-123"),
                    new Claim(ClaimTypes.Name, "Local Admin"),
                    new Claim(ClaimTypes.Email, "admin@boardtpl.local")
                ]));

                services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                    options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                    options.DefaultScheme = TestAuthHandler.SchemeName;
                }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
            });
        }
    }

    public sealed record TestApiData(
        CurrentUserResponse CurrentUser,
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
        public Task<CatalogTitleListResponse> GetCatalogTitlesAsync(CatalogBrowseRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new CatalogTitleListResponse(
                    [
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
                    ],
                    new CatalogPaging(1, 12, 1, 1, false, false)));

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

        public Task<CurrentUserResponse?> GetCurrentUserAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<CurrentUserResponse?>(data.CurrentUser);

        public Task<BoardProfile?> GetBoardProfileAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(data.BoardProfile);

        public Task<DeveloperEnrollmentResponse> EnrollAsDeveloperAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(
                new DeveloperEnrollmentResponse(
                    new DeveloperEnrollment(
                        "enabled",
                        true,
                        data.CurrentUser.IsDeveloper(),
                        !data.CurrentUser.IsDeveloper())));

        public Task<DeveloperOrganizationListResponse> GetManagedOrganizationsAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(data.ManagedOrganizations ?? new DeveloperOrganizationListResponse([]));

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
