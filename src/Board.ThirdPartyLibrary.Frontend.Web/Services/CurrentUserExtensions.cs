namespace Board.ThirdPartyLibrary.Frontend.Web.Services;

/// <summary>
/// Helper methods for working with the current-user payload returned by the backend API.
/// </summary>
internal static class CurrentUserExtensions
{
    /// <summary>
    /// Determines whether the current user has the developer platform role.
    /// </summary>
    /// <param name="currentUser">Current user response to evaluate.</param>
    /// <returns><see langword="true" /> when the user has developer access; otherwise <see langword="false" />.</returns>
    public static bool IsDeveloper(this CurrentUserResponse? currentUser) =>
        currentUser.HasRole("developer");

    /// <summary>
    /// Determines whether the current user has moderator access.
    /// </summary>
    /// <param name="currentUser">Current user response to evaluate.</param>
    /// <returns><see langword="true" /> when the user can review moderation requests; otherwise <see langword="false" />.</returns>
    public static bool IsModerator(this CurrentUserResponse? currentUser) =>
        currentUser.HasRole("moderator");

    /// <summary>
    /// Determines whether the current user has the supplied platform role.
    /// </summary>
    /// <param name="currentUser">Current user response to evaluate.</param>
    /// <param name="role">Platform role code to match.</param>
    /// <returns><see langword="true" /> when the user has the role; otherwise <see langword="false" />.</returns>
    public static bool HasRole(this CurrentUserResponse? currentUser, string role) =>
        currentUser?.Roles.Any(candidate => string.Equals(candidate, role, StringComparison.OrdinalIgnoreCase)) == true;
}
