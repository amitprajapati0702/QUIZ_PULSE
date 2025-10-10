const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  questionText: String,
  options: [String],
  correctIndex: Number
});

const QuizSchema = new mongoose.Schema({
  title: String,
  language: String,          // e.g., "JavaScript", "Python"
  durationSeconds: Number,
  questions: { type: [QuestionSchema], validate: v => v.length >= 20 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Quiz", QuizSchema);
