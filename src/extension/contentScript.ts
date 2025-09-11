import {OpenRouterAPI} from './modules/api'
import {DataProcessor} from './modules/dataProcessor'
import {MessageHandler} from './modules/messaging'
import {UIManager} from './modules/ui'
import {DEV_MODE, Logger} from './modules/debug'

class OpenRouterAnalyzer {
  constructor() {
    Logger.debug('OpenRouter Analyzer: Initializing...')
    this.init()
  }

  private isOnActivityPage(): boolean {
    const currentUrl = window.location.href
    return (
      currentUrl.includes('/activity') && !currentUrl.includes('/settings')
    )
  }

  private buttonAdded = false

  init(): void {
    if (!this.isOnActivityPage()) {
      Logger.debug(
        'OpenRouter Analyzer: Not on activity page, skipping initialization',
      )
      return
    }

    Logger.debug('OpenRouter Analyzer: Setting up timers...')
    setTimeout(() => {
      Logger.debug('OpenRouter Analyzer: Initial button check...')
      this.addAnalyzeButton()

      setTimeout(() => {
        Logger.debug('OpenRouter Analyzer: About to check cached results...')
        this.checkAndDisplayCachedResults()
      }, 500)
    }, 2000)

    // Set up date input synchronization with auto-refresh
    OpenRouterAPI.setupDateInputSync()
    // Initial sync from URL to date inputs
    setTimeout(() => {
      OpenRouterAPI.syncUrlParamsToDateInputs()
    }, 1000)

    // Monitor URL changes for date parameter updates
    this.setupUrlChangeMonitoring()

    const checkInterval = setInterval(() => {
      if (!this.buttonAdded) {
        this.addAnalyzeButton()
      } else {
        Logger.debug('Button already added, stopping interval checks')
        clearInterval(checkInterval)
      }
    }, 5000)
  }

  /**
   * Set up monitoring for URL changes that affect date parameters
   */
  private setupUrlChangeMonitoring(): void {
    let lastUrl = window.location.href
    let lastDateParams = OpenRouterAPI.extractPageParams()

    // Monitor URL changes
    const checkUrlChange = () => {
      const currentUrl = window.location.href
      const currentDateParams = OpenRouterAPI.extractPageParams()

      // Check if date parameters changed
      const dateChanged =
        currentDateParams.from !== lastDateParams.from ||
        currentDateParams.to !== lastDateParams.to

      if (dateChanged) {
        Logger.debug(
          'Date parameters changed in URL, triggering auto-refresh',
          {
            old: lastDateParams,
            new: currentDateParams,
          },
        )

        // Update stored values
        lastUrl = currentUrl
        lastDateParams = currentDateParams

        // Trigger auto-refresh
        this.triggerAutoRefresh(currentDateParams.from, currentDateParams.to)
      }
    }

    // Check for URL changes every 500ms
    setInterval(checkUrlChange, 500)

    // Also listen for popstate events (browser back/forward)
    window.addEventListener('popstate', () => {
      Logger.debug('Popstate event detected, checking for date changes')
      setTimeout(checkUrlChange, 100) // Small delay to let URL update
    })

    Logger.debug('URL change monitoring setup complete')
  }

  /**
   * Trigger automatic refresh when date parameters change
   */
  private async triggerAutoRefresh(
    fromDate: string | null,
    toDate: string | null,
  ): Promise<void> {
    try {
      Logger.debug('Starting auto-refresh with date parameters:', {
        fromDate,
        toDate,
      })

      // Extract current date range from UI/URL
      let finalFromDate = fromDate
      let finalToDate = toDate

      // If no URL params, try to extract from UI inputs
      if (!finalFromDate || !finalToDate) {
        const uiDates = OpenRouterAPI.extractDefaultDateRange()
        if (!finalFromDate) finalFromDate = uiDates.from
        if (!finalToDate) finalToDate = uiDates.to
      }

      // Normalize dates: ensure toDate is not in the future
      const today = new Date()
      today.setHours(23, 59, 59, 999) // End of today

      if (finalToDate) {
        const toDateObj = new Date(finalToDate)
        if (toDateObj > today) {
          Logger.debug('toDate is in the future, setting to today:', {
            original: finalToDate,
            normalized: today.toISOString().split('T')[0],
          })
          finalToDate = today.toISOString().split('T')[0]
        }
      }

      // Also ensure fromDate is not after toDate
      if (finalFromDate && finalToDate) {
        const fromDateObj = new Date(finalFromDate)
        const toDateObj = new Date(finalToDate)
        if (fromDateObj > toDateObj) {
          Logger.debug('fromDate is after toDate, adjusting fromDate')
          finalFromDate = finalToDate
        }
      }

      // Trigger the comprehensive data fetch
      const responseData = await OpenRouterAPI.fetchComprehensiveActivityData(
        finalFromDate,
        finalToDate,
      )

      // Process and display the results
      await this.processAndDisplayResults(responseData, finalFromDate, finalToDate)

      Logger.debug('Auto-refresh completed successfully')
    } catch (error) {
      Logger.error('Auto-refresh failed:', error)
    }
  }

  /**
   * Process API response data and display results
   */
  private async processAndDisplayResults(
    responseData: any,
    fromDate: string | null,
    toDate: string | null,
  ): Promise<void> {
    try {
      Logger.debug('Processing auto-refresh results...')

      // Normalize dates: ensure toDate is not in the future
      const today = new Date()
      today.setHours(23, 59, 59, 999) // End of today

      let normalizedFromDate = fromDate
      let normalizedToDate = toDate

      if (normalizedToDate) {
        const toDateObj = new Date(normalizedToDate)
        if (toDateObj > today) {
          Logger.debug('toDate is in the future, setting to today:', {
            original: normalizedToDate,
            normalized: today.toISOString().split('T')[0],
          })
          normalizedToDate = today.toISOString().split('T')[0]
        }
      }

      // Also ensure fromDate is not after toDate
      if (normalizedFromDate && normalizedToDate) {
        const fromDateObj = new Date(normalizedFromDate)
        const toDateObj = new Date(normalizedToDate)
        if (fromDateObj > toDateObj) {
          Logger.debug('fromDate is after toDate, adjusting fromDate')
          normalizedFromDate = normalizedToDate
        }
      }

      // Use normalized dates for processing
      fromDate = normalizedFromDate
      toDate = normalizedToDate

      // Enhanced validation for API response
      if (!responseData) {
        Logger.error('API returned null/undefined response')
        MessageHandler.sendError(
          'The API returned an empty response. Please try again in a few minutes.',
        )
        return
      }

      if (typeof responseData !== 'object') {
        Logger.error('API returned non-object response:', typeof responseData)
        MessageHandler.sendError(
          'The API returned an invalid response format. Please try again.',
        )
        return
      }

      // Validate that we have transaction data
      let transactions = []
      let dataSource = 'unknown'

      if (responseData.data && Array.isArray(responseData.data)) {
        transactions = responseData.data
        dataSource = 'responseData.data'
      } else if (
        responseData.data &&
        responseData.data.data &&
        Array.isArray(responseData.data.data)
      ) {
        transactions = responseData.data.data
        dataSource = 'responseData.data.data'
      } else if (Array.isArray(responseData)) {
        transactions = responseData
        dataSource = 'direct array'
      }

      Logger.debug(
        `Found ${transactions.length} transactions from ${dataSource}`,
      )

      if (transactions.length === 0) {
        Logger.warn('No transactions found in API response', {
          dataSource,
          responseKeys: Object.keys(responseData),
          hasDataField: !!responseData.data,
          dataFieldType: responseData.data ? typeof responseData.data : 'N/A',
        })

        MessageHandler.sendError(
          'No transaction data found for the selected date range. Please try a different date range or try again later.',
        )
        return
      }

      // Process the data using DataProcessor
      const result = DataProcessor.processOpenRouterResponse(
        responseData,
        fromDate ? new Date(fromDate) : null,
        toDate ? new Date(toDate) : null,
      )

      // Enhanced validation of processing results
      if (!result) {
        Logger.error('DataProcessor returned null/undefined result')
        throw new Error('Data processing failed - no result returned')
      }

      if (!result.costs || typeof result.costs !== 'object') {
        Logger.error('Invalid costs data:', result.costs)
        throw new Error('Data processing failed - invalid cost data')
      }

      if (Object.keys(result.costs).length === 0) {
        Logger.warn('No cost data found after processing', {
          transactionCount: transactions.length,
          sampleTransaction: transactions[0],
        })
        throw new Error(
          'No cost data found in the transaction data. This might indicate an issue with the data format.',
        )
      }

      const totalCost = Object.values(result.costs).reduce(
        (sum, cost) => sum + cost,
        0,
      )

      if (typeof totalCost !== 'number' || isNaN(totalCost)) {
        Logger.error('Invalid total cost calculation:', {
          totalCost,
          costsObject: result.costs,
        })
        throw new Error('Failed to calculate total cost from the data')
      }

      Logger.debug('Data processed successfully:', {
        totalCost,
        totalTokens: result.totalTokens,
        modelCount: Object.keys(result.costs).length,
        costBreakdown: result.costs,
      })

      // Display results
      MessageHandler.sendResult(result.costs)
      UIManager.displayResults(
        result.costs,
        totalCost,
        result.totalTokens,
        result.tokens,
      )

    } catch (error: any) {
      Logger.error('Auto-refresh processing error:', error)
      MessageHandler.sendError(
        `Failed to process auto-refresh data: ${error.message}`,
      )
    }
  }



  findExportButton(): Element | undefined {
    const buttons = Array.from(document.querySelectorAll('button, a'))
    return buttons.find(
      btn =>
        btn.textContent?.toLowerCase().includes('export') ||
        btn.getAttribute('aria-label')?.toLowerCase().includes('export') ||
        btn.getAttribute('title')?.toLowerCase().includes('export'),
    )
  }

  addAnalyzeButton(): void {
    Logger.debug('OpenRouter Analyzer: Looking for export button...')
    const exportBtn = this.findExportButton()
    if (!exportBtn) {
      Logger.debug('OpenRouter Analyzer: Export button not found')
      return
    }

    Logger.debug(
      'OpenRouter Analyzer: Export button found, creating analyze button...',
    )
    try {
      const success = UIManager.createAnalyzeButton(
        exportBtn,
        event => this.analyzeData(event),
      )
      if (success) {
        this.buttonAdded = true
        Logger.debug(
          'OpenRouter Analyzer: Analyze button created successfully',
        )
      }
    } catch (error) {
      Logger.error(
        'OpenRouter Analyzer: Error creating analyze button:',
        error,
      )
    }
  }

  async checkAndDisplayCachedResults(): Promise<void> {
    if (!this.isOnActivityPage()) {
      Logger.debug(
        'OpenRouter Analyzer: Not on activity page, skipping cached data check',
      )
      return
    }

    Logger.debug('OpenRouter Analyzer: Checking for cached results...')

    try {
      const cachedData = this.getCachedData()
      if (cachedData) {
        Logger.debug(
          'OpenRouter Analyzer: Found cached data, processing and displaying...',
        )

        try {
          const result = DataProcessor.processOpenRouterResponse(
            cachedData,
            null,
            null,
          )

          if (!result.costs || Object.keys(result.costs).length === 0) {
            Logger.warn('OpenRouter Analyzer: No valid data in cache')
            return
          }

          const totalCost = Object.values(result.costs).reduce(
            (sum, cost) => sum + cost,
            0,
          )

          if (typeof totalCost !== 'number' || isNaN(totalCost)) {
            Logger.warn('OpenRouter Analyzer: Invalid total cost from cache')
            return
          }

          MessageHandler.sendInfo('Displaying cached results (30min cache)')

          try {
            UIManager.displayResults(
              result.costs,
              totalCost,
              result.totalTokens,
              result.tokens,
            )
          } catch (displayError) {
            Logger.error(
              'OpenRouter Analyzer: Error displaying cached results:',
              displayError,
            )
          }

          setTimeout(() => {
            try {
              const deleteBtn = document.querySelector(
                'button[title*="cache"]',
              ) as HTMLButtonElement
              if (deleteBtn) {
                deleteBtn.disabled = false
                deleteBtn.style.opacity = '1'
                deleteBtn.title = 'Clear cache only'
              }
            } catch (error) {
              Logger.warn(
                'OpenRouter Analyzer: Error updating delete button state:',
                error,
              )
            }
          }, 500)
        } catch (processingError) {
          Logger.error(
            'OpenRouter Analyzer: Error processing cached data:',
            processingError,
          )
          Logger.warn('OpenRouter Analyzer: Clearing corrupted cache')
          try {
            OpenRouterAPI.clearDevCache()
          } catch (clearError) {
            Logger.warn(
              'OpenRouter Analyzer: Error clearing cache:',
              clearError,
            )
          }
        }
      } else {
        Logger.debug('OpenRouter Analyzer: No cached data found')
      }
    } catch (error) {
      Logger.error('OpenRouter Analyzer: Error checking cached data:', error)
    }
  }

  private getCachedData(): string | null {
    if (!DEV_MODE) {
      return null
    }

    try {
      const expiry = localStorage.getItem('openrouter_dev_cache_expiry')
      const cached = localStorage.getItem('openrouter_dev_cache')

      Logger.debug(
        'OpenRouter Analyzer: Cache check - expiry:',
        expiry,
        'now:',
        Date.now(),
        'cached length:',
        cached?.length,
      )

      if (!expiry || Date.now() > parseInt(expiry)) {
        Logger.debug('OpenRouter Analyzer: Cache expired or not found')
        return null
      }

      Logger.debug('OpenRouter Analyzer: Cache valid, returning data')
      return cached
    } catch (error) {
      Logger.debug('OpenRouter Analyzer: Cache check error:', error)
      return null
    }
  }

  async analyzeData(event: Event): Promise<void> {
    event.preventDefault()

    Logger.debug('Starting OpenRouter activity analysis...')
    MessageHandler.sendInfo('Fetching your OpenRouter activity data...')

    try {
      Logger.debug('Fetching comprehensive activity data...')

      // Extract current date range from UI/URL
      Logger.debug('Extracting date parameters...')
      const urlParams = OpenRouterAPI.extractPageParams()
      Logger.debug('URL parameters extracted:', urlParams)

      let fromDate = urlParams.from
      let toDate = urlParams.to

      // If no URL params, try to extract from UI inputs
      if (!fromDate || !toDate) {
        Logger.debug('No complete URL params, extracting from UI...')
        const uiDates = OpenRouterAPI.extractDefaultDateRange()
        Logger.debug('UI date inputs extracted:', uiDates)

        if (!fromDate) fromDate = uiDates.from
        if (!toDate) toDate = uiDates.to
      }

      // Normalize dates: ensure toDate is not in the future
      const today = new Date()
      today.setHours(23, 59, 59, 999) // End of today

      if (toDate) {
        const toDateObj = new Date(toDate)
        if (toDateObj > today) {
          Logger.debug('toDate is in the future, setting to today:', {
            original: toDate,
            normalized: today.toISOString().split('T')[0],
          })
          toDate = today.toISOString().split('T')[0]
        }
      }

      // Also ensure fromDate is not after toDate
      if (fromDate && toDate) {
        const fromDateObj = new Date(fromDate)
        const toDateObj = new Date(toDate)
        if (fromDateObj > toDateObj) {
          Logger.debug('fromDate is after toDate, adjusting fromDate')
          fromDate = toDate
        }
      }

      Logger.debug('Final normalized date parameters being used:', {fromDate, toDate})

      const responseData = await OpenRouterAPI.fetchComprehensiveActivityData(
        fromDate,
        toDate,
      )
      Logger.debug(
        'Comprehensive API Response received:',
        typeof responseData,
        responseData ? 'has data' : 'empty',
      )

      // Log cache status for debugging
      if (typeof responseData === 'object' && responseData !== null) {
        const transactionCount = Array.isArray(responseData.data)
          ? responseData.data.length
          : Array.isArray(responseData.data?.data)
            ? responseData.data.data.length
            : Array.isArray(responseData)
              ? responseData.length
              : 'unknown'
        Logger.debug(`Processing ${transactionCount} transactions`)
      }

      // Enhanced validation for API response
      if (!responseData) {
        Logger.error('API returned null/undefined response')
        MessageHandler.sendError(
          'The API returned an empty response. Please try again in a few minutes.',
        )
        return
      }

      if (typeof responseData !== 'object') {
        Logger.error('API returned non-object response:', typeof responseData)
        MessageHandler.sendError(
          'The API returned an invalid response format. Please try again.',
        )
        return
      }

      // Validate that we have transaction data
      let transactions = []
      let dataSource = 'unknown'

      if (responseData.data && Array.isArray(responseData.data)) {
        transactions = responseData.data
        dataSource = 'responseData.data'
      } else if (
        responseData.data &&
        responseData.data.data &&
        Array.isArray(responseData.data.data)
      ) {
        transactions = responseData.data.data
        dataSource = 'responseData.data.data'
      } else if (Array.isArray(responseData)) {
        transactions = responseData
        dataSource = 'direct array'
      }

      Logger.debug(
        `Found ${transactions.length} transactions from ${dataSource}`,
      )

      if (transactions.length === 0) {
        Logger.warn('No transactions found in API response', {
          dataSource,
          responseKeys: Object.keys(responseData),
          hasDataField: !!responseData.data,
          dataFieldType: responseData.data ? typeof responseData.data : 'N/A',
        })

        MessageHandler.sendError(
          'No transaction data found for the selected date range. Please try a different date range or try again later.',
        )
        return
      }

      // Additional validation - check if transactions have required fields
      const sampleTransaction = transactions[0]
      if (!sampleTransaction || typeof sampleTransaction !== 'object') {
        Logger.error('Invalid transaction structure:', sampleTransaction)
        MessageHandler.sendError(
          'The transaction data format is invalid. Please try again.',
        )
        return
      }

      Logger.debug(
        `Processing ${transactions.length} transactions with sample:`,
        {
          keys: Object.keys(sampleTransaction),
          hasDate: !!sampleTransaction.date || !!sampleTransaction.timestamp,
          hasCost: !!sampleTransaction.usage || !!sampleTransaction.cost,
          hasTokens:
            !!sampleTransaction.prompt_tokens || !!sampleTransaction.tokens,
        },
      )

      let result: {
        costs: Record<string, number>;
        tokens: Record<string, number>;
        totalTokens: number;
      } | null = null
      let totalCost: number

      try {
        // Convert date strings to Date objects for filtering
        let fromDateObj: Date | null = null
        let toDateObj: Date | null = null

        if (fromDate) {
          fromDateObj = new Date(fromDate)
          if (isNaN(fromDateObj.getTime())) {
            console.warn('Invalid fromDate format:', fromDate)
            fromDateObj = null
          }
        }

        if (toDate) {
          toDateObj = new Date(toDate)
          if (isNaN(toDateObj.getTime())) {
            console.warn('Invalid toDate format:', toDate)
            toDateObj = null
          }
        }

        try {
          Logger.debug(
            'Starting data processing with',
            transactions.length,
            'transactions',
          )

          result = DataProcessor.processOpenRouterResponse(
            responseData,
            fromDateObj,
            toDateObj,
          )

          // Enhanced validation of processing results
          if (!result) {
            Logger.error('DataProcessor returned null/undefined result')
            throw new Error('Data processing failed - no result returned')
          }

          if (!result.costs || typeof result.costs !== 'object') {
            Logger.error('Invalid costs data:', result.costs)
            throw new Error('Data processing failed - invalid cost data')
          }

          if (Object.keys(result.costs).length === 0) {
            Logger.warn('No cost data found after processing', {
              transactionCount: transactions.length,
              sampleTransaction: transactions[0],
            })
            throw new Error(
              'No cost data found in the transaction data. This might indicate an issue with the data format.',
            )
          }

          totalCost = Object.values(result.costs).reduce(
            (sum, cost) => sum + cost,
            0,
          )

          if (typeof totalCost !== 'number' || isNaN(totalCost)) {
            Logger.error('Invalid total cost calculation:', {
              totalCost,
              costsObject: result.costs,
            })
            throw new Error('Failed to calculate total cost from the data')
          }

          Logger.debug('Data processed successfully:', {
            totalCost,
            totalTokens: result.totalTokens,
            modelCount: Object.keys(result.costs).length,
            costBreakdown: result.costs,
          })
        } catch (processingError: any) {
          Logger.error('Data processing error:', {
            error: processingError.message,
            stack: processingError.stack,
            transactionCount: transactions.length,
            resultKeys: result ? Object.keys(result) : 'null',
          })

          // Provide more specific error messages based on the error
          let userMessage = 'Failed to process transaction data. '

          if (processingError.message.includes('cost')) {
            userMessage +=
              'There was an issue calculating costs from your transactions.'
          } else if (processingError.message.includes('format')) {
            userMessage += 'The transaction data format is unexpected.'
          } else if (processingError.message.includes('empty')) {
            userMessage += 'No valid transaction data was found.'
          } else {
            userMessage +=
              'Please try again or contact support if the issue persists.'
          }

          MessageHandler.sendError(
            `${userMessage} (${processingError.message})`,
          )
          return
        }
      } catch (processingError: any) {
        console.error('Data processing error:', processingError)
        throw new Error(
          `Failed to process activity data: ${processingError.message}`,
        )
      }

      try {
        MessageHandler.sendResult(result.costs)
        UIManager.displayResults(
          result.costs,
          totalCost,
          result.totalTokens,
          result.tokens,
        )
      } catch (displayError: any) {
        Logger.error('Display error:', displayError)
        throw new Error(`Failed to display results: ${displayError.message}`)
      }

      setTimeout(() => {
        try {
          const deleteBtn = document.querySelector(
            'button[title*="cache"]',
          ) as HTMLButtonElement
          if (deleteBtn) {
            deleteBtn.disabled = false
            deleteBtn.style.opacity = '1'
            deleteBtn.title = 'Clear cache only'
          }
        } catch (error) {
          Logger.warn(
            'OpenRouter Analyzer: Error updating delete button state:',
            error,
          )
        }
      }, 500)
    } catch (error: any) {
      Logger.error('Analysis error:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        type: error.constructor.name,
      })

      // Provide user-friendly error messages based on error type
      let userMessage = 'Failed to analyze OpenRouter data. '

      if (
        error.message.includes('Authentication') ||
        error.message.includes('401')
      ) {
        userMessage += 'Please log in to OpenRouter and try again.'
      } else if (
        error.message.includes('forbidden') ||
        error.message.includes('403')
      ) {
        userMessage += 'You don\'t have permission to access this data.'
      } else if (
        error.message.includes('connect') ||
        error.message.includes('fetch')
      ) {
        userMessage += 'Please check your internet connection and try again.'
      } else if (
        error.message.includes('rate limit') ||
        error.message.includes('429')
      ) {
        userMessage += 'Too many requests. Please wait a moment and try again.'
      } else if (
        error.message.includes('server') ||
        error.message.includes('500')
      ) {
        userMessage +=
          'The service is temporarily unavailable. Please try again later.'
      } else if (
        error.message.includes('empty') ||
        error.message.includes('invalid')
      ) {
        userMessage += 'No data was found. Please try a different date range.'
      } else if (
        error.message.includes('JSON') ||
        error.message.includes('parse')
      ) {
        userMessage += 'The data format is invalid. Please try again.'
      } else {
        userMessage += 'An unexpected error occurred. Please try again.'
      }

      MessageHandler.sendError(`${userMessage} (Error: ${error.message})`)

      // In DEV mode, also log additional debugging info
      if (DEV_MODE) {
        console.error('Full error details:', error)
        Logger.error('Additional debugging info:', {
          url: window.location.href,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        })
      }
    }
  }
}

Logger.debug(
  'OpenRouter Analyzer: Content script loaded, document state:',
  document.readyState,
)

let globalAnalyzer: OpenRouterAnalyzer

if (typeof window !== 'undefined') {
  (window as any).OpenRouterDev = {
    clearCache: () => OpenRouterAPI.clearDevCache(),
    enableDebug: () => {
      chrome.storage.sync.set({debugMode: true}, () => {
        Logger.debug('DEV: Debug mode enabled via chrome.storage')
      })
    },
    disableDebug: () => {
      chrome.storage.sync.set({debugMode: false}, () => {
        Logger.debug('DEV: Debug mode disabled via chrome.storage')
      })
    },
    info: () =>
      Logger.log(
        'DEV Utils: Use OpenRouterDev.clearCache() to clear cache, OpenRouterDev.clearTransactionCaches() to clear transaction caches, OpenRouterDev.checkCache() to test cache display, OpenRouterDev.debugCache() to inspect cache status, OpenRouterDev.enableDebug()/disableDebug() to control debug mode',
      ),
    // Logger functions
    log: (...args: any[]) => Logger.log(args[0] || '', ...args.slice(1)),
    debug: (...args: any[]) => Logger.debug(args[0] || '', ...args.slice(1)),
    warn: (...args: any[]) => Logger.warn(args[0] || '', ...args.slice(1)),
    error: (...args: any[]) => Logger.error(args[0] || '', ...args.slice(1)),
    api: (...args: any[]) => Logger.api(args[0] || '', ...args.slice(1)),
    cache: (...args: any[]) => Logger.cache(args[0] || '', ...args.slice(1)),


  }
  Logger.log(
    'DEV: Use OpenRouterDev.clearCache() to clear cache, OpenRouterDev.clearTransactionCaches() to clear transaction caches, OpenRouterDev.checkCache() to test cache display, OpenRouterDev.debugCache() to inspect cache status, OpenRouterDev.enableDebug()/disableDebug() to control debug mode',
  )
  Logger.log(
    'DEV: Logger functions available: OpenRouterDev.log(), .debug(), .warn(), .error(), .api(), .cache(), .getLogs(), .clearLogs()',
  )
}

if (document.readyState === 'loading') {
  Logger.debug('OpenRouter Analyzer: Waiting for DOMContentLoaded...')
  document.addEventListener('DOMContentLoaded', () => {
    Logger.debug(
      'OpenRouter Analyzer: DOMContentLoaded fired, creating analyzer...',
    )
    globalAnalyzer = new OpenRouterAnalyzer()
  })
} else {
  Logger.debug(
    'OpenRouter Analyzer: DOM already ready, creating analyzer immediately...',
  )
  globalAnalyzer = new OpenRouterAnalyzer()
}
