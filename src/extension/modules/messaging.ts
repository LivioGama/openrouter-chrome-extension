export class MessageHandler {
  static sendInfo(message: string): void {
    window.postMessage({
      type: 'OPENROUTER_ANALYSIS_INFO',
      data: message
    }, '*');
  }

  static sendResult(data: Record<string, number>): void {
    window.postMessage({
      type: 'OPENROUTER_ANALYSIS_RESULT',
      data: data
    }, '*');
  }

  static sendError(message: string): void {
    window.postMessage({
      type: 'OPENROUTER_ANALYSIS_ERROR',
      data: message
    }, '*');
  }
}
