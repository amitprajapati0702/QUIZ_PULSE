const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.get('/quizzes', adminController.listQuizzes);
router.get('/quizzes/:quizId', adminController.getQuizById);
router.post('/quizzes', adminController.createQuiz);
// Accept file uploads (CSV or XLSX) containing questions
router.post('/quizzes/upload', upload.single('file'), adminController.uploadQuizFile);
router.delete('/quizzes/:quizId', adminController.deleteQuiz);
router.patch('/quizzes/:quizId', adminController.updateQuiz);

router.get('/attempts', adminController.listAttempts);
router.get('/attempts/download', adminController.downloadAttemptsCSV);

module.exports = router;
