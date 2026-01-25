# Domain Setup Guide: agricatch.store

This guide will help you configure your custom domain `agricatch.store` for your frontend (Netlify) and update CORS settings on your backend (Render).

## Overview

- **Frontend**: Netlify (will use agricatch.store)
- **Backend**: Render (API server)
- **Domain**: agricatch.store

---

## Part 1: Configure Domain on Netlify

### Step 1: Add Custom Domain in Netlify

1. Go to your [Netlify Dashboard](https://app.netlify.com)
2. Select your site
3. Go to **Site settings** → **Domain management**
4. Click **Add custom domain**
5. Enter: `agricatch.store`
6. Click **Verify**

### Step 2: Configure DNS Records

You need to add DNS records in your domain registrar (z.com):

#### Option A: CNAME Record (Recommended)
- **Type**: CNAME
- **Name**: `@` (or leave blank for root domain)
- **Value**: `your-site-name.netlify.app`
- **TTL**: 3600 (or default)

#### Option B: A Records (Alternative)
If CNAME doesn't work for root domain, use A records:
- **Type**: A
- **Name**: `@`
- **Value**: Netlify's IP addresses (Netlify will provide these)

#### For www subdomain (optional):
- **Type**: CNAME
- **Name**: `www`
- **Value**: `your-site-name.netlify.app`

### Step 3: Wait for DNS Propagation

- DNS changes can take 24-48 hours to propagate
- Netlify will show "DNS configuration detected" when ready
- You can check status in Netlify dashboard

### Step 4: Enable HTTPS

1. Netlify automatically provisions SSL certificates via Let's Encrypt
2. Wait for certificate to be issued (usually within minutes)
3. Your site will be available at `https://agricatch.store`

---

## Part 2: Update Backend CORS on Render

### Step 1: Set Environment Variable on Render

1. Go to your [Render Dashboard](https://dashboard.render.com)
2. Select your backend service
3. Go to **Environment** tab
4. Add/Update the `FRONTEND_URL` variable:

```
FRONTEND_URL=https://agricatch.store
```

**Or if you want to allow multiple domains:**

```
FRONTEND_URL=https://agricatch.store,https://www.agricatch.store,http://localhost:3000
```

### Step 2: Restart Your Render Service

After setting the environment variable, restart your service:
1. Go to **Manual Deploy** → **Clear build cache & deploy**
2. Or wait for automatic restart

---

## Part 3: Verify Configuration

### Test Frontend Domain

1. Visit `https://agricatch.store` in your browser
2. Check browser console for any CORS errors
3. Try logging in/registering to test API calls

### Test CORS Configuration

Open browser console on `https://agricatch.store` and run:

```javascript
fetch('https://your-backend.onrender.com/api/test-db')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

If you see data, CORS is working correctly!

---

## Part 4: Update netlify.toml (Already Configured)

Your `netlify.toml` is already set up correctly with redirects to your Render backend. No changes needed unless your Render URL changes.

---

## Troubleshooting

### Issue: "CORS error" in browser console

**Solution:**
1. Verify `FRONTEND_URL` is set correctly in Render
2. Make sure it includes `https://agricatch.store` (with https://)
3. Restart your Render service
4. Clear browser cache and try again

### Issue: Domain not resolving

**Solution:**
1. Check DNS records in z.com are correct
2. Wait 24-48 hours for DNS propagation
3. Use [DNS Checker](https://dnschecker.org) to verify DNS propagation globally

### Issue: SSL certificate not issued

**Solution:**
1. Make sure DNS is fully propagated
2. Check Netlify dashboard for SSL status
3. Contact Netlify support if certificate doesn't issue within 24 hours

### Issue: Site shows Netlify default page

**Solution:**
1. Verify your site is connected to the correct repository
2. Check that builds are successful
3. Ensure `netlify.toml` is in your repository root

---

## Current Configuration Summary

✅ **Backend CORS**: Updated to allow `https://agricatch.store`  
✅ **netlify.toml**: Already configured with Render redirects  
⏳ **Netlify Domain**: Needs to be added in Netlify dashboard  
⏳ **Render Environment**: Needs `FRONTEND_URL` set  

---

## Next Steps

1. ✅ Backend CORS code updated (done)
2. ⏳ Add domain in Netlify dashboard
3. ⏳ Configure DNS in z.com
4. ⏳ Set `FRONTEND_URL` in Render
5. ⏳ Wait for DNS propagation
6. ⏳ Test the site

---

## Support

If you encounter issues:
- Check Netlify logs: Site settings → Build & deploy → Deploy logs
- Check Render logs: Your service → Logs
- Check browser console for specific error messages
