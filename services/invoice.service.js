const Invoice = require("@models/invoice");
const Notification = require("@models/notification");
const Cart = require("@models/cart");
const { responseInvoice } = require("@utils/responsor");
const AppError = require("@utils/appError");
const {
    FORBIDDEN,
    NOT_FOUND_INVOICE,
    NOT_FOUND_CART,
    NOT_FOUND_PRODUCT_IN_CART,
    UNKNOWN_PAYMENT_METHOD
} = require("@constants/error");
const { createPayment, executePayment, refundPayment, getPaymentById } = require("@utils/paypal");

/**
 * Get all invoices by user id
 * @param {String} userId
 * @param {{
 * 		status: String
 * }} filter
 * @param {Number} limit
 * @param {Number} offset
 * @DrakeGoCoding 12/19/2021
 */
const getAllInvoices = async (userId, filter = {}, limit = 10, offset = 0) => {
    const query = {
        $and: [{ user: userId }]
    };
    if (filter.status) {
        query.$and.push({ status: filter.status });
    }
    const result = await Invoice.collection.find(query).sort({ modifiedDate: -1 });
    const total = await result.count();
    const invoiceList = await result.skip(offset).limit(limit).toArray();
    return {
        statusCode: 200,
        data: {
            invoiceList: invoiceList.map(invoice => responseInvoice(invoice)),
            total
        }
    };
};

/**
 * Get invoice by id
 * @param {String} userId
 * @param {String} invoiceId
 * @DrakeGoCoding 12/19/2021
 */
const getInvoice = async (userId, invoiceId) => {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
        throw new AppError(404, "fail", NOT_FOUND_INVOICE);
    }

    if (invoice.user.toString() !== userId.toString()) {
        throw new AppError(403, "fail", FORBIDDEN);
    }

    return {
        statusCode: 200,
        data: {
            invoice: responseInvoice(invoice.toJSON())
        }
    };
};

/**
 * Create a new invoice
 * @param {String} userId
 * @param {Array} products
 * @DrakeGoCoding 12/15/2021
 */
const createInvoice = async (userId, username, products) => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
        throw new AppError(404, "fail", NOT_FOUND_CART);
    }

    let total = 0;
    let discountTotal = 0;
    const toRemoveFromCart = [];
    for (const product of products) {
        const { _id, quantity, listedPrice, discountPrice } = product;
        if (cart.items.findIndex(item => item._id.toString() === _id.toString()) >= 0) {
            total += listedPrice * quantity;
            discountTotal += (discountPrice || listedPrice) * quantity;
            toRemoveFromCart.push(_id);
        }
    }

    if (toRemoveFromCart.length === 0) {
        throw new AppError(400, "fail", NOT_FOUND_PRODUCT_IN_CART);
    }

    cart.items = cart.items.filter(item => !toRemoveFromCart.includes(item._id.toString()));
    products = products.filter(product => toRemoveFromCart.findIndex(item => item._id === product._id) < 0);

    const newInvoice = await Invoice.create({
        user: userId,
        products,
        total: parseFloat(total.toFixed(2)),
        discountTotal: parseFloat(discountTotal.toFixed(2)),
        logs: [
            {
                user: username,
                action: "create"
            }
        ]
    });

    await cart.save();

    Notification.create({
        user: userId,
        action: "created a new invoice",
        link: `/invoices/${newInvoice._id}`
    });

    return {
        statusCode: 201,
        data: { invoice: responseInvoice(newInvoice.toJSON()) }
    };
};

const payInvoice = async (userId, invoiceId, paymentMethod) => {
    switch (paymentMethod) {
        case "paypal":
            return await payWithPaypal(userId, invoiceId);
        case "stripe":
            return await payWithStripe(userId, invoiceId);
        default:
            throw new AppError(400, "fail", UNKNOWN_PAYMENT_METHOD);
    }
};

/**
 * Cancel an invoice with invoice id and user id
 * @param {String} userId
 * @param {String} invoiceId
 */
const cancelInvoice = async (userId, invoiceId) => {
    const invoice = await Invoice.findOne({ _id: invoiceId, user: userId }).populate("user");
    if (!invoice) {
        throw new AppError(404, "fail", NOT_FOUND_INVOICE);
    }

    if (invoice.status === "in_progress" || invoice.status === "delivered") {
        throw new AppError(403, "fail", FORBIDDEN);
    }

    if (invoice.paymentStatus === "done" && invoice.paymentId) {
        const payment = await getPaymentById(invoice.paymentId);
        const amount = invoice.discountTotal || invoice.total;
        const saleId = payment.transactions[0].related_resources[0].sale.id;
        await refundPayment(saleId, amount);
    }

    invoice.status = "failed";
    invoice.paymentStatus = "cancel";
    invoice.logs.push({
        user: invoice.user.username,
        action: "cancel"
    });
    await invoice.save();

    Notification.create({
        user: invoice.user,
        action: `cancelled invoice ${invoiceId}`,
        link: `/invoices/${invoiceId}`
    });

    return {
        statusCode: 200,
        data: { status: "success", invoice: invoiceId }
    };
};

const payWithPaypal = async (userId, invoiceId) => {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
        throw new AppError(404, "fail", NOT_FOUND_INVOICE);
    }

    if (invoice.user.toString() !== userId.toString()) {
        throw new AppError(403, "fail", FORBIDDEN);
    }

    const payment = await createPayment(invoice);
    const approveUrl = payment.links.find(link => link.rel === "approval_url");

    return {
        statusCode: payment.httpStatusCode,
        data: { url: approveUrl.href }
    };
};

const payWithPaypalSuccess = async (paymentId, payerId) => {
    const payment = await executePayment(paymentId, payerId);
    const invoiceId = payment.transactions[0].invoice_number;

    const invoice = await Invoice.findById(invoiceId).populate("user");
    invoice.paymentMethod = "paypal";
    invoice.paymentStatus = "done";
    invoice.paymentId = paymentId;
    invoice.logs.push({
        user: invoice.user.username,
        action: "change_status",
        prevStatus: invoice.status,
        nextStatus: "in_progress"
    });
    invoice.status = "in_progress";
    await invoice.save();

    Notification.create({
        user: invoice.user,
        action: `paid for invoice ${invoiceId}`,
        link: `/invoices/${invoiceId}`
    });

    return {
        statusCode: 200,
        url: `${process.env.APP_END_USER}/me/orders`
    };
};

const payWithPaypalCancel = async () => {
    return {
        statusCode: 200,
        url: `${process.env.APP_END_USER}/me/orders`
    };
};

const payWithStripe = async (userId, invoiceId) => {
    return {
        statusCode: 200,
        data: { userId, invoiceId }
    };
};

module.exports = {
    getAllInvoices,
    getInvoice,
    createInvoice,
    payInvoice,
    cancelInvoice,
    payWithPaypal,
    payWithPaypalSuccess,
    payWithPaypalCancel,
    payWithStripe
};
