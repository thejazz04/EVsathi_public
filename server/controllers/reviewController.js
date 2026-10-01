import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import Charger from '../models/Charger.js';

export const createReview = async (req, res, next) => {
  try {
    const { bookingId, chargerId, rating, comment } = req.body;
    let booking;

    if (bookingId) {
      booking = await Booking.findById(bookingId);
    } else if (chargerId) {
      // Find the user's booking for this charger
      const existingReviews = await Review.find({ user: req.user._id, charger: chargerId }).select('booking');
      const reviewedBookingIds = existingReviews.map((r) => String(r.booking));

      const userBookings = await Booking.find({
        charger: chargerId,
        $or: [{ driver: req.user._id }, { user: req.user._id }],
      }).sort({ createdAt: -1 });

      if (!userBookings || userBookings.length === 0) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ELIGIBILITY_REQUIRED',
            message: 'You can only review chargers where you have booked or completed a charging session.',
          },
        });
      }

      booking = userBookings.find((b) => !reviewedBookingIds.includes(String(b._id)));
      if (!booking) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ALREADY_REVIEWED',
            message: 'You have already reviewed your session at this charging station.',
          },
        });
      }
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      });
    }

    const review = await Review.create({
      booking: booking._id,
      charger: booking.charger?._id || booking.charger,
      user: req.user._id,
      rating: Number(rating),
      comment: comment || '',
    });

    // Recalculate Charger Average Rating
    const targetChargerId = booking.charger?._id || booking.charger;
    const reviews = await Review.find({ charger: targetChargerId });
    const avgRating = Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1));
    await Charger.findByIdAndUpdate(targetChargerId, {
      rating: avgRating,
      totalRatings: reviews.length,
    });

    res.status(201).json({
      success: true,
      data: { review },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_REVIEWED', message: 'You have already reviewed this booking' },
      });
    }
    next(error);
  }
};

export const updateReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Review not found' },
      });
    }

    if (String(review.user) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to edit this review' },
      });
    }

    if (rating) review.rating = Number(rating);
    if (comment !== undefined) review.comment = comment;
    await review.save();

    res.status(200).json({
      success: true,
      data: { review },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Review not found' },
      });
    }

    if (String(review.user) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to delete this review' },
      });
    }

    await review.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getChargerReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ charger: req.params.chargerId })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { reviews },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ user: req.params.userId })
      .populate('charger', 'title location')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { reviews },
    });
  } catch (error) {
    next(error);
  }
};
