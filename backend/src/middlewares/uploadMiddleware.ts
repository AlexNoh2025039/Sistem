
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const uploadDirectory = resolve(currentDirectory, '../../uploads');

mkdirSync(uploadDirectory, { recursive: true });

const allowedTypes: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (_req, file, callback) => {
    const extension = allowedTypes[file.mimetype];
    callback(null, `${randomUUID()}${extension}`);
  },
});

const createImageUploader = (maxFileSize: number) =>
  multer({
    storage,
    limits: {
      fileSize: maxFileSize,
      files: 1,
    },
    fileFilter: (_req, file, callback) => {
      if (!allowedTypes[file.mimetype]) {
        return callback(
          new Error('Solo se permiten imágenes JPG, PNG o WebP.'),
        );
      }

      callback(null, true);
    },
  });

export const uploadProfilePhoto = createImageUploader(
  2 * 1024 * 1024,
);

export const uploadProductImage = createImageUploader(
  5 * 1024 * 1024,
);
