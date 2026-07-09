require('dotenv').config();
const jwt = require('../backend/node_modules/jsonwebtoken');

const token = jwt.sign(
  { id: 19, username: 'trial', role: 'customer', full_name: 'Trial Customer', email: 'ianamata666@gmail.com' },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }
);

console.log(token);
