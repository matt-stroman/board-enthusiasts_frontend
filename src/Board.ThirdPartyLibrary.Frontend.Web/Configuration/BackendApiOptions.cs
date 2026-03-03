namespace Board.ThirdPartyLibrary.Frontend.Web.Configuration;

/// <summary>
/// Configuration for the backend API consumed by the web UI.
/// </summary>
internal sealed class BackendApiOptions
{
    /// <summary>
    /// Gets the configuration section name.
    /// </summary>
    public const string SectionName = "BackendApi";

    /// <summary>
    /// Gets or sets the backend API base URL.
    /// </summary>
    public string BaseUrl { get; set; } = "https://localhost:7085";
}
