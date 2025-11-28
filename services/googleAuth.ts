import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useOAuth } from "@clerk/clerk-expo";

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
    const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

    const signInWithGoogle = async () => {
        const redirectUrl = AuthSession.makeRedirectUri({ useProxy: true });
        const { createdSessionId, setActive, signIn, signUp } = await startOAuthFlow({
            redirectUrl,
        });

        const session = createdSessionId || signIn?.createdSessionId || signUp?.createdSessionId;
        if (session) {
            await setActive?.({ session });
            return;
        }

        // User cancelled or provider blocked; let caller decide without throwing.
        return;
    };

    return { signInWithGoogle };
}
