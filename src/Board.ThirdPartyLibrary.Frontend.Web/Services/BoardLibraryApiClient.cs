using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Board.ThirdPartyLibrary.Frontend.Web.Configuration;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.WebUtilities;

namespace Board.ThirdPartyLibrary.Frontend.Web.Services;

/// <summary>
/// Contract for backend API access used by the web UI.
/// </summary>
public interface IBoardLibraryApiClient
{
    /// <summary>
    /// Lists public catalog titles.
    /// </summary>
    Task<CatalogTitleListResponse> GetCatalogTitlesAsync(CatalogBrowseRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a public catalog title by organization and title slug.
    /// </summary>
    Task<CatalogTitle?> GetCatalogTitleAsync(string organizationSlug, string titleSlug, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the current authenticated user profile.
    /// </summary>
    Task<CurrentUserResponse?> GetCurrentUserAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the linked Board profile for the current user when one exists.
    /// </summary>
    Task<BoardProfile?> GetBoardProfileAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Enables developer access for the current authenticated user.
    /// </summary>
    Task<DeveloperEnrollmentResponse> EnrollAsDeveloperAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists organizations the current caller can manage.
    /// </summary>
    Task<DeveloperOrganizationListResponse> GetManagedOrganizationsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists titles for an organization the caller can manage.
    /// </summary>
    Task<DeveloperTitleListResponse> GetOrganizationTitlesAsync(Guid organizationId, CancellationToken cancellationToken = default);
}

/// <summary>
/// HTTP implementation of <see cref="IBoardLibraryApiClient" />.
/// </summary>
/// <param name="httpClient">Configured backend API client.</param>
/// <param name="httpContextAccessor">Current request accessor.</param>
internal sealed class BoardLibraryApiClient(
    HttpClient httpClient,
    IHttpContextAccessor httpContextAccessor) : IBoardLibraryApiClient
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    /// <inheritdoc />
    public async Task<CatalogTitleListResponse> GetCatalogTitlesAsync(CatalogBrowseRequest request, CancellationToken cancellationToken = default)
    {
        var query = new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["organizationSlug"] = request.OrganizationSlug,
            ["contentKind"] = request.ContentKind,
            ["genre"] = request.Genre,
            ["sort"] = request.Sort,
            ["pageNumber"] = request.PageNumber.ToString(),
            ["pageSize"] = request.PageSize.ToString()
        };

        using var httpRequest = CreateRequest(HttpMethod.Get, QueryHelpers.AddQueryString("/catalog", query), requiresAuthentication: false);
        return await SendAsync<CatalogTitleListResponse>(httpRequest, cancellationToken)
            ?? new CatalogTitleListResponse([], new CatalogPaging(1, request.PageSize, 0, 0, false, false));
    }

    /// <inheritdoc />
    public async Task<CatalogTitle?> GetCatalogTitleAsync(string organizationSlug, string titleSlug, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/catalog/{Uri.EscapeDataString(organizationSlug)}/{Uri.EscapeDataString(titleSlug)}",
            requiresAuthentication: false);

        return await SendOptionalAsync<CatalogTitleResponse>(httpRequest, cancellationToken) is { } response
            ? response.Title
            : null;
    }

    /// <inheritdoc />
    public async Task<CurrentUserResponse?> GetCurrentUserAsync(CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Get, "/identity/me", requiresAuthentication: true);
        return await SendOptionalAsync<CurrentUserResponse>(httpRequest, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<BoardProfile?> GetBoardProfileAsync(CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Get, "/identity/me/board-profile", requiresAuthentication: true);
        return await SendOptionalAsync<BoardProfileResponse>(httpRequest, cancellationToken) is { } response
            ? response.BoardProfile
            : null;
    }

    /// <inheritdoc />
    public async Task<DeveloperEnrollmentResponse> EnrollAsDeveloperAsync(CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Post, "/identity/me/developer-enrollment", requiresAuthentication: true);
        return await SendAsync<DeveloperEnrollmentResponse>(httpRequest, cancellationToken)
            ?? new DeveloperEnrollmentResponse(new DeveloperEnrollment("enabled", true, true, false));
    }

    /// <inheritdoc />
    public async Task<DeveloperOrganizationListResponse> GetManagedOrganizationsAsync(CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Get, "/developer/organizations", requiresAuthentication: true);
        return await SendAsync<DeveloperOrganizationListResponse>(httpRequest, cancellationToken)
            ?? new DeveloperOrganizationListResponse([]);
    }

    /// <inheritdoc />
    public async Task<DeveloperTitleListResponse> GetOrganizationTitlesAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/developer/organizations/{organizationId:D}/titles",
            requiresAuthentication: true);

        return await SendAsync<DeveloperTitleListResponse>(httpRequest, cancellationToken)
            ?? new DeveloperTitleListResponse([]);
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string relativeUri, bool requiresAuthentication)
    {
        var request = new HttpRequestMessage(method, relativeUri);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        if (!requiresAuthentication)
        {
            return request;
        }

        var accessToken = GetAccessTokenAsync().GetAwaiter().GetResult();
        if (!string.IsNullOrWhiteSpace(accessToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        }

        return request;
    }

    private async Task<string?> GetAccessTokenAsync()
    {
        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext is null)
        {
            return null;
        }

        return await httpContext.GetTokenAsync("access_token");
    }

    private async Task<T?> SendAsync<T>(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(SerializerOptions, cancellationToken);
    }

    private async Task<T?> SendOptionalAsync<T>(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Unauthorized)
        {
            return default;
        }

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(SerializerOptions, cancellationToken);
    }
}

/// <summary>
/// Catalog browse query sent by the web UI.
/// </summary>
/// <param name="OrganizationSlug">Optional organization filter.</param>
/// <param name="ContentKind">Optional content kind filter.</param>
/// <param name="Genre">Optional genre filter.</param>
/// <param name="Sort">Sort mode such as <c>title</c> or <c>genre</c>.</param>
/// <param name="PageNumber">1-based page number.</param>
/// <param name="PageSize">Requested page size.</param>
public sealed record CatalogBrowseRequest(
    string? OrganizationSlug,
    string? ContentKind,
    string? Genre,
    string Sort,
    int PageNumber,
    int PageSize);

/// <summary>
/// Public catalog list response.
/// </summary>
/// <param name="Titles">Returned catalog titles.</param>
/// <param name="Paging">Paging metadata.</param>
public sealed record CatalogTitleListResponse(IReadOnlyList<CatalogTitleSummary> Titles, CatalogPaging Paging);

/// <summary>
/// Public catalog title detail response wrapper.
/// </summary>
/// <param name="Title">Returned title detail.</param>
public sealed record CatalogTitleResponse(CatalogTitle Title);

/// <summary>
/// Paging metadata returned by catalog browse.
/// </summary>
/// <param name="PageNumber">1-based page number.</param>
/// <param name="PageSize">Requested page size.</param>
/// <param name="TotalCount">Total matched titles.</param>
/// <param name="TotalPages">Total available pages.</param>
/// <param name="HasPreviousPage">Whether a previous page exists.</param>
/// <param name="HasNextPage">Whether a next page exists.</param>
public sealed record CatalogPaging(
    int PageNumber,
    int PageSize,
    int TotalCount,
    int TotalPages,
    bool HasPreviousPage,
    bool HasNextPage);

/// <summary>
/// Public catalog title summary.
/// </summary>
/// <param name="Id">Title identifier.</param>
/// <param name="OrganizationId">Owning organization identifier.</param>
/// <param name="OrganizationSlug">Owning organization route key.</param>
/// <param name="Slug">Title route key.</param>
/// <param name="ContentKind">Content kind.</param>
/// <param name="LifecycleStatus">Lifecycle status.</param>
/// <param name="Visibility">Visibility state.</param>
/// <param name="CurrentMetadataRevision">Current metadata revision.</param>
/// <param name="DisplayName">Public display name.</param>
/// <param name="ShortDescription">Short catalog description.</param>
/// <param name="GenreDisplay">Display-oriented genre text.</param>
/// <param name="MinPlayers">Minimum player count.</param>
/// <param name="MaxPlayers">Maximum player count.</param>
/// <param name="PlayerCountDisplay">Derived player count display.</param>
/// <param name="AgeRatingAuthority">Age rating authority.</param>
/// <param name="AgeRatingValue">Authority-specific rating value.</param>
/// <param name="MinAgeYears">Minimum recommended age.</param>
/// <param name="AgeDisplay">Derived age display.</param>
/// <param name="CardImageUrl">Card image URL.</param>
/// <param name="AcquisitionUrl">Primary acquisition URL.</param>
public sealed record CatalogTitleSummary(
    Guid Id,
    Guid OrganizationId,
    string OrganizationSlug,
    string Slug,
    string ContentKind,
    string LifecycleStatus,
    string Visibility,
    int CurrentMetadataRevision,
    string DisplayName,
    string ShortDescription,
    string GenreDisplay,
    int MinPlayers,
    int MaxPlayers,
    string PlayerCountDisplay,
    string AgeRatingAuthority,
    string AgeRatingValue,
    int MinAgeYears,
    string AgeDisplay,
    string? CardImageUrl,
    string? AcquisitionUrl);

/// <summary>
/// Public catalog title detail.
/// </summary>
/// <param name="Id">Title identifier.</param>
/// <param name="OrganizationId">Owning organization identifier.</param>
/// <param name="OrganizationSlug">Owning organization route key.</param>
/// <param name="Slug">Title route key.</param>
/// <param name="ContentKind">Content kind.</param>
/// <param name="LifecycleStatus">Lifecycle status.</param>
/// <param name="Visibility">Visibility state.</param>
/// <param name="CurrentMetadataRevision">Current metadata revision.</param>
/// <param name="DisplayName">Public display name.</param>
/// <param name="ShortDescription">Short catalog description.</param>
/// <param name="Description">Full catalog description.</param>
/// <param name="GenreDisplay">Display-oriented genre text.</param>
/// <param name="MinPlayers">Minimum player count.</param>
/// <param name="MaxPlayers">Maximum player count.</param>
/// <param name="PlayerCountDisplay">Derived player count display.</param>
/// <param name="AgeRatingAuthority">Age rating authority.</param>
/// <param name="AgeRatingValue">Authority-specific rating value.</param>
/// <param name="MinAgeYears">Minimum recommended age.</param>
/// <param name="AgeDisplay">Derived age display.</param>
/// <param name="CardImageUrl">Card image URL.</param>
/// <param name="AcquisitionUrl">Primary acquisition URL.</param>
/// <param name="MediaAssets">Media assets configured for the title.</param>
/// <param name="CurrentRelease">Current public release.</param>
/// <param name="Acquisition">Detailed acquisition context.</param>
/// <param name="CreatedAt">UTC creation timestamp.</param>
/// <param name="UpdatedAt">UTC update timestamp.</param>
public sealed record CatalogTitle(
    Guid Id,
    Guid OrganizationId,
    string OrganizationSlug,
    string Slug,
    string ContentKind,
    string LifecycleStatus,
    string Visibility,
    int CurrentMetadataRevision,
    string DisplayName,
    string ShortDescription,
    string? Description,
    string GenreDisplay,
    int MinPlayers,
    int MaxPlayers,
    string PlayerCountDisplay,
    string AgeRatingAuthority,
    string AgeRatingValue,
    int MinAgeYears,
    string AgeDisplay,
    string? CardImageUrl,
    string? AcquisitionUrl,
    IReadOnlyList<TitleMediaAsset> MediaAssets,
    CurrentTitleRelease? CurrentRelease,
    PublicTitleAcquisition? Acquisition,
    DateTime? CreatedAt,
    DateTime? UpdatedAt);

/// <summary>
/// Current public release summary.
/// </summary>
/// <param name="Id">Release identifier.</param>
/// <param name="Version">Public version string.</param>
/// <param name="MetadataRevisionNumber">Linked metadata revision number.</param>
/// <param name="PublishedAt">UTC published timestamp.</param>
public sealed record CurrentTitleRelease(Guid Id, string Version, int MetadataRevisionNumber, DateTime PublishedAt);

/// <summary>
/// Public acquisition summary.
/// </summary>
/// <param name="Url">External acquisition URL.</param>
/// <param name="Label">Optional player-facing label.</param>
/// <param name="ProviderDisplayName">Provider display name.</param>
/// <param name="ProviderHomepageUrl">Provider homepage URL.</param>
public sealed record PublicTitleAcquisition(
    string Url,
    string? Label,
    string ProviderDisplayName,
    string? ProviderHomepageUrl);

/// <summary>
/// Title media asset.
/// </summary>
/// <param name="Id">Media asset identifier.</param>
/// <param name="MediaRole">Fixed media role.</param>
/// <param name="SourceUrl">Source asset URL.</param>
/// <param name="AltText">Required accessible alt text when provided by the backend.</param>
/// <param name="MimeType">Optional MIME type.</param>
/// <param name="Width">Optional pixel width.</param>
/// <param name="Height">Optional pixel height.</param>
/// <param name="CreatedAt">UTC creation timestamp.</param>
/// <param name="UpdatedAt">UTC update timestamp.</param>
public sealed record TitleMediaAsset(
    Guid Id,
    string MediaRole,
    string SourceUrl,
    string? AltText,
    string? MimeType,
    int? Width,
    int? Height,
    DateTime CreatedAt,
    DateTime UpdatedAt);

/// <summary>
/// Current authenticated user profile.
/// </summary>
/// <param name="Subject">Stable user subject identifier.</param>
/// <param name="DisplayName">Display name.</param>
/// <param name="Email">Email address.</param>
/// <param name="EmailVerified">Whether the email is verified.</param>
/// <param name="IdentityProvider">Identity provider alias when applicable.</param>
/// <param name="Roles">Granted platform roles.</param>
public sealed record CurrentUserResponse(
    string Subject,
    string? DisplayName,
    string? Email,
    bool EmailVerified,
    string? IdentityProvider,
    IReadOnlyList<string> Roles);

/// <summary>
/// Developer-enrollment response wrapper.
/// </summary>
/// <param name="DeveloperEnrollment">Developer enrollment state.</param>
public sealed record DeveloperEnrollmentResponse(DeveloperEnrollment DeveloperEnrollment);

/// <summary>
/// Developer-enrollment result for the current user.
/// </summary>
/// <param name="Status">Enrollment status.</param>
/// <param name="DeveloperAccessEnabled">Whether developer access is enabled.</param>
/// <param name="AlreadyEnabled">Whether developer access was already enabled before the call.</param>
/// <param name="SessionRefreshRequired">Whether the current session must refresh tokens before developer claims appear.</param>
public sealed record DeveloperEnrollment(
    string Status,
    bool DeveloperAccessEnabled,
    bool AlreadyEnabled,
    bool SessionRefreshRequired);

/// <summary>
/// Linked Board profile response wrapper.
/// </summary>
/// <param name="BoardProfile">Linked Board profile.</param>
public sealed record BoardProfileResponse(BoardProfile BoardProfile);

/// <summary>
/// Linked Board profile.
/// </summary>
/// <param name="BoardUserId">Board user identifier.</param>
/// <param name="DisplayName">Board display name.</param>
/// <param name="AvatarUrl">Optional avatar URL.</param>
/// <param name="LinkedAt">UTC timestamp when the link was created.</param>
/// <param name="LastSyncedAt">UTC timestamp when the cached record was last synced.</param>
public sealed record BoardProfile(
    string BoardUserId,
    string DisplayName,
    string? AvatarUrl,
    DateTime LinkedAt,
    DateTime LastSyncedAt);

/// <summary>
/// Developer-visible organization list response.
/// </summary>
/// <param name="Organizations">Organizations the caller can manage.</param>
public sealed record DeveloperOrganizationListResponse(IReadOnlyList<DeveloperOrganizationSummary> Organizations);

/// <summary>
/// Developer-visible organization summary.
/// </summary>
/// <param name="Id">Organization identifier.</param>
/// <param name="Slug">Organization route key.</param>
/// <param name="DisplayName">Organization display name.</param>
/// <param name="Description">Optional public description.</param>
/// <param name="LogoUrl">Optional public logo URL.</param>
/// <param name="Role">Caller membership role.</param>
public sealed record DeveloperOrganizationSummary(
    Guid Id,
    string Slug,
    string DisplayName,
    string? Description,
    string? LogoUrl,
    string Role);

/// <summary>
/// Developer-visible title list response.
/// </summary>
/// <param name="Titles">Titles the caller can manage in the organization.</param>
public sealed record DeveloperTitleListResponse(IReadOnlyList<CatalogTitleSummary> Titles);
