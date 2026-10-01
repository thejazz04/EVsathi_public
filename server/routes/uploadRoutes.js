import express from 'express';
import { uploadMiddleware, uploadImages, deleteImage } from '../controllers/uploadController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/images', protect, uploadMiddleware, uploadImages);
router.delete('/images', protect, deleteImage);

export default router;
