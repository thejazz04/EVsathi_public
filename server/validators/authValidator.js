import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().min(8).required().pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'password strength'),
  role: Joi.string().valid('driver', 'DRIVER', 'HOST', 'host', 'both', 'BOTH', 'owner', 'OWNER', 'renter', 'RENTER').default('driver'),
  phone: Joi.string().allow('', null),
  vehicle: Joi.object({
    make: Joi.string().allow(''),
    model: Joi.string().allow(''),
    year: Joi.number().integer().allow(null),
    licensePlate: Joi.string().allow(''),
  }).optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().required(),
  role: Joi.string().valid('driver', 'DRIVER', 'host', 'HOST', 'owner', 'OWNER', 'both', 'BOTH').optional(),
});

export const validateRequest = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const message = error.details.map((d) => d.message).join(', ');
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: message,
      },
    });
  }
  req.body = value;
  next();
};
