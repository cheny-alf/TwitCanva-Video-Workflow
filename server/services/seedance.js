/**
 * seedance.js
 *
 * Seedance (Volcengine Ark) video generation service.
 * Creates async task, polls status, and returns result URLs.
 */

import { resolveImageToBase64 } from '../utils/imageHelpers.js';

const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const resolveArkBaseUrl = (customBaseUrl) => (customBaseUrl || process.env.ARK_BASE_URL || DEFAULT_ARK_BASE_URL).replace(/\/+$/, '');

function normalizeRatio(ratio) {
  if (!ratio || ratio === 'Auto') return 'adaptive';
  return ratio;
}

function normalizeResolution(resolution) {
  if (!resolution || resolution === 'Auto') return '720p';
  return resolution;
}

function normalizeDuration(duration) {
  if (duration === undefined || duration === null) return 5;
  return Number(duration);
}

function normalizeSeedanceContent(content = []) {
  const normalized = [];

  for (const item of content) {
    if (!item || !item.type) continue;

    if (item.type === 'text') {
      const text = item.text?.trim();
      if (!text) continue;
      normalized.push({ type: 'text', text });
      continue;
    }

    if (item.type === 'image_url' && item.image_url?.url) {
      const maybeBase64 = resolveImageToBase64(item.image_url.url) || item.image_url.url;
      normalized.push({
        type: 'image_url',
        role: item.role,
        image_url: { url: maybeBase64 }
      });
      continue;
    }

    if (item.type === 'video_url' && item.video_url?.url) {
      const maybeBase64 = resolveImageToBase64(item.video_url.url) || item.video_url.url;
      normalized.push({
        type: 'video_url',
        role: item.role,
        video_url: { url: maybeBase64 }
      });
      continue;
    }

    if (item.type === 'audio_url' && item.audio_url?.url) {
      const maybeBase64 = resolveImageToBase64(item.audio_url.url) || item.audio_url.url;
      normalized.push({
        type: 'audio_url',
        role: item.role,
        audio_url: { url: maybeBase64 }
      });
    }
  }

  return normalized;
}

async function pollSeedanceTask(taskId, apiKey, maxWaitMs = 12 * 60 * 1000, baseUrl) {
  const started = Date.now();
  const intervalMs = 5000;

  while (Date.now() - started < maxWaitMs) {
    const response = await fetch(`${baseUrl}/contents/generations/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const result = await response.json();
    const status = result?.status;

    if (status === 'succeeded') {
      return {
        videoUrl: result?.content?.video_url,
        lastFrameUrl: result?.content?.last_frame_url || result?.content?.end_frame_url
      };
    }

    if (status === 'failed' || status === 'expired' || status === 'cancelled') {
      const errMsg = result?.error?.message || `Seedance task ended with status=${status}`;
      throw new Error(errMsg);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Seedance generation timed out');
}

export async function generateSeedanceVideo({
  prompt,
  modelId,
  aspectRatio,
  resolution,
  duration,
  generateAudio,
  seedanceContent,
  returnLastFrame,
  seed,
  priority,
  tools,
  executionExpiresAfter,
  callbackUrl,
  serviceTier,
  apiKey,
  baseUrl
}) {
  if (!apiKey) {
    throw new Error('ARK_API_KEY not configured. Add ARK_API_KEY to .env for Seedance models.');
  }

  const arkBaseUrl = resolveArkBaseUrl(baseUrl);
  const model = modelId || 'doubao-seedance-2-0-pro';
  const content = normalizeSeedanceContent(seedanceContent || []);
  const textPrompt = (prompt || '').trim();
  if (content.length === 0 && textPrompt) {
    content.push({ type: 'text', text: textPrompt });
  }

  if (content.length === 0) {
    throw new Error('Seedance request requires at least one input (text/image/video/audio).');
  }

  const body = {
    model,
    content,
    ratio: normalizeRatio(aspectRatio),
    resolution: normalizeResolution(resolution),
    duration: normalizeDuration(duration),
    generate_audio: generateAudio !== false,
    return_last_frame: !!returnLastFrame
  };

  if (seed !== undefined && seed !== null) body.seed = seed;
  if (priority !== undefined && priority !== null) body.priority = priority;
  if (Array.isArray(tools) && tools.length > 0) body.tools = tools;
  if (executionExpiresAfter) body.execution_expires_after = executionExpiresAfter;
  if (callbackUrl) body.callback_url = callbackUrl;
  if (serviceTier) body.service_tier = serviceTier;

  console.log('[Seedance] Creating task:', {
    model,
    contentCount: content.length,
    hasText: content.some((x) => x.type === 'text'),
    imageCount: content.filter((x) => x.type === 'image_url').length,
    videoCount: content.filter((x) => x.type === 'video_url').length,
    audioCount: content.filter((x) => x.type === 'audio_url').length,
    ratio: body.ratio,
    resolution: body.resolution,
    duration: body.duration,
    generateAudio: body.generate_audio,
    returnLastFrame: body.return_last_frame
  });

  const response = await fetch(`${arkBaseUrl}/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const result = await response.json();
  if (!response.ok) {
    const msg = result?.error?.message || result?.message || 'Failed to create Seedance task';
    throw new Error(msg);
  }

  if (!result?.id) {
    throw new Error('Seedance task creation failed: missing task id.');
  }

  return await pollSeedanceTask(result.id, apiKey, 12 * 60 * 1000, arkBaseUrl);
}
