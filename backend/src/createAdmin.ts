
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from './db/connection.js';

const createAdmin = async () => {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.error('Usage: pnpm exec tsx src/createAdmin.ts <username> <password>');
    process.exitCode = 1;
    return;
  }

  if (
    username.trim().length < 1 ||
    username.trim().length > 50 ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    console.error('Username must have 1-50 characters and password must have 8-72 bytes.');
    process.exitCode = 1;
    return;
  }

  try {
    const existingUser = await pool.query(
      'SELECT id FROM usuarios WHERE username = $1',
      [username.trim()],
    );

    if (existingUser.rows.length > 0) {
      console.error('That username already exists. No changes were made.');
      process.exitCode = 1;
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO usuarios (username, password, rol) VALUES ($1, $2, $3)',
      [username.trim(), passwordHash, 'admin'],
    );

    console.log(`Administrator "${username.trim()}" created successfully.`);
  } catch (error) {
    console.error('Could not create administrator:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

void createAdmin();
