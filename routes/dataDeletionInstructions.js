const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('dataDeletionInstructions', { title: 'Data Deletion Instructions' });
});

module.exports = router;
