export const API_KEY_FIELDS = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'HAILUO_API_KEY',
  'FAL_API_KEY',
  'ARK_API_KEY',
  'KLING_ACCESS_KEY',
  'KLING_SECRET_KEY'
] as const;

export type ApiKeyField = typeof API_KEY_FIELDS[number];

export interface ApiKeyProviderState {
  isSet: boolean;
  maskedValue: string;
}

export interface ApiKeyConfigResponse {
  providers: Record<ApiKeyField, ApiKeyProviderState>;
  effectiveScope: string[];
}

export interface ApiKeyUpdateResponse {
  success: boolean;
  updatedKeys: ApiKeyField[];
  effectiveScope: string[];
  error?: string;
}

export const getApiKeyConfig = async (): Promise<ApiKeyConfigResponse> => {
  const response = await fetch('/api/runtime-config/apikeys');
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || response.statusText);
  }
  return response.json();
};

export const updateApiKeyConfig = async (
  updates: Partial<Record<ApiKeyField, string>>
): Promise<ApiKeyUpdateResponse> => {
  const response = await fetch('/api/runtime-config/apikeys', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || response.statusText);
  }
  return data;
};
