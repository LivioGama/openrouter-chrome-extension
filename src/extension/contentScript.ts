import { OpenRouterAPI } from "./modules/api";
import { DataProcessor } from "./modules/dataProcessor";
import { MessageHandler } from "./modules/messaging";
import { UIManager } from "./modules/ui";

// Official Chrome Extension approach: Use chrome.storage for debug mode
let DEV_MODE: boolean = false; // Default to production

// Initialize DEV_MODE from storage (official Chrome extension pattern)
chrome.storage.sync.get(['debugMode'], (result) => {
  DEV_MODE = Boolean(result.debugMode);
  console.log(`OpenRouter Analyzer: Debug mode ${DEV_MODE ? 'ENABLED' : 'DISABLED'} (from chrome.storage)`);
});

// Listen for debug mode changes (official Chrome extension pattern)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.debugMode) {
    DEV_MODE = Boolean(changes.debugMode.newValue);
    console.log(`OpenRouter Analyzer: Debug mode ${DEV_MODE ? 'ENABLED' : 'DISABLED'} (updated via chrome.storage)`);
  }
});

class OpenRouterAnalyzer {
  constructor() {
    console.log("OpenRouter Analyzer: Initializing...");
    this.init();
  }

  private isOnActivityPage(): boolean {
    const currentUrl = window.location.href;
    return (
      currentUrl.includes("/activity") && !currentUrl.includes("/settings")
    );
  }

  private buttonAdded = false;

  init(): void {
    // Check if we're on the correct page
    if (!this.isOnActivityPage()) {
      console.log(
        "OpenRouter Analyzer: Not on activity page, skipping initialization",
      );
      return;
    }

    console.log("OpenRouter Analyzer: Setting up timers...");
    setTimeout(() => {
      console.log("OpenRouter Analyzer: Initial button check...");
      this.addAnalyzeButton();

      // Check for cached results after button is added
      setTimeout(() => {
        console.log("OpenRouter Analyzer: About to check cached results...");
        this.checkAndDisplayCachedResults();
      }, 500);
    }, 2000);

    // Only check periodically if button hasn't been added yet
    const checkInterval = setInterval(() => {
      if (!this.buttonAdded) {
        this.addAnalyzeButton();
      } else {
        console.log(
          "OpenRouter Analyzer: Button already added, stopping interval checks",
        );
        clearInterval(checkInterval);
      }
    }, 5000);
  }

  findExportButton(): Element | undefined {
    const buttons = Array.from(document.querySelectorAll("button, a"));
    return buttons.find(
      (btn) =>
        btn.textContent?.toLowerCase().includes("export") ||
        btn.getAttribute("aria-label")?.toLowerCase().includes("export") ||
        btn.getAttribute("title")?.toLowerCase().includes("export"),
    );
  }

  addAnalyzeButton(): void {
    console.log("OpenRouter Analyzer: Looking for export button...");
    const exportBtn = this.findExportButton();
    if (!exportBtn) {
      console.log("OpenRouter Analyzer: Export button not found");
      return;
    }

    console.log(
      "OpenRouter Analyzer: Export button found, creating analyze button...",
    );
    try {
      const success = UIManager.createAnalyzeButton(
        exportBtn,
        (event, exportBtn) => this.analyzeCSV(event, exportBtn),
      );
      if (success) {
        this.buttonAdded = true;
        console.log("OpenRouter Analyzer: Analyze button created successfully");
      }
    } catch (error) {
      console.error(
        "OpenRouter Analyzer: Error creating analyze button:",
        error,
      );
    }
  }

  async checkAndDisplayCachedResults(): Promise<void> {
    // Only process cached data on activity page
    if (!this.isOnActivityPage()) {
      console.log(
        "OpenRouter Analyzer: Not on activity page, skipping cached data check",
      );
      return;
    }

    console.log("OpenRouter Analyzer: Checking for cached results...");

    try {
      // Try to get cached data without making an API call
      const cachedData = this.getCachedData();
      if (cachedData) {
        console.log(
          "OpenRouter Analyzer: Found cached data, processing and displaying...",
        );

        try {
          const result = DataProcessor.processOpenRouterResponse(cachedData);

          // Validate aggregated data
          if (!result.costs || Object.keys(result.costs).length === 0) {
            console.warn("OpenRouter Analyzer: No valid data in cache");
            return;
          }

          const totalCost = Object.values(result.costs).reduce(
            (sum, cost) => sum + cost,
            0,
          );

          if (typeof totalCost !== "number" || isNaN(totalCost)) {
            console.warn("OpenRouter Analyzer: Invalid total cost from cache");
            return;
          }

          MessageHandler.sendInfo("Displaying cached results (30min cache)");

          try {
            UIManager.displayResults(
              result.costs,
              totalCost,
              result.totalTokens,
              result.tokens,
            );
          } catch (displayError) {
            console.error(
              "OpenRouter Analyzer: Error displaying cached results:",
              displayError,
            );
          }

          // Update delete button state since we have cached data
          setTimeout(() => {
            try {
              const deleteBtn = document.querySelector(
                'button[title*="cache"]',
              ) as HTMLButtonElement;
              if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.style.opacity = "1";
                deleteBtn.title = "Clear cache only";
              }
            } catch (error) {
              console.warn(
                "OpenRouter Analyzer: Error updating delete button state:",
                error,
              );
            }
          }, 500);
        } catch (processingError) {
          console.error(
            "OpenRouter Analyzer: Error processing cached data:",
            processingError,
          );
          console.warn("OpenRouter Analyzer: Clearing corrupted cache");
          try {
            OpenRouterAPI.clearDevCache();
          } catch (clearError) {
            console.warn(
              "OpenRouter Analyzer: Error clearing cache:",
              clearError,
            );
          }
        }
      } else {
        console.log("OpenRouter Analyzer: No cached data found");
      }
    } catch (error) {
      console.error("OpenRouter Analyzer: Error checking cached data:", error);
    }
  }

  private getCachedData(): string | null {
    // Only use cache in development mode
    if (!DEV_MODE) {
      return null;
    }

    try {
      const expiry = localStorage.getItem("openrouter_dev_cache_expiry");
      const cached = localStorage.getItem("openrouter_dev_cache");

      console.log(
        "OpenRouter Analyzer: Cache check - expiry:",
        expiry,
        "now:",
        Date.now(),
        "cached length:",
        cached?.length,
      );

      if (!expiry || Date.now() > parseInt(expiry)) {
        console.log("OpenRouter Analyzer: Cache expired or not found");
        return null;
      }

      console.log("OpenRouter Analyzer: Cache valid, returning data");
      return cached;
    } catch (error) {
      console.log("OpenRouter Analyzer: Cache check error:", error);
      return null;
    }
  }

  async analyzeCSV(event: Event, exportBtn: Element): Promise<void> {
    event.preventDefault();

    console.log("Starting OpenRouter activity analysis...");
    MessageHandler.sendInfo("Fetching your OpenRouter activity data...");

    try {
      const { from, to } = OpenRouterAPI.extractPageParams();
      console.log("Current page params:", { from, to });

      const responseText = await OpenRouterAPI.fetchActivityData(from, to);
      console.log("API Response received, length:", responseText.length);

      // Validate response text
      if (
        !responseText ||
        typeof responseText !== "string" ||
        responseText.trim() === ""
      ) {
        throw new Error("Received empty or invalid response from API");
      }

      let result: {
        costs: Record<string, number>;
        tokens: Record<string, number>;
        totalTokens: number;
      };
      let totalCost: number;

      try {
        result = DataProcessor.processOpenRouterResponse(responseText);

        // Validate aggregated data
        if (!result.costs || Object.keys(result.costs).length === 0) {
          throw new Error("No valid cost data found in the response");
        }

        totalCost = Object.values(result.costs).reduce(
          (sum, cost) => sum + cost,
          0,
        );

        if (typeof totalCost !== "number" || isNaN(totalCost)) {
          throw new Error("Invalid total cost calculation");
        }

        console.log("Data processed successfully:", {
          totalCost,
          totalTokens: result.totalTokens,
          modelCount: Object.keys(result.costs).length,
        });
      } catch (processingError: any) {
        console.error("Data processing error:", processingError);
        throw new Error(
          `Failed to process activity data: ${processingError.message}`,
        );
      }

      try {
        MessageHandler.sendResult(result.costs);
        UIManager.displayResults(
          result.costs,
          totalCost,
          result.totalTokens,
          result.tokens,
        );
      } catch (displayError: any) {
        console.error("Display error:", displayError);
        throw new Error(`Failed to display results: ${displayError.message}`);
      }

      // Update delete button state since we have fresh data
      setTimeout(() => {
        try {
          const deleteBtn = document.querySelector(
            'button[title*="cache"]',
          ) as HTMLButtonElement;
          if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.style.opacity = "1";
            deleteBtn.title = "Clear cache only";
          }
        } catch (error) {
          console.warn(
            "OpenRouter Analyzer: Error updating delete button state:",
            error,
          );
        }
      }, 500);
    } catch (error: any) {
      console.error("Analysis error:", error);
      const errorMessage = error.message || "Unknown error occurred";
      MessageHandler.sendError(
        `Failed to analyze OpenRouter data: ${errorMessage}. Please try again or check the console for details.`,
      );
    }
  }
}

// Initialize analyzer when DOM is ready
console.log(
  "OpenRouter Analyzer: Content script loaded, document state:",
  document.readyState,
);

let globalAnalyzer: OpenRouterAnalyzer;

// Expose dev utilities to global scope for console access
if (typeof window !== "undefined") {
  (window as any).OpenRouterDev = {
    clearCache: () => OpenRouterAPI.clearDevCache(),
    checkCache: () => globalAnalyzer?.checkAndDisplayCachedResults(),
    enableDebug: () => {
      chrome.storage.sync.set({ debugMode: true }, () => {
        console.log("🛠️ DEV: Debug mode enabled via chrome.storage");
      });
    },
    disableDebug: () => {
      chrome.storage.sync.set({ debugMode: false }, () => {
        console.log("🛠️ DEV: Debug mode disabled via chrome.storage");
      });
    },
    info: () =>
      console.log(
        "🛠️ DEV Utils: Use OpenRouterDev.clearCache() to clear cache, OpenRouterDev.checkCache() to test cache display, OpenRouterDev.enableDebug()/disableDebug() to control debug mode",
      ),
  };
  console.log(
    "🛠️ DEV: Use OpenRouterDev.clearCache() to clear cache, OpenRouterDev.checkCache() to test cache display, OpenRouterDev.enableDebug()/disableDebug() to control debug mode",
  );
}

if (document.readyState === "loading") {
  console.log("OpenRouter Analyzer: Waiting for DOMContentLoaded...");
  document.addEventListener("DOMContentLoaded", () => {
    console.log(
      "OpenRouter Analyzer: DOMContentLoaded fired, creating analyzer...",
    );
    globalAnalyzer = new OpenRouterAnalyzer();
  });
} else {
  console.log(
    "OpenRouter Analyzer: DOM already ready, creating analyzer immediately...",
  );
  globalAnalyzer = new OpenRouterAnalyzer();
}
