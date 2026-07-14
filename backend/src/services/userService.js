'use strict';
/** 用户 & 角色权限读取。 */
const { all } = require('../core/db');
function listUsers() { return all('SELECT * FROM users ORDER BY id'); }
function listRoles() { return all('SELECT * FROM roles ORDER BY id'); }
module.exports = { listUsers, listRoles };
