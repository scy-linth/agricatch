require('dotenv').config();
const jwt = require('../backend/node_modules/jsonwebtoken');
const fs = require('fs');

const customer21 = { id: 21, username: 'QAtester', role: 'customer', full_name: 'QAtester', email: 'ferrancojade99@gmail.com' };
const token = jwt.sign(customer21, process.env.JWT_SECRET, { expiresIn: '30d' });
fs.writeFileSync('tmp/token_customer21.json', JSON.stringify({ token }));
