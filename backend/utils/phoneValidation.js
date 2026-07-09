/**
 * Phone validation helper.
 * 
 * Normalizes only whitespace characters (spaces, tabs, etc.) and validates
 * that the result is a 10-digit Philippine mobile number starting with 9.
 * Other non-digit characters (e.g. +, -, @, #, letters) are not stripped and
 * will cause validation to fail.
 */
function normalizePhone(phone) {
  const raw = phone === null || phone === undefined ? '' : String(phone);
  const normalized = raw.replace(/\s/g, '').trim();
  return /^9\d{9}$/.test(normalized) ? normalized : null;
}

module.exports = { normalizePhone };
