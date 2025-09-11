import {Logger} from './debug'

interface ProcessingResult {
  costs: Record<string, number>;
  tokens: Record<string, number>;
  totalTokens: number;
}

export class DataProcessor {
  static processOpenRouterResponse(
    responseText: string | any,
    fromDate?: Date | null,
    toDate?: Date | null,
  ): ProcessingResult {
    try {
      // Handle direct JSON object (from API)
      if (typeof responseText === 'object' && responseText !== null) {
        Logger.debug('Processing direct JSON response')
        return this.processJSONData(responseText, fromDate, toDate)
      }

      // Handle string responses
      if (!responseText || typeof responseText !== 'string') {
        throw new Error('Invalid response text provided')
      }

      // Try to parse as JSON first
      try {
        const jsonData = JSON.parse(responseText)
        Logger.debug('Parsed JSON response')
        return this.processJSONData(jsonData, fromDate, toDate)
      } catch (jsonParseError) {
        throw new Error('Unable to parse response as JSON')
      }

      const generationMatches = responseText.match(/\{"generation_id"[^}]*\}/g)

      if (!generationMatches || generationMatches.length === 0) {
        throw new Error('No generation records found in response')
      }

      // Process generation records

      const aggregated: Record<string, number> = {}
      const tokensPerModel: Record<string, number> = {}
      let processedItems = 0
      let totalCost = 0
      let totalTokens = 0

      for (let i = 0; i < generationMatches.length; i++) {
        try {
          const match = generationMatches[i]
          if (!match || match.trim() === '') {
            console.warn(`Skipping empty match at index ${i}`)
            continue
          }

          const data = JSON.parse(match)

          const cost =
            data.cost ||
            data.total_cost ||
            data.cost_total ||
            data.price ||
            data.amount ||
            0
          const tokens =
            data.tokens_prompt ||
            data.tokens ||
            data.input_tokens ||
            data.prompt_tokens ||
            0
          const model =
            data.model ||
            data.model_name ||
            data.model_slug ||
            data.model_permaslug ||
            'unknown'

          if (cost && model) {
            const modelName = String(model).replace(/['"]/g, '')
            const costValue = parseFloat(cost)
            const tokenValue = parseInt(tokens) || 0

            if (!isNaN(costValue) && costValue > 0) {
              aggregated[modelName] = (aggregated[modelName] || 0) + costValue
              tokensPerModel[modelName] =
                (tokensPerModel[modelName] || 0) + tokenValue
              totalCost += costValue
              totalTokens += tokenValue
              processedItems++
            }
          }

          if (data && typeof data === 'object') {
            Object.keys(data).forEach(key => {
              try {
                if (
                  typeof data[key] === 'object' &&
                  data[key] &&
                  !Array.isArray(data[key])
                ) {
                  const nestedCost =
                    data[key].cost || data[key].total_cost || data[key].price
                  const nestedTokens =
                    data[key].tokens_prompt ||
                    data[key].tokens ||
                    data[key].input_tokens ||
                    data[key].prompt_tokens ||
                    0
                  const nestedModel = data[key].model || data[key].model_name

                  if (nestedCost && nestedModel) {
                    const modelName = String(nestedModel).replace(/['"]/g, '')
                    const costValue = parseFloat(nestedCost)
                    const tokenValue = parseInt(nestedTokens) || 0

                    if (!isNaN(costValue) && costValue > 0) {
                      aggregated[modelName] =
                        (aggregated[modelName] || 0) + costValue
                      tokensPerModel[modelName] =
                        (tokensPerModel[modelName] || 0) + tokenValue
                      totalCost += costValue
                      totalTokens += tokenValue
                      processedItems++
                    }
                  }
                }
              } catch (nestedError) {
                console.warn(
                  `Error processing nested data for key ${key}:`,
                  nestedError,
                )
              }
            })
          }
        } catch (parseError) {
          // Skip invalid records
        }
      }

      if (processedItems === 0) {
        throw new Error('No valid cost data found in any records')
      }

      // Processing complete

      return {costs: aggregated, tokens: tokensPerModel, totalTokens}
    } catch (error) {
      return {costs: {}, tokens: {}, totalTokens: 0}
    }
  }



  /**
   * Process JSON transaction data directly from the API
   */
  private static processJSONData(
    jsonData: any,
    fromDate?: Date | null,
    toDate?: Date | null,
  ): ProcessingResult {
    console.log('🔄 Processing JSON transaction data', {
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString(),
    })

    // Extract transactions array from API response
    let transactions = []
    if (jsonData && jsonData.data && Array.isArray(jsonData.data)) {
      transactions = jsonData.data
    } else if (
      jsonData &&
      jsonData.data &&
      jsonData.data.data &&
      Array.isArray(jsonData.data.data)
    ) {
      transactions = jsonData.data.data
    } else if (Array.isArray(jsonData)) {
      transactions = jsonData
    } else {
      console.warn('❌ Invalid JSON structure:', jsonData)
      return {costs: {}, tokens: {}, totalTokens: 0}
    }

    if (transactions.length === 0) {
      Logger.warn('No transactions found in JSON data')
      return {costs: {}, tokens: {}, totalTokens: 0}
    }

    Logger.debug(`Processing ${transactions.length} transactions from JSON`)

    // Filter transactions by date range if provided
    let filteredTransactions = transactions
    if (fromDate || toDate) {
      filteredTransactions = transactions.filter(
        (transaction: any, index: number) => {
          try {
            // Extract transaction date
            const transactionDateStr =
              transaction.date ||
              transaction.timestamp ||
              transaction.created_at ||
              transaction.createdAt

            if (!transactionDateStr) {
              console.warn(
                `⚠️ Transaction ${index} missing date, including by default`,
              )
              return true // Include if no date available
            }

            const transactionDate = new Date(transactionDateStr)

            // Check if date is valid
            if (isNaN(transactionDate.getTime())) {
              console.warn(
                `⚠️ Transaction ${index} has invalid date: ${transactionDateStr}`,
              )
              return true // Include if date is invalid
            }

            // Apply date filtering
            if (fromDate && transactionDate < fromDate) {
              return false // Before start date
            }
            if (toDate && transactionDate > toDate) {
              return false // After end date
            }

            return true // Within date range
          } catch (error) {
            console.warn(
              `⚠️ Error filtering transaction ${index} by date:`,
              error,
            )
            return true // Include on error
          }
        },
      )

      console.log(
        `📅 Date filtering: ${transactions.length} → ${filteredTransactions.length} transactions`,
      )
    }

    const aggregated: Record<string, number> = {}
    const tokensPerModel: Record<string, number> = {}
    let processedItems = 0
    let skippedItems = 0
    let totalTokens = 0

    for (let i = 0; i < filteredTransactions.length; i++) {
      const transaction = filteredTransactions[i]

      try {
        // Debug first transaction
        if (i === 0) {
          Logger.debug('First transaction sample:', transaction)
        }

        // Extract model information - try multiple field variations
        const model =
          transaction.model_permaslug ||
          transaction.model ||
          transaction.model_slug ||
          transaction.model_name ||
          transaction.slug ||
          'unknown'

        // Extract cost - try multiple field variations
        let cost = 0
        if (transaction.usage !== undefined && transaction.usage !== null) {
          cost = parseFloat(transaction.usage)
        } else if (
          transaction.cost !== undefined &&
          transaction.cost !== null
        ) {
          cost = parseFloat(transaction.cost)
        } else if (
          transaction.total_cost !== undefined &&
          transaction.total_cost !== null
        ) {
          cost = parseFloat(transaction.total_cost)
        } else if (
          transaction.amount !== undefined &&
          transaction.amount !== null
        ) {
          cost = parseFloat(transaction.amount)
        } else if (
          transaction.price !== undefined &&
          transaction.price !== null
        ) {
          cost = parseFloat(transaction.price)
        }

        // Extract tokens - try multiple field variations
        let tokens = 0
        if (transaction.prompt_tokens !== undefined) {
          tokens = parseInt(transaction.prompt_tokens) || 0
        } else if (transaction.tokens !== undefined) {
          tokens = parseInt(transaction.tokens) || 0
        } else if (transaction.input_tokens !== undefined) {
          tokens = parseInt(transaction.input_tokens) || 0
        }

        // Extract completion tokens if available
        let completionTokens = 0
        if (transaction.completion_tokens !== undefined) {
          completionTokens = parseInt(transaction.completion_tokens) || 0
        } else if (transaction.output_tokens !== undefined) {
          completionTokens = parseInt(transaction.output_tokens) || 0
        }

        const totalTransactionTokens = tokens + completionTokens

        // More flexible validation - allow zero cost but require valid model
        if (!model || model === 'unknown') {
          Logger.warn(`Skipping transaction ${i} - invalid model:`, {
            model,
            transaction,
          })
          skippedItems++
          continue
        }

        // Allow zero-cost transactions but require valid models
        if (isNaN(cost)) {
          Logger.warn(`Skipping transaction ${i} - invalid cost:`, {
            cost,
            transaction,
          })
          skippedItems++
          continue
        }

        // Use model name as key (remove provider prefix if present)
        const modelKey = model.split('/').pop()?.trim() || model

        // Only add to totals if we have meaningful data
        if (cost > 0 || totalTransactionTokens > 0) {
          aggregated[modelKey] = (aggregated[modelKey] || 0) + cost
          tokensPerModel[modelKey] =
            (tokensPerModel[modelKey] || 0) + totalTransactionTokens
          totalTokens += totalTransactionTokens
        }

        processedItems++

        // Debug every 10th transaction
        if ((i + 1) % 10 === 0) {
          Logger.debug(
            `Processed ${i + 1}/${filteredTransactions.length} transactions`,
          )
        }
      } catch (error) {
        Logger.warn(`Error processing transaction ${i}:`, transaction, error)
        skippedItems++
      }
    }

    Logger.debug(
      `Processing complete: ${processedItems} processed, ${skippedItems} skipped`,
    )
    Logger.debug(
      `Final results: ${Object.keys(aggregated).length} models, $${Object.values(
        aggregated,
      )
        .reduce((a, b) => a + b, 0)
        .toFixed(4)} total cost`,
    )

    return {costs: aggregated, tokens: tokensPerModel, totalTokens}
  }
}
