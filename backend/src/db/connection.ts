
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(currentDir, '../../');
const projectRoot = resolve(backendRoot, '../');

dotenv.config({ path: resolve(backendRoot, '.env') });
dotenv.config({ path: resolve(projectRoot, '.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL. Verifica el archivo .env en backend o en la raíz del proyecto.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (error) => {
  console.error('Error inesperado en una conexión inactiva de PostgreSQL:', error);
});

export default pool;
