import Joi from 'joi';

export const createBookingSchema = Joi.object({
  chargerId: Joi.string().required(),
  slotId: Joi.string().optional().allow('', null),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
});
