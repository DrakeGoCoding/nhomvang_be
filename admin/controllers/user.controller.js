const userService = require('@admin/services/user.service');
const AppError = require('@utils/appError');
const {
	MISSING_AUTH_INPUT,
	MISSING_USER_INPUT
} = require('@constants/error');

const getAllUsers = async (req, res, next) => {
	try {
		const { limit, offset, ...filter } = req.query;
		const { statusCode, data } = await userService.getAllUsers(filter, limit, offset);
		res.status(statusCode).json(data);
	} catch (error) {
		next(error);
	}
}

const createUser = async (req, res, next) => {
	try {
		const { username, password } = req.body.user;

		// check if username and password are filled
		if (!username || !password) {
			throw new AppError(400, "fail", MISSING_AUTH_INPUT);
		}

		const { statusCode, data } = await userService.createUser(username, password);
		res.status(statusCode).json(data);
	} catch (error) {
		next(error);
	}
}

const updateUser = async (req, res, next) => {
	try {
		const { username } = req.params;

		// check if username is filled
		if (!username) {
			throw new AppError(400, "fail", MISSING_USER_INPUT);
		}

		const user = Object.assign(req.body.user, {
			username: undefined,
			hash: undefined,
			salt: undefined,
			role: undefined,
			createdDate: undefined,
			modifiedDate: Date.now(),
		});

		const { statusCode, data } = await userService.updateUser(username, user);
		res.status(statusCode).json(data);
	} catch (error) {
		next(error);
	}
}

const deleteUser = async (req, res, next) => {
	try {
		const { username } = req.params;

		// check if username is filled
		if (!username) {
			throw new AppError(400, "fail", MISSING_USER_INPUT);
		}

		const { statusCode, data } = await userService.deleteUser(username);
		res.status(statusCode).json(data);
	} catch (error) {
		next(error);
	}
}

module.exports = {
	getAllUsers,
	createUser,
	updateUser,
	deleteUser
}