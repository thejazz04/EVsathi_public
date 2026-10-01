import multer from 'multer';
import { saveUploadedFile, deleteUploadedFile } from '../services/storage/storage.service.js';

// Multer in-memory storage parser
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
}).array('images', 10);

export const uploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILES', message: 'No images uploaded' },
      });
    }

    const savedUrls = [];
    for (const file of req.files) {
      const url = await saveUploadedFile(file);
      savedUrls.push(url);
    }

    res.status(200).json({
      success: true,
      data: { images: savedUrls },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteImage = async (req, res, next) => {
  try {
    const { imageUrl } = req.body;
    if (imageUrl) {
      await deleteUploadedFile(imageUrl);
    }
    res.status(200).json({
      success: true,
      message: 'Image deleted',
    });
  } catch (error) {
    next(error);
  }
};
