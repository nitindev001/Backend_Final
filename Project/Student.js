const mongoose = require("mongoose");

// Define the structure of a student
const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  age: {
    type: Number,
    required: true
  },

  course: {
    type: String,
    required: true
  }
});

// Create a model using the schema
const Student = mongoose.model("Student", studentSchema);
//means we are creating a Mongoose model named Student using the structure defined in studentSchema.

module.exports = Student;
