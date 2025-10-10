const express = require('express');
const router = express.Router();
const quizzesController = require('../controllers/quizzesController');

router.get('/', quizzesController.list);
router.get('/:quizId', quizzesController.getById);
router.post('/create-sample', quizzesController.createSample);

module.exports = router;
