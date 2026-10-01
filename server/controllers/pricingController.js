import { getPrice } from '../services/pricing/pricing.service.js';

export const getPricingInfo = async (req, res, next) => {
  try {
    const chargerId = req.params.chargerId || req.params.id;
    const { startTime, endTime } = req.query;

    const pricingInfo = await getPrice({ chargerId, startTime, endTime });

    res.status(200).json({
      success: true,
      data: pricingInfo,
    });
  } catch (error) {
    next(error);
  }
};
