import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger.js';

const storageProvider = process.env.STORAGE_PROVIDER || 'local';
const uploadDir = process.env.UPLOAD_DIR || 'uploads';

// Local storage directory setup
const fullUploadPath = path.resolve(uploadDir);
if (!fs.existsSync(fullUploadPath)) {
  fs.mkdirSync(fullUploadPath, { recursive: true });
}

/**
 * Storage Service Abstraction Layer
 * (Local Disk Storage Provider -> Replaceable by Cloud S3 Provider)
 */
export const saveUploadedFile = async (file) => {
  if (storageProvider === 'local') {
    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    const destinationPath = path.join(fullUploadPath, filename);

    if (file.buffer) {
      fs.writeFileSync(destinationPath, file.buffer);
    } else if (file.path) {
      fs.copyFileSync(file.path, destinationPath);
    }

    const publicUrl = `/uploads/${filename}`;
    logger.info(`File saved to local storage: ${publicUrl}`);
    return publicUrl;
  }

  // Future AWS S3 / Cloud Storage Provider Branch
  return `/uploads/sample_${Date.now()}.png`;
};

export const deleteUploadedFile = async (fileUrl) => {
  if (storageProvider === 'local' && fileUrl && fileUrl.startsWith('/uploads/')) {
    const filename = path.basename(fileUrl);
    const filePath = path.join(fullUploadPath, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Deleted file from local storage: ${filePath}`);
    }
  }
};
