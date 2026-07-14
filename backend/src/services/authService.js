'use strict';
/** 鉴权（MVP 用角色直登，生产应接 SSO / 飞书 OAuth，见 PRD 六）。 */
const USERS = {
  uploader: { role: 'uploader', name: '李晓华' },
  reviewer: { role: 'reviewer', name: '王审核' },
  admin: { role: 'admin', name: '钱进' }
};
function login({ role }) {
  if (!role || !USERS[role]) return null;
  return { token: 'mock-' + role + '-' + Date.now(), role, name: USERS[role].name };
}
function me(role) {
  if (!role || !USERS[role]) return null;
  return { role, name: USERS[role].name };
}
module.exports = { login, me };
