import { OpenRouterAPI } from "./api";

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

export class UIManager {
  static createAnalyzeButton(
    exportBtn: Element,
    onClick: (event: Event, exportBtn: Element) => void,
  ): boolean {
    // Check if our button container already exists using unique ID
    if (document.getElementById("openrouter-analyze-buttons")) {
      console.log(
        "OpenRouter Analyzer: Analyze buttons already exist, skipping...",
      );
      return true;
    }

    // Create container for both buttons
    const buttonContainer = document.createElement("div");
    buttonContainer.id = "openrouter-analyze-buttons";
    buttonContainer.className = "flex gap-2";

    // Create analyze button
    const analyzeBtn = document.createElement("button");
    analyzeBtn.className = exportBtn.className;
    analyzeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4 mr-1">
        <line x1="12" y1="20" x2="12" y2="10"/>
        <line x1="18" y1="20" x2="18" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="16"/>
      </svg>
      <span class="button-text">Group by Model</span>
    `;

    const onClickWithLoading = async (event: Event, exportBtn: Element) => {
      const buttonText = analyzeBtn.querySelector(
        ".button-text",
      ) as HTMLElement;
      const originalText = buttonText.textContent;

      // Show loading state
      analyzeBtn.disabled = true;
      buttonText.innerHTML = `
        <div class="flex items-center gap-1">
          <div class="flex gap-0.5">
            <div class="w-1 h-1 bg-current rounded-full animate-bounce" style="animation-delay: 0ms"></div>
            <div class="w-1 h-1 bg-current rounded-full animate-bounce" style="animation-delay: 150ms"></div>
            <div class="w-1 h-1 bg-current rounded-full animate-bounce" style="animation-delay: 300ms"></div>
          </div>
          <span class="ml-1">Loading...</span>
        </div>
      `;

      try {
        await onClick(event, exportBtn);
      } finally {
        // Restore original state
        analyzeBtn.disabled = false;
        buttonText.innerHTML = originalText!;
      }
    };

    analyzeBtn.addEventListener("click", (event) =>
      onClickWithLoading(event, exportBtn),
    );

    buttonContainer.appendChild(analyzeBtn);

    // Add refresh and delete buttons in DEV mode
    if (this.isDevMode()) {
      // Refresh button - clears cache and fetches fresh data
      const refreshBtn = document.createElement("button");
      refreshBtn.className = exportBtn.className
        .replace(/bg-\w+-\d+/, "bg-blue-500")
        .replace(/hover:bg-\w+-\d+/, "hover:bg-blue-600");
      refreshBtn.title = "Refresh data (clears cache and fetches fresh)";
      refreshBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
          <path d="M21 3v5h-5"/>
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
          <path d="M3 21v-5h5"/>
        </svg>
      `;

      const onRefreshWithLoading = async (
        event: Event,
        exportBtn: Element,
        onClick: (event: Event, exportBtn: Element) => void,
      ) => {
        const originalHTML = refreshBtn.innerHTML;

        // Show loading state for refresh button
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = `
        <div class="flex items-center gap-0.5">
          <div class="w-1 h-1 bg-current rounded-full animate-bounce" style="animation-delay: 0ms"></div>
          <div class="w-1 h-1 bg-current rounded-full animate-bounce" style="animation-delay: 150ms"></div>
          <div class="w-1 h-1 bg-current rounded-full animate-bounce" style="animation-delay: 300ms"></div>
        </div>
      `;

        try {
          await this.handleForceRefresh(event, exportBtn, onClick);
          // After successful refresh, update delete button state
          setTimeout(() => {
            try {
              const deleteBtn = buttonContainer.querySelector(
                'button[title*="cache"]',
              ) as HTMLButtonElement;
              if (deleteBtn && DEV_MODE) {
                const expiry = localStorage.getItem(
                  "openrouter_dev_cache_expiry",
                );
                const cached = localStorage.getItem("openrouter_dev_cache");
                const hasCache =
                  expiry && cached && Date.now() < parseInt(expiry);
                deleteBtn.disabled = !hasCache;
                deleteBtn.style.opacity = hasCache ? "1" : "0.5";
              }
            } catch (error) {
              console.warn(
                "DEV: Error updating delete button state after refresh:",
                error,
              );
            }
          }, 100);
        } finally {
          // Restore original state
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = originalHTML;
        }
      };

      refreshBtn.addEventListener("click", (event) =>
        onRefreshWithLoading(event, exportBtn, onClick),
      );
      buttonContainer.appendChild(refreshBtn);

      // Delete button - only clears cache
      const deleteBtn = document.createElement("button");
      deleteBtn.className = exportBtn.className
        .replace(/bg-\w+-\d+/, "bg-red-500")
        .replace(/hover:bg-\w+-\d+/, "hover:bg-red-600");
      deleteBtn.title = "Clear cache only";
      deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4">
          <path d="M3 6h18"/>
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
      `;

      // Check if there's cached data and update button state
      const updateDeleteButtonState = () => {
        if (!DEV_MODE) {
          // In production, disable cache-related UI elements
          if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.style.opacity = "0.5";
            deleteBtn.title = "Cache disabled in production";
          }
          return;
        }

        try {
          const expiry = localStorage.getItem("openrouter_dev_cache_expiry");
          const cached = localStorage.getItem("openrouter_dev_cache");

          const hasCache = expiry && cached && Date.now() < parseInt(expiry);

          if (deleteBtn) {
            deleteBtn.disabled = !hasCache;
            deleteBtn.style.opacity = hasCache ? "1" : "0.5";
            deleteBtn.title = hasCache
              ? "Clear cache only"
              : "No cache to clear";
          }
        } catch (error) {
          console.warn("DEV: Error updating delete button state:", error);
        }
      };

      // Initial state check
      updateDeleteButtonState();

      deleteBtn.addEventListener("click", (event) => {
        event.preventDefault();
        if (!DEV_MODE) {
          console.log("Cache operations disabled in production");
          return;
        }

        try {
          OpenRouterAPI.clearDevCache();
          console.log("🗑️ DEV: Cache cleared (no API call)");
          updateDeleteButtonState(); // Update state after clearing
        } catch (error) {
          console.warn("DEV: Error clearing cache:", error);
        }
      });

      buttonContainer.appendChild(deleteBtn);
    }

    exportBtn.parentNode?.insertBefore(buttonContainer, exportBtn.nextSibling);
    return true; // Successfully created button
  }

  static displayResults(
    aggregated: Record<string, number>,
    totalCost: number,
    totalTokens: number = 0,
    tokensPerModel?: Record<string, number>,
  ): void {
    console.log(
      "🧪 DEBUG: displayResults called with",
      Object.keys(aggregated || {}),
      totalCost,
      totalTokens,
    );

    // Validate input data
    if (!aggregated || Object.keys(aggregated).length === 0) {
      console.warn("No aggregated data to display");
      return;
    }

    if (typeof totalCost !== "number" || isNaN(totalCost)) {
      console.warn("Invalid total cost:", totalCost);
      return;
    }

    const existingResults = document.getElementById("openrouter-cost-analysis");
    if (existingResults) {
      existingResults.remove();
    }

    // Try multiple selectors to find a suitable container (prioritize OpenRouter-specific selectors)
    let tableContainer = document.querySelector(
      ".text-accent-foreground.rounded-lg.border",
    );

    // OpenRouter-specific selectors for activity page
    if (!tableContainer) {
      tableContainer = document.querySelector(
        "[class*='activity'] [class*='table']",
      )?.parentElement;
    }
    if (!tableContainer) {
      tableContainer = document.querySelector(
        "[class*='activity'] table",
      )?.parentElement;
    }
    if (!tableContainer) {
      tableContainer = document.querySelector("main table")?.parentElement;
    }
    if (!tableContainer) {
      tableContainer =
        document.querySelector(".container table")?.parentElement;
    }
    if (!tableContainer) {
      tableContainer = document.querySelector(
        "[role='main'] table",
      )?.parentElement;
    }

    // Generic table selectors
    if (!tableContainer) {
      tableContainer = document.querySelector("table")?.parentElement;
    }
    if (!tableContainer) {
      tableContainer = document.querySelector(".activity-table")?.parentElement;
    }
    if (!tableContainer) {
      tableContainer = document.querySelector(
        "[data-testid='activity-table']",
      )?.parentElement;
    }

    // Content-based detection
    if (!tableContainer) {
      const containers = document.querySelectorAll("div, section, main");
      for (const container of containers) {
        const textContent = container.textContent || "";
        const hasTable = container.querySelector("table");
        const hasActivityKeywords =
          /model|cost|usage|activity|generation/i.test(textContent);

        if (hasTable && hasActivityKeywords) {
          tableContainer = container;
          console.log("Found container by content analysis:", container);
          break;
        }
      }
    }

    // Last resort: any container with a table
    if (!tableContainer) {
      const tableElement = document.querySelector("table");
      if (tableElement) {
        tableContainer =
          tableElement.closest("div, section, main") ||
          tableElement.parentElement;
      }
    }

    if (!tableContainer) {
      console.warn("Could not find any suitable container to insert results");
      console.warn("Page URL:", window.location.href);
      console.warn(
        "Available tables:",
        document.querySelectorAll("table").length,
      );
      console.warn(
        "Available containers with tables:",
        Array.from(document.querySelectorAll("table")).map(
          (t) =>
            t.closest("div, section, main")?.className || "no-parent-class",
        ),
      );
      return;
    }

    console.log(
      "Using container for results:",
      tableContainer.className || tableContainer.tagName,
    );

    console.log("🧪 DEBUG: Table container found", tableContainer);

    const sortedModels = Object.entries(aggregated)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const resultsContainer = document.createElement("div");
    resultsContainer.id = "openrouter-cost-analysis";
    resultsContainer.className =
      "mb-6 rounded-lg border bg-card text-card-foreground shadow-sm";

    resultsContainer.innerHTML = UIManager.generateResultsHTML(
      sortedModels,
      totalCost,
      formatter,
      aggregated,
      totalTokens,
      tokensPerModel,
    );

    tableContainer.parentNode?.insertBefore(resultsContainer, tableContainer);

    UIManager.attachShowMoreHandlers(
      resultsContainer,
      sortedModels,
      aggregated,
      totalCost,
      formatter,
      tokensPerModel,
    );
    UIManager.animateIn(resultsContainer);
  }

  private static generateResultsHTML(
    sortedModels: [string, number][],
    totalCost: number,
    formatter: Intl.NumberFormat,
    aggregated: Record<string, number>,
    totalTokens: number = 0,
    tokensPerModel?: Record<string, number>,
  ): string {
    const top3Models = sortedModels.slice(0, 3);
    const othersModels = sortedModels.slice(3);
    const othersTotal = othersModels.reduce((sum, [, cost]) => sum + cost, 0);

    // Calculate token-based groupings (20% threshold)
    const tokenEntries = tokensPerModel ? Object.entries(tokensPerModel) : [];
    const tokenModels = tokenEntries
      .map(([model, tokens]) => ({
        model,
        tokens,
        percentage: totalTokens > 0 ? (tokens / totalTokens) * 100 : 0,
      }))
      .sort((a, b) => b.tokens - a.tokens);

    const significantTokenModels = tokenModels.filter(
      (m) => m.percentage >= 20,
    );
    const minorTokenModels = tokenModels.filter((m) => m.percentage < 20);
    const minorTokensTotal = minorTokenModels.reduce(
      (sum, m) => sum + m.tokens,
      0,
    );

    return `
      <div class="p-6">
        <div class="flex items-center gap-2 mb-6">
          <h3 class="text-lg font-semibold">Model Cost Aggregator</h3>
        </div>

        <!-- Overview Section -->
        <div class="mb-6">
          <h4 class="text-md font-semibold mb-4">Overview</h4>
          <div class="bg-muted/30 rounded-lg p-4">
            <div class="flex rounded-md overflow-hidden border border-muted" style="height: 80px;">
              ${[
                ...top3Models.map(([model, cost], index) => {
                  const modelTokens = tokensPerModel?.[model] || 0;
                  return {
                    model,
                    cost,
                    tokens: modelTokens,
                    gradient:
                      index === 0
                        ? "linear-gradient(90deg, #f87171 0%, #fb923c 100%)"
                        : index === 1
                          ? "linear-gradient(90deg, #4ade80 0%, #2dd4bf 100%)"
                          : "linear-gradient(90deg, #60a5fa 0%, #6366f1 100%)",
                  };
                }),
                ...(othersTotal > 0
                  ? [
                      {
                        model: "Others",
                        cost: othersTotal,
                        tokens: othersModels.reduce(
                          (sum, [model]) =>
                            sum + (tokensPerModel?.[model] || 0),
                          0,
                        ),
                        gradient:
                          "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)",
                      },
                    ]
                  : []),
              ]
                .map(({ model, cost, tokens, gradient }) => {
                  const percentage = (cost / totalCost) * 100;
                  const displayPercentage = Math.max(percentage, 3); // Ensure visibility
                  return `
                  <div class="text-white flex flex-col justify-center items-center p-2 relative overflow-hidden" style="width: ${percentage}%; min-width: ${displayPercentage || 3}px; background: ${gradient || "#gray"};">
                    <div class="text-xs font-medium mb-1 text-center leading-tight" style="word-break: break-word; hyphens: auto;">${model || "Model"}</div>
                    <div class="text-sm font-bold text-center whitespace-nowrap">${formatter.format(cost || 0)}</div>
                    <div class="text-xs opacity-90 text-center">${tokens.toLocaleString()} tokens</div>
                    <div class="absolute bottom-1 right-1 text-xs opacity-75">${(percentage || 0).toFixed(1)}%</div>
                  </div>
                `;
                })
                .join("")}
            </div>
          </div>

          <!-- Token Usage Graph -->
          <div class="mt-6">
            <h5 class="text-sm font-semibold mb-3">Token Usage Distribution</h5>
            <div class="bg-muted/30 rounded-lg p-4">
              <div class="flex rounded-md overflow-hidden border border-muted" style="height: 80px;">
                ${[
                  ...significantTokenModels.map((modelData, index) => ({
                    model: modelData.model,
                    tokens: modelData.tokens,
                    percentage: modelData.percentage,
                    gradient:
                      index === 0
                        ? "linear-gradient(90deg, #f87171 0%, #fb923c 100%)"
                        : index === 1
                          ? "linear-gradient(90deg, #4ade80 0%, #2dd4bf 100%)"
                          : index === 2
                            ? "linear-gradient(90deg, #60a5fa 0%, #6366f1 100%)"
                            : "linear-gradient(90deg, #a78bfa 0%, #c084fc 100%)",
                  })),
                  ...(minorTokensTotal > 0
                    ? [
                        {
                          model: "Others",
                          tokens: minorTokensTotal,
                          percentage:
                            totalTokens > 0
                              ? (minorTokensTotal / totalTokens) * 100
                              : 0,
                          gradient:
                            "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)",
                        },
                      ]
                    : []),
                ]
                  .map(({ model, tokens, percentage, gradient }) => {
                    const displayPercentage = Math.max(percentage, 3); // Ensure visibility
                    return `
                    <div class="text-white flex flex-col justify-center items-center p-2 relative overflow-hidden" style="width: ${percentage}%; min-width: ${displayPercentage || 3}px; background: ${gradient || "#gray"};">
                      <div class="text-xs font-medium mb-1 text-center leading-tight" style="word-break: break-word; hyphens: auto;">${model || "Model"}</div>
                      <div class="text-sm font-bold text-center whitespace-nowrap">${tokens.toLocaleString()}</div>
                      <div class="text-xs opacity-90 text-center">tokens</div>
                      <div class="absolute bottom-1 right-1 text-xs opacity-75">${percentage.toFixed(1)}%</div>
                    </div>
                  `;
                  })
                  .join("")}
              </div>
            </div>
          </div>
        </div>

        <!-- Total Cost Below Overview -->
        <div class="mb-6 flex justify-center">
          <div class="bg-primary/10 border border-primary/20 rounded-lg px-6 py-3">
            <div class="text-center">
              <div class="text-sm text-muted-foreground mb-1">Total Cost</div>
              <div class="text-2xl font-bold text-primary">${formatter.format(totalCost)}</div>
            </div>
          </div>
        </div>

        <!-- Total Tokens Below Cost -->
        <div class="mb-6 flex justify-center">
          <div class="bg-secondary/10 border border-secondary/20 rounded-lg px-6 py-3">
            <div class="text-center">
              <div class="text-sm text-muted-foreground mb-1">Total Tokens</div>
              <div class="text-2xl font-bold text-secondary">${totalTokens.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <!-- Separator -->
        <hr class="my-6 border-gray-200 dark:border-gray-700">

        <!-- Detail Section -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-md font-semibold">Detail</h4>
            <div class="flex gap-2">
              <button id="sort-cost-btn" class="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md transition-colors active-sort">
                Sort by Cost
              </button>
              <button id="sort-tokens-btn" class="px-3 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 rounded-md transition-colors">
                Sort by Tokens
              </button>
            </div>
          </div>
          <div id="models-container" class="grid gap-3">
            ${UIManager.generateModelRows(sortedModels.slice(0, 5), totalCost, formatter, 0, tokensPerModel)}

            ${
              sortedModels.length > 5
                ? `
              <div id="additional-models" class="space-y-4" style="display: none;">
                ${UIManager.generateModelRows(sortedModels.slice(5), totalCost, formatter, 5, tokensPerModel)}
              </div>

              <div class="mt-3 text-center">
                <button id="show-more-btn" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded-md transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
                    <path fill-rule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clip-rule="evenodd" />
                  </svg>
                  Show ${sortedModels.length - 5} more models
                </button>
              </div>

              <div id="showing-message" class="mt-3 text-center" style="display: none;">
                <span class="text-xs text-muted-foreground">
                  Showing top ${sortedModels.length} of ${Object.keys(aggregated).length} models
                </span>
              </div>
            `
                : ""
            }

            ${
              sortedModels.length === Object.keys(aggregated).length
                ? `
              <div class="mt-3 text-center">
                <span class="text-xs text-muted-foreground">
                  Showing all ${sortedModels.length} models
                </span>
              </div>
            `
                : ""
            }
          </div>
        </div>
      </div>
    `;
  }

  private static generateModelRows(
    models: [string, number][],
    totalCost: number,
    formatter: Intl.NumberFormat,
    startIndex: number,
    tokensPerModel?: Record<string, number>,
  ): string {
    return models
      .map(([model, cost], index) => {
        const percentage = (cost / totalCost) * 100;
        const actualIndex = index + startIndex;
        const modelTokens = tokensPerModel?.[model] || 0;
        return `
        <div class="flex items-center justify-between p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
          <div class="flex items-center gap-3">
            <span class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
              ${actualIndex + 1}
            </span>
            <span class="font-medium text-sm">${model}</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-right">
              <div class="text-sm font-medium">${formatter.format(cost)}</div>
              <div class="text-xs text-muted-foreground">${modelTokens.toLocaleString()} tokens</div>
              <div class="text-xs text-muted-foreground">${percentage.toFixed(1)}%</div>
            </div>
            <div class="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div class="h-full transition-all duration-500"
                   style="width: ${Math.max(percentage, 2)}%; background: linear-gradient(to right, #3b82f6, #8b5cf6);"></div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  private static attachShowMoreHandlers(
    resultsContainer: Element,
    sortedModels: [string, number][],
    aggregated: Record<string, number>,
    totalCost: number,
    formatter: Intl.NumberFormat,
    tokensPerModel?: Record<string, number>,
  ): void {
    const showMoreBtn = resultsContainer.querySelector("#show-more-btn");
    const additionalModels = resultsContainer.querySelector(
      "#additional-models",
    ) as HTMLElement;
    const showingMessage = resultsContainer.querySelector(
      "#showing-message",
    ) as HTMLElement;
    const modelsContainer = resultsContainer.querySelector(
      "#models-container",
    ) as HTMLElement;
    const sortCostBtn = resultsContainer.querySelector(
      "#sort-cost-btn",
    ) as HTMLElement;
    const sortTokensBtn = resultsContainer.querySelector(
      "#sort-tokens-btn",
    ) as HTMLElement;

    // Sorting functionality
    const updateSorting = (sortBy: "cost" | "tokens") => {
      // Update button states
      if (sortCostBtn && sortTokensBtn) {
        sortCostBtn.className =
          sortBy === "cost"
            ? "px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md transition-colors active-sort"
            : "px-3 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 rounded-md transition-colors";
        sortTokensBtn.className =
          sortBy === "tokens"
            ? "px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md transition-colors active-sort"
            : "px-3 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 rounded-md transition-colors";
      }

      // Sort models
      let sorted: [string, number][];
      if (sortBy === "tokens" && tokensPerModel) {
        // Sort by tokens but maintain cost data structure for display
        sorted = Object.keys(tokensPerModel)
          .sort((a, b) => (tokensPerModel[b] || 0) - (tokensPerModel[a] || 0))
          .slice(0, 10)
          .map((model) => [model, aggregated[model] || 0]);
      } else {
        sorted = Object.entries(aggregated)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10);
      }

      // Update models container
      if (modelsContainer) {
        const isExpanded =
          additionalModels && additionalModels.style.display !== "none";
        const showCount = isExpanded ? sorted.length : 5;

        modelsContainer.innerHTML = `
          ${UIManager.generateModelRows(sorted.slice(0, 5), totalCost, formatter, 0, tokensPerModel)}

          ${
            sorted.length > 5
              ? `
            <div id="additional-models" class="space-y-4" style="display: ${isExpanded ? "block" : "none"};">
              ${UIManager.generateModelRows(sorted.slice(5), totalCost, formatter, 5, tokensPerModel)}
            </div>

            <div class="mt-3 text-center">
              <button id="show-more-btn" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded-md transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
                  <path fill-rule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clip-rule="evenodd" />
                </svg>
                Show ${sorted.length - 5} more models
              </button>
            </div>

            <div id="showing-message" class="mt-3 text-center" style="display: ${isExpanded ? "block" : "none"};">
              <span class="text-xs text-muted-foreground">
                Showing top ${showCount} of ${sorted.length} models
              </span>
            </div>
          `
              : ""
          }

          ${
            sorted.length === Object.keys(aggregated).length
              ? `
            <div class="mt-3 text-center">
              <span class="text-xs text-muted-foreground">
                Showing all ${sorted.length} models
              </span>
            </div>
          `
              : ""
          }
        `;

        // Re-attach show more handler to the new button
        const newShowMoreBtn = modelsContainer.querySelector("#show-more-btn");
        const newAdditionalModels = modelsContainer.querySelector(
          "#additional-models",
        ) as HTMLElement;
        const newShowingMessage = modelsContainer.querySelector(
          "#showing-message",
        ) as HTMLElement;

        if (newShowMoreBtn && newAdditionalModels) {
          newShowMoreBtn.addEventListener("click", () => {
            const isHidden = newAdditionalModels.style.display === "none";

            if (isHidden) {
              newAdditionalModels.style.display = "block";
              if (newShowingMessage) {
                newShowingMessage.style.display = "block";
              }
              newShowMoreBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
                  <path fill-rule="evenodd" d="M11.47 7.72a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06L12 9.31l-6.97 6.97a.75.75 0 0 1-1.06-1.06l7.5-7.5Z" clip-rule="evenodd" />
                </svg>
                Show less
              `;
            } else {
              newAdditionalModels.style.display = "none";
              if (newShowingMessage) {
                newShowingMessage.style.display = "none";
              }
              newShowMoreBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
                  <path fill-rule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clip-rule="evenodd" />
                </svg>
                Show ${sorted.length - 5} more models
              `;
            }
          });
        }
      }
    };

    // Add sort button event listeners
    if (sortCostBtn) {
      sortCostBtn.addEventListener("click", () => updateSorting("cost"));
    }
    if (sortTokensBtn) {
      sortTokensBtn.addEventListener("click", () => updateSorting("tokens"));
    }

    // Original show more functionality
    if (showMoreBtn && additionalModels) {
      showMoreBtn.addEventListener("click", () => {
        const isHidden = additionalModels.style.display === "none";

        if (isHidden) {
          additionalModels.style.display = "block";
          if (showingMessage) {
            showingMessage.style.display = "block";
          }
          showMoreBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M11.47 7.72a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06L12 9.31l-6.97 6.97a.75.75 0 0 1-1.06-1.06l7.5-7.5Z" clip-rule="evenodd" />
            </svg>
            Show less
          `;
        } else {
          additionalModels.style.display = "none";
          if (showingMessage) {
            showingMessage.style.display = "none";
          }
          showMoreBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clip-rule="evenodd" />
            </svg>
            Show ${sortedModels.length - 5} more models
          `;
        }
      });
    }
  }

  private static animateIn(element: HTMLElement): void {
    setTimeout(() => {
      element.style.opacity = "0";
      element.style.transform = "translateY(-10px)";
      element.style.transition = "opacity 0.3s ease, transform 0.3s ease";

      requestAnimationFrame(() => {
        element.style.opacity = "1";
        element.style.transform = "translateY(0)";
      });
    }, 10);
  }

  private static isDevMode(): boolean {
    // Return the DEV_MODE from chrome.storage
    return DEV_MODE;
  }

  private static async handleForceRefresh(
    event: Event,
    exportBtn: Element,
    onClick: (event: Event, exportBtn: Element) => void,
  ): Promise<void> {
    event.preventDefault();

    // Clear cache directly using API method
    OpenRouterAPI.clearDevCache();
    console.log("🗑️ DEV: Cache cleared, forcing fresh fetch...");

    // Then trigger the normal analyze flow
    onClick(event, exportBtn);
  }
}
