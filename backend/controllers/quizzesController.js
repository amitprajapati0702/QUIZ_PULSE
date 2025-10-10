const Quiz = require('../models/quiz');

exports.list = async (req, res) => {
  try {
    const quizzes = await Quiz.find().select('title language durationSeconds questions');
    res.json(quizzes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createSample = async (req, res) => {
  try {
    const pool = {
      "JavaScript": [
        { q: "Which keyword declares a block-scoped variable in ES6?", o:["var","let","const (function-scoped)","function"], a:1 },
        { q: "Which operator checks both value and type equality?", o:["=","==","===","!=="], a:2 },
        { q: "What is the output of `typeof NaN`?", o:["'number'","'NaN'","'undefined'","'object'"], a:0 },
        { q: "Which method adds one or more elements to the end of an array?", o:["shift()","pop()","push()","unshift()"], a:2 },
        { q: "Which function is used to transform each element of an array?", o:["filter()","reduce()","map()","forEach()"], a:2 },
        { q: "Which feature allows functions to capture variables from their lexical scope?", o:["Hoisting","Closure","Prototype","Event Loop"], a:1 },
        { q: "How do you create a resolved Promise?", o:["Promise.resolve()","new Promise()","Promise.create()","Promise.done()"], a:0 },
        { q: "Which keyword creates a class in ES6?", o:["function","class","struct","object"], a:1 },
        { q: "Which array method returns the first element that satisfies a condition?", o:["find()","filter()","some()","every()"], a:0 },
        { q: "What's the result of `[] + []` in JavaScript?", o:["0","'' (empty string)","[]","[object Object]"], a:1 },
        { q: "Which statement is used to exit a loop immediately?", o:["stop","break","return","exit"], a:1 },
        { q: "In arrow functions, which of the following is true about `this`?", o:["`this` is dynamically bound","`this` is lexically bound","`this` is undefined","`this` is global object"], a:1 },
        { q: "Which global object provides timing-related functions like setTimeout?", o:["Timer","Window","Console","globalThis"], a:3 },
        { q: "Which symbol is used to interpolate expressions in template literals?", o:["${}","#{}","@{}","%{}"], a:0 },
        { q: "Which built-in method converts JSON text to an object?", o:["JSON.toObject()","JSON.parse()","JSON.stringify()","JSON.load()"], a:1 },
        { q: "Which Array method reduces array to a single value?", o:["reduce()","concat()","slice()","splice()"], a:0 },
        { q: "Which data structure allows key-value pairs and preserves insertion order?", o:["Object","Map","Set","Array"], a:1 },
        { q: "Which of the following is true about prototypes?", o:["Every function has a prototype property","Objects don't have prototypes","Prototype is language deprecated","Prototype is same as class"], a:0 },
        { q: "Which will schedule a microtask?", o:["setTimeout","setInterval","Promise.then","requestAnimationFrame"], a:2 },
        { q: "Which keyword prevents extending an object with new properties?", o:["freeze","Object.freeze","preventExtensions","Object.preventExtensions"], a:3 }
      ],
      "Python": [ /* ... same as earlier ... */ ],
      "Java": [ /* ... */ ],
      "C++": [ /* ... */ ],
      "Go": [ /* ... */ ]
    };

    const languages = Object.keys(pool);
    const { lang } = req.query;
    const force = req.query.force === 'true';
    let targetLangs = languages;
    if (lang && typeof lang === 'string') {
      const clean = lang.trim();
      if (clean && clean.toLowerCase() !== 'all') {
        const match = languages.find(l => l.toLowerCase() === clean.toLowerCase());
        if (match) targetLangs = [match];
        else return res.status(400).json({ message: `Unknown language: ${lang}` });
      }
    }
    if (force) { await Quiz.deleteMany({ language: { $in: targetLangs } }); }
    const created = [];
    for (const l of targetLangs) {
      const exists = await Quiz.findOne({ language: l });
      if (exists && !force) { created.push({ skipped: l, reason: 'already exists' }); continue; }
      const questions = (pool[l] || []).slice(0,20).map(item => ({ questionText: item.q, options: item.o, correctIndex: item.a }));
      const quiz = await Quiz.create({ title: `${l} Basics Quiz`, language: l, durationSeconds: 20 * 60, questions });
      created.push(quiz);
    }
    res.json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a single quiz by id (public to authenticated users)
exports.getById = async (req, res) => {
  try {
    const id = req.params.quizId;
    const quiz = await Quiz.findById(id).lean();
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    // Don't expose correctIndex values to the client; send only questionText and options
    const quizSnapshot = {
      _id: quiz._id,
      title: quiz.title,
      language: quiz.language,
      durationSeconds: quiz.durationSeconds,
      questions: (quiz.questions || []).map(q => ({ questionText: q.questionText, options: q.options }))
    };
    res.json(quizSnapshot);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
