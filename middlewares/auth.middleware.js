const jwt = require("jsonwebtoken");
const User = require("@models/user");
const AppError = require("@utils/appError");
const { INVALID_TOKEN, FORBIDDEN, LOGIN_REQUIRED, NOT_FOUND_USER } = require("@constants/error");

const authenticate = async (req, res, next) => {
    // check if token exists
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
        next(new AppError(401, "fail", LOGIN_REQUIRED));
        return;
    }

    // verify token
    jwt.verify(token, process.env.JWT_SECRET, async (err, payload) => {
        if (err) {
            next(new AppError(401, "fail", INVALID_TOKEN));
            return;
        }
        // check if user exists
        const user = await User.findById(payload.id).exec();
        if (!user) {
            next(new AppError(401, "fail", NOT_FOUND_USER));
            return;
        }
        req.user = user.toJSON();
        next();
    });
};

const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            const err = new AppError(403, "fail", FORBIDDEN);
            next(err, req, res, next);
        }
        next();
    };
};

module.exports = {
    authenticate,
    restrictTo
};
