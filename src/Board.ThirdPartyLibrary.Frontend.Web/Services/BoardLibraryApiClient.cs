using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Board.ThirdPartyLibrary.Frontend.Web.Configuration;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using System.Globalization;

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
    /// Gets application-managed profile details for the current authenticated user.
    /// </summary>
    Task<UserProfile?> GetCurrentUserProfileAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates application-managed profile details for the current authenticated user.
    /// </summary>
    Task<UserProfileResponse> UpdateCurrentUserProfileAsync(UpdateUserProfileRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets a hosted avatar URL for the current authenticated user.
    /// </summary>
    Task<UserProfileResponse> SetCurrentUserAvatarUrlAsync(string avatarUrl, CancellationToken cancellationToken = default);

    /// <summary>
    /// Uploads an avatar image for the current authenticated user.
    /// </summary>
    Task<UserProfileResponse> UploadCurrentUserAvatarAsync(ApiUploadFile avatarFile, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes any configured avatar for the current authenticated user.
    /// </summary>
    Task<UserProfileResponse> RemoveCurrentUserAvatarAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the linked Board profile for the current user when one exists.
    /// </summary>
    Task<BoardProfile?> GetBoardProfileAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the current developer-enrollment state for the authenticated user.
    /// </summary>
    Task<DeveloperEnrollmentResponse> GetDeveloperEnrollmentAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Submits the current user's developer-enrollment request.
    /// </summary>
    Task<DeveloperEnrollmentResponse> SubmitDeveloperEnrollmentAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancels the current user's open developer-enrollment request.
    /// </summary>
    Task<DeveloperEnrollmentResponse> CancelDeveloperEnrollmentAsync(Guid requestId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the conversation history for the current user's developer-enrollment request.
    /// </summary>
    Task<DeveloperEnrollmentConversationResponse> GetDeveloperEnrollmentConversationAsync(Guid requestId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Downloads a developer-enrollment attachment for the current user.
    /// </summary>
    Task<ApiFileDownload?> GetDeveloperEnrollmentAttachmentAsync(Guid requestId, Guid attachmentId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Replies to a developer-enrollment information request.
    /// </summary>
    Task<DeveloperEnrollmentResponse> ReplyToDeveloperEnrollmentAsync(Guid requestId, string? message, IReadOnlyList<ApiUploadFile> attachments, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists developer-enrollment requests for moderators.
    /// </summary>
    Task<DeveloperEnrollmentRequestListResponse> GetDeveloperEnrollmentRequestsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Approves a developer-enrollment request as a moderator.
    /// </summary>
    Task<DeveloperEnrollmentRequestResponse> ApproveDeveloperEnrollmentRequestAsync(Guid requestId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Rejects a developer-enrollment request as a moderator.
    /// </summary>
    Task<DeveloperEnrollmentRequestResponse> RejectDeveloperEnrollmentRequestAsync(Guid requestId, string message, IReadOnlyList<ApiUploadFile> attachments, CancellationToken cancellationToken = default);

    /// <summary>
    /// Requests more information from an applicant as a moderator.
    /// </summary>
    Task<DeveloperEnrollmentRequestResponse> RequestMoreInformationForDeveloperEnrollmentAsync(Guid requestId, string message, IReadOnlyList<ApiUploadFile> attachments, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the conversation history for a moderated developer-enrollment request.
    /// </summary>
    Task<DeveloperEnrollmentConversationResponse> GetModeratedDeveloperEnrollmentConversationAsync(Guid requestId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Downloads a moderated developer-enrollment attachment.
    /// </summary>
    Task<ApiFileDownload?> GetModeratedDeveloperEnrollmentAttachmentAsync(Guid requestId, Guid attachmentId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists in-app notifications for the current user.
    /// </summary>
    Task<NotificationListResponse> GetNotificationsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks an in-app notification as read.
    /// </summary>
    Task<NotificationResponse> MarkNotificationReadAsync(Guid notificationId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists organizations the current caller can manage.
    /// </summary>
    Task<DeveloperOrganizationListResponse> GetManagedOrganizationsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a new organization for the current developer.
    /// </summary>
    Task<OrganizationResponse> CreateOrganizationAsync(CreateOrganizationRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates an organization the caller can manage.
    /// </summary>
    Task<OrganizationResponse> UpdateOrganizationAsync(Guid organizationId, UpdateOrganizationRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists titles for an organization the caller can manage.
    /// </summary>
    Task<DeveloperTitleListResponse> GetOrganizationTitlesAsync(Guid organizationId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a new title within the selected organization.
    /// </summary>
    Task<DeveloperTitleResponse> CreateTitleAsync(Guid organizationId, CreateDeveloperTitleRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a developer-visible title by identifier.
    /// </summary>
    Task<DeveloperTitle?> GetDeveloperTitleAsync(Guid titleId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates stable title fields.
    /// </summary>
    Task<DeveloperTitleResponse> UpdateTitleAsync(Guid titleId, UpdateDeveloperTitleRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates the current metadata revision for a title.
    /// </summary>
    Task<DeveloperTitleResponse> UpsertTitleMetadataAsync(Guid titleId, UpsertTitleMetadataRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists metadata revisions for a title.
    /// </summary>
    Task<TitleMetadataVersionListResponse> GetTitleMetadataVersionsAsync(Guid titleId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Activates a metadata revision for a title.
    /// </summary>
    Task<DeveloperTitleResponse> ActivateTitleMetadataVersionAsync(Guid titleId, int revisionNumber, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists media assets for a title.
    /// </summary>
    Task<TitleMediaAssetListResponse> GetTitleMediaAssetsAsync(Guid titleId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Upserts a title media asset using a source URL.
    /// </summary>
    Task<TitleMediaAssetResponse> UpsertTitleMediaAssetAsync(Guid titleId, string mediaRole, UpsertTitleMediaAssetRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Uploads a title media asset image file.
    /// </summary>
    Task<TitleMediaAssetResponse> UploadTitleMediaAssetAsync(Guid titleId, string mediaRole, ApiUploadFile mediaFile, string? altText, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a title media asset for the selected role.
    /// </summary>
    Task DeleteTitleMediaAssetAsync(Guid titleId, string mediaRole, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists releases for a title.
    /// </summary>
    Task<TitleReleaseListResponse> GetTitleReleasesAsync(Guid titleId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a draft release for a title.
    /// </summary>
    Task<TitleReleaseResponse> CreateTitleReleaseAsync(Guid titleId, UpsertTitleReleaseRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates a draft release.
    /// </summary>
    Task<TitleReleaseResponse> UpdateTitleReleaseAsync(Guid titleId, Guid releaseId, UpsertTitleReleaseRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Publishes a draft release.
    /// </summary>
    Task<TitleReleaseResponse> PublishTitleReleaseAsync(Guid titleId, Guid releaseId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Activates a published release as current.
    /// </summary>
    Task<DeveloperTitleResponse> ActivateTitleReleaseAsync(Guid titleId, Guid releaseId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Withdraws a published release.
    /// </summary>
    Task<TitleReleaseResponse> WithdrawTitleReleaseAsync(Guid titleId, Guid releaseId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists artifacts for a title release.
    /// </summary>
    Task<ReleaseArtifactListResponse> GetReleaseArtifactsAsync(Guid titleId, Guid releaseId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a release artifact.
    /// </summary>
    Task<ReleaseArtifactResponse> CreateReleaseArtifactAsync(Guid titleId, Guid releaseId, UpsertReleaseArtifactRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a release artifact.
    /// </summary>
    Task DeleteReleaseArtifactAsync(Guid titleId, Guid releaseId, Guid artifactId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists organization integration connections.
    /// </summary>
    Task<IntegrationConnectionListResponse> GetOrganizationIntegrationConnectionsAsync(Guid organizationId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates an organization integration connection.
    /// </summary>
    Task<IntegrationConnectionResponse> CreateOrganizationIntegrationConnectionAsync(Guid organizationId, UpsertIntegrationConnectionRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists acquisition bindings for a title.
    /// </summary>
    Task<TitleIntegrationBindingListResponse> GetTitleIntegrationBindingsAsync(Guid titleId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates an acquisition binding for a title.
    /// </summary>
    Task<TitleIntegrationBindingResponse> CreateTitleIntegrationBindingAsync(Guid titleId, UpsertTitleIntegrationBindingRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates an acquisition binding for a title.
    /// </summary>
    Task<TitleIntegrationBindingResponse> UpdateTitleIntegrationBindingAsync(Guid titleId, Guid bindingId, UpsertTitleIntegrationBindingRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes an acquisition binding for a title.
    /// </summary>
    Task DeleteTitleIntegrationBindingAsync(Guid titleId, Guid bindingId, CancellationToken cancellationToken = default);
}

/// <summary>
/// HTTP implementation of <see cref="IBoardLibraryApiClient" />.
/// </summary>
/// <param name="httpClient">Configured backend API client.</param>
/// <param name="httpContextAccessor">Current request accessor.</param>
/// <param name="keycloakOptionsAccessor">Bound Keycloak authentication settings.</param>
/// <param name="logger">Logger.</param>
internal sealed class BoardLibraryApiClient(
    HttpClient httpClient,
    IHttpContextAccessor httpContextAccessor,
    IOptions<KeycloakOptions> keycloakOptionsAccessor,
    ILogger<BoardLibraryApiClient> logger) : IBoardLibraryApiClient
{
    private static readonly TimeSpan AccessTokenRefreshWindow = TimeSpan.FromMinutes(1);

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
    public async Task<UserProfile?> GetCurrentUserProfileAsync(CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Get, "/identity/me/profile", requiresAuthentication: true);
        return await SendOptionalAsync<UserProfileResponse>(httpRequest, cancellationToken) is { } response
            ? response.Profile
            : null;
    }

    /// <inheritdoc />
    public async Task<UserProfileResponse> UpdateCurrentUserProfileAsync(UpdateUserProfileRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Put, "/identity/me/profile", requiresAuthentication: true);
        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<UserProfileResponse>(httpRequest, cancellationToken)
            ?? new UserProfileResponse(new UserProfile(string.Empty, null, null, null, null, null, false, null, null, "U", DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task<UserProfileResponse> SetCurrentUserAvatarUrlAsync(string avatarUrl, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Put, "/identity/me/profile/avatar-url", requiresAuthentication: true);
        httpRequest.Content = JsonContent.Create(new SetAvatarUrlRequest(avatarUrl));
        return await SendAsync<UserProfileResponse>(httpRequest, cancellationToken)
            ?? new UserProfileResponse(new UserProfile(string.Empty, null, null, null, null, null, false, null, null, "U", DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task<UserProfileResponse> UploadCurrentUserAvatarAsync(ApiUploadFile avatarFile, CancellationToken cancellationToken = default)
    {
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/identity/me/profile/avatar-upload")
        {
            Version = HttpVersion.Version20,
            VersionPolicy = HttpVersionPolicy.RequestVersionOrHigher
        };
        httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var content = new MultipartFormDataContent();
        var avatarContent = new ByteArrayContent(avatarFile.Content);
        avatarContent.Headers.ContentType = new MediaTypeHeaderValue(avatarFile.ContentType);
        content.Add(avatarContent, "Avatar", avatarFile.FileName);
        httpRequest.Content = content;

        await AttachAuthorizationAsync(httpRequest);

        return await SendAsync<UserProfileResponse>(httpRequest, cancellationToken)
            ?? new UserProfileResponse(new UserProfile(string.Empty, null, null, null, null, null, false, null, null, "U", DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task<UserProfileResponse> RemoveCurrentUserAvatarAsync(CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Delete, "/identity/me/profile/avatar", requiresAuthentication: true);
        return await SendAsync<UserProfileResponse>(httpRequest, cancellationToken)
            ?? new UserProfileResponse(new UserProfile(string.Empty, null, null, null, null, null, false, null, null, "U", DateTime.UtcNow));
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
    public async Task<DeveloperEnrollmentResponse> GetDeveloperEnrollmentAsync(CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Get, "/identity/me/developer-enrollment", requiresAuthentication: true);
        return await SendAsync<DeveloperEnrollmentResponse>(httpRequest, cancellationToken)
            ?? new DeveloperEnrollmentResponse(new DeveloperEnrollment(null, "not_requested", "none", false, true, false, false, null, null, null, null, null));
    }

    /// <inheritdoc />
    public async Task<DeveloperEnrollmentResponse> SubmitDeveloperEnrollmentAsync(CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Post, "/identity/me/developer-enrollment", requiresAuthentication: true);
        return await SendAsync<DeveloperEnrollmentResponse>(httpRequest, cancellationToken)
            ?? new DeveloperEnrollmentResponse(new DeveloperEnrollment(null, "not_requested", "none", false, true, false, false, null, null, null, null, null));
    }

    /// <inheritdoc />
    public async Task<DeveloperEnrollmentResponse> CancelDeveloperEnrollmentAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Post,
            $"/identity/me/developer-enrollment/{requestId:D}/cancel",
            requiresAuthentication: true);

        return await SendAsync<DeveloperEnrollmentResponse>(httpRequest, cancellationToken)
            ?? new DeveloperEnrollmentResponse(new DeveloperEnrollment(requestId, "cancelled", "none", false, true, false, false, DateTime.UtcNow, DateTime.UtcNow, null, null, null));
    }

    /// <inheritdoc />
    public async Task<DeveloperEnrollmentConversationResponse> GetDeveloperEnrollmentConversationAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/identity/me/developer-enrollment/{requestId:D}/conversation",
            requiresAuthentication: true);

        return await SendAsync<DeveloperEnrollmentConversationResponse>(httpRequest, cancellationToken)
            ?? new DeveloperEnrollmentConversationResponse(new DeveloperEnrollmentConversation(requestId, "not_requested", "none", null, null, []));
    }

    /// <inheritdoc />
    public async Task<ApiFileDownload?> GetDeveloperEnrollmentAttachmentAsync(Guid requestId, Guid attachmentId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/identity/me/developer-enrollment/{requestId:D}/attachments/{attachmentId:D}",
            requiresAuthentication: true);

        return await SendFileOptionalAsync(httpRequest, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<DeveloperEnrollmentResponse> ReplyToDeveloperEnrollmentAsync(Guid requestId, string? message, IReadOnlyList<ApiUploadFile> attachments, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateMultipartRequest(
            $"/identity/me/developer-enrollment/{requestId:D}/messages",
            message,
            attachments);

        await AttachAuthorizationAsync(httpRequest);

        return await SendAsync<DeveloperEnrollmentResponse>(httpRequest, cancellationToken)
            ?? new DeveloperEnrollmentResponse(new DeveloperEnrollment(requestId, "pending_review", "moderator", false, false, false, false, DateTime.UtcNow, DateTime.UtcNow, null, null, null));
    }

    /// <inheritdoc />
    public async Task<DeveloperEnrollmentRequestListResponse> GetDeveloperEnrollmentRequestsAsync(CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Get, "/moderation/developer-enrollment-requests", requiresAuthentication: true);
        return await SendAsync<DeveloperEnrollmentRequestListResponse>(httpRequest, cancellationToken)
            ?? new DeveloperEnrollmentRequestListResponse([]);
    }

    /// <inheritdoc />
    public async Task<DeveloperEnrollmentRequestResponse> ApproveDeveloperEnrollmentRequestAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Post,
            $"/moderation/developer-enrollment-requests/{requestId:D}/approve",
            requiresAuthentication: true);

        return await SendAsync<DeveloperEnrollmentRequestResponse>(httpRequest, cancellationToken)
            ?? new DeveloperEnrollmentRequestResponse(new DeveloperEnrollmentRequest(
                requestId,
                string.Empty,
                null,
                null,
                "approved",
                "none",
                true,
                DateTime.UtcNow,
                DateTime.UtcNow,
                DateTime.UtcNow,
                null,
                null));
    }

    /// <inheritdoc />
    public async Task<DeveloperEnrollmentRequestResponse> RejectDeveloperEnrollmentRequestAsync(Guid requestId, string message, IReadOnlyList<ApiUploadFile> attachments, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateMultipartRequest(
            $"/moderation/developer-enrollment-requests/{requestId:D}/reject",
            message,
            attachments);

        await AttachAuthorizationAsync(httpRequest);

        return await SendAsync<DeveloperEnrollmentRequestResponse>(httpRequest, cancellationToken)
            ?? new DeveloperEnrollmentRequestResponse(new DeveloperEnrollmentRequest(
                requestId,
                string.Empty,
                null,
                null,
                "rejected",
                "none",
                false,
                DateTime.UtcNow,
                DateTime.UtcNow,
                DateTime.UtcNow,
                DateTime.UtcNow.AddDays(30),
                null));
    }

    /// <inheritdoc />
    public async Task<DeveloperEnrollmentRequestResponse> RequestMoreInformationForDeveloperEnrollmentAsync(Guid requestId, string message, IReadOnlyList<ApiUploadFile> attachments, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateMultipartRequest(
            $"/moderation/developer-enrollment-requests/{requestId:D}/request-more-information",
            message,
            attachments);

        await AttachAuthorizationAsync(httpRequest);

        return await SendAsync<DeveloperEnrollmentRequestResponse>(httpRequest, cancellationToken)
            ?? new DeveloperEnrollmentRequestResponse(new DeveloperEnrollmentRequest(
                requestId,
                string.Empty,
                null,
                null,
                "awaiting_applicant_response",
                "applicant",
                false,
                DateTime.UtcNow,
                DateTime.UtcNow,
                null,
                null,
                null));
    }

    /// <inheritdoc />
    public async Task<DeveloperEnrollmentConversationResponse> GetModeratedDeveloperEnrollmentConversationAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/moderation/developer-enrollment-requests/{requestId:D}/conversation",
            requiresAuthentication: true);

        return await SendAsync<DeveloperEnrollmentConversationResponse>(httpRequest, cancellationToken)
            ?? new DeveloperEnrollmentConversationResponse(new DeveloperEnrollmentConversation(requestId, "not_requested", "none", null, null, []));
    }

    /// <inheritdoc />
    public async Task<ApiFileDownload?> GetModeratedDeveloperEnrollmentAttachmentAsync(Guid requestId, Guid attachmentId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/moderation/developer-enrollment-requests/{requestId:D}/attachments/{attachmentId:D}",
            requiresAuthentication: true);

        return await SendFileOptionalAsync(httpRequest, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<NotificationListResponse> GetNotificationsAsync(CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Get, "/identity/me/notifications", requiresAuthentication: true);
        return await SendAsync<NotificationListResponse>(httpRequest, cancellationToken)
            ?? new NotificationListResponse([]);
    }

    /// <inheritdoc />
    public async Task<NotificationResponse> MarkNotificationReadAsync(Guid notificationId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Post,
            $"/identity/me/notifications/{notificationId:D}/read",
            requiresAuthentication: true);

        return await SendAsync<NotificationResponse>(httpRequest, cancellationToken)
            ?? new NotificationResponse(new UserNotification(notificationId, "developer_enrollment", string.Empty, string.Empty, null, true, DateTime.UtcNow, DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task<DeveloperOrganizationListResponse> GetManagedOrganizationsAsync(CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Get, "/developer/organizations", requiresAuthentication: true);
        return await SendAsync<DeveloperOrganizationListResponse>(httpRequest, cancellationToken)
            ?? new DeveloperOrganizationListResponse([]);
    }

    /// <inheritdoc />
    public async Task<OrganizationResponse> CreateOrganizationAsync(CreateOrganizationRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(HttpMethod.Post, "/organizations", requiresAuthentication: true);
        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<OrganizationResponse>(httpRequest, cancellationToken)
            ?? new OrganizationResponse(
                new OrganizationSummary(
                    Guid.Empty,
                    request.Slug,
                    request.DisplayName,
                    request.Description,
                    request.LogoUrl,
                    DateTime.UtcNow,
                    DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task<OrganizationResponse> UpdateOrganizationAsync(Guid organizationId, UpdateOrganizationRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Put,
            $"/developer/organizations/{organizationId:D}",
            requiresAuthentication: true);

        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<OrganizationResponse>(httpRequest, cancellationToken)
            ?? new OrganizationResponse(
                new OrganizationSummary(
                    organizationId,
                    request.Slug,
                    request.DisplayName,
                    request.Description,
                    request.LogoUrl,
                    DateTime.UtcNow,
                    DateTime.UtcNow));
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

    /// <inheritdoc />
    public async Task<DeveloperTitleResponse> CreateTitleAsync(Guid organizationId, CreateDeveloperTitleRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Post,
            $"/developer/organizations/{organizationId:D}/titles",
            requiresAuthentication: true);

        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<DeveloperTitleResponse>(httpRequest, cancellationToken)
            ?? new DeveloperTitleResponse(CreateFallbackDeveloperTitle(Guid.Empty));
    }

    /// <inheritdoc />
    public async Task<DeveloperTitle?> GetDeveloperTitleAsync(Guid titleId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/developer/titles/{titleId:D}",
            requiresAuthentication: true);

        return await SendOptionalAsync<DeveloperTitleResponse>(httpRequest, cancellationToken) is { } response
            ? response.Title
            : null;
    }

    /// <inheritdoc />
    public async Task<DeveloperTitleResponse> UpdateTitleAsync(Guid titleId, UpdateDeveloperTitleRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Put,
            $"/developer/titles/{titleId:D}",
            requiresAuthentication: true);

        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<DeveloperTitleResponse>(httpRequest, cancellationToken)
            ?? new DeveloperTitleResponse(CreateFallbackDeveloperTitle(titleId));
    }

    /// <inheritdoc />
    public async Task<DeveloperTitleResponse> UpsertTitleMetadataAsync(Guid titleId, UpsertTitleMetadataRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Put,
            $"/developer/titles/{titleId:D}/metadata/current",
            requiresAuthentication: true);

        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<DeveloperTitleResponse>(httpRequest, cancellationToken)
            ?? new DeveloperTitleResponse(CreateFallbackDeveloperTitle(titleId));
    }

    /// <inheritdoc />
    public async Task<TitleMetadataVersionListResponse> GetTitleMetadataVersionsAsync(Guid titleId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/developer/titles/{titleId:D}/metadata-versions",
            requiresAuthentication: true);

        return await SendAsync<TitleMetadataVersionListResponse>(httpRequest, cancellationToken)
            ?? new TitleMetadataVersionListResponse([]);
    }

    /// <inheritdoc />
    public async Task<DeveloperTitleResponse> ActivateTitleMetadataVersionAsync(Guid titleId, int revisionNumber, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Post,
            $"/developer/titles/{titleId:D}/metadata-versions/{revisionNumber}/activate",
            requiresAuthentication: true);

        return await SendAsync<DeveloperTitleResponse>(httpRequest, cancellationToken)
            ?? new DeveloperTitleResponse(CreateFallbackDeveloperTitle(titleId));
    }

    /// <inheritdoc />
    public async Task<TitleMediaAssetListResponse> GetTitleMediaAssetsAsync(Guid titleId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/developer/titles/{titleId:D}/media",
            requiresAuthentication: true);

        return await SendAsync<TitleMediaAssetListResponse>(httpRequest, cancellationToken)
            ?? new TitleMediaAssetListResponse([]);
    }

    /// <inheritdoc />
    public async Task<TitleMediaAssetResponse> UpsertTitleMediaAssetAsync(Guid titleId, string mediaRole, UpsertTitleMediaAssetRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Put,
            $"/developer/titles/{titleId:D}/media/{Uri.EscapeDataString(mediaRole)}",
            requiresAuthentication: true);

        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<TitleMediaAssetResponse>(httpRequest, cancellationToken)
            ?? new TitleMediaAssetResponse(new TitleMediaAsset(Guid.Empty, mediaRole, request.SourceUrl, request.AltText, request.MimeType, request.Width, request.Height, DateTime.UtcNow, DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task<TitleMediaAssetResponse> UploadTitleMediaAssetAsync(Guid titleId, string mediaRole, ApiUploadFile mediaFile, string? altText, CancellationToken cancellationToken = default)
    {
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"/developer/titles/{titleId:D}/media/{Uri.EscapeDataString(mediaRole)}/upload")
        {
            Version = HttpVersion.Version20,
            VersionPolicy = HttpVersionPolicy.RequestVersionOrHigher
        };
        httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var content = new MultipartFormDataContent();
        var mediaContent = new ByteArrayContent(mediaFile.Content);
        mediaContent.Headers.ContentType = new MediaTypeHeaderValue(mediaFile.ContentType);
        content.Add(mediaContent, "media", mediaFile.FileName);

        if (!string.IsNullOrWhiteSpace(altText))
        {
            content.Add(new StringContent(altText.Trim()), "altText");
        }

        httpRequest.Content = content;
        await AttachAuthorizationAsync(httpRequest);

        return await SendAsync<TitleMediaAssetResponse>(httpRequest, cancellationToken)
            ?? new TitleMediaAssetResponse(new TitleMediaAsset(Guid.Empty, mediaRole, string.Empty, altText, mediaFile.ContentType, null, null, DateTime.UtcNow, DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task DeleteTitleMediaAssetAsync(Guid titleId, string mediaRole, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Delete,
            $"/developer/titles/{titleId:D}/media/{Uri.EscapeDataString(mediaRole)}",
            requiresAuthentication: true);

        await SendNoContentAsync(httpRequest, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<TitleReleaseListResponse> GetTitleReleasesAsync(Guid titleId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/developer/titles/{titleId:D}/releases",
            requiresAuthentication: true);

        return await SendAsync<TitleReleaseListResponse>(httpRequest, cancellationToken)
            ?? new TitleReleaseListResponse([]);
    }

    /// <inheritdoc />
    public async Task<TitleReleaseResponse> CreateTitleReleaseAsync(Guid titleId, UpsertTitleReleaseRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Post,
            $"/developer/titles/{titleId:D}/releases",
            requiresAuthentication: true);

        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<TitleReleaseResponse>(httpRequest, cancellationToken)
            ?? new TitleReleaseResponse(new TitleRelease(Guid.Empty, request.Version, "draft", request.MetadataRevisionNumber, false, null, DateTime.UtcNow, DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task<TitleReleaseResponse> UpdateTitleReleaseAsync(Guid titleId, Guid releaseId, UpsertTitleReleaseRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Put,
            $"/developer/titles/{titleId:D}/releases/{releaseId:D}",
            requiresAuthentication: true);

        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<TitleReleaseResponse>(httpRequest, cancellationToken)
            ?? new TitleReleaseResponse(new TitleRelease(releaseId, request.Version, "draft", request.MetadataRevisionNumber, false, null, DateTime.UtcNow, DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task<TitleReleaseResponse> PublishTitleReleaseAsync(Guid titleId, Guid releaseId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Post,
            $"/developer/titles/{titleId:D}/releases/{releaseId:D}/publish",
            requiresAuthentication: true);

        return await SendAsync<TitleReleaseResponse>(httpRequest, cancellationToken)
            ?? new TitleReleaseResponse(new TitleRelease(releaseId, string.Empty, "published", 1, false, DateTime.UtcNow, DateTime.UtcNow, DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task<DeveloperTitleResponse> ActivateTitleReleaseAsync(Guid titleId, Guid releaseId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Post,
            $"/developer/titles/{titleId:D}/releases/{releaseId:D}/activate",
            requiresAuthentication: true);

        return await SendAsync<DeveloperTitleResponse>(httpRequest, cancellationToken)
            ?? new DeveloperTitleResponse(CreateFallbackDeveloperTitle(titleId));
    }

    /// <inheritdoc />
    public async Task<TitleReleaseResponse> WithdrawTitleReleaseAsync(Guid titleId, Guid releaseId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Post,
            $"/developer/titles/{titleId:D}/releases/{releaseId:D}/withdraw",
            requiresAuthentication: true);

        return await SendAsync<TitleReleaseResponse>(httpRequest, cancellationToken)
            ?? new TitleReleaseResponse(new TitleRelease(releaseId, string.Empty, "withdrawn", 1, false, null, DateTime.UtcNow, DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task<ReleaseArtifactListResponse> GetReleaseArtifactsAsync(Guid titleId, Guid releaseId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/developer/titles/{titleId:D}/releases/{releaseId:D}/artifacts",
            requiresAuthentication: true);

        return await SendAsync<ReleaseArtifactListResponse>(httpRequest, cancellationToken)
            ?? new ReleaseArtifactListResponse([]);
    }

    /// <inheritdoc />
    public async Task<ReleaseArtifactResponse> CreateReleaseArtifactAsync(Guid titleId, Guid releaseId, UpsertReleaseArtifactRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Post,
            $"/developer/titles/{titleId:D}/releases/{releaseId:D}/artifacts",
            requiresAuthentication: true);

        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<ReleaseArtifactResponse>(httpRequest, cancellationToken)
            ?? new ReleaseArtifactResponse(new ReleaseArtifact(Guid.Empty, request.ArtifactKind, request.PackageName, request.VersionCode, request.Sha256, request.FileSizeBytes, DateTime.UtcNow, DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task DeleteReleaseArtifactAsync(Guid titleId, Guid releaseId, Guid artifactId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Delete,
            $"/developer/titles/{titleId:D}/releases/{releaseId:D}/artifacts/{artifactId:D}",
            requiresAuthentication: true);

        await SendNoContentAsync(httpRequest, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IntegrationConnectionListResponse> GetOrganizationIntegrationConnectionsAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/developer/organizations/{organizationId:D}/integration-connections",
            requiresAuthentication: true);

        return await SendAsync<IntegrationConnectionListResponse>(httpRequest, cancellationToken)
            ?? new IntegrationConnectionListResponse([]);
    }

    /// <inheritdoc />
    public async Task<IntegrationConnectionResponse> CreateOrganizationIntegrationConnectionAsync(Guid organizationId, UpsertIntegrationConnectionRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Post,
            $"/developer/organizations/{organizationId:D}/integration-connections",
            requiresAuthentication: true);

        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<IntegrationConnectionResponse>(httpRequest, cancellationToken)
            ?? new IntegrationConnectionResponse(
                new IntegrationConnection(
                    Guid.Empty,
                    organizationId,
                    request.SupportedPublisherId,
                    null,
                    request.CustomPublisherDisplayName,
                    request.CustomPublisherHomepageUrl,
                    request.Configuration,
                    request.IsEnabled,
                    DateTime.UtcNow,
                    DateTime.UtcNow));
    }

    /// <inheritdoc />
    public async Task<TitleIntegrationBindingListResponse> GetTitleIntegrationBindingsAsync(Guid titleId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Get,
            $"/developer/titles/{titleId:D}/integration-bindings",
            requiresAuthentication: true);

        return await SendAsync<TitleIntegrationBindingListResponse>(httpRequest, cancellationToken)
            ?? new TitleIntegrationBindingListResponse([]);
    }

    /// <inheritdoc />
    public async Task<TitleIntegrationBindingResponse> CreateTitleIntegrationBindingAsync(Guid titleId, UpsertTitleIntegrationBindingRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Post,
            $"/developer/titles/{titleId:D}/integration-bindings",
            requiresAuthentication: true);

        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<TitleIntegrationBindingResponse>(httpRequest, cancellationToken)
            ?? new TitleIntegrationBindingResponse(CreateFallbackTitleIntegrationBinding(titleId, request));
    }

    /// <inheritdoc />
    public async Task<TitleIntegrationBindingResponse> UpdateTitleIntegrationBindingAsync(Guid titleId, Guid bindingId, UpsertTitleIntegrationBindingRequest request, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Put,
            $"/developer/titles/{titleId:D}/integration-bindings/{bindingId:D}",
            requiresAuthentication: true);

        httpRequest.Content = JsonContent.Create(request);
        return await SendAsync<TitleIntegrationBindingResponse>(httpRequest, cancellationToken)
            ?? new TitleIntegrationBindingResponse(CreateFallbackTitleIntegrationBinding(titleId, request) with { Id = bindingId });
    }

    /// <inheritdoc />
    public async Task DeleteTitleIntegrationBindingAsync(Guid titleId, Guid bindingId, CancellationToken cancellationToken = default)
    {
        using var httpRequest = CreateRequest(
            HttpMethod.Delete,
            $"/developer/titles/{titleId:D}/integration-bindings/{bindingId:D}",
            requiresAuthentication: true);

        await SendNoContentAsync(httpRequest, cancellationToken);
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string relativeUri, bool requiresAuthentication)
    {
        var request = new HttpRequestMessage(method, relativeUri);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Version = HttpVersion.Version20;
        request.VersionPolicy = HttpVersionPolicy.RequestVersionOrHigher;

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

    private HttpRequestMessage CreateMultipartRequest(string relativeUri, string? message, IReadOnlyList<ApiUploadFile> attachments)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, relativeUri);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Version = HttpVersion.Version20;
        request.VersionPolicy = HttpVersionPolicy.RequestVersionOrHigher;

        var content = new MultipartFormDataContent();
        if (!string.IsNullOrWhiteSpace(message))
        {
            content.Add(new StringContent(message), "message");
        }

        foreach (var attachment in attachments)
        {
            var fileContent = new ByteArrayContent(attachment.Content);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(string.IsNullOrWhiteSpace(attachment.ContentType) ? "application/octet-stream" : attachment.ContentType);
            content.Add(fileContent, "attachments", attachment.FileName);
        }

        request.Content = content;
        return request;
    }

    private async Task AttachAuthorizationAsync(HttpRequestMessage request)
    {
        var accessToken = await GetAccessTokenAsync();
        if (!string.IsNullOrWhiteSpace(accessToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        }
    }

    private async Task<string?> GetAccessTokenAsync()
    {
        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext is null)
        {
            return null;
        }

        var authenticationResult = await httpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        if (!authenticationResult.Succeeded || authenticationResult.Principal is null || authenticationResult.Properties is null)
        {
            return await httpContext.GetTokenAsync("access_token");
        }

        var properties = authenticationResult.Properties;
        var accessToken = properties.GetTokenValue("access_token");
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return null;
        }

        if (!ShouldRefreshAccessToken(properties, accessToken))
        {
            return accessToken;
        }

        var refreshedAccessToken = await TryRefreshAccessTokenAsync(httpContext, authenticationResult.Principal, properties, accessToken);
        return string.IsNullOrWhiteSpace(refreshedAccessToken) ? accessToken : refreshedAccessToken;
    }

    private static bool ShouldRefreshAccessToken(AuthenticationProperties properties, string accessToken)
    {
        if (!TryResolveAccessTokenExpiry(properties, accessToken, out var expiresAt))
        {
            return false;
        }

        return expiresAt <= DateTimeOffset.UtcNow.Add(AccessTokenRefreshWindow);
    }

    private static bool TryResolveAccessTokenExpiry(
        AuthenticationProperties properties,
        string accessToken,
        out DateTimeOffset expiresAt)
    {
        var expiresAtRaw = properties.GetTokenValue("expires_at");
        if (!string.IsNullOrWhiteSpace(expiresAtRaw) &&
            DateTimeOffset.TryParse(
                expiresAtRaw,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out expiresAt))
        {
            return true;
        }

        return TryGetJwtExpiry(accessToken, out expiresAt);
    }

    private static bool TryGetJwtExpiry(string accessToken, out DateTimeOffset expiresAt)
    {
        expiresAt = default;

        var segments = accessToken.Split('.');
        if (segments.Length < 2 || string.IsNullOrWhiteSpace(segments[1]))
        {
            return false;
        }

        try
        {
            var payloadBytes = WebEncoders.Base64UrlDecode(segments[1]);
            using var document = JsonDocument.Parse(payloadBytes);
            if (!document.RootElement.TryGetProperty("exp", out var expProperty) || !expProperty.TryGetInt64(out var expUnixSeconds))
            {
                return false;
            }

            expiresAt = DateTimeOffset.FromUnixTimeSeconds(expUnixSeconds);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private async Task<string?> TryRefreshAccessTokenAsync(
        HttpContext httpContext,
        ClaimsPrincipal principal,
        AuthenticationProperties properties,
        string currentAccessToken)
    {
        var refreshToken = properties.GetTokenValue("refresh_token");
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return currentAccessToken;
        }

        var keycloakOptions = keycloakOptionsAccessor.Value;
        var tokenEndpoint = $"{keycloakOptions.BaseUrl.TrimEnd('/')}/realms/{keycloakOptions.Realm}/protocol/openid-connect/token";

        using var refreshHttpClient = new HttpClient
        {
            DefaultRequestVersion = HttpVersion.Version20,
            DefaultVersionPolicy = HttpVersionPolicy.RequestVersionOrHigher
        };

        using var refreshRequest = new HttpRequestMessage(HttpMethod.Post, tokenEndpoint)
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "refresh_token",
                ["client_id"] = keycloakOptions.ClientId,
                ["refresh_token"] = refreshToken
            })
        };

        if (!string.IsNullOrWhiteSpace(keycloakOptions.ClientSecret))
        {
            var secretBytes = Encoding.UTF8.GetBytes($"{keycloakOptions.ClientId}:{keycloakOptions.ClientSecret}");
            refreshRequest.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(secretBytes));
        }

        using var refreshResponse = await refreshHttpClient.SendAsync(refreshRequest);
        if (!refreshResponse.IsSuccessStatusCode)
        {
            logger.LogWarning(
                "Access token refresh failed with status code {StatusCode} for Keycloak realm {Realm}.",
                refreshResponse.StatusCode,
                keycloakOptions.Realm);
            return currentAccessToken;
        }

        var refreshPayload = await refreshResponse.Content.ReadFromJsonAsync<KeycloakRefreshTokenResponse>(SerializerOptions);
        if (refreshPayload is null || string.IsNullOrWhiteSpace(refreshPayload.AccessToken))
        {
            logger.LogWarning("Access token refresh response did not include an access token.");
            return currentAccessToken;
        }

        var refreshedAccessToken = refreshPayload.AccessToken;
        var refreshedRefreshToken = string.IsNullOrWhiteSpace(refreshPayload.RefreshToken)
            ? refreshToken
            : refreshPayload.RefreshToken;
        var refreshedIdToken = string.IsNullOrWhiteSpace(refreshPayload.IdToken)
            ? properties.GetTokenValue("id_token")
            : refreshPayload.IdToken;
        var tokenType = string.IsNullOrWhiteSpace(refreshPayload.TokenType)
            ? properties.GetTokenValue("token_type")
            : refreshPayload.TokenType;
        var expiresAt = DateTimeOffset.UtcNow.AddSeconds(Math.Max(30, refreshPayload.ExpiresIn));

        var refreshedTokens = new List<AuthenticationToken>
        {
            new() { Name = "access_token", Value = refreshedAccessToken },
            new() { Name = "refresh_token", Value = refreshedRefreshToken },
            new() { Name = "expires_at", Value = expiresAt.ToString("o", CultureInfo.InvariantCulture) }
        };

        if (!string.IsNullOrWhiteSpace(refreshedIdToken))
        {
            refreshedTokens.Add(new AuthenticationToken { Name = "id_token", Value = refreshedIdToken });
        }

        if (!string.IsNullOrWhiteSpace(tokenType))
        {
            refreshedTokens.Add(new AuthenticationToken { Name = "token_type", Value = tokenType });
        }

        properties.StoreTokens(refreshedTokens);

        await httpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, properties);
        return refreshedAccessToken;
    }

    private async Task<T?> SendAsync<T>(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<T>(SerializerOptions, cancellationToken);
    }

    private async Task<T?> SendOptionalAsync<T>(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Unauthorized)
        {
            return default;
        }

        await EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<T>(SerializerOptions, cancellationToken);
    }

    private async Task<ApiFileDownload?> SendFileOptionalAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Unauthorized)
        {
            return null;
        }

        await EnsureSuccessAsync(response, cancellationToken);
        var content = await response.Content.ReadAsByteArrayAsync(cancellationToken);
        var contentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
        var fileName = response.Content.Headers.ContentDisposition?.FileNameStar
            ?? response.Content.Headers.ContentDisposition?.FileName?.Trim('"')
            ?? "attachment.bin";

        return new ApiFileDownload(fileName, contentType, content);
    }

    private async Task SendNoContentAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
    }

    private static DeveloperTitle CreateFallbackDeveloperTitle(Guid titleId) =>
        new(
            titleId,
            Guid.Empty,
            string.Empty,
            string.Empty,
            "game",
            "draft",
            "private",
            1,
            string.Empty,
            string.Empty,
            null,
            string.Empty,
            1,
            1,
            "1 player",
            "ESRB",
            "E",
            0,
            "ESRB E",
            null,
            null,
            [],
            null,
            null,
            null,
            DateTime.UtcNow,
            DateTime.UtcNow);

    private static TitleIntegrationBinding CreateFallbackTitleIntegrationBinding(Guid titleId, UpsertTitleIntegrationBindingRequest request) =>
        new(
            Guid.Empty,
            titleId,
            request.IntegrationConnectionId,
            new IntegrationConnection(
                request.IntegrationConnectionId,
                Guid.Empty,
                null,
                null,
                null,
                null,
                null,
                true,
                DateTime.UtcNow,
                DateTime.UtcNow),
            request.AcquisitionUrl,
            request.AcquisitionLabel,
            request.Configuration,
            request.IsPrimary,
            request.IsEnabled,
            DateTime.UtcNow,
            DateTime.UtcNow);

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        ApiProblemResponse? problem = null;

        try
        {
            problem = await response.Content.ReadFromJsonAsync<ApiProblemResponse>(SerializerOptions, cancellationToken);
        }
        catch (JsonException)
        {
        }

        throw new BoardLibraryApiException(
            response.StatusCode,
            problem?.Title ?? $"The backend returned {(int)response.StatusCode}.",
            problem?.Detail,
            problem?.Code);
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
/// Application-managed profile details for the current authenticated user.
/// </summary>
/// <param name="Subject">Stable user subject identifier.</param>
/// <param name="DisplayName">Application-managed display name.</param>
/// <param name="UserName">Username sourced from Keycloak claims.</param>
/// <param name="FirstName">First name sourced from Keycloak claims.</param>
/// <param name="LastName">Last name sourced from Keycloak claims.</param>
/// <param name="Email">Cached identity email address.</param>
/// <param name="EmailVerified">Cached identity email verification flag.</param>
/// <param name="AvatarUrl">Hosted avatar URL when configured.</param>
/// <param name="AvatarDataUrl">Inline avatar data URL when an avatar image is uploaded directly.</param>
/// <param name="Initials">Initials used for avatar fallback rendering.</param>
/// <param name="UpdatedAt">UTC profile update timestamp.</param>
public sealed record UserProfile(
    string Subject,
    string? DisplayName,
    string? UserName,
    string? FirstName,
    string? LastName,
    string? Email,
    bool EmailVerified,
    string? AvatarUrl,
    string? AvatarDataUrl,
    string Initials,
    DateTime UpdatedAt);

/// <summary>
/// Response wrapper for current-user profile endpoints.
/// </summary>
/// <param name="Profile">Returned current user profile details.</param>
public sealed record UserProfileResponse(UserProfile Profile);

/// <summary>
/// Request payload for updating current-user profile details.
/// </summary>
/// <param name="DisplayName">Application-managed display name.</param>
public sealed record UpdateUserProfileRequest(string? DisplayName);

/// <summary>
/// Request payload for setting a hosted avatar URL.
/// </summary>
/// <param name="AvatarUrl">Absolute avatar URL.</param>
public sealed record SetAvatarUrlRequest(string AvatarUrl);

/// <summary>
/// Developer-enrollment response wrapper.
/// </summary>
/// <param name="DeveloperEnrollment">Developer enrollment state.</param>
public sealed record DeveloperEnrollmentResponse(DeveloperEnrollment DeveloperEnrollment);

/// <summary>
/// Developer-enrollment result for the current user.
/// </summary>
/// <param name="RequestId">Application-owned request identifier when one exists.</param>
/// <param name="Status">Enrollment status.</param>
/// <param name="ActionRequiredBy">Which workflow actor must act next.</param>
/// <param name="DeveloperAccessEnabled">Whether developer access is enabled.</param>
/// <param name="CanSubmitRequest">Whether the user may submit a request.</param>
/// <param name="CanCancelRequest">Whether the active request can be cancelled.</param>
/// <param name="CanReply">Whether the user can reply with more information.</param>
/// <param name="RequestedAt">UTC timestamp when the request was created.</param>
/// <param name="UpdatedAt">UTC timestamp of the latest workflow activity.</param>
/// <param name="ReviewedAt">UTC timestamp when the request was reviewed.</param>
/// <param name="ReapplyAvailableAt">UTC timestamp when a new request may be created again.</param>
/// <param name="ReviewerSubject">Reviewer Keycloak subject when one exists.</param>
public sealed record DeveloperEnrollment(
    Guid? RequestId,
    string Status,
    string ActionRequiredBy,
    bool DeveloperAccessEnabled,
    bool CanSubmitRequest,
    bool CanCancelRequest,
    bool CanReply,
    DateTime? RequestedAt,
    DateTime? UpdatedAt,
    DateTime? ReviewedAt,
    DateTime? ReapplyAvailableAt,
    string? ReviewerSubject);

/// <summary>
/// Moderator-visible developer-enrollment request list.
/// </summary>
/// <param name="Requests">Returned enrollment requests.</param>
public sealed record DeveloperEnrollmentRequestListResponse(IReadOnlyList<DeveloperEnrollmentRequest> Requests);

/// <summary>
/// Moderator-visible developer-enrollment request wrapper.
/// </summary>
/// <param name="DeveloperEnrollmentRequest">Returned request.</param>
public sealed record DeveloperEnrollmentRequestResponse(DeveloperEnrollmentRequest DeveloperEnrollmentRequest);

/// <summary>
/// Developer-enrollment request shown to moderators.
/// </summary>
/// <param name="RequestId">Request identifier.</param>
/// <param name="ApplicantSubject">Applicant Keycloak subject.</param>
/// <param name="ApplicantDisplayName">Applicant display name.</param>
/// <param name="ApplicantEmail">Applicant email address.</param>
/// <param name="Status">Review status.</param>
/// <param name="ActionRequiredBy">Which workflow actor must act next.</param>
/// <param name="DeveloperAccessEnabled">Whether developer access is enabled.</param>
/// <param name="RequestedAt">UTC timestamp when the request was submitted.</param>
/// <param name="UpdatedAt">UTC timestamp of the latest workflow activity.</param>
/// <param name="ReviewedAt">UTC timestamp when the request was reviewed.</param>
/// <param name="ReapplyAvailableAt">UTC timestamp when the applicant may submit again.</param>
/// <param name="ReviewerSubject">Reviewer Keycloak subject.</param>
public sealed record DeveloperEnrollmentRequest(
    Guid RequestId,
    string ApplicantSubject,
    string? ApplicantDisplayName,
    string? ApplicantEmail,
    string Status,
    string ActionRequiredBy,
    bool DeveloperAccessEnabled,
    DateTime RequestedAt,
    DateTime UpdatedAt,
    DateTime? ReviewedAt,
    DateTime? ReapplyAvailableAt,
    string? ReviewerSubject);

/// <summary>
/// Developer-enrollment conversation response wrapper.
/// </summary>
/// <param name="Conversation">Returned conversation.</param>
public sealed record DeveloperEnrollmentConversationResponse(DeveloperEnrollmentConversation Conversation);

/// <summary>
/// Developer-enrollment conversation detail.
/// </summary>
/// <param name="RequestId">Enrollment request identifier.</param>
/// <param name="Status">Current request status.</param>
/// <param name="ActionRequiredBy">Which workflow actor must act next.</param>
/// <param name="ReviewedAt">UTC review timestamp when applicable.</param>
/// <param name="ReviewerSubject">Reviewer Keycloak subject when one exists.</param>
/// <param name="Messages">Conversation messages.</param>
public sealed record DeveloperEnrollmentConversation(
    Guid RequestId,
    string Status,
    string ActionRequiredBy,
    DateTime? ReviewedAt,
    string? ReviewerSubject,
    IReadOnlyList<DeveloperEnrollmentConversationMessage> Messages);

/// <summary>
/// Developer-enrollment conversation message.
/// </summary>
/// <param name="MessageId">Conversation message identifier.</param>
/// <param name="AuthorRole">Message author role.</param>
/// <param name="AuthorSubject">Message author subject.</param>
/// <param name="AuthorDisplayName">Message author display name.</param>
/// <param name="MessageKind">Semantic message kind.</param>
/// <param name="Body">Message body text.</param>
/// <param name="CreatedAt">UTC creation timestamp.</param>
/// <param name="Attachments">Message attachments.</param>
public sealed record DeveloperEnrollmentConversationMessage(
    Guid MessageId,
    string AuthorRole,
    string AuthorSubject,
    string? AuthorDisplayName,
    string MessageKind,
    string? Body,
    DateTime CreatedAt,
    IReadOnlyList<DeveloperEnrollmentConversationAttachment> Attachments);

/// <summary>
/// Developer-enrollment conversation attachment.
/// </summary>
/// <param name="AttachmentId">Attachment identifier.</param>
/// <param name="FileName">Original file name.</param>
/// <param name="ContentType">Attachment content type.</param>
/// <param name="SizeBytes">Attachment size in bytes.</param>
public sealed record DeveloperEnrollmentConversationAttachment(
    Guid AttachmentId,
    string FileName,
    string ContentType,
    long SizeBytes);

/// <summary>
/// Binary file upload sent to the backend.
/// </summary>
/// <param name="FileName">Original file name.</param>
/// <param name="ContentType">Normalized content type.</param>
/// <param name="Content">Binary file content.</param>
public sealed record ApiUploadFile(string FileName, string ContentType, byte[] Content);

/// <summary>
/// Binary file downloaded from the backend.
/// </summary>
/// <param name="FileName">Original file name.</param>
/// <param name="ContentType">Normalized content type.</param>
/// <param name="Content">Binary file content.</param>
public sealed record ApiFileDownload(string FileName, string ContentType, byte[] Content);

/// <summary>
/// Notification list response wrapper.
/// </summary>
/// <param name="Notifications">Returned notifications.</param>
public sealed record NotificationListResponse(IReadOnlyList<UserNotification> Notifications);

/// <summary>
/// Notification response wrapper.
/// </summary>
/// <param name="Notification">Returned notification.</param>
public sealed record NotificationResponse(UserNotification Notification);

/// <summary>
/// In-app user notification.
/// </summary>
/// <param name="NotificationId">Notification identifier.</param>
/// <param name="Category">Notification category.</param>
/// <param name="Title">Short notification title.</param>
/// <param name="Body">Notification body text.</param>
/// <param name="ActionUrl">Optional route opened by the notification.</param>
/// <param name="IsRead">Whether the notification is read.</param>
/// <param name="CreatedAt">UTC creation timestamp.</param>
/// <param name="ReadAt">UTC read timestamp.</param>
public sealed record UserNotification(
    Guid NotificationId,
    string Category,
    string Title,
    string Body,
    string? ActionUrl,
    bool IsRead,
    DateTime CreatedAt,
    DateTime? ReadAt);

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
/// Request payload for creating an organization.
/// </summary>
/// <param name="Slug">Organization route key.</param>
/// <param name="DisplayName">Organization display name.</param>
/// <param name="Description">Optional public description.</param>
/// <param name="LogoUrl">Optional public logo URL.</param>
public sealed record CreateOrganizationRequest(
    string Slug,
    string DisplayName,
    string? Description,
    string? LogoUrl);

/// <summary>
/// Request payload for updating an organization.
/// </summary>
/// <param name="Slug">Organization route key.</param>
/// <param name="DisplayName">Organization display name.</param>
/// <param name="Description">Optional public description.</param>
/// <param name="LogoUrl">Optional public logo URL.</param>
public sealed record UpdateOrganizationRequest(
    string Slug,
    string DisplayName,
    string? Description,
    string? LogoUrl);

/// <summary>
/// Organization response wrapper.
/// </summary>
/// <param name="Organization">Organization details.</param>
public sealed record OrganizationResponse(OrganizationSummary Organization);

/// <summary>
/// Public organization details.
/// </summary>
/// <param name="Id">Organization identifier.</param>
/// <param name="Slug">Organization route key.</param>
/// <param name="DisplayName">Organization display name.</param>
/// <param name="Description">Optional public description.</param>
/// <param name="LogoUrl">Optional public logo URL.</param>
/// <param name="CreatedAt">UTC creation timestamp.</param>
/// <param name="UpdatedAt">UTC update timestamp.</param>
public sealed record OrganizationSummary(
    Guid Id,
    string Slug,
    string DisplayName,
    string? Description,
    string? LogoUrl,
    DateTime? CreatedAt,
    DateTime? UpdatedAt);

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

/// <summary>
/// Request payload for creating a title.
/// </summary>
public sealed record CreateDeveloperTitleRequest(
    string Slug,
    string ContentKind,
    string LifecycleStatus,
    string Visibility,
    UpsertTitleMetadataRequest Metadata);

/// <summary>
/// Request payload for updating stable title fields.
/// </summary>
public sealed record UpdateDeveloperTitleRequest(
    string Slug,
    string ContentKind,
    string LifecycleStatus,
    string Visibility);

/// <summary>
/// Request payload for creating or updating current metadata.
/// </summary>
public sealed record UpsertTitleMetadataRequest(
    string DisplayName,
    string ShortDescription,
    string Description,
    string GenreDisplay,
    int MinPlayers,
    int MaxPlayers,
    string AgeRatingAuthority,
    string AgeRatingValue,
    int MinAgeYears);

/// <summary>
/// Developer title response wrapper.
/// </summary>
public sealed record DeveloperTitleResponse(DeveloperTitle Title);

/// <summary>
/// Developer-visible title detail.
/// </summary>
public sealed record DeveloperTitle(
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
    Guid? CurrentReleaseId,
    DateTime? CreatedAt,
    DateTime? UpdatedAt);

/// <summary>
/// Metadata version list response wrapper.
/// </summary>
public sealed record TitleMetadataVersionListResponse(IReadOnlyList<TitleMetadataVersion> MetadataVersions);

/// <summary>
/// Developer-visible title metadata version.
/// </summary>
public sealed record TitleMetadataVersion(
    int RevisionNumber,
    bool IsCurrent,
    bool IsFrozen,
    string DisplayName,
    string ShortDescription,
    string Description,
    string GenreDisplay,
    int MinPlayers,
    int MaxPlayers,
    string PlayerCountDisplay,
    string AgeRatingAuthority,
    string AgeRatingValue,
    int MinAgeYears,
    string AgeDisplay,
    DateTime CreatedAt,
    DateTime UpdatedAt);

/// <summary>
/// Request payload for upserting title media.
/// </summary>
public sealed record UpsertTitleMediaAssetRequest(
    string SourceUrl,
    string? AltText,
    string? MimeType,
    int? Width,
    int? Height);

/// <summary>
/// Title media asset list response wrapper.
/// </summary>
public sealed record TitleMediaAssetListResponse(IReadOnlyList<TitleMediaAsset> MediaAssets);

/// <summary>
/// Title media asset response wrapper.
/// </summary>
public sealed record TitleMediaAssetResponse(TitleMediaAsset MediaAsset);

/// <summary>
/// Request payload for creating or updating releases.
/// </summary>
public sealed record UpsertTitleReleaseRequest(string Version, int MetadataRevisionNumber);

/// <summary>
/// Title release list response wrapper.
/// </summary>
public sealed record TitleReleaseListResponse(IReadOnlyList<TitleRelease> Releases);

/// <summary>
/// Title release response wrapper.
/// </summary>
public sealed record TitleReleaseResponse(TitleRelease Release);

/// <summary>
/// Developer-visible title release.
/// </summary>
public sealed record TitleRelease(
    Guid Id,
    string Version,
    string Status,
    int MetadataRevisionNumber,
    bool IsCurrent,
    DateTime? PublishedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

/// <summary>
/// Request payload for creating a release artifact.
/// </summary>
public sealed record UpsertReleaseArtifactRequest(
    string ArtifactKind,
    string PackageName,
    long VersionCode,
    string? Sha256,
    long? FileSizeBytes);

/// <summary>
/// Release artifact list response wrapper.
/// </summary>
public sealed record ReleaseArtifactListResponse(IReadOnlyList<ReleaseArtifact> Artifacts);

/// <summary>
/// Release artifact response wrapper.
/// </summary>
public sealed record ReleaseArtifactResponse(ReleaseArtifact Artifact);

/// <summary>
/// Developer-visible release artifact.
/// </summary>
public sealed record ReleaseArtifact(
    Guid Id,
    string ArtifactKind,
    string PackageName,
    long VersionCode,
    string? Sha256,
    long? FileSizeBytes,
    DateTime CreatedAt,
    DateTime UpdatedAt);

/// <summary>
/// Integration connection list response wrapper.
/// </summary>
public sealed record IntegrationConnectionListResponse(IReadOnlyList<IntegrationConnection> IntegrationConnections);

/// <summary>
/// Integration connection response wrapper.
/// </summary>
public sealed record IntegrationConnectionResponse(IntegrationConnection IntegrationConnection);

/// <summary>
/// Request payload for creating or updating integration connections.
/// </summary>
public sealed record UpsertIntegrationConnectionRequest(
    Guid? SupportedPublisherId,
    string? CustomPublisherDisplayName,
    string? CustomPublisherHomepageUrl,
    JsonElement? Configuration,
    bool IsEnabled);

/// <summary>
/// Developer-visible organization integration connection.
/// </summary>
public sealed record IntegrationConnection(
    Guid Id,
    Guid OrganizationId,
    Guid? SupportedPublisherId,
    SupportedPublisher? SupportedPublisher,
    string? CustomPublisherDisplayName,
    string? CustomPublisherHomepageUrl,
    JsonElement? Configuration,
    bool IsEnabled,
    DateTime CreatedAt,
    DateTime UpdatedAt);

/// <summary>
/// Supported publisher detail.
/// </summary>
public sealed record SupportedPublisher(
    Guid Id,
    string Key,
    string DisplayName,
    string HomepageUrl);

/// <summary>
/// Request payload for creating or updating title integration bindings.
/// </summary>
public sealed record UpsertTitleIntegrationBindingRequest(
    Guid IntegrationConnectionId,
    string AcquisitionUrl,
    string? AcquisitionLabel,
    JsonElement? Configuration,
    bool IsPrimary,
    bool IsEnabled);

/// <summary>
/// Title integration binding list response wrapper.
/// </summary>
public sealed record TitleIntegrationBindingListResponse(IReadOnlyList<TitleIntegrationBinding> IntegrationBindings);

/// <summary>
/// Title integration binding response wrapper.
/// </summary>
public sealed record TitleIntegrationBindingResponse(TitleIntegrationBinding IntegrationBinding);

/// <summary>
/// Title integration binding detail.
/// </summary>
public sealed record TitleIntegrationBinding(
    Guid Id,
    Guid TitleId,
    Guid IntegrationConnectionId,
    IntegrationConnection IntegrationConnection,
    string AcquisitionUrl,
    string? AcquisitionLabel,
    JsonElement? Configuration,
    bool IsPrimary,
    bool IsEnabled,
    DateTime CreatedAt,
    DateTime UpdatedAt);

/// <summary>
/// Problem details returned by the backend API.
/// </summary>
/// <param name="Type">Problem type URI.</param>
/// <param name="Title">Problem title.</param>
/// <param name="Status">HTTP status code.</param>
/// <param name="Detail">Detailed message.</param>
/// <param name="Code">Stable application error code.</param>
internal sealed record ApiProblemResponse(string? Type, string Title, int Status, string? Detail, string? Code);

/// <summary>
/// Exception thrown when the backend API returns a handled non-success response.
/// </summary>
internal sealed class BoardLibraryApiException : Exception
{
    public BoardLibraryApiException(HttpStatusCode statusCode, string message, string? detail, string? code)
        : base(string.IsNullOrWhiteSpace(detail) ? message : $"{message} {detail}")
    {
        StatusCode = statusCode;
        Detail = detail;
        Code = code;
    }

    public HttpStatusCode StatusCode { get; }

    public string? Detail { get; }

    public string? Code { get; }
}

/// <summary>
/// Token payload returned by Keycloak refresh-token exchange.
/// </summary>
/// <param name="AccessToken">Refreshed access token.</param>
/// <param name="RefreshToken">Refreshed refresh token when rotated.</param>
/// <param name="IdToken">Refreshed ID token when returned.</param>
/// <param name="TokenType">Token type.</param>
/// <param name="ExpiresIn">Access-token lifetime in seconds.</param>
internal sealed record KeycloakRefreshTokenResponse(
    [property: JsonPropertyName("access_token")] string AccessToken,
    [property: JsonPropertyName("refresh_token")] string? RefreshToken,
    [property: JsonPropertyName("id_token")] string? IdToken,
    [property: JsonPropertyName("token_type")] string? TokenType,
    [property: JsonPropertyName("expires_in")] int ExpiresIn);
