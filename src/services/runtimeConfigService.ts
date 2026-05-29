export const API_KEY_FIELDS = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'HAILUO_API_KEY',
  'FAL_API_KEY',
  'ARK_API_KEY',
  'KLING_ACCESS_KEY',
  'KLING_SECRET_KEY'
] as const;

export const BASE_URL_FIELDS = [
  'KLING_BASE_URL',
  'HAILUO_BASE_URL',
  'FAL_BASE_URL',
  'ARK_BASE_URL'
] as const;

export const RUNTIME_CONFIG_FIELDS = [...API_KEY_FIELDS, ...BASE_URL_FIELDS] as const;

export type ApiKeyField = typeof API_KEY_FIELDS[number];
export type BaseUrlField = typeof BASE_URL_FIELDS[number];
export type RuntimeConfigField = typeof RUNTIME_CONFIG_FIELDS[number];

export const RUNTIME_CONFIG_FIELD_TYPE: Record<RuntimeConfigField, 'secret' | 'url'> = {
  GEMINI_API_KEY: 'secret',
  OPENAI_API_KEY: 'secret',
  HAILUO_API_KEY: 'secret',
  FAL_API_KEY: 'secret',
  ARK_API_KEY: 'secret',
  KLING_ACCESS_KEY: 'secret',
  KLING_SECRET_KEY: 'secret',
  KLING_BASE_URL: 'url',
  HAILUO_BASE_URL: 'url',
  FAL_BASE_URL: 'url',
  ARK_BASE_URL: 'url'
};

export interface ApiKeyProviderState {
  isSet: boolean;
  maskedValue: string;
}

export interface ApiKeyConfigResponse {
  providers: Record<RuntimeConfigField, ApiKeyProviderState>;
  effectiveScope: string[];
}

export interface ApiKeyUpdateResponse {
  success: boolean;
  updatedKeys: RuntimeConfigField[];
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
  updates: Partial<Record<RuntimeConfigField, string>>
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
