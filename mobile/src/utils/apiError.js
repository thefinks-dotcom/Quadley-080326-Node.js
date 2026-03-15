/**
 * Safely converts a FastAPI/Pydantic error `detail` field to a human-readable string.
 *
 * Pydantic v2 returns `detail` as an array of objects:
 *   [{ type, loc, msg, input, ctx }, ...]
 * Pydantic v1 and plain FastAPI errors return `detail` as a plain string.
 *
 * Passing a Pydantic v2 detail array directly to React state and rendering
 * it as {error} causes:
 *   "Objects are not valid as a React child (found: object with keys
 *    {type, loc, msg, input, ctx})"
 *
 * Usage:
 *   import { apiErrorMessage } from '../../utils/apiError';
 *   setError(apiErrorMessage(err.response?.data?.detail, 'Fallback message'));
 *
 * @param {any} detail  - Value of err.response?.data?.detail
 * @param {string} fallback - Shown when detail is absent or unreadable
 * @returns {string}
 */
export function apiErrorMessage(detail, fallback = 'Something went wrong') {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map(e => (e && typeof e === 'object' ? e.msg || JSON.stringify(e) : String(e)))
      .filter(Boolean);
    return msgs.length > 0 ? msgs.join('. ') : fallback;
  }
  if (typeof detail === 'object') {
    return detail.msg || detail.message || fallback;
  }
  return String(detail) || fallback;
}
