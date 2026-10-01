import Joi from 'joi';

export const createChargerSchema = Joi.object({
  title: Joi.string().required().trim().min(3).max(150),
  description: Joi.string().allow('').max(1000),
  chargerType: Joi.string().default('Level 2'),
  connectorType: Joi.string().default('Type 2'),
  powerOutput: Joi.number().positive().required(),
  pricePerHour: Joi.number().min(0).required(),
  pricePerKwh: Joi.number().min(0).optional().allow(null),
  location: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    country: Joi.string().default('India'),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
    }).required(),
  }).required(),
  amenities: Joi.array().items(Joi.string()).default([]),
  images: Joi.array().items(Joi.string()).default([]),
  availabilitySchedule: Joi.array().items(
    Joi.object({
      dayOfWeek: Joi.number().min(0).max(6).required(),
      startHour: Joi.number().min(0).max(23).default(0),
      endHour: Joi.number().min(1).max(24).default(24),
    })
  ).optional(),
});
