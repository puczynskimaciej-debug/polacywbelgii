import { cmsRequest } from './client.js';
export class CmsAuth {
  async session() { return (await cmsRequest('cms-auth', { action: 'session' })).user; }
  async login(email, password) { return (await cmsRequest('cms-auth', { action: 'login' }, 'POST', { email, password })).user; }
  async logout() { await cmsRequest('cms-auth', { action: 'logout' }, 'POST', {}); location.assign('/admin/'); }
  async changePassword(currentPassword, password) { return cmsRequest('cms-auth', { action: 'password' }, 'POST', { currentPassword, password }); }
  async users() { return (await cmsRequest('cms-auth', { action: 'users' })).users; }
  async saveUser(user) { return cmsRequest('cms-auth', { action: 'users' }, user.id ? 'PUT' : 'POST', user); }
}
