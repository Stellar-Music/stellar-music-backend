import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a'];
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'audio') {
      if (ALLOWED_AUDIO_EXTENSIONS.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid audio format: ${ext}. Allowed extensions: ${ALLOWED_AUDIO_EXTENSIONS.join(', ')}`));
      }
    } else if (file.fieldname === 'artwork') {
      if (ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid artwork format: ${ext}. Allowed extensions: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}`));
      }
    } else {
      cb(null, true);
    }
  },
});
