
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

//variables constastes (osea no cambian jjaja) que nos ayudan a obtener 
// la ruta del proyecto y del backend para poder cargar el archivo .env correctamente

const currentDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(currentDir, '../../');
const projectRoot = resolve(backendRoot, '../');

dotenv.config({ path: resolve(backendRoot, '.env') });
dotenv.config({ path: resolve(projectRoot, '.env') });


// este confirma que la base de datos se haya conectado de forma corecta sin ningun inconveniente  
if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL. Verifica el archivo .env en backend o en la raíz del proyecto.');
}

// variable que se connecta a la base de datos y maneja la conexion de la BD de postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

//este lo que hace es mandar un error en caso que la base de datos no se conecte (osea un mensaje)
pool.on('error', (error) => {
  console.error('Error inesperado en una conexión inactiva de PostgreSQL:', error);
});

export default pool;
