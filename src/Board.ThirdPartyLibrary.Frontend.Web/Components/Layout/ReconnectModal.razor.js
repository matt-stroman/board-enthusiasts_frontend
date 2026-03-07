const reconnectModal = document.getElementById("components-reconnect-modal");
if (!reconnectModal) {
    throw new Error("Reconnect modal element was not found.");
}

reconnectModal.addEventListener("components-reconnect-state-changed", handleReconnectStateChanged);

const retryButton = document.getElementById("components-reconnect-button");
retryButton?.addEventListener("click", retry);

const resumeButton = document.getElementById("components-resume-button");
resumeButton?.addEventListener("click", resume);

const retryEventHandlers = [
    ["visibilitychange", retryWhenDocumentBecomesVisible],
    ["focus", retryWhenWindowFocused],
    ["pageshow", retryWhenWindowFocused],
    ["online", retryWhenWindowFocused]
];

let autoRetryTimeoutId = null;
let retryInFlight = false;
let retryListenersRegistered = false;

function handleReconnectStateChanged(event) {
    if (event.detail.state === "show") {
        reconnectModal.showModal();
        registerRetryListeners();
        scheduleRetry(750);
    } else if (event.detail.state === "hide") {
        unregisterRetryListeners();
        clearScheduledRetry();
        reconnectModal.close();
    } else if (event.detail.state === "failed") {
        registerRetryListeners();
        scheduleRetry(1250);
    } else if (event.detail.state === "rejected") {
        unregisterRetryListeners();
        clearScheduledRetry();
        location.reload();
    }
}

async function retry() {
    if (retryInFlight) {
        return;
    }

    clearScheduledRetry();

    if (document.visibilityState !== "visible" || document.hasFocus() === false || navigator.onLine === false) {
        scheduleRetry(1500);
        return;
    }

    retryInFlight = true;

    if (!window.Blazor || typeof window.Blazor.reconnect !== "function") {
        retryInFlight = false;
        location.reload();
        return;
    }

    try {
        // Reconnect will asynchronously return:
        // - true to mean success
        // - false to mean we reached the server, but the circuit is no longer available
        // - exception to mean we didn't reach the server (this can be sync or async)
        const successful = await Blazor.reconnect();
        if (!successful) {
            // Reached the server but this circuit cannot be resumed. Reload immediately.
            retryInFlight = false;
            location.reload();
            return;
        }

        retryInFlight = false;
        unregisterRetryListeners();
        reconnectModal.close();
    } catch (err) {
        // We got an exception, server is currently unavailable
        retryInFlight = false;
        registerRetryListeners();
        scheduleRetry(2000);
    }
}

async function resume() {
    await retry();
}

async function retryWhenDocumentBecomesVisible() {
    if (document.visibilityState === "visible") {
        scheduleRetry(250);
    }
}

function retryWhenWindowFocused() {
    scheduleRetry(250);
}

function registerRetryListeners() {
    if (retryListenersRegistered) {
        return;
    }

    for (const [eventName, handler] of retryEventHandlers) {
        window.addEventListener(eventName, handler);
        if (eventName === "visibilitychange") {
            document.addEventListener(eventName, handler);
        }
    }

    retryListenersRegistered = true;
}

function unregisterRetryListeners() {
    if (!retryListenersRegistered) {
        return;
    }

    for (const [eventName, handler] of retryEventHandlers) {
        window.removeEventListener(eventName, handler);
        if (eventName === "visibilitychange") {
            document.removeEventListener(eventName, handler);
        }
    }

    retryListenersRegistered = false;
}

function scheduleRetry(delayMilliseconds) {
    clearScheduledRetry();
    autoRetryTimeoutId = window.setTimeout(() => {
        autoRetryTimeoutId = null;
        retry();
    }, delayMilliseconds);
}

function clearScheduledRetry() {
    if (autoRetryTimeoutId !== null) {
        window.clearTimeout(autoRetryTimeoutId);
        autoRetryTimeoutId = null;
    }
}
