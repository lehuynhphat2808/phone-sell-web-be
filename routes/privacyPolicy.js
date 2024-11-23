const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('privacyPolicy', { title: 'Privacy Policy' });
});

module.exports = router;

