const invoiceService = require("@services/invoice.service");
const AppError = require("@utils/appError");
const { MISSING_INVOICE_PRODUCTS, INVALID_INVOICE_PRODUCTS, MISSING_INVOICE_ID } = require("@constants/error");

const getAllInvoices = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { statusCode, data } = await invoiceService.getAllInvoices(userId);
        res.status(statusCode).json(data);
    } catch (error) {
        next(error);
    }
};

const getInvoice = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const invoiceId = req.params.invoiceId;
        if (!invoiceId) {
            throw new AppError(400, "fail", MISSING_INVOICE_ID);
        }

        const { statusCode, data } = await invoiceService.getInvoice(userId, invoiceId);
        res.status(statusCode).json(data);
    } catch (error) {
        next(error);
    }
};

const createInvoice = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { products, paymentMethod } = req.body.invoice;
        if (!Array.isArray(products) || !products.length) {
            throw new AppError(400, "fail", MISSING_INVOICE_PRODUCTS);
        }

        const requiredProps = ["_id", "listedPrice", "quantity"];
        const isValidProducts = products.every(product => {
            return requiredProps.every(prop => Object.hasOwn(product, prop));
        });

        if (!isValidProducts) {
            throw new AppError(400, "fail", INVALID_INVOICE_PRODUCTS);
        }

        const { statusCode, data } = await invoiceService.createInvoice(userId, products, paymentMethod);
        res.status(statusCode).json(data);
    } catch (error) {
        next(error);
    }
};

const cancelInvoice = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const invoiceId = req.params.invoiceId;
        if (!invoiceId) {
            throw new AppError(400, "fail", MISSING_INVOICE_ID);
        }

        const { statusCode, data } = await invoiceService.cancelInvoice(userId, invoiceId);
        res.status(statusCode).json(data);
    } catch (error) {
        next(error);
    }
};

const payWithPaypal = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const invoiceId = req.params.invoice;
        if (!invoiceId) {
            throw new AppError(400, "fail", MISSING_INVOICE_ID);
        }

        const { statusCode, data } = await invoiceService.payWithPaypal(userId, invoiceId);
        res.status(statusCode).json(data);
    } catch (error) {
        next(error);
    }
};

const payWithStripe = async (req, res, next) => {
    try {
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllInvoices,
    getInvoice,
    createInvoice,
    cancelInvoice,
    payWithPaypal,
    payWithStripe
};