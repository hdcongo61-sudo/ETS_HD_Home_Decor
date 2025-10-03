import { useEffect } from 'react';

const DEFAULT_DELAY = 40000; // 40 seconds
const DEFAULT_KEYWORDS = ['succès', 'success', 'réussi', '✅'];

const toLower = (value) => (typeof value === 'string' ? value.toLowerCase() : '');

/**
 * Automatically clears a success message after a delay (default 40 seconds).
 * A message is considered successful if it contains one of the default keywords
 * or if the optional predicate returns true.
 */
const useAutoClearMessage = (
  message,
  clearFn,
  {
    delay = DEFAULT_DELAY,
    resetValue = '',
    predicate,
    keywords = DEFAULT_KEYWORDS,
  } = {}
) => {
  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const lowerMessage = toLower(message);
    const isSuccess = predicate
      ? predicate(message)
      : keywords.some((keyword) => lowerMessage.includes(keyword));

    if (!isSuccess) {
      return undefined;
    }

    const timer = setTimeout(() => {
      clearFn(resetValue);
    }, delay);

    return () => clearTimeout(timer);
  }, [message, clearFn, delay, resetValue, predicate, keywords]);
};

export default useAutoClearMessage;
