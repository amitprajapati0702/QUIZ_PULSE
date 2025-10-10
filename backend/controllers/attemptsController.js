const Quiz = require('../models/quiz');
const QuizAttempt = require('../models/QuizAttempt');

exports.start = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    const pool = quiz.questions.slice();
    const sampleCount = Math.min(20, pool.length);
    const sampled = [];
    while (sampled.length < sampleCount && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      sampled.push(pool.splice(idx, 1)[0]);
    }
    const now = new Date();
    const attempt = await QuizAttempt.create({ userId: req.user.userId, quizId: quiz._id, questions: sampled, startAt: now, endAt: new Date(now.getTime() + quiz.durationSeconds * 1000) });
    const quizSnapshot = { _id: quiz._id, title: quiz.title, language: quiz.language, durationSeconds: quiz.durationSeconds, questions: sampled.map(q => ({ questionText: q.questionText, options: q.options })) };
    res.json({ attemptId: attempt._id, startAt: attempt.startAt, endAt: attempt.endAt, quiz: quizSnapshot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.violation = async (req, res) => {
  try {
    const attempt = await QuizAttempt.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.userId.toString() !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });
    attempt.violations += 1;
    if (attempt.violations >= 3) attempt.status = 'forfeited';
    await attempt.save();
    res.json({ violations: attempt.violations, status: attempt.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submit = async (req, res) => {
  try {
    const { answers } = req.body;
    const attempt = await QuizAttempt.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.userId.toString() !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });
    const now = new Date();
    if (now < attempt.startAt || now > new Date(attempt.endAt.getTime() + 5000)) return res.status(400).json({ message: 'Submission not allowed at this time' });
    attempt.answers = answers.map(a => ({ ...a, submittedAt: new Date() }));
    const quizQuestions = attempt.questions || [];
    let score = 0;
    for (const a of answers) {
      const q = quizQuestions[a.questionIndex];
      if (q && q.correctIndex === a.selectedIndex) score += 1;
    }
    attempt.score = score;
    attempt.status = 'completed';
    await attempt.save();
    res.json({ ok: true, score, total: quizQuestions.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAttempt = async (req, res) => {
  try {
    const attempt = await QuizAttempt.findById(req.params.attemptId).populate('quizId');
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    res.json({ attempt, serverNow: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Forfeit an attempt immediately (used when user leaves the tab or otherwise breaks rules)
exports.forfeit = async (req, res) => {
  try {
    const attempt = await QuizAttempt.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.userId.toString() !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });
    attempt.status = 'forfeited';
    attempt.score = 0;
    await attempt.save();
    res.json({ ok: true, status: attempt.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.analytics = async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({ userId: req.user.userId }).populate('quizId', 'title');
    const totalQuizzes = attempts.length;
    const scored = attempts.filter(a => typeof a.score === 'number');
    const averageScore = scored.length ? (scored.reduce((sum, a) => sum + (a.score || 0), 0) / scored.length) : 0;
    const mapped = attempts.map(a => ({ quizTitle: a.quizId ? a.quizId.title : '(deleted quiz)', score: typeof a.score === 'number' ? a.score : 0, status: a.status, attemptedAt: a.startAt }));
    res.json({ totalQuizzes, averageScore, attempts: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await QuizAttempt.deleteMany({ userId });
    res.json({ ok: true, deleted: result.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
