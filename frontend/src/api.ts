import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = 'ourspace_token';
const USER_KEY = 'ourspace_user';

export async function getToken() { return AsyncStorage.getItem(TOKEN_KEY); }
export async function setToken(t: string) { return AsyncStorage.setItem(TOKEN_KEY, t); }
export async function clearAuth() { await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]); }
export async function setUser(u: any) { return AsyncStorage.setItem(USER_KEY, JSON.stringify(u)); }
export async function getUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function req(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const headers: any = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text).detail || text; } catch {}
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export const api = {
  login: (username: string, password: string) =>
    req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => req('/auth/me'),
  changePassword: (old_password: string, new_password: string) =>
    req('/auth/change-password', { method: 'POST', body: JSON.stringify({ old_password, new_password }) }),
  updateProfile: (data: any) => req('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),

  // Admin
  listSpaces: () => req('/spaces'),
  createSpace: (name: string, max_members: number) =>
    req('/spaces', { method: 'POST', body: JSON.stringify({ name, max_members }) }),
  deleteSpace: (id: string) => req(`/spaces/${id}`, { method: 'DELETE' }),

  // Member
  spaceMembers: () => req('/space/members'),
  setNickname: (target_id: string, nickname: string) =>
    req('/nicknames', { method: 'POST', body: JSON.stringify({ target_id, nickname }) }),

  getSignature: () => req('/cloudinary/signature', { method: 'POST', body: JSON.stringify({}) }),
  saveMedia: (items: any[]) => req('/media', { method: 'POST', body: JSON.stringify(items) }),
  listMedia: () => req('/media'),
  deleteMedia: (id: string) => req(`/media/${id}`, { method: 'DELETE' }),
  deleteMany: (ids: string[]) => req('/media/delete-many', { method: 'POST', body: JSON.stringify({ ids }) }),

  listMessages: () => req('/chat/messages'),
  sendMessage: (text: string) => req('/chat/messages', { method: 'POST', body: JSON.stringify({ text }) }),

  aiGenerate: (prompt: string, media_ids: string[]) =>
    req('/ai/generate', { method: 'POST', body: JSON.stringify({ prompt, media_ids }) }),
};

export async function uploadToCloudinary(asset: any) {
  const sig = await api.getSignature();
  const resourceType = (asset.mimeType || '').startsWith('video/') || asset.type === 'video' ? 'video' : 'image';
  const form: any = new FormData();

  if (Platform.OS === 'web') {
    // On web, fetch the uri (blob: or data:) into a Blob for correct multipart upload
    const blob = await (await fetch(asset.uri)).blob();
    const filename = asset.fileName || `upload.${resourceType === 'video' ? 'mp4' : 'jpg'}`;
    form.append('file', blob, filename);
  } else {
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName || `upload.${resourceType === 'video' ? 'mp4' : 'jpg'}`,
      type: asset.mimeType || (resourceType === 'video' ? 'video/mp4' : 'image/jpeg'),
    } as any);
  }
  form.append('api_key', sig.api_key);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);

  const r = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/${resourceType}/upload`, { method: 'POST', body: form });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Upload failed: ${r.status} ${t.slice(0, 200)}`);
  }
  return r.json();
}

export async function uploadBase64ToCloudinary(base64Data: string) {
  const sig = await api.getSignature();
  const form: any = new FormData();
  form.append('file', `data:image/png;base64,${base64Data}`);
  form.append('api_key', sig.api_key);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
  return r.json();
}
