using Board.ThirdPartyLibrary.Frontend.Web.Services;

namespace Board.ThirdPartyLibrary.Frontend.Web.Tests;

/// <summary>
/// Tests the browse projection used by the public catalog page.
/// </summary>
public sealed class BrowseCatalogProjectionServiceTests
{
    /// <summary>
    /// Verifies that selecting all content kinds keeps both games and apps visible.
    /// </summary>
    [Fact]
    public void Project_WithAllContentKind_ReturnsGamesAndApps()
    {
        var projection = BrowseCatalogProjectionService.Project(
            CreateTitles(),
            CreateStudioDisplayNames(),
            CreateStudioDescriptions(),
            new BrowseCatalogFilterState(
                SearchQuery: null,
                ContentKind: "all",
                Sort: "title-asc",
                SelectedGenres: [],
                SelectedStudios: []));

        Assert.Equal(3, projection.FilteredTitles.Count);
        Assert.Contains(projection.FilteredTitles, candidate => candidate.ContentKind == "game");
        Assert.Contains(projection.FilteredTitles, candidate => candidate.ContentKind == "app");
    }

    /// <summary>
    /// Verifies that direct title matches suppress broader fuzzy fallback matches.
    /// </summary>
    [Fact]
    public void Project_WithDirectSearchMatch_ReturnsOnlyDirectMatches()
    {
        var projection = BrowseCatalogProjectionService.Project(
            CreateTitles(),
            CreateStudioDisplayNames(),
            CreateStudioDescriptions(),
            new BrowseCatalogFilterState(
                SearchQuery: "Beacon",
                ContentKind: "all",
                Sort: "title-asc",
                SelectedGenres: [],
                SelectedStudios: []));

        var titles = projection.FilteredTitles.Select(candidate => candidate.DisplayName).ToArray();

        Assert.Single(titles);
        Assert.Equal("Beacon Boardwalk", titles[0]);
    }

    /// <summary>
    /// Verifies that studio and genre filters are both honored in the projection.
    /// </summary>
    [Fact]
    public void Project_WithStudioAndGenreFilters_ReturnsMatchingSlice()
    {
        var projection = BrowseCatalogProjectionService.Project(
            CreateTitles(),
            CreateStudioDisplayNames(),
            CreateStudioDescriptions(),
            new BrowseCatalogFilterState(
                SearchQuery: null,
                ContentKind: "all",
                Sort: "title-asc",
                SelectedGenres: ["Strategy"],
                SelectedStudios: ["harborlight-mechanics"]));

        Assert.Single(projection.FilteredTitles);
        Assert.Single(projection.VisibleStudios);
        Assert.Single(projection.AvailableGenres);
        Assert.Equal("Beacon Boardwalk", projection.FilteredTitles[0].DisplayName);
        Assert.Equal("Harborlight Mechanics", projection.VisibleStudios[0].DisplayName);
        Assert.Equal("Strategy", projection.AvailableGenres[0]);
    }

    private static IReadOnlyList<CatalogTitleSummary> CreateTitles() =>
    [
        new CatalogTitleSummary(
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            "harborlight-mechanics",
            "beacon-boardwalk",
            "game",
            "published",
            "listed",
            1,
            "Beacon Boardwalk",
            "Claim neon boardwalk routes before the tide turns.",
            "Strategy, Family",
            1,
            3,
            "1-3 players",
            "ESRB",
            "E10+",
            10,
            "Ages 10+",
            null,
            "https://example.com/beacon"),
        new CatalogTitleSummary(
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            "blue-harbor-games",
            "lantern-drift",
            "game",
            "published",
            "listed",
            1,
            "Lantern Drift",
            "Steer glowing lanterns through a harbor puzzle festival.",
            "Puzzle, Family",
            2,
            3,
            "2-3 players",
            "ESRB",
            "E",
            8,
            "Ages 8+",
            null,
            "https://example.com/lantern"),
        new CatalogTitleSummary(
            Guid.Parse("33333333-3333-3333-3333-333333333333"),
            Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            "moss-byte-collective",
            "pioneer-broadcast",
            "app",
            "published",
            "listed",
            1,
            "Pioneer Broadcast",
            "Tune a modular creator toolkit for community streams.",
            "Creator Tools, Utility",
            1,
            1,
            "1 player",
            "ESRB",
            "E",
            6,
            "Ages 6+",
            null,
            "https://example.com/pioneer")
    ];

    private static IReadOnlyDictionary<string, string> CreateStudioDisplayNames() =>
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["harborlight-mechanics"] = "Harborlight Mechanics",
            ["blue-harbor-games"] = "Blue Harbor Games",
            ["moss-byte-collective"] = "Moss Byte Collective"
        };

    private static IReadOnlyDictionary<string, string?> CreateStudioDescriptions() =>
        new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["harborlight-mechanics"] = "Boardwalk strategy designs and tidal route puzzles.",
            ["blue-harbor-games"] = "Coastal puzzle stories and family harbor adventures.",
            ["moss-byte-collective"] = "Creator tools for streaming, automation, and utility workflows."
        };
}
