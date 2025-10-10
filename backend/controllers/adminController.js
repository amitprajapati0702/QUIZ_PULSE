const Quiz = require('../models/quiz');
const QuizAttempt = require('../models/QuizAttempt');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const xlsx = require('xlsx');

exports.listQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find().lean();
    res.json(quizzes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createQuiz = async (req, res) => {
  try {
    const { title, language, durationSeconds, questions } = req.body;
    if (!title || !language || !Array.isArray(questions) || questions.length === 0) return res.status(400).json({ message: 'Invalid payload' });
    const quiz = await Quiz.create({ title, language, durationSeconds: durationSeconds || 1200, questions });
    res.status(201).json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteQuiz = async (req, res) => {
  try {
    const id = req.params.quizId;
    const q = await Quiz.findByIdAndDelete(id);
    if (!q) return res.status(404).json({ message: 'Quiz not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Return attempts (optionally filtered) and CSV export
exports.listAttempts = async (req, res) => {
  try {
    const filter = {};
    if (req.query.quizId) filter.quizId = req.query.quizId;
    const attempts = await QuizAttempt.find(filter).populate('quizId', 'title language').lean();
    res.json(attempts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.downloadAttemptsCSV = async (req, res) => {
  try {
    const filter = {};
    if (req.query.quizId) filter.quizId = req.query.quizId;
    const attempts = await QuizAttempt.find(filter).populate('quizId', 'title language').lean();

    const rows = attempts.map(a => ({
      attemptId: a._id,
      userId: a.userId,
      quizId: a.quizId? a.quizId._id : '',
      quizTitle: a.quizId? a.quizId.title : '',
      language: a.quizId? a.quizId.language : '',
      score: a.score || 0,
      status: a.status || '',
      startAt: a.startAt ? new Date(a.startAt).toISOString() : '',
      endAt: a.endAt ? new Date(a.endAt).toISOString() : '',
      violations: a.violations || 0
    }));

    const parser = new Parser();
    const csvOut = parser.parse(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attempts.csv"');
    res.send(csvOut);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update quiz fields (title, language, durationSeconds)
exports.updateQuiz = async (req, res) => {
  try {
    const id = req.params.quizId;
    const allowed = {};
    if (req.body.title) allowed.title = req.body.title;
    if (req.body.language) allowed.language = req.body.language;
    if (req.body.durationSeconds !== undefined) allowed.durationSeconds = Number(req.body.durationSeconds) || 0;
    if (Object.keys(allowed).length === 0) return res.status(400).json({ message: 'No updatable fields provided' });
    const updated = await Quiz.findByIdAndUpdate(id, { $set: allowed }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Quiz not found' });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a single quiz by id
exports.getQuizById = async (req, res) => {
  try {
    const id = req.params.quizId;
    const quiz = await Quiz.findById(id).lean();
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    res.json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Upload a CSV or XLSX file containing quiz questions and save as a Quiz document
exports.uploadQuizFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    let rows = [];

    const parseCsvFile = () => new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', data => results.push(data))
        .on('end', () => resolve(results))
        .on('error', err => reject(err));
    });

    if (ext === '.csv' || (req.file.mimetype && req.file.mimetype === 'text/csv')) {
      rows = await parseCsvFile();
    } else if (ext === '.xlsx' || ext === '.xls' || (req.file.mimetype && req.file.mimetype.includes('sheet'))) {
      const wb = xlsx.readFile(req.file.path);
      const first = wb.SheetNames[0];
      rows = xlsx.utils.sheet_to_json(wb.Sheets[first]);
    } else {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({ message: 'Unsupported file type. Upload CSV or XLSX.' });
    }

    // Map rows to questions. Support multiple formats:
    // 1) single 'options' column with separators (||, ;, |, ,)
    // 2) separate option columns (option1, option2, a, b, c, etc.)
    // correct can be index, option text, or letter (A/B/C)
    const questions = (rows || []).map((r) => {
      const keys = Object.keys(r || {}).reduce((acc, k) => { acc[k.trim().toLowerCase()] = r[k]; return acc; }, {});
      const rawQ = keys['question'] || keys['questiontext'] || keys['q'] || keys['question_text'] || keys['question text'] || '';
      const rawOptions = keys['options'] || keys['opts'] || keys['choices'] || keys['option'] || keys['o'] || '';
      const rawCorrect = keys['correct'] || keys['answer'] || keys['a'] || keys['correctindex'] || '';

      // Build options array
      let opts = [];
      if (Array.isArray(rawOptions)) opts = rawOptions;
      else if (typeof rawOptions === 'string' && rawOptions.trim() !== '') {
        if (rawOptions.includes('||')) opts = rawOptions.split('||').map(s => s.trim());
        else if (rawOptions.includes(';')) opts = rawOptions.split(';').map(s => s.trim());
        else if (rawOptions.includes('|')) opts = rawOptions.split('|').map(s => s.trim());
        else opts = rawOptions.split(',').map(s => s.trim()).filter(Boolean);
      }

      // If no single options column, try to collect option-like columns
      if (opts.length === 0) {
        const optionCandidates = [];
        for (const k of Object.keys(keys)) {
          if (['question','questiontext','q','question_text','question text','correct','answer','a','correctindex','id','explanation'].includes(k)) continue;
          const val = keys[k];
          if (val === undefined || val === null) continue;
          const str = String(val).trim();
          if (!str) continue;
          // heuristics: column names that contain 'opt'/'choice'/'option' or are single letters (a,b,c,d) or end with a digit
          if (/opt|choice|option/i.test(k) || /^[abcd]$/.test(k) || /\d$/.test(k) || k.length <= 3) {
            optionCandidates.push(str);
          }
        }
        if (optionCandidates.length >= 2) opts = optionCandidates;
      }

      // Determine correctIndex
      let correctIndex = -1;
      if (rawCorrect === undefined || rawCorrect === null || rawCorrect === '') {
        correctIndex = -1;
      } else {
        const rc = String(rawCorrect).trim();
        // letter like A,B,C
        if (/^[A-D]$/i.test(rc)) {
          correctIndex = rc.toUpperCase().charCodeAt(0) - 65;
        } else if (!isNaN(Number(rc))) {
          correctIndex = Number(rc);
        } else {
          // find by text match
          const idxMatch = opts.findIndex(o => String(o).toLowerCase() === rc.toLowerCase());
          correctIndex = idxMatch;
        }
      }

      return { questionText: String(rawQ || '').trim(), options: opts, correctIndex };
    }).filter(q => q.questionText && Array.isArray(q.options) && q.options.length >= 2 && q.correctIndex >= 0);

    try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }

    if (!questions || questions.length === 0) {
      // give a helpful preview for debugging
      const preview = (rows && rows.length > 0) ? rows.slice(0,3) : [];
      return res.status(400).json({ message: 'No valid questions parsed from file', preview });
    }

    const title = req.body.title || req.query.title || `Imported Quiz ${Date.now()}`;
    const language = req.body.language || req.query.language || 'Imported';
    const durationSeconds = Number(req.body.durationSeconds || req.query.durationSeconds || 1200);

    const quizData = { title, language, durationSeconds, questions };
    const quiz = new Quiz(quizData);
    try {
      await quiz.save();
    } catch (err) {
      if (err && err.name === 'ValidationError') {
        await quiz.save({ validateBeforeSave: false });
      } else throw err;
    }

    res.status(201).json({ message: 'Quiz imported', quizId: quiz._id, questionCount: questions.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
