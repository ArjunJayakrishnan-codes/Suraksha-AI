/**
 * Utility to get auth token from Supabase or localStorage
 */
export async function getAuthToken(): Promise<string> {
  // Try to get from localStorage first (from mock auth or stored session)
  const mockSession = localStorage.getItem("mock_auth_session");
  if (mockSession) {
    try {
      const parsed = JSON.parse(mockSession);
      if (parsed.access_token) return parsed.access_token;
    } catch (e) {
      // Ignore
    }
  }

  // Try to get from Supabase session
  try {
    const { getSupabase } = await import("@/integrations/supabase/client");
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) return token;
    }
  } catch (e) {
    // Ignore
  }

  // Fallback to mock token
  return "mock-dev-token";
}

/**
 * Make authenticated API request
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Make multiple authenticated requests in parallel
 */
export async function authenticatedFetchAll(
  requests: Array<[string, RequestInit?]>
): Promise<Response[]> {
  const token = await getAuthToken();
  return Promise.all(
    requests.map(([url, options = {}]) => {
      const headers = {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${token}`,
      };
      return fetch(url, { ...options, headers });
    })
  );
}
