using FuzzySharp;

namespace Board.ThirdPartyLibrary.Frontend.Web.Services;

/// <summary>
/// Lightweight fuzzy matching helper for in-memory title and studio browse filtering.
/// </summary>
internal static class FuzzySearchService
{
    /// <summary>
    /// Determines whether any candidate directly matches the query via exact, prefix, or containment logic.
    /// </summary>
    /// <param name="query">Search query.</param>
    /// <param name="candidates">Candidate strings to inspect.</param>
    /// <returns><see langword="true" /> when a direct match exists; otherwise <see langword="false" />.</returns>
    public static bool HasDirectMatch(string query, params string?[] candidates) =>
        GetDirectMatchScore(query, candidates) > 0;

    /// <summary>
    /// Computes a direct-match rank for exact, prefix, token-prefix, or containment matches.
    /// </summary>
    /// <param name="query">Search query.</param>
    /// <param name="candidates">Candidate strings to score.</param>
    /// <returns>Direct-match score from 0-100.</returns>
    public static int GetDirectMatchScore(string query, params string?[] candidates)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return 0;
        }

        var normalizedQuery = query.Trim().ToLowerInvariant();
        var bestScore = 0;

        foreach (var candidate in candidates)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            var score = ScoreDirectMatch(normalizedQuery, candidate.Trim().ToLowerInvariant());
            if (score > bestScore)
            {
                bestScore = score;
                if (bestScore == 100)
                {
                    break;
                }
            }
        }

        return bestScore;
    }

    /// <summary>
    /// Computes the highest fuzzy score for a query against candidate text values.
    /// </summary>
    /// <param name="query">Search query.</param>
    /// <param name="candidates">Candidate strings to score.</param>
    /// <returns>Best score from 0-100.</returns>
    public static int BestScore(string query, params string?[] candidates)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return 0;
        }

        var normalizedQuery = query.Trim();
        var normalizedQueryLower = normalizedQuery.ToLowerInvariant();
        var bestScore = 0;

        foreach (var candidate in candidates)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            var normalizedCandidate = candidate.Trim();
            var normalizedCandidateLower = normalizedCandidate.ToLowerInvariant();
            var score = ScoreDirectMatch(normalizedQueryLower, normalizedCandidateLower);

            if (score < 100)
            {
                // Combine token and partial matching so short and mid-length terms remain useful.
                score = Math.Max(score, Fuzz.TokenSetRatio(normalizedQuery, normalizedCandidate));
                score = Math.Max(score, Fuzz.PartialRatio(normalizedQuery, normalizedCandidate));
            }

            if (score > bestScore)
            {
                bestScore = score;
                if (bestScore == 100)
                {
                    break;
                }
            }
        }

        return bestScore;
    }

    /// <summary>
    /// Gets a practical minimum threshold for interactive title search.
    /// </summary>
    /// <param name="query">Search query.</param>
    /// <returns>Threshold from 0-100.</returns>
    public static int GetMinimumScoreThreshold(string query)
    {
        var length = query.Trim().Length;
        return length switch
        {
            <= 1 => 90,
            <= 2 => 84,
            <= 4 => 64,
            _ => 56
        };
    }

    private static int ScoreDirectMatch(string query, string candidate)
    {
        if (string.Equals(candidate, query, StringComparison.Ordinal))
        {
            return 100;
        }

        if (candidate.StartsWith(query, StringComparison.Ordinal))
        {
            return 98;
        }

        if (candidate.Contains(query, StringComparison.Ordinal))
        {
            return query.Length == 1 ? 94 : 92;
        }

        foreach (var token in candidate.Split([' ', '-', ',', '.', ':', ';', '/', '\\', '|'], StringSplitOptions.RemoveEmptyEntries))
        {
            if (token.StartsWith(query, StringComparison.Ordinal))
            {
                return 96;
            }

            if (token.Contains(query, StringComparison.Ordinal))
            {
                return query.Length == 1 ? 93 : 90;
            }
        }

        return 0;
    }
}
