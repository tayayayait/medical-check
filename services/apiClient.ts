type ApiOptions = RequestInit & {
  body?: any;
};

const API_BASE = (import.meta as any)?.env?.VITE_API_BASE ?? '';

const getAuthHeaders = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem('medai_user');
    if (!raw) return {};
    const user = JSON.parse(raw);
    if (!user?.role || !user?.email) return {};
    return {
      'x-user-role': user.role,
      'x-user-email': user.email
    };
  } catch {
    return {};
  }
};

export const apiFetch = async <T = any>(path: string, options: ApiOptions = {}): Promise<T> => {
  const headers = new Headers(options.headers || {});
  const authHeaders = getAuthHeaders();
  Object.entries(authHeaders).forEach(([key, value]) => {
    if (!headers.has(key)) headers.set(key, value);
  });

  let body = options.body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body && typeof body === 'object' && !isFormData && !(body instanceof Blob)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, body });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
};
