import { cmsRequest } from './client.js';
export class ContentApi {
  async list(path) { return cmsRequest('cms-content', { path }); }
  async read(path) { const file = await this.list(path); return { ...file, text: decodeBase64(file.content) }; }
  async writeText(path, text, message, sha) { return this.writeBinary(path, new TextEncoder().encode(text), message, sha); }
  async writeBinary(path, bytes, _message, sha) { return cmsRequest('cms-content', { path }, 'PUT', { content: encodeBytes(bytes), ...(sha ? { sha } : {}) }); }
  async remove(path, sha, _message) { return cmsRequest('cms-content', { path }, 'DELETE', { sha }); }
  async commits() { return cmsRequest('cms-content', { action: 'history' }); }
}
function decodeBase64(value) {
  const binary = atob(value.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
}
function encodeBytes(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}
