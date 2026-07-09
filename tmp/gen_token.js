require('dotenv').config();
const jwt = require('../backend/node_modules/jsonwebtoken');

const token = jwt.sign(
  { id: 20, username: 'Theressa', role: 'farmer', full_name: 'Terisa Beaty Pagkalinawan', email: 'dhelhilis@gmail.com' },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }
);

console.log(token);
