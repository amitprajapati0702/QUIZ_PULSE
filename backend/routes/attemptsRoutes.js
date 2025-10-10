const express = require('express');
const router = express.Router();
const attemptsController = require('../controllers/attemptsController');

router.post('/start/:quizId', attemptsController.start);
router.post('/:attemptId/violation', attemptsController.violation);
router.post('/:attemptId/forfeit', attemptsController.forfeit);
router.post('/:attemptId/submit', attemptsController.submit);
router.get('/:attemptId', attemptsController.getAttempt);

router.get('/', attemptsController.analytics); // GET /api/attempts -> analytics (for current user)
router.delete('/', attemptsController.deleteAnalytics);

module.exports = router;
