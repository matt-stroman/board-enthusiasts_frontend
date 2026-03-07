namespace Board.ThirdPartyLibrary.Frontend.Web.Configuration;

/// <summary>
/// Configuration for the frontend's Keycloak OpenID Connect session integration.
/// </summary>
internal sealed class KeycloakOptions
{
    /// <summary>
    /// Gets the configuration section name.
    /// </summary>
    public const string SectionName = "Authentication:Keycloak";

    /// <summary>
    /// Gets or sets the Keycloak server base URL.
    /// </summary>
    public string BaseUrl { get; set; } = "https://localhost:8443";

    /// <summary>
    /// Gets or sets the Keycloak realm name.
    /// </summary>
    public string Realm { get; set; } = "board-enthusiasts";

    /// <summary>
    /// Gets or sets the OpenID Connect client identifier.
    /// </summary>
    public string ClientId { get; set; } = "board-enthusiasts-web";

    /// <summary>
    /// Gets or sets the confidential client secret when required.
    /// </summary>
    public string? ClientSecret { get; set; } = "board-enthusiasts-web-secret";

    /// <summary>
    /// Gets or sets a value indicating whether discovery metadata must use HTTPS.
    /// </summary>
    public bool RequireHttpsMetadata { get; set; } = true;

    /// <summary>
    /// Gets or sets the requested OpenID Connect scopes.
    /// </summary>
    public string[] Scopes { get; set; } = ["openid", "profile", "email"];
}
