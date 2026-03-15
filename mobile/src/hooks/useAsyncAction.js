import { useState, useCallback } from 'react';

/**
 * useAsyncAction — wraps an async function with loading/error state.
 *
 * Usage:
 *   const { execute, loading, error } = useAsyncAction(async () => {
 *     await api.post('/some/endpoint', data);
 *   });
 *
 * Or with options:
 *   const { execute, loading, error } = useAsyncAction(
 *     myAsyncFn,
 *     { onSuccess: (result) => doSomething(result), onError: (e) => showToast(e) }
 *   );
 */
export default function useAsyncAction(fn, options = {}) {
  const { onSuccess, onError, resetErrorOnExecute = true } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (...args) => {
      if (resetErrorOnExecute) setError(null);
      setLoading(true);
      try {
        const result = await fn(...args);
        if (onSuccess) onSuccess(result);
        return result;
      } catch (err) {
        setError(err);
        if (onError) onError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fn, onSuccess, onError, resetErrorOnExecute]
  );

  return { execute, loading, error };
}
