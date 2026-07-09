require('dotenv').config();
const jwt = require('../backend/node_modules/jsonwebtoken');
const fs = require('fs');

const users = {
  customer155: { id: 155, username: 'aa23_920', role: 'customer', full_name: 'Customer 155', email: 'andrhea099@gmail.com' },
  customer19:  { id: 19,  username: 'trial',   role: 'customer', full_name: 'Trial Customer', email: 'ianamata666@gmail.com' },
  farmer42:    { id: 42,  username: 'testfarmer', role: 'farmer', full_name: 'Test Farmer', email: 'testfarmer42@test.com' },
  farmer20:    { id: 20,  username: 'Theressa', role: 'farmer', full_name: 'Terisa Beaty Pagkalinawan', email: 'dhelhilis@gmail.com' },
  admin43:     { id: 43,  username: 'testadmin', role: 'admin', full_name: 'Test Admin', email: 'testadmin@test.com' },
  superadmin5: { id: 5,   username: 'scy_linth', role: 'super_admin', full_name: 'Scy', email: 'scy@linth' }
};

const tokens = {};
for (const [key, user] of Object.entries(users)) {
  tokens[key] = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '30d' });
}

fs.writeFileSync('tmp/regression_tokens.json', JSON.stringify(tokens, null, 2));
console.log('Tokens written to tmp/regression_tokens.json');
