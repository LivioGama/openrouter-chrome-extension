import {DEV_MODE, Logger} from './debug'

export class OpenRouterAPI {
  private static readonly CACHE_KEY = 'openrouter_dev_cache'
  private static readonly CACHE_EXPIRY_KEY = 'openrouter_dev_cache_expiry'
  private static readonly CACHE_DURATION = 30 * 60 * 1000

  // Improved caching system for transaction-analytics API
  private static readonly TRANSACTION_CACHE_PREFIX =
    'openrouter_transaction_cache_'
  private static readonly TRANSACTION_CACHE_EXPIRY_PREFIX =
    'openrouter_transaction_expiry_'
  private static readonly TRANSACTION_CACHE_DURATION = 15 * 60 * 1000 // 15 minutes
  private static readonly CACHE_VERSION = 'v2' // For cache invalidation on updates
  private static readonly CACHE_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours
  private static readonly MAX_CACHE_ENTRIES = 10 // Limit cache size









  public static extractDefaultDateRange(): { from: string; to: string } {
    const dateInputs = document.querySelectorAll('input[type="date"]')
    let fromDate = ''
    let toDate = ''

    for (const input of dateInputs) {
      const name = input.getAttribute('name') || input.getAttribute('id') || ''
      if (
        name.toLowerCase().includes('from') ||
        name.toLowerCase().includes('start')
      ) {
        fromDate =
          (input as HTMLInputElement).value ||
          input.getAttribute('value') ||
          ''
      } else if (
        name.toLowerCase().includes('to') ||
        name.toLowerCase().includes('end')
      ) {
        toDate =
          (input as HTMLInputElement).value ||
          input.getAttribute('value') ||
          ''
      }
    }

    if (!fromDate && dateInputs.length >= 2) {
      fromDate =
        (dateInputs[0] as HTMLInputElement).value ||
        dateInputs[0].getAttribute('value') ||
        ''

      toDate =
        (dateInputs[1] as HTMLInputElement).value ||
        dateInputs[1].getAttribute('value') ||
        ''
    }

    if (!fromDate || !toDate) {
      const datePatterns = [
        /\b(\d{4}-\d{2}-\d{2})\b/g,
        /\b(\d{2}\/\d{2}\/\d{4})\b/g,
        /\b(\d{2}-\d{2}-\d{4})\b/g,
      ]

      const pageText = document.body.textContent || ''
      const foundDates: string[] = []

      for (const pattern of datePatterns) {
        const matches = pageText.match(pattern)
        if (matches) {
          foundDates.push(...matches)
        }
      }

      if (foundDates.length >= 2) {
        fromDate = fromDate || foundDates[0]
        toDate = toDate || foundDates[1]
      }
    }

    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const fallbackFrom =
      fromDate || firstDayOfMonth.toISOString().split('T')[0]
    const fallbackTo = toDate || lastDayOfMonth.toISOString().split('T')[0]

    Logger.debug('Extracted default date range:', {
      from: fallbackFrom,
      to: fallbackTo,
    })
    return {from: fallbackFrom, to: fallbackTo}
  }

  static async fetchActivityData(
    fromParam: string | null = null,
    toParam: string | null = null,
  ): Promise<string> {
    Logger.debug('Starting fetchActivityData with params:', {
      fromParam,
      toParam,
    })

    const windowParam = this.calculateWindowParam(fromParam, toParam)

    try {
      // Check for cached transaction data first
      const cachedData = this.getTransactionCachedData(fromParam, toParam)

      if (cachedData) {
        Logger.cache('CACHE HIT - Using cached data for window:', windowParam)
        Logger.debug('Cached data length:', cachedData.length)

        // Validate cached data before returning
        try {
          const testParse = JSON.parse(cachedData)
          if (testParse && typeof testParse === 'object') {
            Logger.debug('Cached data validation passed')
            return cachedData
          } else {
            Logger.warn('Cached data validation failed - invalid structure')
            const cacheKey = this.getTransactionCacheKey(fromParam, toParam)
            this.clearTransactionCache(cacheKey)
          }
        } catch (parseError) {
          Logger.warn(
            'Cached data validation failed - parse error:',
            parseError,
          )
          const cacheKey = this.getTransactionCacheKey(fromParam, toParam)
          this.clearTransactionCache(cacheKey)
        }
      }

      Logger.cache(
        'CACHE MISS - No valid cached data for window:',
        windowParam,
      )

      // Fallback to DEV cache if enabled
      if (DEV_MODE) {
        const devCachedData = this.getCachedData()
        if (devCachedData) {
          Logger.cache('Using DEV cached API response')
          try {
            JSON.parse(devCachedData) // Validate DEV cache too
            return devCachedData
          } catch (parseError) {
            Logger.warn('DEV cache validation failed:', parseError)
            this.clearCache()
          }
        }
        Logger.cache('No valid DEV cache available')
      }
    } catch (cacheError) {
      Logger.error('Cache operation failed:', cacheError)
      // Continue to API call despite cache issues
    }

    // Use the transaction-analytics JSON API instead of HTML scraping
    const url = new URL(
      'https://openrouter.ai/api/frontend/user/transaction-analytics',
    )

    Logger.api('Making request to:', url.toString())
    Logger.debug('Request timestamp:', new Date().toISOString())

    url.searchParams.set('window', windowParam)

    try {
      Logger.api('Making fetch request to:', url.toString())

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Use session cookies for authentication
      })

      Logger.api('Response received:', {
        status: response.status,
        statusText: response.statusText,
        url: url.toString(),
        headers: Object.fromEntries(response.headers.entries()),
        timestamp: new Date().toISOString(),
      })

      // Check for common error status codes
      if (!response.ok) {
        Logger.error('HTTP error response:', {
          status: response.status,
          statusText: response.statusText,
          url: url.toString(),
        })

        // Handle specific error codes
        if (response.status === 401) {
          throw new Error(
            'Authentication required. Please log in to OpenRouter.',
          )
        } else if (response.status === 403) {
          throw new Error(
            'Access forbidden. You might not have permission to view this data.',
          )
        } else if (response.status === 404) {
          throw new Error(
            'API endpoint not found. The service might be temporarily unavailable.',
          )
        } else if (response.status === 429) {
          throw new Error(
            'Too many requests. Please wait a moment before trying again.',
          )
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        }
      }

      if (!response.ok) {
        const errorText = await response.text()
        Logger.error('API Error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText.substring(0, 200),
        })

        throw new Error(
          `HTTP ${response.status}: ${response.statusText}. ${errorText}`,
        )
      }

      const responseText = await response.text()
      Logger.api('Response received:', {
        length: responseText.length,
        preview: responseText.substring(0, 100),
        timestamp: new Date().toISOString(),
      })

      // Cache the transaction data
      this.setTransactionCachedData(fromParam, toParam, responseText)

      // Also cache in DEV mode if enabled
      if (DEV_MODE) {
        this.setCachedData(responseText)
        Logger.cache('DEV cache updated')
      }

      Logger.api('Request completed successfully')
      return responseText
    } catch (error) {
      Logger.error('API Fetch failed:', {
        error: (error as Error).message,
        url: url.toString(),
        timestamp: new Date().toISOString(),
      })

      throw error
    }
  }

  /**
   * Calculate window parameter from date range
   */
  private static calculateWindowParam(
    fromParam: string | null,
    toParam: string | null,
  ): string {
    let windowParam = '1mo' // Default to 1 month

    if (fromParam && toParam) {
      const fromDate = new Date(fromParam)
      const toDate = new Date(toParam)
      const diffTime = Math.abs(toDate.getTime() - fromDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Convert days to months (round up to nearest month)
      const diffMonths = Math.ceil(diffDays / 30)
      windowParam = `${Math.min(diffMonths, 12)}mo` // Max 12 months
    }

    return windowParam
  }

  static extractPageParams(): { from: string | null; to: string | null } {
    try {
      const currentUrl = new URL(window.location.href)
      return {
        from: currentUrl.searchParams.get('from'),
        to: currentUrl.searchParams.get('to'),
      }
    } catch (error) {
      Logger.error('Failed to extract page params:', error)
      return {from: null, to: null}
    }
  }

  /**
   * Sync URL parameters to date input fields
   */
  static syncUrlParamsToDateInputs(): void {
    const urlParams = this.extractPageParams()
    const dateInputs = document.querySelectorAll('input[type="date"]')

    for (const input of dateInputs) {
      const name = input.getAttribute('name') || input.getAttribute('id') || ''
      if (
        (name.toLowerCase().includes('from') ||
          name.toLowerCase().includes('start')) &&
        urlParams.from
      ) {
        // Convert ISO string to date format if needed
        const dateValue = urlParams.from.includes('T')
          ? urlParams.from.split('T')[0]
          : urlParams.from;
        (input as HTMLInputElement).value = dateValue
      } else if (
        (name.toLowerCase().includes('to') ||
          name.toLowerCase().includes('end')) &&
        urlParams.to
      ) {
        // Convert ISO string to date format if needed
        const dateValue = urlParams.to.includes('T')
          ? urlParams.to.split('T')[0]
          : urlParams.to;
        (input as HTMLInputElement).value = dateValue
      }
    }
  }

  /**
   * Sync date input fields to URL parameters
   */
  static syncDateInputsToUrl(): void {
    const dateInputs = document.querySelectorAll('input[type="date"]')
    let fromValue: string | null = null
    let toValue: string | null = null

    for (const input of dateInputs) {
      const name = input.getAttribute('name') || input.getAttribute('id') || ''
      const value = (input as HTMLInputElement).value

      if (
        (name.toLowerCase().includes('from') ||
          name.toLowerCase().includes('start')) &&
        value
      ) {
        fromValue = value
      } else if (
        (name.toLowerCase().includes('to') ||
          name.toLowerCase().includes('end')) &&
        value
      ) {
        toValue = value
      }
    }

    // Update URL parameters
    const currentUrl = new URL(window.location.href)
    if (fromValue) {
      currentUrl.searchParams.set('from', fromValue)
    }
    if (toValue) {
      currentUrl.searchParams.set('to', toValue)
    }

    // Update browser history without triggering a page reload
    window.history.replaceState({}, '', currentUrl.toString())
    Logger.debug('Updated URL with date inputs:', {
      from: fromValue,
      to: toValue,
    })
  }

  /**
   * Set up event listeners for date input synchronization
   */
  static setupDateInputSync(): void {
    const dateInputs = document.querySelectorAll('input[type="date"]')

    dateInputs.forEach(input => {
      input.addEventListener('change', () => {
        Logger.debug('Date input changed, syncing to URL...')
        this.syncDateInputsToUrl()
      })
    })

    // Also listen for URL changes (back/forward navigation)
    window.addEventListener('popstate', () => {
      Logger.debug('URL changed (popstate), syncing to date inputs...')
      this.syncUrlParamsToDateInputs()
    })

    Logger.debug('Date input synchronization setup complete')
  }



  private static getCachedData(): string | null {
    try {
      const expiry = localStorage.getItem(this.CACHE_EXPIRY_KEY)
      if (!expiry || Date.now() > parseInt(expiry)) {
        this.clearCache()
        return null
      }

      const cachedData = localStorage.getItem(this.CACHE_KEY)
      if (cachedData) {
        // Validate cache format
        try {
          JSON.parse(cachedData) // Test if it's valid JSON
          return cachedData
        } catch {
          console.warn('DEV: Invalid cache data format, clearing cache')
          this.clearCache()
          return null
        }
      }
      return cachedData
    } catch (error) {
      console.warn('DEV: Error reading cache:', error)
      return null
    }
  }

  private static setCachedData(data: string): void {
    try {
      // Check storage quota before saving
      const testKey = '__storage_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)

      const expiry = Date.now() + this.CACHE_DURATION
      localStorage.setItem(this.CACHE_KEY, data)
      localStorage.setItem(this.CACHE_EXPIRY_KEY, expiry.toString())

      // Periodic cleanup
      this.performPeriodicCleanup()
    } catch (error) {
      if ((error as Error).name === 'QuotaExceededError') {
        console.warn('DEV: Storage quota exceeded, clearing old cache')
        this.clearCache()
        // Try again after cleanup
        try {
          const expiry = Date.now() + this.CACHE_DURATION
          localStorage.setItem(this.CACHE_KEY, data)
          localStorage.setItem(this.CACHE_EXPIRY_KEY, expiry.toString())
        } catch (retryError) {
          console.warn(
            'DEV: Failed to cache even after cleanup:',
            (retryError as Error).message,
          )
        }
      } else {
        console.warn('DEV: Error setting cache:', (error as Error).message)
      }
    }
  }

  private static clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY)
      localStorage.removeItem(this.CACHE_EXPIRY_KEY)
    } catch (error) {
      console.warn('DEV: Error clearing cache:', error)
    }
  }

  static clearDevCache(): void {
    if (DEV_MODE) {
      this.clearCache()
      console.log('🗑️ DEV: Cache cleared manually')
    }
  }

  /**
   * Generate cache key for transaction data based on window parameter
   */
  private static getTransactionCacheKey(
    fromDate?: string | null,
    toDate?: string | null,
  ): string {
    // Use actual date range for cache key instead of window parameter
    const dateRange = this.getDateRangeKey(fromDate, toDate)
    const cacheKey = `${this.TRANSACTION_CACHE_PREFIX}${this.CACHE_VERSION}_${dateRange}`
    Logger.debug('Generated cache key for date range:', cacheKey)
    return cacheKey
  }

  private static getDateRangeKey(
    fromDate?: string | null,
    toDate?: string | null,
  ): string {
    if (!fromDate || !toDate) {
      // Fallback to current month if no dates provided
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      fromDate = firstDay.toISOString().split('T')[0]
      toDate = lastDay.toISOString().split('T')[0]
    }

    // Create a normalized date range key
    return `${fromDate}_to_${toDate}`
  }

  /**
   * Get cached transaction data for specific window
   */
  private static getTransactionCachedData(
    fromDate?: string | null,
    toDate?: string | null,
  ): string | null {
    try {
      // First try exact date range match
      const exactCacheKey = this.getTransactionCacheKey(fromDate, toDate)
      const exactData = this.getCachedDataByKey(exactCacheKey)
      if (exactData) {
        Logger.cache('Found exact cached data for date range:', {
          fromDate,
          toDate,
        })
        return exactData
      }

      // If no exact match, look for overlapping/covering data
      Logger.cache('No exact cache match, checking for overlapping data...')
      const overlappingData = this.findOverlappingCachedData(fromDate, toDate)
      if (overlappingData) {
        Logger.cache(
          'Found overlapping cached data that covers the requested range',
        )
        return overlappingData
      }

      Logger.cache('No suitable cached data found for date range:', {
        fromDate,
        toDate,
      })
      return null
    } catch (error) {
      Logger.warn('Error reading transaction cache:', error)
      return null
    }
  }

  private static getCachedDataByKey(cacheKey: string): string | null {
    const expiryKey = `${this.TRANSACTION_CACHE_EXPIRY_PREFIX}${this.CACHE_VERSION}_${cacheKey.split('_').pop()}`
    const expiry = localStorage.getItem(expiryKey)

    if (!expiry || Date.now() > parseInt(expiry)) {
      // Cache expired, clean it up
      this.clearTransactionCache(cacheKey)
      return null
    }

    const cachedData = localStorage.getItem(cacheKey)
    if (cachedData) {
      try {
        JSON.parse(cachedData) // Test if it's valid JSON
        return cachedData
      } catch {
        Logger.warn('Invalid cached data format, clearing:', cacheKey)
        this.clearTransactionCache(cacheKey)
        return null
      }
    }
    return null
  }

  private static findOverlappingCachedData(
    fromDate?: string | null,
    toDate?: string | null,
  ): string | null {
    try {
      // Parse requested date range
      const requestedFrom = fromDate ? new Date(fromDate) : null
      const requestedTo = toDate ? new Date(toDate) : null

      // Check all cache entries for overlapping date ranges
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith(this.TRANSACTION_CACHE_PREFIX)) continue

        // Extract date range from cache key
        const dateRangeMatch = key.match(
          /_(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})$/,
        )
        if (!dateRangeMatch) continue

        const cacheFrom = new Date(dateRangeMatch[1])
        const cacheTo = new Date(dateRangeMatch[2])

        // Check if cache covers the requested range
        if (
          this.doesCacheCoverRange(
            cacheFrom,
            cacheTo,
            requestedFrom,
            requestedTo,
          )
        ) {
          const cachedData = localStorage.getItem(key)
          if (cachedData) {
            Logger.cache('Found overlapping cache:', {
              cacheRange: `${dateRangeMatch[1]} to ${dateRangeMatch[2]}`,
              requestedRange: `${fromDate} to ${toDate}`,
              key,
            })
            return cachedData
          }
        }
      }
    } catch (error) {
      Logger.warn('Error checking overlapping cache:', error)
    }
    return null
  }

  private static doesCacheCoverRange(
    cacheFrom: Date,
    cacheTo: Date,
    requestedFrom: Date | null,
    requestedTo: Date | null,
  ): boolean {
    // If no requested dates, any cache covers it
    if (!requestedFrom && !requestedTo) return true

    // If only one date requested, check if cache contains it
    if (requestedFrom && !requestedTo) {
      return requestedFrom >= cacheFrom && requestedFrom <= cacheTo
    }
    if (!requestedFrom && requestedTo) {
      return requestedTo >= cacheFrom && requestedTo <= cacheTo
    }

    // Both dates requested - check if cache fully contains the range
    return requestedFrom! >= cacheFrom && requestedTo! <= cacheTo
  }

  /**
   * Cache transaction data for specific date range
   */
  private static setTransactionCachedData(
    fromDate: string | null,
    toDate: string | null,
    data: string,
  ): void {
    try {
      Logger.debug('Attempting to cache data for date range:', {
        fromDate,
        toDate,
        size: data.length,
        timestamp: new Date().toISOString(),
      })

      // Check storage quota before saving
      const testKey = '__storage_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)

      const cacheKey = this.getTransactionCacheKey(fromDate, toDate)
      const expiryKey = `${this.TRANSACTION_CACHE_EXPIRY_PREFIX}${this.CACHE_VERSION}_${cacheKey.split('_').pop()}`
      const expiry = Date.now() + this.TRANSACTION_CACHE_DURATION
      const expiryDate = new Date(expiry)

      Logger.debug('Setting cache with expiry:', {
        cacheKey,
        expiryKey,
        expiryTimestamp: expiry,
        expiryDate: expiryDate.toISOString(),
      })

      try {
        localStorage.setItem(cacheKey, data)
        localStorage.setItem(expiryKey, expiry.toString())
      } catch (storageError) {
        Logger.error('Failed to save to localStorage:', storageError)
        return
      }

      // Enforce cache limit after adding new entry
      this.enforceCacheLimit()

      Logger.cache('Successfully cached data:', {
        key: cacheKey,
        size: data.length,
        expiresAt: expiryDate.toISOString(),
      })
    } catch (error) {
      Logger.warn('Unexpected error caching data:', (error as Error).message)

      if ((error as Error).name === 'QuotaExceededError') {
        Logger.cache('Storage quota exceeded, attempting cleanup')
        this.clearExpiredCaches()

        // Try again after cleanup
        try {
          const cacheKey = this.getTransactionCacheKey(fromDate, toDate)
          const expiryKey = `${this.TRANSACTION_CACHE_EXPIRY_PREFIX}${this.CACHE_VERSION}_${cacheKey.split('_').pop()}`
          const expiry = Date.now() + this.TRANSACTION_CACHE_DURATION
          localStorage.setItem(cacheKey, data)
          localStorage.setItem(expiryKey, expiry.toString())
          this.enforceCacheLimit()

          Logger.cache('Successfully cached after cleanup')
        } catch (retryError) {
          Logger.warn(
            'Failed to cache even after cleanup:',
            (retryError as Error).message,
          )
        }
      } else {
        Logger.warn('Unexpected error caching data:', (error as Error).message)
      }
    }
  }

  /**
   * Cache transaction data for specific window
   */
  private static clearTransactionCache(cacheKey: string): void {
    try {
      // Clear both the data and expiry keys
      const expiryKey = `${this.TRANSACTION_CACHE_EXPIRY_PREFIX}${this.CACHE_VERSION}_${cacheKey.split('_').pop()}`
      localStorage.removeItem(cacheKey)
      localStorage.removeItem(expiryKey)
      Logger.cache('Cleared transaction cache for key:', cacheKey)
    } catch (error) {
      Logger.warn('Error clearing transaction cache:', error)
    }
  }

  /**
   * Enforce maximum cache entries limit
   */
  private static enforceCacheLimit(): void {
    try {
      const keys = Object.keys(localStorage)
      const cacheKeys = keys.filter(
        key =>
          key.startsWith(this.TRANSACTION_CACHE_PREFIX) &&
          key.includes(this.CACHE_VERSION),
      )

      if (cacheKeys.length >= this.MAX_CACHE_ENTRIES) {
        // Remove oldest cache entries
        const entriesWithTimestamps = cacheKeys
          .map(key => {
            const expiryKey = `${this.TRANSACTION_CACHE_EXPIRY_PREFIX}${this.CACHE_VERSION}_${key.split('_').pop()}`
            const timestamp = parseInt(localStorage.getItem(expiryKey) || '0')
            return {key, timestamp}
          })
          .sort((a, b) => a.timestamp - b.timestamp)

        // Remove the oldest entries
        const toRemove = entriesWithTimestamps.slice(
          0,
          cacheKeys.length - this.MAX_CACHE_ENTRIES + 1,
        )
        toRemove.forEach(entry => {
          this.clearTransactionCache(entry.key)
        })

        console.log(`🧹 Cleaned up ${toRemove.length} old cache entries`)
      }
    } catch (error) {
      console.warn('Error enforcing cache limit:', error)
    }
  }

  /**
   * Clear expired caches
   */
  private static clearExpiredCaches(): void {
    try {
      const keys = Object.keys(localStorage)
      const now = Date.now()

      keys.forEach(key => {
        if (key.startsWith(this.TRANSACTION_CACHE_EXPIRY_PREFIX)) {
          const expiry = localStorage.getItem(key)
          if (expiry && now > parseInt(expiry)) {
            // Find corresponding cache key
            const cacheKey = key.replace(
              this.TRANSACTION_CACHE_EXPIRY_PREFIX,
              this.TRANSACTION_CACHE_PREFIX,
            )
            this.clearTransactionCache(cacheKey)
          }
        }
      })
    } catch (error) {
      console.warn('Error clearing expired caches:', error)
    }
  }

  /**
   * Perform periodic cleanup of old cache entries
   */
  private static performPeriodicCleanup(): void {
    try {
      const lastCleanupKey = 'openrouter_last_cache_cleanup'
      const lastCleanup = localStorage.getItem(lastCleanupKey)
      const now = Date.now()

      if (
        !lastCleanup ||
        now - parseInt(lastCleanup) > this.CACHE_CLEANUP_INTERVAL
      ) {
        console.log('🧹 Performing periodic cache cleanup')
        this.clearExpiredCaches()
        localStorage.setItem(lastCleanupKey, now.toString())
      }
    } catch (error) {
      console.warn('Error performing periodic cleanup:', error)
    }
  }


  /**
   * Fetch comprehensive activity data - returns JSON directly for better processing
   */
  static async fetchComprehensiveActivityData(
    fromParam?: string | null,
    toParam?: string | null,
  ): Promise<any> {
    console.log(
      'Fetching comprehensive activity data from transaction-analytics API...',
    )

    try {
      // Extract date parameters from UI or URL if not provided
      let fromDate = fromParam
      let toDate = toParam

      console.log('🔍 Initial date params:', {fromDate, toDate})

      if (!fromDate || !toDate) {
        // Try to get dates from URL parameters first
        const urlParams = this.extractPageParams()
        console.log('🔍 URL params extracted:', urlParams)
        if (urlParams.from) fromDate = urlParams.from
        if (urlParams.to) toDate = urlParams.to

        // If still no dates, try to extract from UI inputs
        if (!fromDate || !toDate) {
          const uiDates = this.extractDefaultDateRange()
          console.log('🔍 UI dates extracted:', uiDates)
          if (!fromDate) fromDate = uiDates.from
          if (!toDate) toDate = uiDates.to
        }
      }

      console.log('✅ Final date range being used:', {fromDate, toDate})

      // The API already handles all transactions, no need for multiple requests
      const responseText = await this.fetchActivityData(fromDate, toDate)

      // Parse and validate JSON response
      let jsonData
      try {
        jsonData = JSON.parse(responseText)
        Logger.api('Parsed JSON response from transaction-analytics API')

        // Additional validation
        if (!jsonData) {
          Logger.error('Parsed JSON is null or undefined')
          throw new Error('API returned null/undefined data')
        }

        // Log response structure
        const dataKeys = Object.keys(jsonData)
        Logger.debug('API response structure:', {
          keys: dataKeys,
          dataType: typeof jsonData,
          hasDataField: !!jsonData.data,
          dataFieldType: jsonData.data ? typeof jsonData.data : 'N/A',
        })
      } catch (parseError) {
        Logger.error('Failed to parse comprehensive API response:', {
          error: (parseError as Error).message,
          responseLength: responseText.length,
          responsePreview: responseText.substring(0, 300),
        })
        throw new Error(
          `Invalid API response format: ${(parseError as Error).message}`,
        )
      }

      // Return JSON directly - no CSV conversion needed
      return jsonData
    } catch (error) {
      Logger.error('Failed to fetch comprehensive data:', {
        error: (error as Error).message,
        type: (error as Error).constructor.name,
        stack: (error as Error).stack,
      })

      // Provide more specific error messages
      if ((error as Error).message.includes('JSON')) {
        throw new Error(
          'The API returned invalid data. Please try again in a few minutes.',
        )
      } else if ((error as Error).message.includes('fetch')) {
        throw new Error(
          'Unable to connect to the API. Please check your internet connection.',
        )
      } else {
        throw error
      }
    }
  }






}
