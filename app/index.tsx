import { Redirect } from 'expo-router';

// Ensure the app always opens on the Discovery tab
export default function IndexRedirect() {
  return <Redirect href="/(tabs)/discovery" />;
}
