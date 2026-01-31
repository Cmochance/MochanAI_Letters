import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isValidLocale, type Locale } from "./config";

export default getRequestConfig(async () => {
  // Get locale from cookie
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;
  
  let locale: Locale = defaultLocale;
  if (localeCookie && isValidLocale(localeCookie)) {
    locale = localeCookie;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
