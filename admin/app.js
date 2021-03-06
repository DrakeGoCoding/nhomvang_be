const express = require("express");
const authRoute = require("@admin/routes/auth.route");
const newsRoute = require("@admin/routes/news.route");
const userRoute = require("@admin/routes/user.route");
const productRoute = require("@admin/routes/product.route");
const invoiceRoute = require("@admin/routes/invoice.route");
const newsletterRoute = require("@admin/routes/newsletter.route");
const notificationRoute = require("@admin/routes/notification.route");
const { authenticate, restrictTo } = require("@middlewares/auth.middleware");

const admin = express();

admin.use("/auth", authRoute);

admin.use(authenticate);
admin.use(restrictTo("admin"));

admin.use("/news", newsRoute);
admin.use("/users", userRoute);
admin.use("/products", productRoute);
admin.use("/invoices", invoiceRoute);
admin.use("/newsletter", newsletterRoute);
admin.use("/notifications", notificationRoute);

module.exports = admin;
