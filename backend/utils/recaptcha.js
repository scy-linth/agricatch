const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

async function verifyRecaptchaToken(token, { remoteip } = {}) {
  const secret = String(process.env.RECAPTCHA_SECRET_KEY || '').trim();

  if (!secret) {
    return { ok: false, status: 500, message: 'CAPTCHA is not configured on the server.' };
  }

  if (!token || !String(token).trim()) {
    return { ok: false, status: 400, message: 'Please complete the CAPTCHA before submitting.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const body = new URLSearchParams({
      secret,
      response: String(token).trim()
    });

    if (remoteip) {
      body.set('remoteip', String(remoteip));
    }

    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      return { ok: false, status: 502, message: 'Unable to verify CAPTCHA right now. Please try again.' };
    }

    if (!data.success) {
      return { ok: false, status: 403, message: 'CAPTCHA verification failed. Please try again.' };
    }

    return { ok: true, data };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { ok: false, status: 504, message: 'CAPTCHA verification timed out. Please try again.' };
    }

    console.error('CAPTCHA verification error:', error);
    return { ok: false, status: 502, message: 'Unable to verify CAPTCHA right now. Please try again.' };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { verifyRecaptchaToken };