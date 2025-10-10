const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);
// avatar upload: POST /avatar (server will mount upload middleware before this router)
router.post('/avatar', profileController.uploadAvatar);

module.exports = router;
