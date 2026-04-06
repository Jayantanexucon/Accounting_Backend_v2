import passport from "passport";
import { BearerStrategy } from "passport-azure-ad";

/**
 * Azure AD Bearer Token Strategy Configuration
 * 
 * Note: Client secret is NOT required for Bearer token validation.
 * The Bearer strategy only validates tokens already issued by Azure AD.
 * Client secret is only needed when exchanging auth codes for tokens (OAuth flow).
 * 
 * This implementation validates Bearer tokens from Azure AD for API protection.
 */
export const configurePassport = () => {
  const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID?.trim();
  const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID?.trim();
  
  // Only configure Azure AD if Client ID is provided and valid
  if (
    AZURE_CLIENT_ID && 
    AZURE_CLIENT_ID !== "your-azure-client-id" && 
    AZURE_CLIENT_ID.length > 0 &&
    AZURE_TENANT_ID &&
    AZURE_TENANT_ID.length > 0
  ) {
    try {
      const options = {
        identityMetadata: `https://login.microsoftonline.com/${AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration`,
        clientID: AZURE_CLIENT_ID,
        loggingLevel: "info",
        audience: [AZURE_CLIENT_ID, `api://${AZURE_CLIENT_ID}`],
        validateIssuer: false,
        passReqToCallback: false,
        allowMultiAudiencesInToken: true,
      };

      passport.use(
        "oauth-bearer",
        new BearerStrategy(options, (token, done) => {
          // Token validation - verify the token is valid
          // Passport automatically validates the signature and expiration
          return done(null, token);
        })
      );
      
      console.log("✅ Azure AD Bearer Strategy configured successfully");
    } catch (error) {
      console.warn("⚠️  Azure AD configuration warning:", error.message);
      console.warn("   Azure SSO will not be available unless properly configured");
    }
  } else {
    console.warn("⚠️  Azure Client ID or Tenant ID not configured. SSO via Azure disabled.");
  }
};
