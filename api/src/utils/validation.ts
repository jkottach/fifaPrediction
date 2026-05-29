import Joi from 'joi';

export const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().min(2).required(),
    lastName: Joi.string().min(2).required(),
    password: Joi.string().min(6).optional(),
    phoneNumber: Joi.string().trim().required(),
    city: Joi.string().allow('', null),
    state: Joi.string().allow('', null),
    country: Joi.string().allow('', null),
    communityId1: Joi.string().allow('', null).optional(),
    communityId2: Joi.string().allow('', null).optional(),
  }),

  updateProfile: Joi.object({
    firstName: Joi.string().min(2).optional(),
    lastName: Joi.string().min(2).optional(),
    phoneNumber: Joi.string().trim().optional(),
    city: Joi.string().allow('', null).optional(),
    state: Joi.string().allow('', null).optional(),
    country: Joi.string().allow('', null).optional(),
    communityId1: Joi.string().allow('', null).optional(),
    communityId2: Joi.string().allow('', null).optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().optional(),
  }),

  googleLogin: Joi.object({
    credential: Joi.string().required(),
  }),


  prediction: Joi.object({
    matchId: Joi.string().required(),
    team1Score: Joi.number().min(0).required(),
    team2Score: Joi.number().min(0).required(),
    comment: Joi.string().allow('', null).optional(),
  }),

  tournamentPrediction: Joi.object({
    champion: Joi.string().trim().uppercase().length(3).required(),
    finalists: Joi.array()
      .items(Joi.string().trim().uppercase().length(3))
      .length(2)
      .required(),
    semifinalists: Joi.array()
      .items(Joi.string().trim().uppercase().length(3))
      .length(4)
      .required(),
    groupChampions: Joi.object()
      .pattern(Joi.string().trim().uppercase().max(3), Joi.string().trim().uppercase().length(3))
      .default({}),
  }),

  match: Joi.object({
    matchId: Joi.string().optional(),
    sequence: Joi.number().required(),
    team1: Joi.string().required(),
    team2: Joi.string().required(),
    matchTime: Joi.date().required(),
    predictionsEndingTime: Joi.date().required(),
    round: Joi.string().trim().required(),
    group: Joi.string().trim().allow('', null).optional(),
    matchTag: Joi.string().allow('', null).optional(),
    comment: Joi.string().allow('', null).optional(),
  }),
};

export const validateRequest = (schema: Joi.Schema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      console.error('Validation error:', error.details);
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    req.validatedBody = value;
    next();
  };
};
