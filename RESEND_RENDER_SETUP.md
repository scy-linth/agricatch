# Resend API Setup for Render

## Configuration Steps

### Step 1: Set Environment Variables on Render

1. Go to your Render dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Add/Update this environment variable:

```
RESEND_API_KEY=re_CnA9BwoR_3t1gADnP4TR13p4CZDk8L7UP
```

**Optional**: If you have verified a domain in Resend (recommended for production):

```
RESEND_FROM_EMAIL=AgriCatch <noreply@agricatch.store>
```

**Note**: Replace `agricatch.store` with your actual verified domain name.

### Step 2: Restart Your Render Service

After setting environment variables, restart your service on Render.

## Testing

After configuration, test by:
1. Going to your registration page
2. Entering any email address
3. Clicking "Send Verification"
4. The OTP should be sent successfully

## Troubleshooting

### Error: "Failed to send OTP email"

- Check that `RESEND_API_KEY` is set correctly in Render environment variables
- Verify the API key is valid in your Resend dashboard
- Check Render logs for detailed error messages
- Make sure your Render service has been restarted after setting environment variables

### Error: "No email service configured"

- Ensure `RESEND_API_KEY` is set in Render environment variables
- Restart your Render service after adding the environment variable
