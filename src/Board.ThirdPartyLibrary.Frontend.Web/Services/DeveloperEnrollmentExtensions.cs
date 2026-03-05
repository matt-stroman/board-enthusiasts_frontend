namespace Board.ThirdPartyLibrary.Frontend.Web.Services;

/// <summary>
/// Helper methods for developer access state.
/// </summary>
internal static class DeveloperEnrollmentExtensions
{
    /// <summary>
    /// Returns <see langword="true" /> when the enrollment grants developer access.
    /// </summary>
    public static bool HasDeveloperAccess(this DeveloperEnrollment? enrollment) =>
        enrollment?.DeveloperAccessEnabled == true;

    /// <summary>
    /// Returns <see langword="true" /> when the enrollment has not been completed yet.
    /// </summary>
    public static bool IsNotEnrolled(this DeveloperEnrollment? enrollment) =>
        string.IsNullOrWhiteSpace(enrollment?.Status) ||
        string.Equals(enrollment.Status, "not_enrolled", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Returns a player-facing status label for the enrollment.
    /// </summary>
    public static string ToStatusLabel(this DeveloperEnrollment? enrollment) =>
        enrollment switch
        {
            null => "Not enrolled",
            { DeveloperAccessEnabled: true, VerifiedDeveloper: true } => "Verified",
            { DeveloperAccessEnabled: true } => "Enrolled",
            _ => "Not enrolled"
        };

    /// <summary>
    /// Returns a concise player-facing description of the enrollment state.
    /// </summary>
    public static string ToStatusDescription(this DeveloperEnrollment? enrollment) =>
        enrollment switch
        {
            null => "Developer access can be enabled from account settings.",
            { DeveloperAccessEnabled: true, VerifiedDeveloper: true } => "Developer access is enabled and this account is marked as a verified developer.",
            { DeveloperAccessEnabled: true } => "Developer access is enabled for this account.",
            _ => "Developer access is not enabled yet."
        };
}
