namespace Board.ThirdPartyLibrary.Frontend.Web.Tests;

/// <summary>
/// Regression coverage for the reconnect modal client script.
/// </summary>
public sealed class ReconnectModalScriptTests
{
    /// <summary>
    /// Verifies the reconnect script keeps the focus/visibility recovery hooks used to recover from stale circuits.
    /// </summary>
    [Fact]
    public void Script_ContainsExpectedRecoveryHooks()
    {
        var scriptPath = Path.Combine(
            ResolveRepositoryRoot().FullName,
            "frontend",
            "src",
            "Board.ThirdPartyLibrary.Frontend.Web",
            "Components",
            "Layout",
            "ReconnectModal.razor.js");

        var script = File.ReadAllText(scriptPath);

        Assert.Contains("visibilitychange", script, StringComparison.Ordinal);
        Assert.Contains("focus", script, StringComparison.Ordinal);
        Assert.Contains("pageshow", script, StringComparison.Ordinal);
        Assert.Contains("online", script, StringComparison.Ordinal);
        Assert.Contains("Blazor.reconnect", script, StringComparison.Ordinal);
        Assert.Contains("location.reload()", script, StringComparison.Ordinal);
    }

    private static DirectoryInfo ResolveRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "README.md")) &&
                Directory.Exists(Path.Combine(directory.FullName, "frontend")))
            {
                return directory;
            }

            directory = directory.Parent;
        }

        throw new InvalidOperationException("Could not resolve repository root for reconnect script test.");
    }
}
