namespace Board.ThirdPartyLibrary.Frontend.Web.Services;

/// <summary>
/// Helper methods for developer-enrollment state.
/// </summary>
internal static class DeveloperEnrollmentExtensions
{
    /// <summary>
    /// Returns <see langword="true" /> when the enrollment grants developer access.
    /// </summary>
    public static bool HasDeveloperAccess(this DeveloperEnrollment? enrollment) =>
        enrollment?.DeveloperAccessEnabled == true;

    /// <summary>
    /// Returns <see langword="true" /> when the enrollment is pending review.
    /// </summary>
    public static bool IsPending(this DeveloperEnrollment? enrollment) =>
        string.Equals(enrollment?.Status, "pending", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Returns <see langword="true" /> when the enrollment has been rejected.
    /// </summary>
    public static bool IsRejected(this DeveloperEnrollment? enrollment) =>
        string.Equals(enrollment?.Status, "rejected", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Returns <see langword="true" /> when the enrollment has not been requested yet.
    /// </summary>
    public static bool IsNotRequested(this DeveloperEnrollment? enrollment) =>
        string.IsNullOrWhiteSpace(enrollment?.Status) ||
        string.Equals(enrollment.Status, "not_requested", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Returns a player-facing status label for the enrollment.
    /// </summary>
    public static string ToStatusLabel(this DeveloperEnrollment? enrollment) =>
        enrollment switch
        {
            null => "Not requested",
            { DeveloperAccessEnabled: true } => "Enabled",
            _ when enrollment.IsPending() => "Pending review",
            _ when enrollment.IsRejected() => "Rejected",
            _ => "Not requested"
        };

    /// <summary>
    /// Returns a concise player-facing description of the enrollment state.
    /// </summary>
    public static string ToStatusDescription(this DeveloperEnrollment? enrollment) =>
        enrollment switch
        {
            null => "Developer registration is available from the Develop area.",
            { DeveloperAccessEnabled: true } => "Developer console access is active for this account.",
            _ when enrollment.IsPending() => "Your request is waiting for moderator review.",
            _ when enrollment.IsRejected() => "Your request was rejected and cannot be resubmitted yet.",
            _ => "Developer registration is available from the Develop area."
        };
}
