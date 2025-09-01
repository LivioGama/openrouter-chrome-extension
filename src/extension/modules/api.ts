export class OpenRouterAPI {
  private static readonly DEV_MODE = true; // Set to false for production
  private static readonly CACHE_KEY = "openrouter_dev_cache";
  private static readonly CACHE_EXPIRY_KEY = "openrouter_dev_cache_expiry";
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private static extractNextAction(): string {
    // Try to find next-action in various places
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const content = script.textContent || "";
      const match = content.match(/"next-action":"([^"]+)"/);
      if (match) {
        return match[1];
      }
    }

    // Fallback: look for forms with next-action
    const forms = document.querySelectorAll("form");
    for (const form of forms) {
      const action = form.getAttribute("action");
      if (action && action.includes("next-action=")) {
        const match = action.match(/next-action=([^&]+)/);
        if (match) {
          return decodeURIComponent(match[1]);
        }
      }
    }

    // Last resort: hardcoded fallback
    console.warn("Could not extract next-action dynamically, using fallback");
    return "40897bba7b109734a58d1a02ae0dcecd6a3609e2cb";
  }

  private static extractRouterStateTree(): string {
    // Try to find next-router-state-tree in script tags
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const content = script.textContent || "";
      const match = content.match(/"next-router-state-tree":"([^"]+)"/);
      if (match) {
        return match[1];
      }
    }

    // Look for it in __NEXT_DATA__ script
    const nextDataScript = document.querySelector("#__NEXT_DATA__");
    if (nextDataScript) {
      try {
        const data = JSON.parse(nextDataScript.textContent || "{}");
        if (data.routerState) {
          return encodeURIComponent(JSON.stringify(data.routerState));
        }
      } catch (e) {
        console.warn("Failed to parse __NEXT_DATA__:", e);
      }
    }

    // Fallback: hardcoded value
    console.warn(
      "Could not extract next-router-state-tree dynamically, using fallback",
    );
    return "%5B%22%22%2C%7B%22children%22%3A%5B%22(user)%22%2C%7B%22children%22%3A%5B%22activity%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D";
  }

  private static extractDefaultDateRange(): { from: string; to: string } {
    // Try to find date inputs on the page
    const dateInputs = document.querySelectorAll('input[type="date"]');
    let fromDate = "";
    let toDate = "";

    for (const input of dateInputs) {
      const name = input.getAttribute("name") || input.getAttribute("id") || "";
      if (
        name.toLowerCase().includes("from") ||
        name.toLowerCase().includes("start")
      ) {
        // @ts-ignore
        fromDate = input.value || input.getAttribute("value") || "";
      } else if (
        name.toLowerCase().includes("to") ||
        name.toLowerCase().includes("end")
      ) {
        // @ts-ignore
        toDate = input.value || input.getAttribute("value") || "";
      }
    }

    // If no specific inputs found, try to find any date inputs
    if (!fromDate && dateInputs.length >= 2) {
      fromDate =
        // @ts-ignore
        dateInputs[0].value || dateInputs[0].getAttribute("value") || "";
        // @ts-ignore
      toDate = dateInputs[1].value || dateInputs[1].getAttribute("value") || "";
    }

    // If still no dates, look for date-related text in the page
    if (!fromDate || !toDate) {
      const datePatterns = [
        /\b(\d{4}-\d{2}-\d{2})\b/g, // YYYY-MM-DD
        /\b(\d{2}\/\d{2}\/\d{4})\b/g, // MM/DD/YYYY
        /\b(\d{2}-\d{2}-\d{4})\b/g, // MM-DD-YYYY
      ];

      const pageText = document.body.textContent || "";
      const foundDates: string[] = [];

      for (const pattern of datePatterns) {
        const matches = pageText.match(pattern);
        if (matches) {
          foundDates.push(...matches);
        }
      }

      if (foundDates.length >= 2) {
        fromDate = fromDate || foundDates[0];
        toDate = toDate || foundDates[1];
      }
    }

    // Fallback to current month if no dates found
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const fallbackFrom =
      fromDate || firstDayOfMonth.toISOString().split("T")[0];
    const fallbackTo = toDate || lastDayOfMonth.toISOString().split("T")[0];

    console.log("Extracted default date range:", {
      from: fallbackFrom,
      to: fallbackTo,
    });
    return { from: fallbackFrom, to: fallbackTo };
  }

  static async fetchActivityData(
    fromParam: string | null,
    toParam: string | null,
  ): Promise<string> {
    // Check for cached data in dev mode
    if (this.DEV_MODE) {
      const cachedData = this.getCachedData();
      if (cachedData) {
        console.log("🚀 DEV: Using cached API response");
        return cachedData;
      }
    }

    // Extract dynamic values from the page
    const nextAction = this.extractNextAction();
    const routerStateTree = this.extractRouterStateTree();
    const defaultDates = this.extractDefaultDateRange();

    const apiUrl = window.location.href;
    const payload = [
      {
        page: 1,
        apiKeyIds: [],
        modelSlugs: [],
        providerNames: [],
        from: fromParam ? fromParam.split("T")[0] : defaultDates.from,
        to: toParam ? toParam.split("T")[0] : defaultDates.to,
        appIds: "$undefined",
      },
    ];

    console.log("Making API request to:", apiUrl);
    console.log("Payload:", payload);
    console.log("Using next-action:", nextAction);
    console.log("Using next-router-state-tree:", routerStateTree);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Accept: "text/x-component",
          "Content-Type": "text/plain;charset=UTF-8",
          "next-action": nextAction,
          "next-router-state-tree": routerStateTree,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      console.log(
        "OpenRouter API: Response received:",
        response.status,
        response.statusText,
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter API: Error response body:", errorText);
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}. OpenRouter API may have changed.`,
        );
      }

      const responseText = await response.text();

      // Cache the response in dev mode
      if (this.DEV_MODE) {
        this.setCachedData(responseText);
        console.log("💾 DEV: API response cached for 5 minutes");
      }

      return responseText;
    } catch (error) {
      console.error("OpenRouter API: Fetch failed:", error);
      if (
        error instanceof TypeError &&
        error.message.includes("Failed to fetch")
      ) {
        throw new Error(
          "Network error: Unable to connect to OpenRouter. Please check your internet connection and try again.",
        );
      }
      throw error;
    }
  }

  static extractPageParams(): { from: string | null; to: string | null } {
    const currentUrl = new URL(window.location.href);
    return {
      from: currentUrl.searchParams.get("from"),
      to: currentUrl.searchParams.get("to"),
    };
  }

  private static getCachedData(): string | null {
    try {
      const expiry = localStorage.getItem(this.CACHE_EXPIRY_KEY);
      if (!expiry || Date.now() > parseInt(expiry)) {
        // Cache expired
        this.clearCache();
        return null;
      }

      const cachedData = localStorage.getItem(this.CACHE_KEY);
      return cachedData;
    } catch (error) {
      console.warn("DEV: Error reading cache:", error);
      return null;
    }
  }

  private static setCachedData(data: string): void {
    try {
      const expiry = Date.now() + this.CACHE_DURATION;
      localStorage.setItem(this.CACHE_KEY, data);
      localStorage.setItem(this.CACHE_EXPIRY_KEY, expiry.toString());
    } catch (error) {
      console.warn("DEV: Error setting cache:", error);
    }
  }

  private static clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
      localStorage.removeItem(this.CACHE_EXPIRY_KEY);
    } catch (error) {
      console.warn("DEV: Error clearing cache:", error);
    }
  }

  // Public method to manually clear cache for development
  static clearDevCache(): void {
    if (this.DEV_MODE) {
      this.clearCache();
      console.log("🗑️ DEV: Cache cleared manually");
    }
  }
}
