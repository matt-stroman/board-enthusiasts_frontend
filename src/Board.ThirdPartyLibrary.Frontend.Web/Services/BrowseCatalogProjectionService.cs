namespace Board.ThirdPartyLibrary.Frontend.Web.Services;

/// <summary>
/// Produces the client-side browse projection used by the public catalog page.
/// </summary>
internal static class BrowseCatalogProjectionService
{
    /// <summary>
    /// Projects browse results, visible studios, and available genres from the loaded catalog titles.
    /// </summary>
    /// <param name="titles">Loaded public titles.</param>
    /// <param name="studioDisplayNameBySlug">Studio display names keyed by slug.</param>
    /// <param name="studioDescriptionBySlug">Studio descriptions keyed by slug.</param>
    /// <param name="filterState">Current interactive browse state.</param>
    /// <returns>Projected browse state.</returns>
    public static BrowseCatalogProjection Project(
        IReadOnlyList<CatalogTitleSummary> titles,
        IReadOnlyDictionary<string, string> studioDisplayNameBySlug,
        IReadOnlyDictionary<string, string?> studioDescriptionBySlug,
        BrowseCatalogFilterState filterState)
    {
        ArgumentNullException.ThrowIfNull(titles);
        ArgumentNullException.ThrowIfNull(studioDisplayNameBySlug);
        ArgumentNullException.ThrowIfNull(studioDescriptionBySlug);
        ArgumentNullException.ThrowIfNull(filterState);

        var selectedStudios = filterState.SelectedStudios
            .Where(candidate => !string.IsNullOrWhiteSpace(candidate))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var selectedGenres = filterState.SelectedGenres
            .Where(candidate => !string.IsNullOrWhiteSpace(candidate))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        IEnumerable<CatalogTitleSummary> query = titles;

        var effectiveContentKind = NormalizeContentKind(filterState.ContentKind);
        if (!string.Equals(effectiveContentKind, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(candidate => string.Equals(candidate.ContentKind, effectiveContentKind, StringComparison.OrdinalIgnoreCase));
        }

        if (selectedStudios.Count > 0)
        {
            query = query.Where(candidate => selectedStudios.Contains(candidate.StudioSlug));
        }

        if (selectedGenres.Count > 0)
        {
            query = query.Where(candidate =>
            {
                var tags = ParseGenreTags(candidate.GenreDisplay);
                return selectedGenres.Any(selected => tags.Contains(selected, StringComparer.OrdinalIgnoreCase));
            });
        }

        var sorted = ApplySort(query, NormalizeSort(filterState.Sort), studioDisplayNameBySlug).ToArray();

        IEnumerable<CatalogTitleSummary> filteredQuery = sorted;
        if (!string.IsNullOrWhiteSpace(filterState.SearchQuery))
        {
            var normalizedSearch = filterState.SearchQuery.Trim();
            var threshold = FuzzySearchService.GetMinimumScoreThreshold(normalizedSearch);
            var scoredCandidates = sorted
                .Select((title, index) => new
                {
                    Title = title,
                    Index = index,
                    DirectScore = FuzzySearchService.GetDirectMatchScore(
                        normalizedSearch,
                        title.DisplayName,
                        title.ShortDescription,
                        title.GenreDisplay,
                        title.StudioSlug,
                        GetStudioDisplayName(studioDisplayNameBySlug, title.StudioSlug),
                        GetStudioDescription(studioDescriptionBySlug, title.StudioSlug)),
                    Score = FuzzySearchService.BestScore(
                        normalizedSearch,
                        title.DisplayName,
                        title.ShortDescription,
                        title.GenreDisplay,
                        title.StudioSlug,
                        GetStudioDisplayName(studioDisplayNameBySlug, title.StudioSlug),
                        GetStudioDescription(studioDescriptionBySlug, title.StudioSlug))
                })
                .ToArray();

            var directMatches = scoredCandidates
                .Where(candidate => candidate.DirectScore > 0)
                .OrderByDescending(candidate => candidate.DirectScore)
                .ThenBy(candidate => candidate.Index)
                .Select(candidate => candidate.Title)
                .ToArray();

            filteredQuery = directMatches.Length > 0
                ? directMatches
                : scoredCandidates
                    .Where(candidate => candidate.Score >= threshold)
                    .OrderByDescending(candidate => candidate.Score)
                    .ThenBy(candidate => candidate.Index)
                    .Select(candidate => candidate.Title);
        }

        var filteredTitles = filteredQuery.ToArray();
        var visibleStudios = filteredTitles
            .GroupBy(candidate => candidate.StudioSlug, StringComparer.OrdinalIgnoreCase)
            .Select(group => new BrowseStudioEntry(
                group.Key,
                GetStudioDisplayName(studioDisplayNameBySlug, group.Key),
                group.Count()))
            .OrderBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var availableGenres = filteredTitles
            .SelectMany(candidate => ParseGenreTags(candidate.GenreDisplay))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(candidate => candidate, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return new BrowseCatalogProjection(filteredTitles, visibleStudios, availableGenres);
    }

    /// <summary>
    /// Normalizes interactive content-kind selection.
    /// </summary>
    /// <param name="value">Requested content kind.</param>
    /// <returns>Normalized content kind.</returns>
    internal static string NormalizeContentKind(string? value) =>
        (value ?? "all").Trim().ToLowerInvariant() switch
        {
            "game" => "game",
            "app" => "app",
            _ => "all"
        };

    /// <summary>
    /// Normalizes browse sort selection.
    /// </summary>
    /// <param name="value">Requested sort key.</param>
    /// <returns>Normalized sort key.</returns>
    internal static string NormalizeSort(string? value) =>
        (value ?? "title-asc").Trim().ToLowerInvariant() switch
        {
            "title-desc" => "title-desc",
            "studio-asc" => "studio-asc",
            "studio-desc" => "studio-desc",
            "genre-asc" => "genre-asc",
            "players-asc" => "players-asc",
            "players-desc" => "players-desc",
            "age-asc" => "age-asc",
            "age-desc" => "age-desc",
            _ => "title-asc"
        };

    /// <summary>
    /// Parses display-oriented genre text into distinct tags.
    /// </summary>
    /// <param name="genreDisplay">Genre display text.</param>
    /// <returns>Distinct genre tags.</returns>
    internal static IReadOnlyList<string> ParseGenreTags(string? genreDisplay) =>
        string.IsNullOrWhiteSpace(genreDisplay)
            ? []
            : genreDisplay.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(candidate => !string.IsNullOrWhiteSpace(candidate))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

    private static IEnumerable<CatalogTitleSummary> ApplySort(
        IEnumerable<CatalogTitleSummary> query,
        string effectiveSort,
        IReadOnlyDictionary<string, string> studioDisplayNameBySlug) =>
        effectiveSort switch
        {
            "title-desc" => query.OrderByDescending(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(candidate => candidate.StudioSlug, StringComparer.OrdinalIgnoreCase),
            "studio-asc" => query.OrderBy(candidate => GetStudioDisplayName(studioDisplayNameBySlug, candidate.StudioSlug), StringComparer.OrdinalIgnoreCase)
                .ThenBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase),
            "studio-desc" => query.OrderByDescending(candidate => GetStudioDisplayName(studioDisplayNameBySlug, candidate.StudioSlug), StringComparer.OrdinalIgnoreCase)
                .ThenBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase),
            "genre-asc" => query.OrderBy(candidate => candidate.GenreDisplay, StringComparer.OrdinalIgnoreCase)
                .ThenBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase),
            "players-asc" => query.OrderBy(candidate => candidate.MinPlayers)
                .ThenBy(candidate => candidate.MaxPlayers)
                .ThenBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase),
            "players-desc" => query.OrderByDescending(candidate => candidate.MaxPlayers)
                .ThenByDescending(candidate => candidate.MinPlayers)
                .ThenBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase),
            "age-asc" => query.OrderBy(candidate => candidate.MinAgeYears)
                .ThenBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase),
            "age-desc" => query.OrderByDescending(candidate => candidate.MinAgeYears)
                .ThenBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase),
            _ => query.OrderBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(candidate => candidate.StudioSlug, StringComparer.OrdinalIgnoreCase)
        };

    private static string GetStudioDisplayName(IReadOnlyDictionary<string, string> studioDisplayNameBySlug, string studioSlug) =>
        studioDisplayNameBySlug.TryGetValue(studioSlug, out var displayName)
            ? displayName
            : studioSlug;

    private static string? GetStudioDescription(IReadOnlyDictionary<string, string?> studioDescriptionBySlug, string studioSlug) =>
        studioDescriptionBySlug.TryGetValue(studioSlug, out var description)
            ? description
            : null;
}

/// <summary>
/// Interactive browse filter state.
/// </summary>
/// <param name="SearchQuery">Free-text query.</param>
/// <param name="ContentKind">Requested content kind.</param>
/// <param name="Sort">Requested sort.</param>
/// <param name="SelectedGenres">Selected genres.</param>
/// <param name="SelectedStudios">Selected studios.</param>
internal sealed record BrowseCatalogFilterState(
    string? SearchQuery,
    string? ContentKind,
    string? Sort,
    IReadOnlyCollection<string> SelectedGenres,
    IReadOnlyCollection<string> SelectedStudios);

/// <summary>
/// Client-side browse projection.
/// </summary>
/// <param name="FilteredTitles">Filtered and sorted titles.</param>
/// <param name="VisibleStudios">Visible studios after filtering.</param>
/// <param name="AvailableGenres">Available genres after filtering.</param>
internal sealed record BrowseCatalogProjection(
    IReadOnlyList<CatalogTitleSummary> FilteredTitles,
    IReadOnlyList<BrowseStudioEntry> VisibleStudios,
    IReadOnlyList<string> AvailableGenres);

/// <summary>
/// Studio entry shown in browse filters after projection.
/// </summary>
/// <param name="Slug">Studio slug.</param>
/// <param name="DisplayName">Studio display name.</param>
/// <param name="TitleCount">Visible title count.</param>
internal sealed record BrowseStudioEntry(string Slug, string DisplayName, int TitleCount);
