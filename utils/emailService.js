const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendNewAccountEmail = async (email, fullName, tempLoginToken) => {
    const username = email.split('@')[0];
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Tài khoản nhân viên mới đã được tạo',
        html: `
            <h1>Chào mừng ${fullName} đến với hệ thống của chúng tôi!</h1>
            <p>Tài khoản của bạn đã được tạo thành công.</p>
            <p>Tên người dùng của bạn là: ${username}</p>
            <p>Mật khẩu tạm thời của bạn cũng là: ${username}</p>
            <p>Vui lòng sử dụng liên kết sau để đăng nhập vào hệ thống và đổi mật khẩu (có hiệu lực trong 1 phút):</p>
            <a href="${process.env.FRONTEND_URL}/login?email=${encodeURIComponent(email)}&token=${tempLoginToken}">Đăng nhập</a>
            <p>Nếu liên kết hết hạn, vui lòng liên hệ với quản trị viên để được gửi lại email.</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email đã được gửi thành công');
    } catch (error) {
        console.error('Lỗi khi gửi email:', error);
        throw error;
    }
};
