interface ProcessingResult {
  costs: Record<string, number>;
  tokens: Record<string, number>;
  totalTokens: number;
}

export class DataProcessor {
  static processOpenRouterResponse(responseText: string): ProcessingResult {
    console.log("Processing OpenRouter response...");

    try {
      // Validate input
      if (!responseText || typeof responseText !== "string") {
        throw new Error("Invalid response text provided");
      }

      const generationMatches = responseText.match(/\{"generation_id"[^}]*\}/g);

      if (!generationMatches || generationMatches.length === 0) {
        console.warn(
          "No generation records found in response, response length:",
          responseText.length,
        );
        console.warn("Response preview:", responseText.substring(0, 500));
        throw new Error("No generation records found in response");
      }

      console.log(`Found ${generationMatches.length} generation records`);

      const aggregated: Record<string, number> = {};
      const tokensPerModel: Record<string, number> = {};
      let processedItems = 0;
      let totalCost = 0;
      let totalTokens = 0;

      for (let i = 0; i < generationMatches.length; i++) {
        try {
          const match = generationMatches[i];
          if (!match || match.trim() === "") {
            console.warn(`Skipping empty match at index ${i}`);
            continue;
          }

          const data = JSON.parse(match);

          const cost =
            data.cost ||
            data.total_cost ||
            data.cost_total ||
            data.price ||
            data.amount ||
            0;
          const tokens =
            data.tokens_prompt ||
            data.tokens ||
            data.input_tokens ||
            data.prompt_tokens ||
            0;
          const model =
            data.model ||
            data.model_name ||
            data.model_slug ||
            data.model_permaslug ||
            "unknown";

          if (cost && model) {
            const modelName = String(model).replace(/['"]/g, "");
            const costValue = parseFloat(cost);
            const tokenValue = parseInt(tokens) || 0;

            if (!isNaN(costValue) && costValue > 0) {
              aggregated[modelName] = (aggregated[modelName] || 0) + costValue;
              tokensPerModel[modelName] =
                (tokensPerModel[modelName] || 0) + tokenValue;
              totalCost += costValue;
              totalTokens += tokenValue;
              processedItems++;
            }
          }

          // Process nested objects safely
          if (data && typeof data === "object") {
            Object.keys(data).forEach((key) => {
              try {
                if (
                  typeof data[key] === "object" &&
                  data[key] &&
                  !Array.isArray(data[key])
                ) {
                  const nestedCost =
                    data[key].cost || data[key].total_cost || data[key].price;
                  const nestedTokens =
                    data[key].tokens_prompt ||
                    data[key].tokens ||
                    data[key].input_tokens ||
                    data[key].prompt_tokens ||
                    0;
                  const nestedModel = data[key].model || data[key].model_name;

                  if (nestedCost && nestedModel) {
                    const modelName = String(nestedModel).replace(/['"]/g, "");
                    const costValue = parseFloat(nestedCost);
                    const tokenValue = parseInt(nestedTokens) || 0;

                    if (!isNaN(costValue) && costValue > 0) {
                      aggregated[modelName] =
                        (aggregated[modelName] || 0) + costValue;
                      tokensPerModel[modelName] =
                        (tokensPerModel[modelName] || 0) + tokenValue;
                      totalCost += costValue;
                      totalTokens += tokenValue;
                      processedItems++;
                    }
                  }
                }
              } catch (nestedError) {
                console.warn(
                  `Error processing nested data for key ${key}:`,
                  nestedError,
                );
              }
            });
          }
        } catch (parseError) {
          console.warn(
            `Failed to parse generation record at index ${i}:`,
            parseError,
          );
          console.warn("Problematic record:", generationMatches[i]);
        }
      }

      if (processedItems === 0) {
        console.warn("No valid cost data found in any records");
        if (generationMatches.length > 0) {
          try {
            const sampleRecord = JSON.parse(generationMatches[0]);
            console.log("Sample record structure:", Object.keys(sampleRecord));
            console.log(
              "Full sample record:",
              JSON.stringify(sampleRecord, null, 2),
            );
          } catch (sampleError) {
            console.warn("Could not parse sample record:", sampleError);
          }
        }
        throw new Error(
          `Found ${generationMatches.length} records but no valid cost data`,
        );
      }

      console.log(
        `Successfully processed ${processedItems} items with total cost: $${totalCost.toFixed(6)} and total tokens: ${totalTokens}`,
      );
      console.log("Aggregated results:", aggregated);

      return { costs: aggregated, tokens: tokensPerModel, totalTokens };
    } catch (error) {
      console.error("Error processing OpenRouter response:", error);
      // Return empty result instead of throwing to prevent crashes
      console.warn("Returning empty results due to processing error");
      return { costs: {}, tokens: {}, totalTokens: 0 };
    }
  }

  static processCSVData(csvText: string): ProcessingResult {
    console.log("Processing CSV data...");

    const lines = csvText.split("\n");
    const headers = lines[0].split(",");

    console.log("CSV Headers:", headers);

    const costIdx = headers.findIndex(
      (h) => h.includes("cost") || h.includes("price") || h.includes("total"),
    );
    const modelIdx = headers.findIndex(
      (h) => h.includes("model") || h.includes("slug") || h.includes("name"),
    );
    const tokensIdx = headers.findIndex(
      (h) =>
        h.includes("tokens") ||
        h.includes("tokens_prompt") ||
        h.includes("input_tokens"),
    );

    if (costIdx === -1 || modelIdx === -1) {
      console.warn("CSV columns not found. Headers:", headers);
      throw new Error(
        `Could not find cost/model columns. Available columns: ${headers.join(", ")}`,
      );
    }

    const aggregated: Record<string, number> = {};
    const tokensPerModel: Record<string, number> = {};
    let processedRows = 0;
    let totalTokens = 0;

    lines.slice(1).forEach((line) => {
      if (!line.trim()) return;
      const cols = line.split(",");
      const model = cols[modelIdx]?.trim().replace(/"/g, "");
      const costStr = cols[costIdx]?.trim().replace(/"/g, "");
      const tokensStr =
        tokensIdx !== -1 ? cols[tokensIdx]?.trim().replace(/"/g, "") : "0";

      if (!model || !costStr) return;

      const cost = parseFloat(costStr);
      const tokens = parseInt(tokensStr) || 0;

      if (isNaN(cost)) return;

      aggregated[model] = (aggregated[model] || 0) + cost;
      tokensPerModel[model] = (tokensPerModel[model] || 0) + tokens;
      totalTokens += tokens;
      processedRows++;
    });

    console.log(
      `Analysis complete: ${processedRows} rows processed, total tokens: ${totalTokens}`,
      aggregated,
    );
    return { costs: aggregated, tokens: tokensPerModel, totalTokens };
  }
}
