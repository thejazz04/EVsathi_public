import { getRoute, getReroute, getNearbyChargersOnRoute } from '../services/navigation/navigation.service.js';

export const computeRoute = async (req, res, next) => {
  try {
    const { start, end } = req.body;
    const route = await getRoute(start, end);

    res.status(200).json({
      success: true,
      data: route,
    });
  } catch (error) {
    next(error);
  }
};

export const computeReroute = async (req, res, next) => {
  try {
    const { currentLocation, destination, routeId } = req.body;
    const route = await getReroute(currentLocation, destination, routeId);

    res.status(200).json({
      success: true,
      data: route,
    });
  } catch (error) {
    next(error);
  }
};

export const getNearbyNavChargers = async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 10 } = req.query;
    const chargers = await getNearbyChargersOnRoute(Number(latitude), Number(longitude), Number(radius));

    res.status(200).json({
      success: true,
      data: { chargers },
    });
  } catch (error) {
    next(error);
  }
};
