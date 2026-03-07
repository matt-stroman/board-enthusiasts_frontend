using Board.ThirdPartyLibrary.Frontend.Web.Services;

namespace Board.ThirdPartyLibrary.Frontend.Web.Tests;

/// <summary>
/// Tests browse fuzzy-search scoring behavior.
/// </summary>
public sealed class FuzzySearchServiceTests
{
    /// <summary>
    /// Verifies that a single-character containment match remains searchable.
    /// </summary>
    [Fact]
    public void BestScore_WithSingleCharacterContainedInCandidate_ReturnsInteractiveMatchScore()
    {
        var score = FuzzySearchService.BestScore("B", "Signal Harbor");

        Assert.True(score >= FuzzySearchService.GetMinimumScoreThreshold("B"));
    }

    /// <summary>
    /// Verifies that partial studio-name text remains searchable.
    /// </summary>
    [Fact]
    public void BestScore_WithPartialStudioName_ReturnsInteractiveMatchScore()
    {
        var score = FuzzySearchService.BestScore("harb", "Blue Harbor Games");

        Assert.True(score >= FuzzySearchService.GetMinimumScoreThreshold("harb"));
    }

    /// <summary>
    /// Verifies that unrelated text does not pass the single-character threshold accidentally.
    /// </summary>
    [Fact]
    public void BestScore_WithNoDirectOrFuzzyRelation_RemainsBelowThreshold()
    {
        var score = FuzzySearchService.BestScore("zzz", "Signal Harbor");

        Assert.True(score < FuzzySearchService.GetMinimumScoreThreshold("zzz"));
    }

    /// <summary>
    /// Verifies that exact containment is treated as a direct match.
    /// </summary>
    [Fact]
    public void GetDirectMatchScore_WithContainedTitleWord_ReturnsPositiveDirectScore()
    {
        var score = FuzzySearchService.GetDirectMatchScore("Beacon", "Beacon Boardwalk");

        Assert.True(score > 0);
    }

    /// <summary>
    /// Verifies that unrelated titles do not present as direct matches.
    /// </summary>
    [Fact]
    public void GetDirectMatchScore_WithUnrelatedTitle_ReturnsZero()
    {
        var score = FuzzySearchService.GetDirectMatchScore("Beacon", "Solar Orchard");

        Assert.Equal(0, score);
    }
}
