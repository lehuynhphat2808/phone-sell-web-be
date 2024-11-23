var createError = require('http-errors');
var express = require('express');
const session = require('express-session');  // Thêm dòng này
require('dotenv').config();
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const axios = require('axios');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const userDAO = require('./dao/UserDAO');
const { authenticateToken } = require('./middleware/auth');
const orderDAO = require('./dao/OrderDAO');
// Import các router mới
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var categoriesRouter = require('./routes/categories');
var vouchersRouter = require('./routes/vouchers');
var ordersRouter = require('./routes/orders');
var productsRouter = require('./routes/products');
var commentsRouter = require('./routes/comments'); // Thêm dòng này
var cartRouter = require('./routes/carts'); // Thêm dòng này
const uploadsRouter = require('./routes/uploads');
const privacyPolicyRouter = require('./routes/privacyPolicy');
const termsOfServiceRouter = require('./routes/termsOfService'); // Thêm dòng này
const dataDeleteRouter = require('./routes/dataDelete');
const dataDeletionInstructionsRouter = require('./routes/dataDeletionInstructions');

var ENV_CONFIG = require('./config/env');
var app = express();

// Cấu hình express-session
app.use(session({
  secret: process.env.SESSION_SECRET,  // Thay thế bằng một chuỗi bí mật của riêng bạn
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }  // Đặt thành true nếu bạn sử dụng HTTPS
}));

app.use(cors());
//swagger
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger-output.json');
const host = process.env.NODE_ENV === 'production'
  ? 'https://nha-trang-sea-food-rcfdmqtop-ps-projects-6fd1b1d9.vercel.app'
  : 'localhost:3000';

swaggerDocument.host = host;

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/categories', categoriesRouter);
app.use('/vouchers', vouchersRouter);
app.use('/orders', ordersRouter);
app.use('/products', productsRouter);
app.use('/comments', commentsRouter);
app.use('/carts', cartRouter);
app.use('/uploads', uploadsRouter);
app.use('/privacy-policy', privacyPolicyRouter);
app.use('/terms-of-service', termsOfServiceRouter); // Thêm dòng này
app.use('/data-deletion', dataDeleteRouter);
app.use('/data-deletion-instructions', dataDeletionInstructionsRouter);

//swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

var accessKey = ENV_CONFIG.MOMO_ACCESS_KEY;
var secretKey = ENV_CONFIG.MOMO_SECRET_KEY;
var amount = '50000';
const crypto = require('crypto');
const Order = require('./models/OrderModel');



app.post('/payments', authenticateToken, async (req, res) => {
  // Tạo đối tượng chứa thông tin đơn hàng
  const orderData = {
    userId: req.user.id,
    items: req.body.items,
    totalAmount: req.body.totalAmount,
    status: 'pending',
    paymentMethod: 'momo',
    shippingAddress: req.body.shippingAddress,
    // Thêm các thông tin khác nếu cần
  };

  // Chuyển đổi orderData thành chuỗi JSON
  var extraData = JSON.stringify(orderData);
  console.log(extraData);

  var orderInfo = 'pay with MoMo';
  var partnerCode = 'MOMO';
  var redirectUrl = 'https://seafood-1.firebaseapp.com/product-management';
  var ipnUrl = 'https://9979-2402-800-6349-f38c-4015-6b79-3482-f83e.ngrok-free.app/callback';
  var requestType = "payWithMethod";
  var orderId = partnerCode + new Date().getTime();
  var requestId = orderId;
  var orderGroupId = '';
  var autoCapture = true;
  var lang = 'vi';

  //before sign HMAC SHA256 with format
  //accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
  var rawSignature = "accessKey=" + accessKey + "&amount=" + amount + "&extraData=" + extraData + "&ipnUrl=" + ipnUrl + "&orderId=" + orderId + "&orderInfo=" + orderInfo + "&partnerCode=" + partnerCode + "&redirectUrl=" + redirectUrl + "&requestId=" + requestId + "&requestType=" + requestType;
  //puts raw signature
  console.log("--------------------RAW SIGNATURE----------------")
  console.log(rawSignature)
  //signature
  var signature = crypto.createHmac('sha256', secretKey)
    .update(rawSignature)
    .digest('hex');
  console.log("--------------------SIGNATURE----------------")
  console.log(signature)

  //json object send to MoMo endpoint
  const requestBody = JSON.stringify({
    partnerCode: partnerCode,
    partnerName: "Test",
    storeId: "MomoTestStore",
    requestId: requestId,
    amount: amount,
    orderId: orderId,
    orderInfo: orderInfo,
    redirectUrl: redirectUrl,
    ipnUrl: ipnUrl,
    lang: lang,
    requestType: requestType,
    autoCapture: autoCapture,
    extraData: extraData,
    orderGroupId: orderGroupId,
    signature: signature
  });
  const options = {
    method: 'POST',
    url: 'https://test-payment.momo.vn/v2/gateway/api/create',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody)
    },
    data: requestBody
  }
  let result;
  try {
    result = await axios(options);
    return res.status(200).json(result.data);
  } catch (error) {
    console.log(error);
    return res.status(500).json(error);
  }

});

app.post('/callback', async (req, res) => {
  console.log("--------------------CALLBACK----------------");
  console.log(req.body);
  const { orderId, resultCode, amount, extraData } = req.body;

  if (resultCode === 0) {
    try {
      // Phân tích extraData
      let orderData;
      try {
        orderData = JSON.parse(extraData);
      } catch (error) {
        console.error('Lỗi khi phân tích extraData:', error);
        orderData = {}; // Hoặc xử lý lỗi theo cách khác
      }

      // Tạo đơn hàng mới
      const newOrder = {
        userId: orderData.userId,
        items: orderData.items,
        totalAmount: parseInt(amount),
        status: 'completed',
        paymentMethod: 'momo',
        transactionId: orderId,
        shippingAddress: orderData.shippingAddress,
      };

      const newOrderId = await orderDAO.add(newOrder);

      // Cập nhật thông tin người dùng (ví dụ: cộng điểm thưởng)
      if (orderData.userId) {
        await userDAO.updateRewardPoints(orderData.userId, Math.floor(parseInt(amount) / 1000));
      }

      res.status(200).json({ message: 'Thanh toán thành công', orderId: newOrderId });
    } catch (error) {
      console.error('Lỗi khi xử lý callback:', error);
      res.status(500).json({ message: 'Đã xảy ra lỗi khi xử lý thanh toán' });
    }
  } else {
    res.status(400).json({ message: 'Thanh toán không thành công' });
  }
});

app.post('/transaction-status', async (req, res) => {
  console.log("--------------------TRANSACTION----------------");
  const { orderId } = req.body;
  const rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=MOMO&requestId=${orderId}`;
  const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
  const requestBody = JSON.stringify({
    partnerCode: 'MOMO',
    accessKey: accessKey,
    requestId: orderId,
    orderId: orderId,
    signature: signature,
    lang: 'vi'
  });
  const options = {
    method: 'POST',
    url: 'https://test-payment.momo.vn/v2/gateway/api/query',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody)
    },
    data: requestBody
  }
  let result;
  try {
    result = await axios(options);
    return res.status(200).json(result.data);
  } catch (error) {
    console.log(error);
    return res.status(500).json(error);
  }
});


// Xử lý lỗi 404
app.use(function (req, res, next) {
  res.status(404).json({ message: 'Không tìm thấy trang' });
});

// Xử lý các lỗi khác
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Đã xảy ra lỗi server',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

app.use(passport.initialize());
app.use(passport.session());

// Cấu hình Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://www.youtube.com/watch?v=RH2yzOZVvdE&t=6039s"
},
  async function (accessToken, refreshToken, profile, done) {
    try {
      // Tìm user trong cơ sở dữ liệu
      let user = await userDAO.getByGoogleId(profile.id);

      if (!user) {
        // Nếu user chưa tồn tại, tạo mới
        const newUserId = await userDAO.add({
          googleId: profile.id,
          email: profile.emails[0].value,
          fullName: profile.displayName,
          // Không cần thêm mật khẩu ở đây
        });
        user = await userDAO.getById(newUserId);
      }

      return done(null, user);
    } catch (error) {
      console.error("Lỗi trong quá trình xác thực Google:", error);
      return done(error, null);
    }
  }));

// Cấu hình Facebook Strategy
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: "/users/auth/facebook/callback",
  profileFields: ['id', 'emails', 'name']
},
  async (accessToken, refreshToken, profile, done) => {
    // Xử lý thông tin người dùng từ Facebook
    try {
      let user = await userDAO.getByEmail(profile.emails[0].value);
      if (!user) {
        // Tạo người dùng mới nếu chưa tồn tại
        const userId = await userDAO.add({
          email: profile.emails[0].value,
          name: `${profile.name.givenName} ${profile.name.familyName}`,
          // Các thông tin khác từ profile
        });
        user = await userDAO.getById(userId);
      }
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }));

// Cấu hình serializeUser và deserializeUser
const User = require('./models/UserModel'); // Đảm bảo đường dẫn đến model User là chính xác

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      done(err, null);
    });
});

module.exports = app;