const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  questionText: String,
  options: [String],
  correctIndex: Number
});

const AttemptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz" },
  // snapshot of questions used for this attempt (so grading is deterministic)
  questions: { type: [QuestionSchema], default: [] },
  startAt: Date,
  endAt: Date,
  answers: [{ questionIndex: Number, selectedIndex: Number, submittedAt: Date }],
  score: { type: Number, default: 0 },
  status: { type: String, default: "in_progress" }, // in_progress | completed | forfeited
  violations: { type: Number, default: 0 }
});

module.exports = mongoose.model("QuizAttempt", AttemptSchema);
