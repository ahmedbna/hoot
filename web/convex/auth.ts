import Google from '@auth/core/providers/google';
import Resend from '@auth/core/providers/resend';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Password,
    Resend({
      from: 'hi@ahmedbna.com',
      name: 'hoot',
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const appName = 'hoot';

        const colors = {
          background: ' #0A0B11',
          primary: '#EBF0FA',
          card: '#11141D',
          cardForeground: '#FBFBFB',
          mutedForeground: '#B4BBCB',
        };

        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login to ${appName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${colors.background};">
  <div style="padding: 20px;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table style="max-width: 600px; width: 100%; background-color: ${colors.card}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);">
            <!-- Header -->
            <tr>
              <td align="center" style="padding: 35px 0 25px;">
                <h1 style="margin: 0; color: ${colors.primary}; font-size: 24px; font-weight: 600; letter-spacing: -0.025em;">
                ${appName}
                </h1>
              </td>
            </tr>
            
            <!-- Body -->
            <tr>
              <td style="padding: 0 30px 30px;">
                <p style="margin: 0 0 20px; color: ${colors.cardForeground}; font-size: 16px; line-height: 1.6; text-align: center;">
                  Click the button below to login to your account.
                </p>
                
                <!-- Button -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding: 20px 0;">
                      <table border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" style="border-radius: 6px;" bgcolor="${colors.primary}">
                            <a href="${url}" target="_blank" rel="noopener noreferrer"
                              style="display: inline-block; padding: 12px 36px; font-size: 16px; color: ${colors.background}; text-decoration: none; border-radius: 6px; font-weight: 500; transition: all 0.2s;">
                              Login to your account
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                
                <!-- URL Fallback -->
                <div style="padding: 16px; background-color: rgba(0, 0, 0, 0.2); border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 8px; color: ${colors.mutedForeground}; font-size: 14px; line-height: 1.5;">
                    If the button doesn't work, copy and paste this URL:
                  </p>
                  <p style="margin: 0; word-break: break-all; color: ${colors.mutedForeground}; font-size: 14px; font-family: monospace; padding: 8px 12px; background-color: rgba(0, 0, 0, 0.2); border-radius: 4px;">
                    ${url}
                  </p>
                </div>
                
                <!-- Security notice -->
                <p style="margin: 20px 0 0; color: ${colors.mutedForeground}; font-size: 14px; line-height: 1.5; padding-top: 20px; text-align: center;">
                  If you didn't request this email, you can safely ignore it. This link will expire in 24 hours.
                </p>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="background-color: rgba(0, 0, 0, 0.2); padding: 20px 30px; border-top: 1px solid ${colors.mutedForeground};">
                <p style="margin: 0; color: ${colors.mutedForeground}; font-size: 12px; text-align: center;">
                  &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`;

        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'hi@ahmedbna.com',
              to: email,
              name: 'hoot',
              subject: `Login to ${appName}`,
              html: emailHtml,
              text: `Login to ${appName}\n${url}\n\n`,
            }),
          });

          if (!res.ok) throw new Error('Resend error: ' + JSON.stringify(await res.json()));
        } catch (err) {
          console.error('Email send failed:', err);
          throw new Error('Failed to send verification email');
        }
      },
    }),
    Password,
  ],
});
