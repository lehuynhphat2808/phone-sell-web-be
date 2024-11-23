const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('termsOfService', { title: 'Terms of Service' });
});

module.exports = router;
