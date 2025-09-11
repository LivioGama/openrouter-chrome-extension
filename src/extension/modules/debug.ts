export let DEV_MODE = false

chrome.storage?.sync.get(['debugMode'], result => {
  DEV_MODE = Boolean(result.debugMode)
})

chrome.storage?.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.debugMode) {
    DEV_MODE = Boolean(changes.debugMode.newValue)
  }
})

/**
 * Logger class for conditional logging based on DEV_MODE
 */
export class Logger {
  private static readonly LOG_STORAGE_KEY = 'openrouter_logs'
  private static readonly LOG_CONFIG_KEY = 'openrouter_log_config'
  private static readonly MAX_LOGS = 100
  private static readonly LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    LOG: 3,
    DEBUG: 4,
  }

  // Current log level (defaults to INFO in PROD, DEBUG in DEV)
  private static currentLogLevel = DEV_MODE
    ? this.LOG_LEVELS.DEBUG
    : this.LOG_LEVELS.INFO

  /**
   * Log debug information - only in DEV mode or when log level allows
   */
  static debug(message: string, ...args: any[]): void {
    if (!this.shouldLog('DEBUG')) return

    const logEntry = this.createLogEntry('DEBUG', message, args)
    if (DEV_MODE) {
      console.debug(`🐛 ${message}`, ...args)
    }
    this.storeLog(logEntry)
  }

  /**
   * Log general information
   */
  static log(message: string, ...args: any[]): void {
    if (!this.shouldLog('LOG')) return

    const logEntry = this.createLogEntry('LOG', message, args)
    if (DEV_MODE) {
      console.log(`ℹ️ ${message}`, ...args)
    }
    this.storeLog(logEntry)
  }

  /**
   * Log warnings - shown in both DEV and PROD
   */
  static warn(message: string, ...args: any[]): void {
    if (!this.shouldLog('WARN')) return

    const logEntry = this.createLogEntry('WARN', message, args)

    if (DEV_MODE) {
      console.warn(`⚠️ ${message}`, ...args)
    } else {
      // In PROD, only show critical warnings in console
      console.warn(`⚠️ ${message}`)
    }
    this.storeLog(logEntry)
  }

  /**
   * Log errors - shown in both DEV and PROD
   */
  static error(message: string, ...args: any[]): void {
    const logEntry = this.createLogEntry('ERROR', message, args)

    if (DEV_MODE) {
      console.error(`❌ ${message}`, ...args)
    } else {
      // In PROD, log errors minimally to console for debugging
      console.error(`❌ ${message}`, args.length > 0 ? args[0] : '')
    }
    this.storeLog(logEntry)
  }

  /**
   * Log API-related information
   */
  static api(message: string, ...args: any[]): void {
    if (!this.shouldLog('INFO')) return

    const logEntry = this.createLogEntry('API', message, args)
    if (DEV_MODE) {
      console.log(`🌐 ${message}`, ...args)
    }
    this.storeLog(logEntry)
  }

  /**
   * Log cache-related information
   */
  static cache(message: string, ...args: any[]): void {
    if (!this.shouldLog('INFO')) return

    const logEntry = this.createLogEntry('CACHE', message, args)
    if (DEV_MODE) {
      console.log(`💾 ${message}`, ...args)
    }
    this.storeLog(logEntry)
  }

  /**
   * Check if message should be logged based on current log level
   */
  private static shouldLog(level: string): boolean {
    const levelValue =
      this.LOG_LEVELS[level as keyof typeof this.LOG_LEVELS] || 0
    return levelValue <= this.currentLogLevel
  }

  /**
   * Set the current log level
   */
  static setLogLevel(level: string): void {
    const levelValue =
      this.LOG_LEVELS[level.toUpperCase() as keyof typeof this.LOG_LEVELS]
    if (levelValue !== undefined) {
      this.currentLogLevel = levelValue
      this.debug(`Log level set to: ${level.toUpperCase()}`)
    } else {
      this.warn(
        `Invalid log level: ${level}. Valid levels: ${Object.keys(this.LOG_LEVELS).join(', ')}`,
      )
    }
  }

  /**
   * Create a structured log entry
   */
  private static createLogEntry(
    level: string,
    message: string,
    args: any[],
  ): any {
    return {
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      args: args.length > 0 ? args : undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      sessionId: this.getSessionId(),
      version: chrome?.runtime?.getManifest?.()?.version || 'unknown',
    }
  }

  /**
   * Generate unique log ID
   */
  private static generateLogId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  /**
   * Get or create session ID
   */
  private static getSessionId(): string {
    try {
      let sessionId = sessionStorage.getItem('openrouter_session_id')
      if (!sessionId) {
        sessionId = this.generateLogId()
        sessionStorage.setItem('openrouter_session_id', sessionId)
      }
      return sessionId
    } catch {
      return 'unknown'
    }
  }

  /**
   * Store log entry in localStorage with error handling
   */
  private static storeLog(logEntry: any): void {
    try {
      const existingLogs = this.getStoredLogs()
      existingLogs.push(logEntry)

      // Keep only the most recent logs
      if (existingLogs.length > this.MAX_LOGS) {
        existingLogs.splice(0, existingLogs.length - this.MAX_LOGS)
      }

      localStorage.setItem(this.LOG_STORAGE_KEY, JSON.stringify(existingLogs))
    } catch (error) {
      // If localStorage fails, try to log to console if in DEV mode
      if (DEV_MODE) {
        console.warn('Failed to store log:', error)
      }
    }
  }

  /**
   * Get stored logs from localStorage
   */
  static getStoredLogs(): any[] {
    try {
      const stored = localStorage.getItem(this.LOG_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      if (DEV_MODE) {
        console.warn('Failed to retrieve stored logs:', error)
      }
      return []
    }
  }


  /**
   * Initialize logger configuration
   */
  static init(): void {
    // Load saved log level
    try {
      const config = localStorage.getItem(this.LOG_CONFIG_KEY)
      if (config) {
        const parsedConfig = JSON.parse(config)
        if (parsedConfig.logLevel) {
          this.setLogLevel(parsedConfig.logLevel)
        }
      }
    } catch (error) {
      if (DEV_MODE) {
        console.warn('Failed to load logger config:', error)
      }
    }

    // Clean up old logs on initialization
    this.cleanupOldLogs()
  }

  /**
   * Clean up logs older than specified days
   */
  private static cleanupOldLogs(maxAgeDays: number = 7): void {
    try {
      const logs = this.getStoredLogs()
      const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000

      const filteredLogs = logs.filter(log => {
        const logTime = new Date(log.timestamp).getTime()
        return logTime > cutoffTime
      })

      if (filteredLogs.length !== logs.length) {
        localStorage.setItem(
          this.LOG_STORAGE_KEY,
          JSON.stringify(filteredLogs),
        )
        if (DEV_MODE) {
          console.log(
            `🧹 Cleaned up ${logs.length - filteredLogs.length} old log entries`,
          )
        }
      }
    } catch (error) {
      if (DEV_MODE) {
        console.warn('Failed to cleanup old logs:', error)
      }
    }
  }
}

// Initialize logger on load
Logger.init()


