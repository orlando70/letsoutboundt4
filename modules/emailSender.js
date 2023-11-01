
const nodemailer = require('nodemailer')
const { regCodeEmailContent, outboundEmailNotFoundContent, outboundEmailDataNotFound, TaskCompletionEmail } = require('./emailContents')


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PASS,
    }
})



const sendRegistrationCode = (receiverName, receiverEmail, code) => {
    return new Promise((resolve, reject) => {
        const emailContent = regCodeEmailContent(receiverName, code);
        const mailOptions = {
            from: '"Chima | Lets Outbound" <info@letsoutbound.com>',
            to: receiverEmail,
            subject: "Welcome to Let's Outbound",
            html: emailContent
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                reject("failed to send");
            } else {
                resolve("email sent");
            }
        });
    });
};

const sendOutboundEmailNotFound = (receiverEmail, outbondName, taskName, senderEmail) => {
    return new Promise((resolve, reject) => {
        const emailContent = outboundEmailNotFoundContent(outbondName, taskName, senderEmail);
        const mailOptions = {
            from: '"Chima | Lets Outbound" <info@letsoutbound.com>',
            to: receiverEmail,
            subject: "Email not Sent!",
            text: emailContent
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                reject("failed to send");
            } else {
                resolve("email sent");
            }
        });
    });
};
const sendOutboundEmailDataNotFound = (receiverEmail, outbondName, taskName) => {
    return new Promise((resolve, reject) => {
        const emailContent = outboundEmailDataNotFound(outbondName, taskName);
        const mailOptions = {
            from: '"Chima | Lets Outbound" <info@letsoutbound.com>',
            to: receiverEmail,
            subject: "Task Stopped -  Email Data not Found",
            html: emailContent
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                reject("failed to send");
            } else {
                resolve("email sent");
            }
        });
    });
};
const sendTaskCompletionEmail = (receiverEmail, outbondName, taskName) => {
    return new Promise((resolve, reject) => {
        const emailContent = TaskCompletionEmail(outbondName, taskName);
        const mailOptions = {
            from: '"Chima|Lets Outbound" <info@letsoutbound.com>',
            to: receiverEmail,
            subject: "Watchout for Replies",
            text: emailContent
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                reject("failed to send");
            } else {
                resolve("email sent");
            }
        });
    });
};






module.exports = {
    sendRegistrationCode,
    sendOutboundEmailNotFound,
    sendOutboundEmailDataNotFound,
    sendTaskCompletionEmail
}