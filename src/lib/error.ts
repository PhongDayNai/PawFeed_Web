/**
 * Converts a raw technical error into a user-friendly, localized error message.
 *
 * @param err The error object caught in a try-catch block.
 * @param fallbackKey The fallback i18n key path to use if no specific error matches.
 * @param t The translation function from useLanguage().
 */
export function getFriendlyErrorMessage(
  err: any,
  fallbackKey: string,
  t: (keyPath: string, variables?: Record<string, string | number>) => string
): string {
  const message = err?.message || '';

  // 1. Check for generic or system technical errors
  if (
    !message ||
    message === 'API request failed' ||
    message.includes('fetch failed') ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message === 'Refresh failed'
  ) {
    const apiFailed = t('errors.api_failed');
    return apiFailed !== 'errors.api_failed' ? apiFailed : t(fallbackKey);
  }

  if (message === 'Unauthorized' || message === 'Token refresh failed') {
    const unauthorized = t('errors.unauthorized');
    return unauthorized !== 'errors.unauthorized' ? unauthorized : t(fallbackKey);
  }

  // 2. Normalize and check for specific backend error keys
  // E.g., "Email already in use" -> "errors.email_already_in_use"
  const normalizedKey = `errors.${message
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')}`;

  const translated = t(normalizedKey);
  if (translated !== normalizedKey) {
    return translated;
  }

  // 3. Prevent displaying technical implementation details (e.g. stack trace or code locations)
  if (
    message.includes('Error:') ||
    message.includes('status code') ||
    message.includes('HTTP') ||
    message.includes('api/') ||
    message.includes('at ')
  ) {
    return t(fallbackKey);
  }

  // 4. Return the original message if it's already a descriptive custom error
  return message;
}
