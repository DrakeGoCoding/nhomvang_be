const bcrypt = require("bcrypt");
const User = require("@models/user");
const Cart = require("@models/cart");
const { generateToken } = require("@utils/token");
const { responseUser, responseCart } = require("@utils/responsor");
const AppError = require("@utils/appError");
const { WRONG_AUTH_INPUT, FOUND_USER, MISSING_OLD_PASSWORD, INCORRECT_PASSWORD } = require("@constants/error");

/**
 * Login a registered account
 * @param {String} username
 * @param {String} password
 * @DrakeGoCoding 11/11/2021
 */
const login = async (username, password) => {
    // check if username exists and password is correct
    const user = await User.findOne({ username }).select("+hash");
    if (!user || !(await user.isCorrectPassword(password, user.hash))) {
        throw new AppError(401, "fail", WRONG_AUTH_INPUT);
    }

    // generate a new token
    const token = generateToken(user._id);
    return {
        statusCode: 200,
        data: {
            token,
            user: responseUser(user.toJSON())
        }
    };
};

/**
 * Register a new user account (role="user")
 * @param {String} username
 * @param {String} password
 * @DrakeGoCoding 11/10/2021
 */
const register = async (username, password) => {
    // check if username is registered
    const foundUser = await User.findOne({ username });
    if (foundUser) {
        throw new AppError(400, "fail", FOUND_USER);
    }

    // generate salt then hash password
    const saltRounds = Number.parseInt(process.env.SALT_ROUNDS);
    const salt = bcrypt.genSaltSync(saltRounds);
    const hash = bcrypt.hashSync(password, salt);

    // save user
    const user = new User({ username, hash, salt, isSubscribing: true });
    await user.save();

    // generate a new token
    const token = generateToken(user._id);

    // generate a new cart for user
    const cart = new Cart({ user: user._id });
    await cart.save();

    return {
        statusCode: 201,
        data: {
            token,
            user: responseUser(user.toJSON())
        }
    };
};

/**
 * Update user account
 * @param {User} user
 * @DrakeGoCoding 11/22/2021
 */
const updateUser = async user => {
    const { username, password, oldPassword } = user;
    let hash, salt;
    let updatedUser;

    if (password && !oldPassword) {
        throw new AppError(400, "fail", MISSING_OLD_PASSWORD);
    }

    updatedUser = await User.findOne({ username }).select("+hash +salt");
    if (!updatedUser) {
        throw new AppError(404, "fail", NOT_FOUND_USER);
    }

    if (password && oldPassword) {
        const oldHash = bcrypt.hashSync(oldPassword, updatedUser.salt);
        if (updatedUser.hash !== oldHash) {
            throw new AppError(400, "fail", INCORRECT_PASSWORD);
        }

        const saltRounds = Number.parseInt(process.env.SALT_ROUNDS);
        salt = bcrypt.genSaltSync(saltRounds);
        hash = bcrypt.hashSync(password, salt);
    }

    updatedUser = Object.assign(updatedUser, {
        ...user,
        hash: hash || updatedUser.hash,
        salt: salt || updatedUser.salt
    });
    updatedUser = await updatedUser.save();

    return {
        statusCode: 200,
        data: { user: responseUser(updatedUser.toJSON()) }
    };
};

module.exports = {
    login,
    register,
    updateUser
};
